// server/routes/adminImport.js
// Protected Admin Import Staging & Validation Queue API
// Mounted at /api/admin/import

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { parse } = require('csv-parse/sync');
const humanparser = require('humanparser');
const { authenticateToken, authorizeRole } = require('../middleware/authenticateToken');
const {
  CONTRIBUTING_FACTOR_CATALOG,
  CANONICAL_CRIME_CATEGORIES,
  CORE_INFORMATION_SOURCES,
  resolveContributingFactorCodes,
  resolveCrimeCategoryName,
} = require('../utils/canonicalCatalog');

const router = express.Router();
const prisma = new PrismaClient();

// Require ADMIN or EDITOR JWT for all import routes
router.use((req, res, next) =>
  authenticateToken(req, res, () => authorizeRole(['ADMIN', 'EDITOR'])(req, res, next))
);

const VALID_INDIVIDUAL_STATUSES = new Set([
  'EXONERATED',
  'RELEASED_ALFORD_PLEA',
  'RELEASED_CLEMENCY',
  'RELEASED_TIME_SERVED',
  'CONVICTION_OVERTURNED',
  'EXECUTED',
  'CONVICTED',
  'OTHER',
  'UNKNOWN',
]);

const VALID_CLAIM_STRENGTHS = new Set([
  'FORMALLY_EXONERATED',
  'OFFICIAL_RELIEF_NO_EXONERATION',
  'STRONG_NEW_EVIDENCE',
  'CREDIBLE_CLAIM',
  'UNASSESSED',
]);

const VALID_ORG_TYPES = new Set([
  'INNOCENCE_ORG',
  'LEGAL_AID',
  'LAW_FIRM',
  'LAW_ENFORCEMENT',
  'GOVERNMENT_AGENCY',
  'SUPPORT_GROUP',
  'MEDIA_ORG',
  'UNIVERSITY',
  'OTHER',
  'UNKNOWN',
]);

const VALID_VERIFICATION_STATUSES = new Set(['UNVERIFIED', 'IN_REVIEW', 'VERIFIED', 'DISPUTED']);

const VALID_FILM_WORK_TYPES = new Set(['FILM', 'DOCUMENTARY', 'DOCUSERIES', 'TV_SERIES', 'OTHER', 'UNKNOWN']);
const VALID_MEDIA_ITEM_TYPES = new Set([
  'PODCAST_EPISODE', 'TV_EPISODE', 'BOOK_CONTENT', 'FILM_CONTENT',
  'DOCUMENTARY_CONTENT', 'BOOK_CHAPTER', 'ARTICLE', 'ACADEMIC_PAPER', 'OTHER', 'UNKNOWN',
]);
const VALID_STREAMING_TYPES = new Set(['SUBSCRIPTION', 'RENT', 'BUY', 'FREE', 'OTHER', 'UNKNOWN']);

function parseIntOrNull(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseInt(String(val).trim(), 10);
  return Number.isNaN(n) ? null : n;
}

function normStr(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim().toLowerCase();
}

const VALID_SUMMARY_POLICIES = new Set(['SMART', 'FILL_EMPTY', 'OVERWRITE']);

function getSummarySourceTier(sourceHint) {
  const s = normStr(sourceHint);
  if (!s) return 1;
  if (s.includes('national registry') || s.includes('nre')) return 1;
  if (s.includes('wikipedia') || s.includes('wiki')) return 2;
  // Innocence Project, Legal Orgs, Books, Podcasts, Films, Manual editorial bios
  return 3;
}

function hasSpacingGlitch(text) {
  if (!text) return false;
  if (/[a-z][.?!,:;][A-Z]/.test(text)) return true;
  const cleaned = text.replace(/\b(?:Mc|Mac|De|La|Le|Di|Van|Du|St)[A-Z][a-z]+/g, '');
  return /[a-z][A-Z][a-z]/.test(cleaned);
}

/**
 * Decide which narrativeSummary to keep when merging an incoming record onto an existing Individual.
 * Returns { value, replaced }.
 */
function chooseNarrativeSummary(existing, incomingRaw, incomingSourceHint, policy = 'SMART') {
  const cur = (existing?.narrativeSummary || '').trim() || null;
  const inc = (incomingRaw || '').trim() || null;

  if (!inc) return { value: cur, replaced: false };
  if (!cur) return { value: inc, replaced: true };
  if (cur === inc) return { value: cur, replaced: false };

  const safePolicy = VALID_SUMMARY_POLICIES.has(policy) ? policy : 'SMART';
  if (safePolicy === 'FILL_EMPTY') {
    return { value: cur, replaced: false };
  }
  if (safePolicy === 'OVERWRITE') {
    return { value: inc, replaced: true };
  }

  // SMART policy:
  // 1. Protect human-verified summaries from automatic overwrite
  if (existing?.verificationStatus === 'VERIFIED') {
    return { value: cur, replaced: false };
  }

  // 2. Compare source editorial tier
  const existingTier = getSummarySourceTier(existing?.ingestionSource);
  const incomingTier = getSummarySourceTier(incomingSourceHint);

  if (incomingTier > existingTier && inc.length >= 60) {
    return { value: inc, replaced: true };
  }

  // 3. Same tier: upgrade if incoming is meaningfully richer (>= 40% longer) or fixes spacing glitches
  if (incomingTier === existingTier) {
    if (inc.length >= Math.round(cur.length * 1.4)) {
      return { value: inc, replaced: true };
    }
    if (hasSpacingGlitch(cur) && !hasSpacingGlitch(inc)) {
      return { value: inc, replaced: true };
    }
  }

  return { value: cur, replaced: false };
}

const US_STATE_ABBR_TO_NAME = {
  al: 'alabama', ak: 'alaska', az: 'arizona', ar: 'arkansas', ca: 'california',
  co: 'colorado', ct: 'connecticut', de: 'delaware', dc: 'district of columbia',
  fl: 'florida', ga: 'georgia', hi: 'hawaii', id: 'idaho', il: 'illinois',
  in: 'indiana', ia: 'iowa', ks: 'kansas', ky: 'kentucky', la: 'louisiana',
  me: 'maine', md: 'maryland', ma: 'massachusetts', mi: 'michigan', mn: 'minnesota',
  ms: 'mississippi', mo: 'missouri', mt: 'montana', ne: 'nebraska', nv: 'nevada',
  nh: 'new hampshire', nj: 'new jersey', nm: 'new mexico', ny: 'new york',
  nc: 'north carolina', nd: 'north dakota', oh: 'ohio', ok: 'oklahoma', or: 'oregon',
  pa: 'pennsylvania', pr: 'puerto rico', ri: 'rhode island', sc: 'south carolina',
  sd: 'south dakota', tn: 'tennessee', tx: 'texas', ut: 'utah', vt: 'vermont',
  va: 'virginia', wa: 'washington', wv: 'west virginia', wi: 'wisconsin', wy: 'wyoming',
  gu: 'guam',
};

function normBaseState(val) {
  let s = normStr(val);
  if (!s) return '';
  if (s.startsWith('fed-')) s = s.slice(4).trim();
  if (US_STATE_ABBR_TO_NAME[s]) return US_STATE_ABBR_TO_NAME[s];
  return s;
}

function getField(record, candidates) {
  for (const key of candidates) {
    if (record[key] !== undefined && record[key] !== null && String(record[key]).trim() !== '') {
      return String(record[key]).trim();
    }
  }
  // Case-insensitive fallback
  const lowerMap = Object.fromEntries(
    Object.entries(record).map(([k, v]) => [k.toLowerCase().trim(), v])
  );
  for (const key of candidates) {
    const v = lowerMap[key.toLowerCase()];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return String(v).trim();
    }
  }
  return null;
}

function parseLocationString(loc) {
  if (!loc) return { city: null, county: null, state: null };
  const parts = loc.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) return { city: parts[0], county: parts[1], state: parts[2] };
  if (parts.length === 2) return { city: parts[0], county: null, state: parts[1] };
  if (parts.length === 1) return { city: null, county: null, state: parts[0] };
  return { city: null, county: null, state: null };
}

function mapStatusString(raw) {
  if (!raw) return null;
  const upper = raw.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (VALID_INDIVIDUAL_STATUSES.has(upper)) return upper;
  const lower = raw.trim().toLowerCase();
  if (lower === 'yes' || lower.includes('exonerat')) return 'EXONERATED';
  if (lower.includes('alford')) return 'RELEASED_ALFORD_PLEA';
  if (lower.includes('pardon') || lower.includes('clemency') || lower.includes('commut')) return 'RELEASED_CLEMENCY';
  if (lower.includes('time served')) return 'RELEASED_TIME_SERVED';
  if (lower.includes('overturned') || lower.includes('vacated')) return 'CONVICTION_OVERTURNED';
  if (lower.includes('executed')) return 'EXECUTED';
  if (lower.includes('convicted') || lower.includes('incarcerated')) return 'CONVICTED';
  return 'UNKNOWN';
}

function mapOrgTypeString(raw) {
  if (!raw) return 'UNKNOWN';
  const upper = raw.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (VALID_ORG_TYPES.has(upper)) return upper;
  const lower = raw.trim().toLowerCase();
  if (lower.includes('innocence')) return 'INNOCENCE_ORG';
  if (lower.includes('legal aid') || lower.includes('public defender')) return 'LEGAL_AID';
  if (lower.includes('law firm') || lower.includes('llp')) return 'LAW_FIRM';
  if (lower.includes('police') || lower.includes('sheriff') || lower.includes('district attorney') || lower.includes('prosecut')) return 'LAW_ENFORCEMENT';
  if (lower.includes('university') || lower.includes('college') || lower.includes('school of law')) return 'UNIVERSITY';
  if (lower.includes('support') || lower.includes('reentry')) return 'SUPPORT_GROUP';
  if (lower.includes('media') || lower.includes('news') || lower.includes('podcast') || lower.includes('film')) return 'MEDIA_ORG';
  if (lower.includes('government') || lower.includes('department of') || lower.includes('commission')) return 'GOVERNMENT_AGENCY';
  return 'OTHER';
}

function parseNameFields(record) {
  let firstName = getField(record, ['firstName', 'first_name', 'First Name']);
  let middleName = getField(record, ['middleName', 'middle_name', 'Middle Name']);
  let lastName = getField(record, ['lastName', 'last_name', 'Last Name']);
  let suffix = getField(record, ['suffix', 'Suffix']);
  let nickname = getField(record, ['nickname', 'Nickname']);

  if (!firstName || !lastName) {
    const fullName = getField(record, ['Name', 'fullName', 'full_name', 'IndividualName', 'Individual']);
    if (fullName) {
      let cleaned = fullName;
      const nickMatch = cleaned.match(/"([^"]+)"/);
      if (nickMatch) {
        if (!nickname) nickname = nickMatch[1].trim();
        cleaned = cleaned.replace(/"[^"]+"/, ' ').replace(/\s+/g, ' ').trim();
      }
      const parsed = humanparser.parseName(cleaned);
      if (!firstName && parsed.firstName) firstName = parsed.firstName.trim();
      if (!middleName && parsed.middleName) middleName = parsed.middleName.trim();
      if (!lastName && parsed.lastName) lastName = parsed.lastName.trim();
      if (!suffix && parsed.suffix) suffix = parsed.suffix.trim();
    }
  }
  return { firstName, middleName, lastName, suffix, nickname };
}

// --- 1. Core Lookup Tables Status & One-Click Seed ---

router.get('/core-status', async (req, res) => {
  try {
    const [contributingFactors, crimeCategories, informationSources] = await Promise.all([
      prisma.contributingFactor.count(),
      prisma.crimeCategory.count(),
      prisma.informationSource.findMany({ orderBy: { name: 'asc' } }),
    ]);

    res.json({
      contributingFactors: {
        count: contributingFactors,
        expected: CONTRIBUTING_FACTOR_CATALOG.length,
        ready: contributingFactors >= CONTRIBUTING_FACTOR_CATALOG.length,
      },
      crimeCategories: {
        count: crimeCategories,
        expected: CANONICAL_CRIME_CATEGORIES.length,
        ready: crimeCategories >= CANONICAL_CRIME_CATEGORIES.length,
      },
      informationSources: {
        count: informationSources.length,
        expected: CORE_INFORMATION_SOURCES.length,
        ready: informationSources.length >= CORE_INFORMATION_SOURCES.length,
        items: informationSources,
      },
    });
  } catch (error) {
    console.error('Error fetching core lookup status:', error);
    res.status(500).json({ message: 'Failed to check core lookup status.', error: error.message });
  }
});

router.post('/seed-core', async (req, res) => {
  try {
    let factorsUpserted = 0;
    for (const factor of CONTRIBUTING_FACTOR_CATALOG) {
      await prisma.contributingFactor.upsert({
        where: { code: factor.code },
        update: {
          name: factor.name,
          description: factor.description,
          aiGenerated: false,
          verificationStatus: 'VERIFIED',
        },
        create: {
          code: factor.code,
          name: factor.name,
          description: factor.description,
          aiGenerated: false,
          verificationStatus: 'VERIFIED',
          ingestionSource: 'admin_seed_core',
        },
      });
      factorsUpserted++;
    }

    let crimesUpserted = 0;
    for (const crime of CANONICAL_CRIME_CATEGORIES) {
      await prisma.crimeCategory.upsert({
        where: { crime_name: crime.crime_name },
        update: { severity_order: crime.severity_order },
        create: {
          crime_name: crime.crime_name,
          severity_order: crime.severity_order,
        },
      });
      crimesUpserted++;
    }

    let sourcesUpserted = 0;
    for (const source of CORE_INFORMATION_SOURCES) {
      await prisma.informationSource.upsert({
        where: { name: source.name },
        update: { baseUrl: source.baseUrl },
        create: {
          name: source.name,
          baseUrl: source.baseUrl,
        },
      });
      sourcesUpserted++;
    }

    res.json({
      message: 'Core reference tables initialized successfully.',
      factorsUpserted,
      crimesUpserted,
      sourcesUpserted,
    });
  } catch (error) {
    console.error('Error seeding core lookup tables:', error);
    res.status(500).json({ message: 'Failed to initialize core lookup tables.', error: error.message });
  }
});

// --- 2. Preview & Validate Import Batch (Zero DB Writes) ---

router.post('/preview', async (req, res) => {
  const {
    targetType = 'INDIVIDUAL',
    inputType = 'CSV',
    rawText = '',
    defaultSourceName = '',
    defaultSourceUrl = '',
    defaultStatus = '',
    defaultClaimStrength = 'UNASSESSED',
  } = req.body || {};

  if (!rawText || !rawText.trim()) {
    return res.status(400).json({ message: 'Please provide CSV or JSON content to preview.' });
  }

  let rawRecords = [];
  try {
    if (inputType.toUpperCase() === 'JSON') {
      const parsed = JSON.parse(rawText);
      rawRecords = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.records)
          ? parsed.records
          : [parsed];
    } else {
      rawRecords = parse(rawText, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
        relax_column_count: true,
      });
    }
  } catch (parseErr) {
    return res.status(400).json({
      message: `Failed to parse ${inputType} input: ${parseErr.message}`,
    });
  }

  if (rawRecords.length === 0) {
    return res.status(400).json({ message: 'No rows found in uploaded data.' });
  }

  const batchId = `import_${targetType.toLowerCase()}_${Date.now()}`;

  try {
    if (targetType === 'BOOK_BUNDLE') {
      const existingBooks = await prisma.mediaWork.findMany({
        where: { workType: 'BOOK' },
        select: { id: true, title: true, externalId: true, verificationStatus: true },
      });
      const byTitle = new Map(existingBooks.map((b) => [normStr(b.title), b]));
      const byIsbn = new Map(
        existingBooks.filter((b) => b.externalId).map((b) => [normStr(b.externalId), b])
      );

      const previewRows = rawRecords.map((rec, idx) => {
        const mw = rec.mediaWork || rec.media_work || {};
        const mi = rec.mediaItem || rec.media_item || {};
        const bpd = rec.bookPurchaseDetails || null;
        const featuredIndividuals = rec.featuredIndividuals || rec.featured_individuals || [];
        const involvedPersons = rec.involvedPersons || rec.involved_persons || [];
        const title = (mw.title || '').trim();
        const externalId = mw.externalId ? String(mw.externalId).trim() : null;
        const warnings = Array.isArray(rec.reviewWarnings) ? [...rec.reviewWarnings] : [];

        let matchStatus = 'NEW';
        let existingMatch = null;
        let action = 'CREATE';

        if (!title) {
          matchStatus = 'INVALID';
          action = 'SKIP';
          warnings.push('Missing book title.');
        } else {
          const exact =
            (externalId && byIsbn.get(normStr(externalId))) || byTitle.get(normStr(title)) || null;
          if (exact) {
            matchStatus = 'EXACT_MATCH';
            existingMatch = exact;
            action = 'MERGE';
          }
        }

        return {
          rowIndex: idx + 1,
          matchStatus,
          action,
          existingMatch,
          warnings,
          data: {
            sourceFileName: rec.sourceFileName || null,
            mediaWork: {
              ...mw,
              title,
              workType: 'BOOK',
              externalId,
            },
            bookPurchaseDetails: bpd,
            mediaItem: {
              ...mi,
              itemTitle: mi.itemTitle || `Book Content: ${title}`,
              itemMediaType: 'BOOK_CONTENT',
            },
            featuredIndividuals,
            involvedPersons,
          },
        };
      });

      const summary = {
        total: previewRows.length,
        new: previewRows.filter((r) => r.matchStatus === 'NEW').length,
        exactMatch: previewRows.filter((r) => r.matchStatus === 'EXACT_MATCH').length,
        fuzzyDuplicate: 0,
        invalid: previewRows.filter((r) => r.matchStatus === 'INVALID').length,
      };

      return res.json({ batchId, targetType: 'BOOK_BUNDLE', summary, rows: previewRows });
    }

    if (targetType === 'FILM_BUNDLE') {
      const existingWorks = await prisma.mediaWork.findMany({
        where: { workType: { in: ['FILM', 'DOCUMENTARY', 'DOCUSERIES', 'TV_SERIES'] } },
        select: { id: true, title: true, workType: true, externalId: true, verificationStatus: true },
      });
      const byTitle = new Map(existingWorks.map((w) => [normStr(w.title), w]));
      const byTmdbId = new Map(
        existingWorks.filter((w) => w.externalId).map((w) => [normStr(w.externalId), w])
      );

      const previewRows = rawRecords.map((rec, idx) => {
        const mw = rec.mediaWork || rec.media_work || {};
        const streamingProviders = Array.isArray(rec.streamingProviders) ? rec.streamingProviders : [];
        const mediaItems = Array.isArray(rec.mediaItems)
          ? rec.mediaItems
          : rec.mediaItem
            ? [rec.mediaItem]
            : [];
        const title = (mw.title || '').trim();
        const externalId = mw.externalId ? String(mw.externalId).trim() : null;
        const workType = VALID_FILM_WORK_TYPES.has((mw.workType || '').toUpperCase())
          ? mw.workType.toUpperCase()
          : 'DOCUMENTARY';
        const warnings = Array.isArray(rec.reviewWarnings) ? [...rec.reviewWarnings] : [];

        let matchStatus = 'NEW';
        let existingMatch = null;
        let action = rec.recommendedAction === 'SKIP' ? 'SKIP' : 'CREATE';

        if (!title) {
          matchStatus = 'INVALID';
          action = 'SKIP';
          warnings.push('Missing film/series title.');
        } else {
          const exact =
            (externalId && byTmdbId.get(normStr(externalId))) || byTitle.get(normStr(title)) || null;
          if (exact) {
            matchStatus = 'EXACT_MATCH';
            existingMatch = exact;
            action = rec.recommendedAction === 'SKIP' ? 'SKIP' : 'MERGE';
          }
        }

        // Aggregate summary counts for preview display
        const allFactorCodes = new Set();
        let totalInds = 0;
        let totalOips = 0;
        for (const it of mediaItems) {
          (it.contributingFactorCodes || []).forEach((c) => allFactorCodes.add(c));
          totalInds += (it.featuredIndividuals || []).length;
          totalOips += (it.involvedPersons || []).length;
        }

        return {
          rowIndex: idx + 1,
          matchStatus,
          action,
          existingMatch,
          warnings,
          data: {
            sourceFiles: rec.sourceFiles || [],
            sourceType: rec.sourceType || null,
            mediaWork: {
              ...mw,
              title,
              workType,
              externalId,
            },
            streamingProviders,
            mediaItems,
            _previewStats: {
              episodeCount: mediaItems.length,
              streamingCount: streamingProviders.length,
              individualCount: totalInds,
              involvedPersonCount: totalOips,
              contributingFactorCodes: Array.from(allFactorCodes),
            },
          },
        };
      });

      const summary = {
        total: previewRows.length,
        new: previewRows.filter((r) => r.matchStatus === 'NEW').length,
        exactMatch: previewRows.filter((r) => r.matchStatus === 'EXACT_MATCH').length,
        fuzzyDuplicate: 0,
        invalid: previewRows.filter((r) => r.matchStatus === 'INVALID').length,
      };

      return res.json({ batchId, targetType: 'FILM_BUNDLE', summary, rows: previewRows });
    }

    if (targetType === 'PODCAST_SERIES_BUNDLE') {
      const existingPodcasts = await prisma.mediaWork.findMany({
        where: { workType: 'PODCAST_SERIES' },
        select: { id: true, title: true, externalId: true, verificationStatus: true },
      });
      const byTitle = new Map(existingPodcasts.map((w) => [normStr(w.title), w]));
      const byExtId = new Map(
        existingPodcasts.filter((w) => w.externalId).map((w) => [normStr(w.externalId), w])
      );

      const previewRows = rawRecords.map((rec, idx) => {
        const mw = rec.mediaWork || rec.media_work || rec || {};
        const podcastMeta = rec.podcastMeta || {};
        const title = (mw.title || '').trim();
        const externalId = mw.externalId ? String(mw.externalId).trim() : null;
        const warnings = Array.isArray(rec.reviewWarnings) ? [...rec.reviewWarnings] : [];

        let matchStatus = 'NEW';
        let existingMatch = null;
        let action = rec.recommendedAction === 'SKIP' ? 'SKIP' : 'CREATE';

        if (!title) {
          matchStatus = 'INVALID';
          action = 'SKIP';
          warnings.push('Missing podcast series title.');
        } else {
          const exact =
            (externalId && byExtId.get(normStr(externalId))) || byTitle.get(normStr(title)) || null;
          if (exact) {
            matchStatus = 'EXACT_MATCH';
            existingMatch = exact;
            action = rec.recommendedAction === 'SKIP' ? 'SKIP' : 'MERGE';
          }
        }

        return {
          rowIndex: idx + 1,
          matchStatus,
          action,
          existingMatch,
          warnings,
          data: {
            sourceFiles: rec.sourceFiles || [],
            category: rec.category || null,
            podcastMeta,
            mediaWork: {
              ...mw,
              title,
              workType: 'PODCAST_SERIES',
              externalId,
            },
          },
        };
      });

      const summary = {
        total: previewRows.length,
        new: previewRows.filter((r) => r.matchStatus === 'NEW').length,
        exactMatch: previewRows.filter((r) => r.matchStatus === 'EXACT_MATCH').length,
        fuzzyDuplicate: 0,
        invalid: previewRows.filter((r) => r.matchStatus === 'INVALID').length,
      };

      return res.json({ batchId, targetType: 'PODCAST_SERIES_BUNDLE', summary, rows: previewRows });
    }

    if (targetType === 'GROUPS_AND_LINKS') {
      const bundleObj = Array.isArray(rawRecords) && rawRecords.length === 1 ? rawRecords[0] : rawRecords;
      const groupsIn = Array.isArray(bundleObj?.groups) ? bundleObj.groups : [];
      const relsIn = Array.isArray(bundleObj?.relationships) ? bundleObj.relationships : [];

      const [existingGroups, existingIndividuals] = await Promise.all([
        prisma.individualGroup.findMany({ select: { id: true, name: true } }),
        prisma.individual.findMany({
          select: { id: true, firstName: true, middleName: true, lastName: true, nickname: true },
        }),
      ]);

      const groupByName = new Map(existingGroups.map((g) => [normStr(g.name), g]));
      const indByFL = new Map();
      for (const ind of existingIndividuals) {
        const k = `${normStr(ind.firstName)}|${normStr(ind.lastName)}`;
        if (!indByFL.has(k)) indByFL.set(k, ind);
        if (ind.nickname) {
          const kn = `${normStr(ind.nickname)}|${normStr(ind.lastName)}`;
          if (!indByFL.has(kn)) indByFL.set(kn, ind);
        }
      }

      const resolveMembers = (members) => {
        const matched = [];
        const missing = [];
        const seenIds = new Set();
        for (const m of members || []) {
          const k = `${normStr(m.firstName)}|${normStr(m.lastName)}`;
          const found = indByFL.get(k) || (m.nickname ? indByFL.get(`${normStr(m.nickname)}|${normStr(m.lastName)}`) : null);
          if (found) {
            if (!seenIds.has(found.id)) {
              seenIds.add(found.id);
              matched.push({ id: found.id, name: `${found.firstName} ${found.lastName}` });
            }
          } else {
            missing.push(m.fullName || `${m.firstName || ''} ${m.lastName || ''}`.trim());
          }
        }
        return { matched, missing };
      };

      const previewRows = [];
      let rowIdx = 1;

      for (const g of groupsIn) {
        const { matched, missing } = resolveMembers(g.members);
        const existingMatch = groupByName.get(normStr(g.name)) || null;
        const warnings = [];
        if (missing.length > 0) {
          warnings.push(`${missing.length} member(s) not yet in DB (will be skipped until added): ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? '…' : ''}`);
        }
        if (matched.length === 0) {
          warnings.push('No members currently exist in DB — import Individuals first or stage group shell.');
        }

        previewRows.push({
          rowIndex: rowIdx++,
          matchStatus: existingMatch ? 'EXACT_MATCH' : 'NEW',
          action: existingMatch ? 'MERGE' : 'CREATE',
          existingMatch,
          warnings,
          data: {
            kind: 'GROUP',
            name: g.name,
            description: g.description || null,
            linkCoDefendants: Boolean(g.linkCoDefendants),
            matchedMembers: matched,
            missingMembers: missing,
          },
        });
      }

      for (const rel of relsIn) {
        const { matched, missing } = resolveMembers(rel.members);
        const warnings = [];
        if (missing.length > 0) {
          warnings.push(`Missing from DB: ${missing.join(', ')}`);
        }
        if (matched.length < 2) {
          warnings.push('Fewer than 2 matched members in DB — skipping co-defendant link.');
        }

        previewRows.push({
          rowIndex: rowIdx++,
          matchStatus: matched.length >= 2 ? 'NEW' : 'INVALID',
          action: matched.length >= 2 ? 'CREATE' : 'SKIP',
          existingMatch: null,
          warnings,
          data: {
            kind: 'RELATIONSHIP',
            label: rel.label,
            matchedMembers: matched,
            missingMembers: missing,
          },
        });
      }

      const summary = {
        total: previewRows.length,
        new: previewRows.filter((r) => r.matchStatus === 'NEW').length,
        exactMatch: previewRows.filter((r) => r.matchStatus === 'EXACT_MATCH').length,
        fuzzyDuplicate: 0,
        invalid: previewRows.filter((r) => r.matchStatus === 'INVALID').length,
      };

      return res.json({ batchId, targetType: 'GROUPS_AND_LINKS', summary, rows: previewRows });
    }

    if (targetType === 'ORGANIZATION') {
      const existingOrgs = await prisma.organization.findMany({
        select: { id: true, name: true, type: true, locationState: true, verificationStatus: true },
      });

      const byExactName = new Map(existingOrgs.map((o) => [normStr(o.name), o]));

      const previewRows = rawRecords.map((rec, idx) => {
        const name = getField(rec, ['name', 'Name', 'Organization', 'organizationName']);
        const rawType = getField(rec, ['type', 'Type', 'organizationType']);
        const type = mapOrgTypeString(rawType);
        const locationCity = getField(rec, ['locationCity', 'city', 'City']);
        const locationState = getField(rec, ['locationState', 'state', 'State']);
        const locationCountry = getField(rec, ['locationCountry', 'country', 'Country']) || 'USA';
        const website = getField(rec, ['website', 'Website', 'url', 'URL', 'Link']);
        const notes = getField(rec, ['notes', 'Notes', 'description', 'Description', 'mission', 'Mission']);

        const warnings = [];
        let matchStatus = 'NEW';
        let existingMatch = null;
        let action = 'CREATE';

        if (!name) {
          matchStatus = 'INVALID';
          action = 'SKIP';
          warnings.push('Missing required organization name.');
        } else {
          const exact = byExactName.get(normStr(name));
          if (exact) {
            matchStatus = 'EXACT_MATCH';
            existingMatch = exact;
            action = 'MERGE';
          } else {
            const lower = normStr(name);
            const fuzzy = existingOrgs.find(
              (o) =>
                (lower.length >= 5 && normStr(o.name).includes(lower)) ||
                (normStr(o.name).length >= 5 && lower.includes(normStr(o.name)))
            );
            if (fuzzy) {
              matchStatus = 'FUZZY_DUPLICATE';
              existingMatch = fuzzy;
              action = 'SKIP';
              warnings.push(`Similar existing organization found: "${fuzzy.name}" (ID #${fuzzy.id}).`);
            }
          }
        }

        if (!website) warnings.push('No website/source URL provided.');

        return {
          rowIndex: idx + 1,
          matchStatus,
          action,
          existingMatch,
          warnings,
          data: {
            name: name || '',
            type,
            locationCity,
            locationState,
            locationCountry,
            website,
            notes,
          },
        };
      });

      const summary = {
        total: previewRows.length,
        new: previewRows.filter((r) => r.matchStatus === 'NEW').length,
        exactMatch: previewRows.filter((r) => r.matchStatus === 'EXACT_MATCH').length,
        fuzzyDuplicate: previewRows.filter((r) => r.matchStatus === 'FUZZY_DUPLICATE').length,
        invalid: previewRows.filter((r) => r.matchStatus === 'INVALID').length,
      };

      return res.json({ batchId, targetType, summary, rows: previewRows });
    }

    // Default: INDIVIDUAL preview
    const [existingIndividuals, existingSourceLinks] = await Promise.all([
      prisma.individual.findMany({
        select: {
          id: true,
          firstName: true,
          middleName: true,
          lastName: true,
          suffix: true,
          disambiguationTag: true,
          caseLocationState: true,
          convictionYear: true,
          exonerationOrReleaseYear: true,
          verificationStatus: true,
        },
      }),
      prisma.individualSourceLink.findMany({
        select: { individualId: true, specificUrl: true },
      }),
    ]);

    const exactKey = (i) =>
      [
        normStr(i.firstName),
        normStr(i.middleName),
        normStr(i.lastName),
        normStr(i.suffix),
        normStr(i.disambiguationTag),
      ].join('|');

    const byId = new Map(existingIndividuals.map((i) => [i.id, i]));
    // Track how many distinct individuals share each URL so shared list/article URLs
    // (e.g. Wikipedia's list page or multi-defendant news articles) never trigger false URL matches
    const urlOwners = new Map();
    for (const sl of existingSourceLinks) {
      if (sl.specificUrl && byId.has(sl.individualId)) {
        const uKey = normStr(sl.specificUrl);
        if (!urlOwners.has(uKey)) urlOwners.set(uKey, new Set());
        urlOwners.get(uKey).add(sl.individualId);
      }
    }
    const isSharedListUrl = (u) =>
      /wikipedia\.org\/wiki\/list_of_wrongful_convictions/i.test(u || '');
    const bySourceUrl = new Map();
    for (const [uKey, ownerIds] of urlOwners.entries()) {
      if (ownerIds.size === 1 && !isSharedListUrl(uKey)) {
        const onlyId = Array.from(ownerIds)[0];
        bySourceUrl.set(uKey, byId.get(onlyId));
      }
    }

    const byExact = new Map();
    const byLastName = new Map();
    for (const ind of existingIndividuals) {
      byExact.set(exactKey(ind), ind);
      const ln = normStr(ind.lastName);
      if (!byLastName.has(ln)) byLastName.set(ln, []);
      byLastName.get(ln).push(ind);
    }

    const previewRows = rawRecords.map((rec, idx) => {
      const { firstName, middleName, lastName, suffix, nickname } = parseNameFields(rec);
      const disambiguationTag = getField(rec, ['disambiguationTag', 'Disambigulation', 'Disambiguation']);

      const rawLocation = getField(rec, ['Location', 'location']);
      const parsedLoc = parseLocationString(rawLocation);
      const caseLocationCity = getField(rec, ['caseLocationCity', 'City', 'city']) || parsedLoc.city;
      const caseLocationCounty = getField(rec, ['caseLocationCounty', 'County', 'county']) || parsedLoc.county;
      const caseLocationState = getField(rec, ['caseLocationState', 'State', 'state']) || parsedLoc.state;
      const caseLocationCountry = getField(rec, ['caseLocationCountry', 'Country', 'country']) || 'USA';

      const convictionYear = parseIntOrNull(getField(rec, ['convictionYear', 'ConvictedYear', 'Convicted']));
      const exonerationOrReleaseYear = parseIntOrNull(
        getField(rec, ['exonerationOrReleaseYear', 'ExoneratedYear', 'Exonerated'])
      );
      const timeServed = getField(rec, ['timeServed', 'Time Served']);
      const sentence = getField(rec, ['sentence', 'Sentence']);
      const narrativeSummary = getField(rec, ['narrativeSummary', 'Summary', 'summary', 'Notes']);

      const rawCrime = getField(rec, ['crimeCategory', 'Crime', 'crime', 'Worst Crime Display']);
      const canonicalCrimeName = resolveCrimeCategoryName(rawCrime);

      const rawStatus = getField(rec, ['status', 'Status', 'Status of Exoneration']);
      const status = mapStatusString(rawStatus) || (VALID_INDIVIDUAL_STATUSES.has(defaultStatus) ? defaultStatus : null);

      const rawClaim = getField(rec, ['claimStrength', 'claim_strength']);
      let claimStrength = VALID_CLAIM_STRENGTHS.has(rawClaim) ? rawClaim : defaultClaimStrength;
      if (!VALID_CLAIM_STRENGTHS.has(claimStrength)) claimStrength = 'UNASSESSED';
      if (status === 'EXONERATED' && claimStrength === 'UNASSESSED') {
        claimStrength = 'FORMALLY_EXONERATED';
      }

      // Contributing factors (array or delimited string)
      const rawFactorsField = rec.contributingFactors ?? rec.contributing_factors ?? rec['Contributing Factors'] ?? rec['Factors'];
      const rawFactorsList = Array.isArray(rawFactorsField)
        ? rawFactorsField
        : typeof rawFactorsField === 'string' && rawFactorsField.trim()
          ? rawFactorsField.split(/[;|,]/).map((s) => s.trim()).filter(Boolean)
          : [];

      const factorCodesSet = new Set();
      const unmappedFactors = [];
      for (const rf of rawFactorsList) {
        const resolved = resolveContributingFactorCodes(rf);
        if (resolved.length > 0) {
          resolved.forEach((c) => factorCodesSet.add(c));
        } else {
          unmappedFactors.push(rf);
        }
      }

      const sourceUrl = getField(rec, ['sourceUrl', 'Link', 'link', 'URL', 'url', 'specificUrl']) || defaultSourceUrl || null;
      const sourceName = getField(rec, ['sourceName', 'Source', 'Source of Information']) || defaultSourceName || null;
      const sourceHeadline = getField(rec, ['headline', 'Headline', 'articleTitle']);
      const rawSourceLinks = Array.isArray(rec.sourceLinks) ? rec.sourceLinks : [];
      const sourceLinks = rawSourceLinks
        .map((sl) => ({
          sourceName: (sl.sourceName || sourceName || defaultSourceName || 'Manual Import').trim(),
          sourceUrl: (sl.sourceUrl || sl.specificUrl || sl.url || '').trim(),
          headline: (sl.headline || '').trim() || null,
        }))
        .filter((sl) => sl.sourceUrl);
      if (sourceLinks.length === 0 && sourceUrl) {
        sourceLinks.push({
          sourceName: sourceName || defaultSourceName || 'Manual Import',
          sourceUrl,
          headline: sourceHeadline || null,
        });
      }

      const warnings = Array.isArray(rec.reviewWarnings) ? [...rec.reviewWarnings] : [];
      if (rawCrime && canonicalCrimeName && normStr(rawCrime) !== normStr(canonicalCrimeName)) {
        warnings.push(`Crime "${rawCrime}" mapped to canonical "${canonicalCrimeName}".`);
      }
      if (unmappedFactors.length > 0) {
        warnings.push(`Unmapped factor(s): ${unmappedFactors.join(', ')}`);
      }
      if (sourceLinks.length === 0) {
        warnings.push('No source URL provided — consider attaching a primary source link.');
      }

      let matchStatus = 'NEW';
      let existingMatch = null;
      let action = rec.recommendedAction === 'SKIP' ? 'SKIP' : 'CREATE';

      const statesCompatible = (s1, s2) => {
        const b1 = normBaseState(s1);
        const b2 = normBaseState(s2);
        if (!b1 || !b2) return true;
        return b1 === b2;
      };
      const statesStronglyConflict = (s1, s2) => {
        const b1 = normBaseState(s1);
        const b2 = normBaseState(s2);
        return Boolean(b1 && b2 && b1 !== b2);
      };
      const yearsCompatible = (y1, y2) => {
        if (!y1 || !y2) return true;
        return Math.abs(y1 - y2) <= 6;
      };

      if (!firstName || !lastName) {
        matchStatus = 'INVALID';
        action = 'SKIP';
        warnings.push('Could not determine both First Name and Last Name.');
      } else {
        // 1. Exact match by unique person-specific source URL (e.g. NRE case URL),
        //    requiring compatible lastName so shared multi-defendant articles never collide
        let urlMatch = null;
        for (const sl of sourceLinks) {
          if (isSharedListUrl(sl.sourceUrl)) continue;
          const hit = bySourceUrl.get(normStr(sl.sourceUrl));
          if (hit && normStr(hit.lastName) === normStr(lastName)) {
            urlMatch = hit;
            break;
          }
        }

        if (urlMatch) {
          matchStatus = 'EXACT_MATCH';
          existingMatch = urlMatch;
          action = rec.recommendedAction === 'SKIP' ? 'SKIP' : 'MERGE';
        } else {
          const key = exactKey({ firstName, middleName, lastName, suffix, disambiguationTag });
          const exact = byExact.get(key);
          if (
            exact &&
            !statesStronglyConflict(caseLocationState, exact.caseLocationState) &&
            yearsCompatible(convictionYear, exact.convictionYear)
          ) {
            matchStatus = 'EXACT_MATCH';
            existingMatch = exact;
            action = rec.recommendedAction === 'SKIP' ? 'SKIP' : 'MERGE';
          } else {
            const sameLast = byLastName.get(normStr(lastName)) || [];
            const fnA = normStr(firstName);

            // 2. Same first+last (middle/suffix may differ) WITH compatible state & years -> safe MERGE
            const strongNameMatch = sameLast.find((cand) => {
              if (normStr(cand.firstName) !== fnA) return false;
              if (statesStronglyConflict(caseLocationState, cand.caseLocationState)) return false;
              if (!yearsCompatible(convictionYear, cand.convictionYear)) return false;
              const stateConfirmed =
                Boolean(normBaseState(caseLocationState)) &&
                normBaseState(caseLocationState) === normBaseState(cand.caseLocationState);
              const yearConfirmed =
                Boolean(convictionYear && cand.convictionYear) &&
                Math.abs(convictionYear - cand.convictionYear) <= 4;
              return stateConfirmed || yearConfirmed || (!cand.caseLocationState && !cand.convictionYear);
            });

            if (strongNameMatch) {
              matchStatus = 'EXACT_MATCH';
              existingMatch = strongNameMatch;
              action = rec.recommendedAction === 'SKIP' ? 'SKIP' : 'MERGE';
            } else {
              // 3. Possible fuzzy duplicate (only if first name prefix matches AND state/years don't contradict)
              const fuzzy = sameLast.find((cand) => {
                const fnB = normStr(cand.firstName);
                const firstPrefix = fnA === fnB || (fnA.length >= 3 && fnB.length >= 3 && (fnB.startsWith(fnA.slice(0, 3)) || fnA.startsWith(fnB.slice(0, 3))));
                if (!firstPrefix) return false;
                if (statesStronglyConflict(caseLocationState, cand.caseLocationState)) return false;
                const stateConfirmed =
                  Boolean(normBaseState(caseLocationState)) &&
                  normBaseState(caseLocationState) === normBaseState(cand.caseLocationState);
                const yearConfirmed =
                  Boolean(convictionYear && cand.convictionYear) &&
                  Math.abs(convictionYear - cand.convictionYear) <= 4;
                return (stateConfirmed && yearsCompatible(convictionYear, cand.convictionYear)) || yearConfirmed;
              });
              if (fuzzy) {
                matchStatus = 'FUZZY_DUPLICATE';
                existingMatch = fuzzy;
                action = 'SKIP';
                warnings.push(
                  `Possible duplicate of #${fuzzy.id} ${fuzzy.firstName} ${fuzzy.lastName} (${fuzzy.caseLocationState || '?'}, ${fuzzy.convictionYear || '?'}).`
                );
              }
            }
          }
        }
      }

      return {
        rowIndex: idx + 1,
        matchStatus,
        action,
        existingMatch,
        warnings,
        data: {
          firstName: firstName || '',
          middleName,
          lastName: lastName || '',
          suffix,
          nickname,
          disambiguationTag,
          status,
          claimStrength,
          crimeCategoryName: canonicalCrimeName,
          convictionYear,
          exonerationOrReleaseYear,
          timeServed,
          sentence,
          caseLocationCity,
          caseLocationCounty,
          caseLocationState,
          caseLocationCountry,
          narrativeSummary,
          contributingFactorCodes: Array.from(factorCodesSet),
          sourceName,
          sourceUrl: sourceLinks[0]?.sourceUrl || sourceUrl,
          sourceHeadline: sourceLinks[0]?.headline || sourceHeadline,
          sourceLinks,
        },
      };
    });

    const summary = {
      total: previewRows.length,
      new: previewRows.filter((r) => r.matchStatus === 'NEW').length,
      exactMatch: previewRows.filter((r) => r.matchStatus === 'EXACT_MATCH').length,
      fuzzyDuplicate: previewRows.filter((r) => r.matchStatus === 'FUZZY_DUPLICATE').length,
      invalid: previewRows.filter((r) => r.matchStatus === 'INVALID').length,
    };

    return res.json({ batchId, targetType: 'INDIVIDUAL', summary, rows: previewRows });
  } catch (error) {
    console.error('Error previewing import batch:', error);
    return res.status(500).json({ message: 'Failed to preview import batch.', error: error.message });
  }
});

// --- 3. Commit Reviewed & Approved Rows ---

router.post('/commit', async (req, res) => {
  const {
    targetType = 'INDIVIDUAL',
    batchId = `import_${Date.now()}`,
    ingestionSource = 'admin_import_queue',
    defaultSourceName = 'Manual Import',
    verificationStatus = 'UNVERIFIED',
    aiGenerated = false,
    summaryMergePolicy = 'SMART',
    rows = [],
  } = req.body || {};

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ message: 'No rows provided to commit.' });
  }

  const safeSummaryPolicy = VALID_SUMMARY_POLICIES.has(summaryMergePolicy) ? summaryMergePolicy : 'SMART';
  const safeStatus = VALID_VERIFICATION_STATUSES.has(verificationStatus) ? verificationStatus : 'UNVERIFIED';
  const verifiedFields =
    safeStatus === 'VERIFIED'
      ? { verifiedAt: new Date(), verifiedById: req.user?.userId || null }
      : { verifiedAt: null, verifiedById: null };

  let created = 0;
  let merged = 0;
  let skipped = 0;
  let linksAdded = 0;
  let summariesUpdated = 0;
  const errors = [];

  try {
    if (targetType === 'BOOK_BUNDLE') {
      const [allCrimes, allFactors] = await Promise.all([
        prisma.crimeCategory.findMany(),
        prisma.contributingFactor.findMany(),
      ]);
      const crimeIdByName = new Map(allCrimes.map((c) => [normStr(c.crime_name), c.id]));
      const factorIdByCode = new Map(allFactors.map((f) => [f.code, f.id]));

      for (const row of rows) {
        if (row.action === 'SKIP') {
          skipped++;
          continue;
        }
        const d = row.data || {};
        const mw = d.mediaWork || {};
        const mi = d.mediaItem || {};
        const bpd = d.bookPurchaseDetails || null;
        const featuredIndividuals = Array.isArray(d.featuredIndividuals) ? d.featuredIndividuals : [];
        const involvedPersons = Array.isArray(d.involvedPersons) ? d.involvedPersons : [];

        try {
          let work = null;
          const workFields = {
            title: mw.title?.trim(),
            workType: 'BOOK',
            creatorName: mw.creatorName || null,
            publicationOrReleaseYear: parseIntOrNull(mw.publicationOrReleaseYear),
            publisherOrNetwork: mw.publisherOrNetwork || null,
            focusOrTheme: mw.focusOrTheme || null,
            summaryNotes: mw.summaryNotes || null,
            availabilityNotes: mw.availabilityNotes || null,
            sourceUrl: mw.sourceUrl || null,
            externalId: mw.externalId || null,
            imagePath: mw.imagePath || null,
            sourcingCredit: mw.sourcingCredit || null,
            lastExternalFetch: bpd ? new Date() : null,
            aiGenerated: mw.aiGenerated !== undefined ? Boolean(mw.aiGenerated) : Boolean(aiGenerated),
            verificationStatus: safeStatus,
            ...verifiedFields,
            ingestionSource,
            importBatchId: batchId,
          };

          if (row.action === 'MERGE' && row.existingMatch?.id) {
            const existing = await prisma.mediaWork.findUnique({ where: { id: row.existingMatch.id } });
            if (!existing) {
              errors.push({ rowIndex: row.rowIndex, name: mw.title, error: `Existing Book #${row.existingMatch.id} not found.` });
              continue;
            }
            work = await prisma.mediaWork.update({
              where: { id: existing.id },
              data: {
                creatorName: existing.creatorName || workFields.creatorName,
                publicationOrReleaseYear: existing.publicationOrReleaseYear ?? workFields.publicationOrReleaseYear,
                publisherOrNetwork: existing.publisherOrNetwork || workFields.publisherOrNetwork,
                focusOrTheme: existing.focusOrTheme || workFields.focusOrTheme,
                summaryNotes: existing.summaryNotes || workFields.summaryNotes,
                availabilityNotes: existing.availabilityNotes || workFields.availabilityNotes,
                sourceUrl: existing.sourceUrl || workFields.sourceUrl,
                externalId: existing.externalId || workFields.externalId,
                imagePath: existing.imagePath || workFields.imagePath,
                sourcingCredit: existing.sourcingCredit || workFields.sourcingCredit,
                lastExternalFetch: bpd ? new Date() : existing.lastExternalFetch,
              },
            });
            merged++;
          } else {
            if (!workFields.title) {
              errors.push({ rowIndex: row.rowIndex, error: 'Book title is required.' });
              continue;
            }
            work = await prisma.mediaWork.create({ data: workFields });
            created++;
          }

          if (bpd) {
            const bpdData = {
              subtitle: bpd.subtitle || null,
              pageCount: parseIntOrNull(bpd.pageCount),
              googleBooksPreviewLink: bpd.googleBooksPreviewLink || null,
              googleBooksWebReaderLink: bpd.googleBooksWebReaderLink || null,
              googleBooksBuyLink: bpd.googleBooksBuyLink || null,
              googleBooksCategories: Array.isArray(bpd.googleBooksCategories) ? bpd.googleBooksCategories : [],
              amazonPurchaseUrl: bpd.amazonPurchaseUrl || null,
              listPriceAmount: bpd.listPriceAmount !== null && bpd.listPriceAmount !== undefined ? Number(bpd.listPriceAmount) : null,
              listPriceCurrency: bpd.listPriceCurrency || null,
              retailPriceAmount: bpd.retailPriceAmount !== null && bpd.retailPriceAmount !== undefined ? Number(bpd.retailPriceAmount) : null,
              retailPriceCurrency: bpd.retailPriceCurrency || null,
              isEbookGoogle: Boolean(bpd.isEbookGoogle),
              saleabilityGoogle: bpd.saleabilityGoogle || null,
              viewabilityGoogle: bpd.viewabilityGoogle || null,
              lastApiCheck: new Date(),
            };
            await prisma.bookPurchaseDetails.upsert({
              where: { mediaWorkId: work.id },
              update: bpdData,
              create: { mediaWorkId: work.id, ...bpdData },
            });
          }

          const itemTitle = (mi.itemTitle || `Book Content: ${work.title}`).trim();
          const itemFactorIds = (mi.contributingFactorCodes || [])
            .map((code) => factorIdByCode.get(code))
            .filter(Boolean)
            .map((id) => ({ id }));

          let mediaItem = await prisma.mediaItem.findFirst({
            where: { workId: work.id, itemMediaType: 'BOOK_CONTENT' },
          });
          if (!mediaItem) {
            mediaItem = await prisma.mediaItem.create({
              data: {
                workId: work.id,
                itemTitle,
                itemMediaType: 'BOOK_CONTENT',
                focusOrTheme: mi.focusOrTheme || work.focusOrTheme || null,
                summaryNotes: mi.summaryNotes || null,
                aiGenerated: true,
                verificationStatus: safeStatus,
                ...verifiedFields,
                ingestionSource,
                importBatchId: batchId,
                ...(itemFactorIds.length > 0 ? { contributingFactorsMentioned: { connect: itemFactorIds } } : {}),
              },
            });
          } else if (itemFactorIds.length > 0) {
            await prisma.mediaItem.update({
              where: { id: mediaItem.id },
              data: { contributingFactorsMentioned: { connect: itemFactorIds } },
            });
          }

          const itemIndividualIds = [];
          const itemOrgIds = new Set();

          for (const ind of featuredIndividuals) {
            if (!ind.firstName || !ind.lastName || ind.firstName === 'Unknown' || ind.lastName === 'Unknown') continue;
            const indFactorIds = (ind.contributingFactorCodes || [])
              .map((code) => factorIdByCode.get(code))
              .filter(Boolean)
              .map((id) => ({ id }));
            const crimeCategoryId = ind.crimeCategoryName
              ? crimeIdByName.get(normStr(ind.crimeCategoryName)) || null
              : null;

            const indOrgIds = [];
            for (const orgObj of ind.organizations || []) {
              const orgName = (typeof orgObj === 'string' ? orgObj : orgObj?.name || '').trim();
              if (!orgName) continue;
              const orgType = VALID_ORG_TYPES.has(orgObj?.type) ? orgObj.type : 'OTHER';
              const orgRecord = await prisma.organization.upsert({
                where: { name: orgName },
                update: {},
                create: {
                  name: orgName,
                  type: orgType,
                  aiGenerated: true,
                  verificationStatus: safeStatus,
                  ...verifiedFields,
                  ingestionSource,
                  importBatchId: batchId,
                },
              });
              indOrgIds.push({ id: orgRecord.id });
              itemOrgIds.add(orgRecord.id);
            }

            let existingInd = await prisma.individual.findFirst({
              where: {
                firstName: { equals: ind.firstName.trim(), mode: 'insensitive' },
                lastName: { equals: ind.lastName.trim(), mode: 'insensitive' },
              },
            });

            if (existingInd) {
              await prisma.individual.update({
                where: { id: existingInd.id },
                data: {
                  status: existingInd.status || (VALID_INDIVIDUAL_STATUSES.has(ind.status) ? ind.status : null),
                  claimStrength:
                    existingInd.claimStrength && existingInd.claimStrength !== 'UNASSESSED'
                      ? existingInd.claimStrength
                      : VALID_CLAIM_STRENGTHS.has(ind.claimStrength)
                        ? ind.claimStrength
                        : 'UNASSESSED',
                  crimeCategoryId: existingInd.crimeCategoryId || crimeCategoryId,
                  convictionYear: existingInd.convictionYear ?? parseIntOrNull(ind.convictionYear),
                  exonerationOrReleaseYear:
                    existingInd.exonerationOrReleaseYear ?? parseIntOrNull(ind.exonerationOrReleaseYear),
                  timeServed: existingInd.timeServed || ind.timeServed || null,
                  sentence: existingInd.sentence || ind.sentence || null,
                  caseLocationCity: existingInd.caseLocationCity || ind.caseLocationCity || null,
                  caseLocationCounty: existingInd.caseLocationCounty || ind.caseLocationCounty || null,
                  caseLocationState: existingInd.caseLocationState || ind.caseLocationState || null,
                  narrativeSummary: (() => {
                    const pick = chooseNarrativeSummary(existingInd, ind.narrativeSummary, defaultSourceName || 'Book Bundle', safeSummaryPolicy);
                    if (pick.replaced) summariesUpdated++;
                    return pick.value;
                  })(),
                  ...(indFactorIds.length > 0 ? { contributingFactors: { connect: indFactorIds } } : {}),
                  ...(indOrgIds.length > 0 ? { organizationsInvolved: { connect: indOrgIds } } : {}),
                },
              });
            } else {
              existingInd = await prisma.individual.create({
                data: {
                  firstName: ind.firstName.trim(),
                  middleName: ind.middleName?.trim() || null,
                  lastName: ind.lastName.trim(),
                  suffix: ind.suffix?.trim() || null,
                  status: VALID_INDIVIDUAL_STATUSES.has(ind.status) ? ind.status : null,
                  claimStrength: VALID_CLAIM_STRENGTHS.has(ind.claimStrength) ? ind.claimStrength : 'UNASSESSED',
                  crimeCategoryId,
                  convictionYear: parseIntOrNull(ind.convictionYear),
                  exonerationOrReleaseYear: parseIntOrNull(ind.exonerationOrReleaseYear),
                  timeServed: ind.timeServed || null,
                  sentence: ind.sentence || null,
                  caseLocationCity: ind.caseLocationCity || null,
                  caseLocationCounty: ind.caseLocationCounty || null,
                  caseLocationState: ind.caseLocationState || null,
                  caseLocationCountry: ind.caseLocationCountry || 'USA',
                  narrativeSummary: ind.narrativeSummary || null,
                  aiGenerated: true,
                  verificationStatus: safeStatus,
                  ...verifiedFields,
                  ingestionSource,
                  importBatchId: batchId,
                  ...(indFactorIds.length > 0 ? { contributingFactors: { connect: indFactorIds } } : {}),
                  ...(indOrgIds.length > 0 ? { organizationsInvolved: { connect: indOrgIds } } : {}),
                },
              });
            }
            itemIndividualIds.push({ id: existingInd.id });
          }

          const itemPersonIds = [];
          for (const p of involvedPersons) {
            if (!p.firstName || !p.lastName || p.firstName === 'Unknown' || p.lastName === 'Unknown') continue;
            const role = p.role || 'OTHER';
            let person = await prisma.involvedPerson.findFirst({
              where: {
                firstName: { equals: p.firstName.trim(), mode: 'insensitive' },
                lastName: { equals: p.lastName.trim(), mode: 'insensitive' },
                role,
              },
            });
            if (!person) {
              person = await prisma.involvedPerson.create({
                data: {
                  firstName: p.firstName.trim(),
                  middleName: p.middleName?.trim() || null,
                  lastName: p.lastName.trim(),
                  suffix: p.suffix?.trim() || null,
                  role,
                  aiGenerated: true,
                  verificationStatus: safeStatus,
                  ...verifiedFields,
                  ingestionSource,
                  importBatchId: batchId,
                },
              });
            }
            itemPersonIds.push({ id: person.id });
          }

          if (itemIndividualIds.length > 0 || itemOrgIds.size > 0 || itemPersonIds.length > 0) {
            await prisma.mediaItem.update({
              where: { id: mediaItem.id },
              data: {
                ...(itemIndividualIds.length > 0 ? { individualsFeatured: { connect: itemIndividualIds } } : {}),
                ...(itemOrgIds.size > 0 ? { organizationsMentioned: { connect: Array.from(itemOrgIds).map((id) => ({ id })) } } : {}),
                ...(itemPersonIds.length > 0 ? { involvedPersonsMentioned: { connect: itemPersonIds } } : {}),
              },
            });
            linksAdded += itemIndividualIds.length + itemOrgIds.size + itemPersonIds.length;
          }
        } catch (err) {
          errors.push({ rowIndex: row.rowIndex, name: mw.title, error: err.message });
        }
      }

      return res.json({ batchId, targetType: 'BOOK_BUNDLE', created, merged, skipped, linksAdded, errors });
    }

    if (targetType === 'FILM_BUNDLE') {
      const [allCrimes, allFactors] = await Promise.all([
        prisma.crimeCategory.findMany(),
        prisma.contributingFactor.findMany(),
      ]);
      const crimeIdByName = new Map(allCrimes.map((c) => [normStr(c.crime_name), c.id]));
      const factorIdByCode = new Map(allFactors.map((f) => [f.code, f.id]));

      for (const row of rows) {
        if (row.action === 'SKIP') {
          skipped++;
          continue;
        }
        const d = row.data || {};
        const mw = d.mediaWork || {};
        const streamingProviders = Array.isArray(d.streamingProviders) ? d.streamingProviders : [];
        const mediaItems = Array.isArray(d.mediaItems) ? d.mediaItems : [];

        try {
          let work = null;
          const workType = VALID_FILM_WORK_TYPES.has((mw.workType || '').toUpperCase())
            ? mw.workType.toUpperCase()
            : 'DOCUMENTARY';

          const workFields = {
            title: mw.title?.trim(),
            workType,
            creatorName: mw.creatorName || null,
            publicationOrReleaseYear: parseIntOrNull(mw.publicationOrReleaseYear),
            publisherOrNetwork: mw.publisherOrNetwork || null,
            focusOrTheme: mw.focusOrTheme || null,
            summaryNotes: mw.summaryNotes || null,
            availabilityNotes: mw.availabilityNotes || null,
            sourceUrl: mw.sourceUrl || null,
            externalId: mw.externalId ? String(mw.externalId).trim() : null,
            imagePath: mw.imagePath || null,
            sourcingCredit: mw.sourcingCredit || null,
            lastExternalFetch: mw.externalId ? new Date() : null,
            aiGenerated: mw.aiGenerated !== undefined ? Boolean(mw.aiGenerated) : Boolean(aiGenerated),
            verificationStatus: safeStatus,
            ...verifiedFields,
            ingestionSource,
            importBatchId: batchId,
          };

          if (row.action === 'MERGE' && row.existingMatch?.id) {
            const existing = await prisma.mediaWork.findUnique({ where: { id: row.existingMatch.id } });
            if (!existing) {
              errors.push({ rowIndex: row.rowIndex, name: mw.title, error: `Existing MediaWork #${row.existingMatch.id} not found.` });
              continue;
            }
            work = await prisma.mediaWork.update({
              where: { id: existing.id },
              data: {
                creatorName: existing.creatorName || workFields.creatorName,
                publicationOrReleaseYear: existing.publicationOrReleaseYear ?? workFields.publicationOrReleaseYear,
                publisherOrNetwork: existing.publisherOrNetwork || workFields.publisherOrNetwork,
                focusOrTheme: existing.focusOrTheme || workFields.focusOrTheme,
                summaryNotes: existing.summaryNotes || workFields.summaryNotes,
                availabilityNotes: existing.availabilityNotes || workFields.availabilityNotes,
                sourceUrl: existing.sourceUrl || workFields.sourceUrl,
                externalId: existing.externalId || workFields.externalId,
                imagePath: existing.imagePath || workFields.imagePath,
                sourcingCredit: existing.sourcingCredit || workFields.sourcingCredit,
                lastExternalFetch: workFields.externalId ? new Date() : existing.lastExternalFetch,
              },
            });
            merged++;
          } else {
            if (!workFields.title) {
              errors.push({ rowIndex: row.rowIndex, error: 'Film/series title is required.' });
              continue;
            }
            work = await prisma.mediaWork.create({ data: workFields });
            created++;
          }

          // Upsert Watchmode streaming providers for this MediaWork
          for (const sp of streamingProviders) {
            const providerName = (sp.providerName || '').trim();
            if (!providerName) continue;
            const streamingType = VALID_STREAMING_TYPES.has((sp.streamingType || '').toUpperCase())
              ? sp.streamingType.toUpperCase()
              : 'OTHER';
            const presentationQuality = (sp.presentationQuality || 'HD').trim();
            const spData = {
              watchmodeProviderId: parseIntOrNull(sp.watchmodeProviderId),
              url: sp.url || null,
              priceAmount: sp.priceAmount !== null && sp.priceAmount !== undefined ? Number(sp.priceAmount) : null,
              priceCurrency: sp.priceCurrency || (sp.priceAmount != null ? 'USD' : null),
              lastChecked: new Date(),
            };
            await prisma.streamingProvider.upsert({
              where: {
                mediaWorkId_providerName_streamingType_presentationQuality: {
                  mediaWorkId: work.id,
                  providerName,
                  streamingType,
                  presentationQuality,
                },
              },
              update: spData,
              create: {
                mediaWorkId: work.id,
                providerName,
                streamingType,
                presentationQuality,
                ...spData,
              },
            });
            linksAdded++;
          }

          // Upsert each MediaItem (1 for standalone Film/Doc, or multiple episodes for TV_SERIES)
          for (const mi of mediaItems) {
            const itemMediaType = VALID_MEDIA_ITEM_TYPES.has((mi.itemMediaType || '').toUpperCase())
              ? mi.itemMediaType.toUpperCase()
              : workType === 'TV_SERIES'
                ? 'TV_EPISODE'
                : workType === 'FILM'
                  ? 'FILM_CONTENT'
                  : 'DOCUMENTARY_CONTENT';
            const itemTitle = (mi.itemTitle || `${work.title} (${workType})`).trim();
            const releaseDateObj = mi.releaseDate ? new Date(mi.releaseDate) : null;
            const validReleaseDate = releaseDateObj && !Number.isNaN(releaseDateObj.getTime()) ? releaseDateObj : null;

            const itemFactorIds = (mi.contributingFactorCodes || [])
              .map((code) => factorIdByCode.get(code))
              .filter(Boolean)
              .map((id) => ({ id }));

            let mediaItem = null;
            if (itemMediaType === 'TV_EPISODE') {
              mediaItem = await prisma.mediaItem.findFirst({
                where: {
                  workId: work.id,
                  itemTitle: { equals: itemTitle, mode: 'insensitive' },
                },
              });
            } else {
              mediaItem = await prisma.mediaItem.findFirst({
                where: { workId: work.id, itemMediaType },
              });
            }

            if (!mediaItem) {
              mediaItem = await prisma.mediaItem.create({
                data: {
                  workId: work.id,
                  itemTitle,
                  itemNumber: mi.itemNumber ? String(mi.itemNumber).trim() : null,
                  itemMediaType,
                  releaseDate: validReleaseDate,
                  hostOrNarrator: mi.hostOrNarrator || null,
                  focusOrTheme: mi.focusOrTheme || work.focusOrTheme || null,
                  summaryNotes: mi.summaryNotes || null,
                  keyQuotes: mi.keyQuotes || null,
                  sourceUrl: mi.sourceUrl || null,
                  aiGenerated: true,
                  verificationStatus: safeStatus,
                  ...verifiedFields,
                  ingestionSource,
                  importBatchId: batchId,
                  ...(itemFactorIds.length > 0 ? { contributingFactorsMentioned: { connect: itemFactorIds } } : {}),
                  ...(Array.isArray(mi.externalLinks) && mi.externalLinks.length > 0
                    ? {
                        externalLinks: {
                          create: mi.externalLinks
                            .filter((l) => l?.url?.trim())
                            .map((l) => ({ url: l.url.trim(), description: l.description || null })),
                        },
                      }
                    : {}),
                },
              });
            } else if (itemFactorIds.length > 0) {
              await prisma.mediaItem.update({
                where: { id: mediaItem.id },
                data: { contributingFactorsMentioned: { connect: itemFactorIds } },
              });
            }

            const itemIndividualIds = [];
            const itemOrgIds = new Set();

            for (const ind of mi.featuredIndividuals || []) {
              if (!ind.firstName || !ind.lastName || ind.firstName === 'Unknown' || ind.lastName === 'Unknown') continue;
              const indFactorIds = (ind.contributingFactorCodes || [])
                .map((code) => factorIdByCode.get(code))
                .filter(Boolean)
                .map((id) => ({ id }));
              const crimeCategoryId = ind.crimeCategoryName
                ? crimeIdByName.get(normStr(ind.crimeCategoryName)) || null
                : null;

              const indOrgIds = [];
              for (const orgObj of ind.organizations || []) {
                const orgName = (typeof orgObj === 'string' ? orgObj : orgObj?.name || '').trim();
                if (!orgName) continue;
                const orgType = VALID_ORG_TYPES.has(orgObj?.type) ? orgObj.type : 'OTHER';
                let orgRecord = await prisma.organization.findFirst({
                  where: { name: { equals: orgName, mode: 'insensitive' } },
                });
                if (!orgRecord) {
                  orgRecord = await prisma.organization.create({
                    data: {
                      name: orgName,
                      type: orgType,
                      aiGenerated: true,
                      verificationStatus: safeStatus,
                      ...verifiedFields,
                      ingestionSource,
                      importBatchId: batchId,
                    },
                  });
                }
                indOrgIds.push({ id: orgRecord.id });
                itemOrgIds.add(orgRecord.id);
              }

              let existingInd = await prisma.individual.findFirst({
                where: {
                  firstName: { equals: ind.firstName.trim(), mode: 'insensitive' },
                  lastName: { equals: ind.lastName.trim(), mode: 'insensitive' },
                },
              });

              if (existingInd) {
                await prisma.individual.update({
                  where: { id: existingInd.id },
                  data: {
                    status: existingInd.status || (VALID_INDIVIDUAL_STATUSES.has(ind.status) ? ind.status : null),
                    claimStrength:
                      existingInd.claimStrength && existingInd.claimStrength !== 'UNASSESSED'
                        ? existingInd.claimStrength
                        : VALID_CLAIM_STRENGTHS.has(ind.claimStrength)
                          ? ind.claimStrength
                          : 'UNASSESSED',
                    crimeCategoryId: existingInd.crimeCategoryId || crimeCategoryId,
                    convictionYear: existingInd.convictionYear ?? parseIntOrNull(ind.convictionYear),
                    exonerationOrReleaseYear:
                      existingInd.exonerationOrReleaseYear ?? parseIntOrNull(ind.exonerationOrReleaseYear),
                    timeServed: existingInd.timeServed || ind.timeServed || null,
                    sentence: existingInd.sentence || ind.sentence || null,
                    caseLocationCity: existingInd.caseLocationCity || ind.caseLocationCity || null,
                    caseLocationCounty: existingInd.caseLocationCounty || ind.caseLocationCounty || null,
                    caseLocationState: existingInd.caseLocationState || ind.caseLocationState || null,
                    narrativeSummary: (() => {
                      const pick = chooseNarrativeSummary(existingInd, ind.narrativeSummary, defaultSourceName || targetType, safeSummaryPolicy);
                      if (pick.replaced) summariesUpdated++;
                      return pick.value;
                    })(),
                    ...(indFactorIds.length > 0 ? { contributingFactors: { connect: indFactorIds } } : {}),
                    ...(indOrgIds.length > 0 ? { organizationsInvolved: { connect: indOrgIds } } : {}),
                  },
                });
              } else {
                existingInd = await prisma.individual.create({
                  data: {
                    firstName: ind.firstName.trim(),
                    middleName: ind.middleName?.trim() || null,
                    lastName: ind.lastName.trim(),
                    suffix: ind.suffix?.trim() || null,
                    status: VALID_INDIVIDUAL_STATUSES.has(ind.status) ? ind.status : null,
                    claimStrength: VALID_CLAIM_STRENGTHS.has(ind.claimStrength) ? ind.claimStrength : 'UNASSESSED',
                    crimeCategoryId,
                    convictionYear: parseIntOrNull(ind.convictionYear),
                    exonerationOrReleaseYear: parseIntOrNull(ind.exonerationOrReleaseYear),
                    timeServed: ind.timeServed || null,
                    sentence: ind.sentence || null,
                    caseLocationCity: ind.caseLocationCity || null,
                    caseLocationCounty: ind.caseLocationCounty || null,
                    caseLocationState: ind.caseLocationState || null,
                    caseLocationCountry: ind.caseLocationCountry || 'USA',
                    narrativeSummary: ind.narrativeSummary || null,
                    aiGenerated: true,
                    verificationStatus: safeStatus,
                    ...verifiedFields,
                    ingestionSource,
                    importBatchId: batchId,
                    ...(indFactorIds.length > 0 ? { contributingFactors: { connect: indFactorIds } } : {}),
                    ...(indOrgIds.length > 0 ? { organizationsInvolved: { connect: indOrgIds } } : {}),
                  },
                });
              }
              itemIndividualIds.push({ id: existingInd.id });
            }

            const itemPersonIds = [];
            for (const p of mi.involvedPersons || []) {
              if (!p.firstName || !p.lastName || p.firstName === 'Unknown' || p.lastName === 'Unknown') continue;
              const role = p.role || 'OTHER';
              let person = await prisma.involvedPerson.findFirst({
                where: {
                  firstName: { equals: p.firstName.trim(), mode: 'insensitive' },
                  lastName: { equals: p.lastName.trim(), mode: 'insensitive' },
                },
              });
              if (!person) {
                person = await prisma.involvedPerson.create({
                  data: {
                    firstName: p.firstName.trim(),
                    middleName: p.middleName?.trim() || null,
                    lastName: p.lastName.trim(),
                    suffix: p.suffix?.trim() || null,
                    role,
                    aiGenerated: true,
                    verificationStatus: safeStatus,
                    ...verifiedFields,
                    ingestionSource,
                    importBatchId: batchId,
                  },
                });
              }
              itemPersonIds.push({ id: person.id });
            }

            if (itemIndividualIds.length > 0 || itemOrgIds.size > 0 || itemPersonIds.length > 0) {
              await prisma.mediaItem.update({
                where: { id: mediaItem.id },
                data: {
                  ...(itemIndividualIds.length > 0 ? { individualsFeatured: { connect: itemIndividualIds } } : {}),
                  ...(itemOrgIds.size > 0 ? { organizationsMentioned: { connect: Array.from(itemOrgIds).map((id) => ({ id })) } } : {}),
                  ...(itemPersonIds.length > 0 ? { involvedPersonsMentioned: { connect: itemPersonIds } } : {}),
                },
              });
              linksAdded += itemIndividualIds.length + itemOrgIds.size + itemPersonIds.length;
            }
          }
        } catch (err) {
          errors.push({ rowIndex: row.rowIndex, name: mw.title, error: err.message });
        }
      }

      return res.json({ batchId, targetType: 'FILM_BUNDLE', created, merged, skipped, linksAdded, errors });
    }

    if (targetType === 'PODCAST_SERIES_BUNDLE') {
      // Series metadata ONLY — intentionally creates/merges MediaWork (PODCAST_SERIES) with zero episodes.
      for (const row of rows) {
        if (row.action === 'SKIP') {
          skipped++;
          continue;
        }
        const d = row.data || {};
        const mw = d.mediaWork || {};

        try {
          const externalId = mw.externalId ? String(mw.externalId).trim() : null;
          const workFields = {
            title: mw.title?.trim(),
            workType: 'PODCAST_SERIES',
            creatorName: mw.creatorName || null,
            publicationOrReleaseYear: parseIntOrNull(mw.publicationOrReleaseYear),
            publisherOrNetwork: mw.publisherOrNetwork || null,
            focusOrTheme: mw.focusOrTheme || null,
            summaryNotes: mw.summaryNotes || null,
            availabilityNotes: mw.availabilityNotes || null,
            sourceUrl: mw.sourceUrl || null,
            externalId,
            imagePath: mw.imagePath || null,
            sourcingCredit: mw.sourcingCredit || null,
            lastExternalFetch: externalId ? new Date() : null,
            aiGenerated: mw.aiGenerated !== undefined ? Boolean(mw.aiGenerated) : Boolean(aiGenerated),
            verificationStatus: safeStatus,
            ...verifiedFields,
            ingestionSource,
            importBatchId: batchId,
          };

          if (row.action === 'MERGE' && row.existingMatch?.id) {
            const existing = await prisma.mediaWork.findUnique({ where: { id: row.existingMatch.id } });
            if (!existing) {
              errors.push({
                rowIndex: row.rowIndex,
                name: mw.title,
                error: `Existing Podcast Series #${row.existingMatch.id} not found.`,
              });
              continue;
            }
            await prisma.mediaWork.update({
              where: { id: existing.id },
              data: {
                creatorName: existing.creatorName || workFields.creatorName,
                publicationOrReleaseYear:
                  existing.publicationOrReleaseYear ?? workFields.publicationOrReleaseYear,
                publisherOrNetwork: existing.publisherOrNetwork || workFields.publisherOrNetwork,
                focusOrTheme: existing.focusOrTheme || workFields.focusOrTheme,
                summaryNotes: existing.summaryNotes || workFields.summaryNotes,
                availabilityNotes: existing.availabilityNotes || workFields.availabilityNotes,
                sourceUrl: existing.sourceUrl || workFields.sourceUrl,
                externalId: existing.externalId || workFields.externalId,
                imagePath: existing.imagePath || workFields.imagePath,
                sourcingCredit: existing.sourcingCredit || workFields.sourcingCredit,
                lastExternalFetch: workFields.externalId ? new Date() : existing.lastExternalFetch,
              },
            });
            merged++;
          } else {
            if (!workFields.title) {
              errors.push({ rowIndex: row.rowIndex, error: 'Podcast series title is required.' });
              continue;
            }
            await prisma.mediaWork.create({ data: workFields });
            created++;
          }
        } catch (err) {
          errors.push({ rowIndex: row.rowIndex, name: mw.title, error: err.message });
        }
      }

      return res.json({
        batchId,
        targetType: 'PODCAST_SERIES_BUNDLE',
        created,
        merged,
        skipped,
        linksAdded,
        errors,
      });
    }

    if (targetType === 'GROUPS_AND_LINKS') {
      async function linkAllPairs(ids) {
        let pairLinks = 0;
        for (let i = 0; i < ids.length; i++) {
          const others = ids.filter((id) => id !== ids[i]).map((id) => ({ id }));
          if (others.length === 0) continue;
          await prisma.individual.update({
            where: { id: ids[i] },
            data: { relatedIndividuals: { connect: others } },
          });
          pairLinks += others.length;
        }
        return pairLinks;
      }

      for (const row of rows) {
        if (row.action === 'SKIP') {
          skipped++;
          continue;
        }
        const d = row.data || {};
        const memberIds = (d.matchedMembers || []).map((m) => m.id).filter(Boolean);

        try {
          if (d.kind === 'GROUP') {
            if (!d.name?.trim()) {
              errors.push({ rowIndex: row.rowIndex, error: 'Group name is required.' });
              continue;
            }
            const existing = await prisma.individualGroup.findUnique({ where: { name: d.name.trim() } });
            if (existing) {
              await prisma.individualGroup.update({
                where: { id: existing.id },
                data: {
                  description: existing.description || d.description || null,
                  ...(memberIds.length > 0 ? { members: { connect: memberIds.map((id) => ({ id })) } } : {}),
                },
              });
              merged++;
            } else {
              await prisma.individualGroup.create({
                data: {
                  name: d.name.trim(),
                  description: d.description || null,
                  ...(memberIds.length > 0 ? { members: { connect: memberIds.map((id) => ({ id })) } } : {}),
                },
              });
              created++;
            }
            linksAdded += memberIds.length;
            if (d.linkCoDefendants && memberIds.length >= 2 && memberIds.length <= 10) {
              linksAdded += await linkAllPairs(memberIds);
            }
          } else if (d.kind === 'RELATIONSHIP') {
            if (memberIds.length < 2) {
              skipped++;
              continue;
            }
            linksAdded += await linkAllPairs(memberIds);
            merged++;
          }
        } catch (err) {
          errors.push({ rowIndex: row.rowIndex, name: d.name || d.label, error: err.message });
        }
      }

      return res.json({
        batchId,
        targetType: 'GROUPS_AND_LINKS',
        created,
        merged,
        skipped,
        linksAdded,
        errors,
      });
    }

    if (targetType === 'ORGANIZATION') {
      for (const row of rows) {
        if (row.action === 'SKIP') {
          skipped++;
          continue;
        }
        const d = row.data || {};
        try {
          if (row.action === 'MERGE' && row.existingMatch?.id) {
            const existing = await prisma.organization.findUnique({ where: { id: row.existingMatch.id } });
            if (!existing) {
              errors.push({ rowIndex: row.rowIndex, error: `Existing Organization #${row.existingMatch.id} not found.` });
              continue;
            }
            await prisma.organization.update({
              where: { id: existing.id },
              data: {
                type: existing.type || d.type || 'UNKNOWN',
                locationCity: existing.locationCity || d.locationCity || null,
                locationState: existing.locationState || d.locationState || null,
                website: existing.website || d.website || null,
                notes: existing.notes || d.notes || null,
              },
            });
            merged++;
          } else if (row.action === 'CREATE') {
            if (!d.name?.trim()) {
              errors.push({ rowIndex: row.rowIndex, error: 'Organization name is required.' });
              continue;
            }
            await prisma.organization.create({
              data: {
                name: d.name.trim(),
                type: VALID_ORG_TYPES.has(d.type) ? d.type : 'UNKNOWN',
                locationCity: d.locationCity || null,
                locationState: d.locationState || null,
                locationCountry: d.locationCountry || 'USA',
                website: d.website || null,
                notes: d.notes || null,
                aiGenerated: Boolean(aiGenerated),
                verificationStatus: safeStatus,
                ...verifiedFields,
                ingestionSource,
                importBatchId: batchId,
              },
            });
            created++;
          }
        } catch (err) {
          errors.push({ rowIndex: row.rowIndex, name: d.name, error: err.message });
        }
      }

      return res.json({ batchId, targetType, created, merged, skipped, linksAdded, summariesUpdated, errors });
    }

    // Preload CrimeCategories and ContributingFactors once for fast lookup
    const [allCrimes, allFactors] = await Promise.all([
      prisma.crimeCategory.findMany(),
      prisma.contributingFactor.findMany(),
    ]);
    const crimeIdByName = new Map(allCrimes.map((c) => [normStr(c.crime_name), c.id]));
    const factorIdByCode = new Map(allFactors.map((f) => [f.code, f.id]));

    // Cache InformationSources by name
    const sourceCache = new Map();
    async function ensureInformationSource(name) {
      const cleanName = (name || defaultSourceName || 'Manual Import').trim();
      if (sourceCache.has(cleanName)) return sourceCache.get(cleanName);
      const src = await prisma.informationSource.upsert({
        where: { name: cleanName },
        update: {},
        create: { name: cleanName },
      });
      sourceCache.set(cleanName, src.id);
      return src.id;
    }

    for (const row of rows) {
      if (row.action === 'SKIP') {
        skipped++;
        continue;
      }

      const d = row.data || {};
      try {
        const crimeCategoryId = d.crimeCategoryName
          ? crimeIdByName.get(normStr(d.crimeCategoryName)) || null
          : null;

        const factorConnectIds = (d.contributingFactorCodes || [])
          .map((code) => factorIdByCode.get(code))
          .filter(Boolean)
          .map((id) => ({ id }));

        let targetIndividualId = null;

        const incomingLinksCheck =
          Array.isArray(d.sourceLinks) && d.sourceLinks.length > 0
            ? d.sourceLinks
            : d.sourceUrl && d.sourceUrl.trim()
              ? [{ sourceName: d.sourceName || defaultSourceName }]
              : [];
        const incomingSourceNames = incomingLinksCheck
          .map((sl) => (sl.sourceName || defaultSourceName || '').trim().toLowerCase())
          .filter(Boolean);
        const incomingIsOnlyNre =
          incomingSourceNames.length > 0 &&
          incomingSourceNames.every((n) => n === 'national registry of exonerations');
        const incomingHasNonNre = incomingSourceNames.some(
          (n) => n !== 'national registry of exonerations'
        );

        if (row.action === 'MERGE' && row.existingMatch?.id) {
          const existing = await prisma.individual.findUnique({ where: { id: row.existingMatch.id } });
          if (!existing) {
            errors.push({ rowIndex: row.rowIndex, error: `Existing Individual #${row.existingMatch.id} not found.` });
            continue;
          }

          await prisma.individual.update({
            where: { id: existing.id },
            data: {
              middleName: existing.middleName || d.middleName || null,
              suffix: existing.suffix || d.suffix || null,
              nickname: existing.nickname || d.nickname || null,
              status: existing.status || d.status || null,
              claimStrength:
                existing.claimStrength && existing.claimStrength !== 'UNASSESSED'
                  ? existing.claimStrength
                  : d.claimStrength || 'UNASSESSED',
              crimeCategoryId: existing.crimeCategoryId || crimeCategoryId,
              convictionYear: existing.convictionYear ?? parseIntOrNull(d.convictionYear),
              exonerationOrReleaseYear:
                existing.exonerationOrReleaseYear ?? parseIntOrNull(d.exonerationOrReleaseYear),
              timeServed: existing.timeServed || d.timeServed || null,
              sentence: existing.sentence || d.sentence || null,
              caseLocationCity: existing.caseLocationCity || d.caseLocationCity || null,
              caseLocationCounty: existing.caseLocationCounty || d.caseLocationCounty || null,
              caseLocationState: existing.caseLocationState || d.caseLocationState || null,
              narrativeSummary: (() => {
                const pick = chooseNarrativeSummary(
                  existing,
                  d.narrativeSummary,
                  d.sourceName || defaultSourceName || ingestionSource,
                  safeSummaryPolicy
                );
                if (pick.replaced) summariesUpdated++;
                return pick.value;
              })(),
              // If a non-NRE source is being merged onto an NRE-only record, auto-promote to published!
              ...(incomingHasNonNre ? { nreOnly: false, isPublished: true } : {}),
              ...(factorConnectIds.length > 0
                ? { contributingFactors: { connect: factorConnectIds } }
                : {}),
            },
          });
          targetIndividualId = existing.id;
          merged++;
        } else if (row.action === 'CREATE') {
          if (!d.firstName?.trim() || !d.lastName?.trim()) {
            errors.push({ rowIndex: row.rowIndex, error: 'firstName and lastName are required.' });
            continue;
          }
          const createdInd = await prisma.individual.create({
            data: {
              firstName: d.firstName.trim(),
              middleName: d.middleName?.trim() || null,
              lastName: d.lastName.trim(),
              suffix: d.suffix?.trim() || null,
              nickname: d.nickname?.trim() || null,
              disambiguationTag: d.disambiguationTag?.trim() || null,
              status: VALID_INDIVIDUAL_STATUSES.has(d.status) ? d.status : null,
              claimStrength: VALID_CLAIM_STRENGTHS.has(d.claimStrength) ? d.claimStrength : 'UNASSESSED',
              crimeCategoryId,
              convictionYear: parseIntOrNull(d.convictionYear),
              exonerationOrReleaseYear: parseIntOrNull(d.exonerationOrReleaseYear),
              timeServed: d.timeServed?.trim() || null,
              sentence: d.sentence?.trim() || null,
              caseLocationCity: d.caseLocationCity?.trim() || null,
              caseLocationCounty: d.caseLocationCounty?.trim() || null,
              caseLocationState: d.caseLocationState?.trim() || null,
              caseLocationCountry: d.caseLocationCountry?.trim() || 'USA',
              narrativeSummary: d.narrativeSummary?.trim() || null,
              aiGenerated: Boolean(aiGenerated),
              verificationStatus: safeStatus,
              ...verifiedFields,
              ingestionSource,
              importBatchId: batchId,
              nreOnly: incomingIsOnlyNre,
              isPublished: !incomingIsOnlyNre,
              ...(factorConnectIds.length > 0
                ? { contributingFactors: { connect: factorConnectIds } }
                : {}),
            },
          });
          targetIndividualId = createdInd.id;
          created++;
        }

        // Attach all source links (supports multi-case NRE individuals via sourceLinks[] or legacy single sourceUrl)
        const linksToAttach =
          Array.isArray(d.sourceLinks) && d.sourceLinks.length > 0
            ? d.sourceLinks
            : d.sourceUrl && d.sourceUrl.trim()
              ? [{ sourceName: d.sourceName, sourceUrl: d.sourceUrl.trim(), headline: d.sourceHeadline }]
              : [];

        if (targetIndividualId && linksToAttach.length > 0) {
          for (const sl of linksToAttach) {
            const url = (sl.sourceUrl || '').trim();
            if (!url) continue;
            const infoSourceId = await ensureInformationSource(sl.sourceName || d.sourceName);
            try {
              await prisma.individualSourceLink.upsert({
                where: {
                  individualId_specificUrl: {
                    individualId: targetIndividualId,
                    specificUrl: url,
                  },
                },
                update: {
                  headline: sl.headline?.trim() || undefined,
                },
                create: {
                  individualId: targetIndividualId,
                  informationSourceId: infoSourceId,
                  specificUrl: url,
                  headline: sl.headline?.trim() || null,
                },
              });
              linksAdded++;
            } catch (linkErr) {
              errors.push({
                rowIndex: row.rowIndex,
                name: `${d.firstName} ${d.lastName}`,
                error: `Record saved, but source link failed (${url}): ${linkErr.message}`,
              });
            }
          }
        }
      } catch (err) {
        errors.push({
          rowIndex: row.rowIndex,
          name: `${d.firstName || ''} ${d.lastName || ''}`.trim(),
          error: err.message,
        });
      }
    }

    return res.json({ batchId, targetType, created, merged, skipped, linksAdded, summariesUpdated, errors });
  } catch (error) {
    console.error('Error committing import batch:', error);
    return res.status(500).json({ message: 'Failed to commit import batch.', error: error.message });
  }
});

module.exports = router;
