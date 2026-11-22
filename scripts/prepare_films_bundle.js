// scripts/prepare_films_bundle.js
// Merges:
//   1. server/prisma/seed_files/films/*.json (82 researched film/doc/TV episode JSONs)
//   2. scripts/streaming/tmdb_data.csv (73 TMDB rows — posters, IDs, release years, credits, summaries)
//   3. scripts/streaming/streaming_availability_us_conditional_purchase.csv (205 Watchmode US streaming rows)
//
// Normalizes all fields to the current Prisma schema enums (ContributingFactorCode, IndividualStatus,
// InnocenceClaimStrength, OrganizationType, InvolvedPersonRole, MediaWorkType, MediaItemType,
// StreamingType, CrimeCategory), fixes broken parenthetical TV series titles, blocks known wrong
// TMDB matches, flags potential AI hallucinations / editorial review items, and writes:
//   - server/prisma/seed_files/films_v2/<slug>.json (individual normalized MediaWork files)
//   - server/prisma/seed_files/films_v2/all_films_bundle.json (combined array for /admin/import)
//   - server/prisma/seed_files/films_v2/AUDIT_REPORT.md (detailed data hygiene & anomaly report)

const fs = require('fs');
const path = require('path');
const { parse } = require(require.resolve('csv-parse/sync', { paths: [path.resolve(__dirname, '../server')] }));
const humanparser = require(require.resolve('humanparser', { paths: [path.resolve(__dirname, '../server')] }));
const {
  resolveContributingFactorCodes,
  resolveCrimeCategoryName,
} = require('../server/utils/canonicalCatalog');

const SEED_DIR = path.resolve(__dirname, '../server/prisma/seed_files');
const FILMS_DIR = path.join(SEED_DIR, 'films');
const STREAM_DIR = path.resolve(__dirname, './streaming');
const TMDB_CSV_PATH = fs.existsSync(path.join(STREAM_DIR, 'tmdb_data.csv'))
  ? path.join(STREAM_DIR, 'tmdb_data.csv')
  : path.join(SEED_DIR, 'tmdb_data.csv');
const STREAMING_CSV_PATH = path.join(STREAM_DIR, 'streaming_availability_us_conditional_purchase.csv');
const OUT_DIR = path.join(SEED_DIR, 'films_v2');

const VALID_ROLES = new Set([
  'LAWYER_DEFENSE', 'LAWYER_PROSECUTION', 'JUDGE', 'WITNESS_EYEWITNESS', 'WITNESS_ALIBI',
  'WITNESS_EXPERT', 'WITNESS_INFORMANT', 'POLICE_DETECTIVE', 'POLICE_OFFICER', 'VICTIM',
  'FAMILY_MEMBER', 'JOURNALIST', 'AUTHOR', 'DIRECTOR', 'HOST', 'ACTIVIST', 'ACCUSER',
  'ACTUAL_PERPETRATOR', 'CO_DEFENDANT', 'SUBJECT_EXONEREE', 'SUBJECT_OTHER', 'OTHER', 'UNKNOWN',
]);

const VALID_WORK_TYPES = new Set([
  'BOOK', 'FILM', 'DOCUMENTARY', 'DOCUSERIES', 'PODCAST_SERIES', 'TV_SERIES',
  'ACADEMIC_PAPER', 'NEWS_ARTICLE', 'OTHER', 'UNKNOWN',
]);

const VALID_ITEM_TYPES = new Set([
  'PODCAST_EPISODE', 'TV_EPISODE', 'BOOK_CONTENT', 'FILM_CONTENT',
  'DOCUMENTARY_CONTENT', 'BOOK_CHAPTER', 'ARTICLE', 'ACADEMIC_PAPER', 'OTHER', 'UNKNOWN',
]);

const INVALID_NAME_TOKENS = new Set([
  'unknown', 'n/a', 'na', 'none', 'unnamed', 'anonymous', 'prisoner', 'various',
  'detective', 'officer', 'judge', 'justice', 'doctor', 'dr', 'dr.',
  'mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.', 'attorney', 'prosecutor',
]);

// Known parenthetical series suffixes in films/*.json that accidentally lived in media_work.title
const PARENTHETICAL_SERIES_MAP = {
  'dateline nbc': 'Dateline NBC',
  '48 hours': '48 Hours',
  '20/20': '20/20',
  'nightline': 'Nightline',
  'pbs newshour report': 'PBS NewsHour',
  'pbs newshour': 'PBS NewsHour',
  'cnn special report': 'CNN Special Report',
  '60 minutes': '60 Minutes',
  'frontline': 'FRONTLINE',
};

// Known TMDB IDs that are WRONG matches or completely unrelated shows
const BLOCKED_TMDB_IDS = new Set([
  '1428',   // MythBusters — completely unrelated entertainment show
  '157062', // The Suspect (2022 UK clinical psychologist thriller) — WRONG match for Amar Wala's Hassan Diab doc
]);

// Known TMDB-only rows that warrant a review warning + recommended SKIP by default so user explicitly decides
const SUSPECT_TMDB_ROWS = {
  '67464': 'WRONG TMDB MATCH: TMDB #67464 ("Love, lust, murder, mystery, suspense...") is NOT the MTV/Ryan Ferguson "Unlocking the Truth" docuseries, and has no poster.',
  '32940': 'Editorial check: "Accused" (2010) is a fictional UK anthology drama rather than a real wrongful-conviction case.',
  '11105': 'Editorial check: "Forensic Files" is a general true-crime forensics series (not wrongful-conviction focused).',
  '132378': 'Editorial check: "Stephen" (2021) is a UK drama about the Stephen Lawrence murder investigation, not a wrongful conviction.',
  '1294456': 'Incomplete TMDB metadata (blank summary) and possible duplicate of "The Wrong Man? 20 Years Behind Bars" (#1423329).',
  '1423329': 'Missing TMDB poster and possible duplicate of "The Wrong Man: 17 Years Behind Bars" (#1294456).',
};

// TMDB TV Shows that are actually documentary series (DOCUSERIES) so they appear under Films & Documentaries
const TMDB_DOCUSERIES_TITLES = new Set([
  'death row stories',
  'exhibit a',
  'i am innocent',
  'making a murderer',
  'murder on middle beach',
  'outcry',
  'the case against adnan syed',
  'the confession tapes',
  'the innocence files',
  'the innocent man',
  'the staircase',
  'time the kalief browder story',
  'trial by media',
  'when they see us',
  'who killed garrett phillips',
  'wrong man',
]);

function normTitle(t) {
  return (t || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function slugify(t) {
  return normTitle(t).replace(/\s+/g, '_').slice(0, 60) || 'untitled';
}

function cleanVal(val) {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  if (!s || s.toUpperCase() === 'NULL' || s.toUpperCase() === 'N/A' || s.toUpperCase() === 'TBD') return null;
  return s;
}

function parseIntOrNull(val) {
  const s = cleanVal(val);
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}

function parseFloatOrNull(val) {
  const s = cleanVal(val);
  if (!s) return null;
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ''));
  return Number.isNaN(n) ? null : n;
}

function parseIsoDateOrNull(val) {
  const s = cleanVal(val);
  if (!s) return null;
  // Handle YYYY or full date strings safely
  if (/^\d{4}$/.test(s)) return `${s}-01-01`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function toHttps(url) {
  const s = cleanVal(url);
  if (!s) return null;
  if (s.startsWith('http://')) return 'https://' + s.slice(7);
  if (s.startsWith('https://')) return s;
  if (s.startsWith('/')) return `https://image.tmdb.org/t/p/w500${s}`;
  return null;
}

function mapIndividualStatus(statusRaw) {
  const text = Array.isArray(statusRaw) ? statusRaw.join(' ') : String(statusRaw || '');
  const lower = text.toLowerCase().trim();
  if (!lower) return 'UNKNOWN';
  const upper = text.trim().toUpperCase();
  if ([
    'EXONERATED', 'RELEASED_ALFORD_PLEA', 'RELEASED_CLEMENCY', 'RELEASED_TIME_SERVED',
    'CONVICTION_OVERTURNED', 'EXECUTED', 'CONVICTED', 'OTHER', 'UNKNOWN',
  ].includes(upper)) {
    return upper;
  }
  if (lower.includes('exonerat')) return 'EXONERATED';
  if (lower.includes('alford')) return 'RELEASED_ALFORD_PLEA';
  if (lower.includes('pardon') || lower.includes('clemency') || lower.includes('commut')) return 'RELEASED_CLEMENCY';
  if (lower.includes('time served')) return 'RELEASED_TIME_SERVED';
  if (lower.includes('overturned') || lower.includes('vacated') || lower.includes('dismissed') || lower.includes('acquitted')) return 'CONVICTION_OVERTURNED';
  if (lower.includes('executed')) return 'EXECUTED';
  if (lower.includes('convicted') || lower.includes('incarcerated') || lower.includes('death row') || lower.includes('prison')) return 'CONVICTED';
  if (lower.includes('released') || lower.includes('freed')) return 'OTHER';
  return 'UNKNOWN';
}

function inferClaimStrength(status) {
  if (status === 'EXONERATED') return 'FORMALLY_EXONERATED';
  if (status === 'RELEASED_ALFORD_PLEA' || status === 'RELEASED_CLEMENCY' || status === 'CONVICTION_OVERTURNED') {
    return 'OFFICIAL_RELIEF_NO_EXONERATION';
  }
  return 'UNASSESSED';
}

function inferOrganizationType(name) {
  const lower = (name || '').toLowerCase();
  if (
    lower.includes('innocence') || lower.includes('equal justice') || lower.includes('centurion') ||
    lower.includes('wrongful conviction') || lower.includes('exoneration') || lower.includes('justice project') ||
    lower.includes('witness to innocence')
  ) return 'INNOCENCE_ORG';
  if (lower.includes('legal aid') || lower.includes('public defender') || lower.includes('defender') || lower.includes('aclu') || lower.includes('naacp')) return 'LEGAL_AID';
  if (lower.includes('law firm') || lower.includes('llp')) return 'LAW_FIRM';
  if (lower.includes('police') || lower.includes('sheriff') || lower.includes('district attorney') || lower.includes('prosecut') || lower.includes('fbi') || lower.includes('attorney general') || lower.includes('nypd')) return 'LAW_ENFORCEMENT';
  if (lower.includes('university') || lower.includes('school of law') || lower.includes('college') || lower.includes('clinic')) return 'UNIVERSITY';
  if (lower.includes('department of') || lower.includes('commission') || lower.includes('court') || lower.includes('board of') || lower.includes('supreme court')) return 'GOVERNMENT_AGENCY';
  if (lower.includes('support') || lower.includes('reentry') || lower.includes('healing')) return 'SUPPORT_GROUP';
  if (lower.includes('cbs') || lower.includes('nbc') || lower.includes('abc') || lower.includes('pbs') || lower.includes('cnn') || lower.includes('hbo') || lower.includes('netflix') || lower.includes('films') || lower.includes('pictures') || lower.includes('productions') || lower.includes('times') || lower.includes('tribune') || lower.includes('media')) return 'MEDIA_ORG';
  return 'OTHER';
}

function mapStreamingType(raw) {
  const lower = (raw || '').trim().toLowerCase();
  if (lower === 'sub' || lower === 'subscription') return 'SUBSCRIPTION';
  if (lower === 'rent') return 'RENT';
  if (lower === 'buy' || lower === 'purchase') return 'BUY';
  if (lower === 'free' || lower === 'tve') return 'FREE';
  return 'OTHER';
}

function extractFactorsFromMixed(val) {
  const codes = new Set();
  const unmapped = [];
  const items = Array.isArray(val) ? val : typeof val === 'string' ? [val] : [];
  for (const entry of items) {
    if (!entry || typeof entry !== 'string') continue;
    const parts = entry.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
    for (const p of parts) {
      const resolved = resolveContributingFactorCodes(p);
      if (resolved.length > 0) {
        resolved.forEach((c) => codes.add(c));
      } else {
        unmapped.push(p);
      }
    }
  }
  return { codes: Array.from(codes), unmapped };
}

function parseNameParts(obj) {
  let firstName = cleanVal(obj.first_name || obj.firstName);
  let middleName = cleanVal(obj.middle_name || obj.middleName);
  let lastName = cleanVal(obj.last_name || obj.lastName);
  let suffix = cleanVal(obj.suffix);
  const full = cleanVal(obj.full_name || obj.name_raw || obj.name);

  if ((!firstName || !lastName) && full) {
    const cleaned = full.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
    const parsed = humanparser.parseName(cleaned);
    firstName = firstName || cleanVal(parsed.firstName);
    middleName = middleName || cleanVal(parsed.middleName);
    lastName = lastName || cleanVal(parsed.lastName);
    suffix = suffix || cleanVal(parsed.suffix);
  }
  return { firstName, middleName, lastName, suffix, full };
}

function isValidPersonName(firstName, lastName) {
  const f = (firstName || '').trim().toLowerCase();
  const l = (lastName || '').trim().toLowerCase();
  if (!f || !l) return false;
  if (INVALID_NAME_TOKENS.has(f) || INVALID_NAME_TOKENS.has(l)) return false;
  if (f.includes('unknown') || l.includes('unknown')) return false;
  return true;
}

function extractUrlsFromRaw(rawLinks) {
  const urls = [];
  const seen = new Set();
  const list = Array.isArray(rawLinks) ? rawLinks : typeof rawLinks === 'string' ? [rawLinks] : [];
  for (const item of list) {
    if (!item) continue;
    if (typeof item === 'object' && item.url) {
      const u = toHttps(item.url);
      if (u && !seen.has(u)) {
        seen.add(u);
        urls.push({ url: u, description: cleanVal(item.description || item.title) || null });
      }
      continue;
    }
    const text = String(item);
    const matches = text.match(/https?:\/\/[^\s)>"']+/gi) || [];
    for (const m of matches) {
      const cleanUrl = m.replace(/[.,;:\]]+$/, '');
      if (!seen.has(cleanUrl)) {
        seen.add(cleanUrl);
        const desc = text.replace(m, '').replace(/[\[\]()\-:]+/g, ' ').trim();
        urls.push({ url: cleanUrl, description: desc ? desc.slice(0, 140) : null });
      }
    }
  }
  return urls;
}

function normalizeSeriesTitleAndItem(rawTitle, rawItemTitle, rawWorkType) {
  let title = (rawTitle || '').trim();
  let itemTitle = (rawItemTitle || '').trim();
  let fixedParenthetical = false;

  // Detect "<Episode Title> (<Series Name>)" pattern (21 JSONs had this bug!)
  const m = title.match(/^(.+?)\s*\(([^()]+)\)\s*$/);
  if (m) {
    const inside = m[2].trim().toLowerCase();
    if (PARENTHETICAL_SERIES_MAP[inside]) {
      const epPart = m[1].trim();
      title = PARENTHETICAL_SERIES_MAP[inside];
      if (!itemTitle || normTitle(itemTitle) === normTitle(rawTitle)) {
        itemTitle = epPart;
      }
      fixedParenthetical = true;
    }
  }

  // Normalize "Murder on a Sunday Morning (Un coupable idéal)" for clean TMDB matching
  let tmdbLookupTitle = title;
  if (normTitle(title).startsWith('murder on a sunday morning')) {
    tmdbLookupTitle = 'Murder on a Sunday Morning';
  }

  // Normalize FRONTLINE / Frontline casing
  if (normTitle(title) === 'frontline') title = 'FRONTLINE';

  const workType = VALID_WORK_TYPES.has((rawWorkType || '').toUpperCase())
    ? rawWorkType.toUpperCase()
    : 'DOCUMENTARY';

  return { title, tmdbLookupTitle, itemTitle, workType, fixedParenthetical };
}

function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  // Remove stale .json files in OUT_DIR before regenerating
  for (const existing of fs.readdirSync(OUT_DIR)) {
    if (existing.endsWith('.json') || existing === 'AUDIT_REPORT.md') {
      fs.unlinkSync(path.join(OUT_DIR, existing));
    }
  }

  // 1. Load TMDB CSV (normalize header keys with trim!)
  const rawTmdb = parse(fs.readFileSync(TMDB_CSV_PATH, 'utf8'), {
    columns: (headers) => headers.map((h) => h.trim()),
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });

  const tmdbByNormTitle = new Map();
  const tmdbById = new Map();
  const excludedTmdbRows = [];

  for (const row of rawTmdb) {
    const id = cleanVal(row.externalId);
    const title = cleanVal(row.Title);
    if (!title) continue;
    if (id && BLOCKED_TMDB_IDS.has(id)) {
      excludedTmdbRows.push({
        title,
        externalId: id,
        reason: id === '1428'
          ? 'Unrelated TV show (MythBusters) — excluded from Innocence Archive bundle.'
          : 'Wrong TMDB match (2022 UK clinical psychologist thriller) — blocked from attaching to Amar Wala\'s "The Suspect" documentary.',
      });
      continue;
    }
    tmdbByNormTitle.set(normTitle(title), row);
    if (id) tmdbById.set(id, row);
  }

  // 2. Load Watchmode US Streaming CSV indexed by tmdb_id
  const rawStreaming = parse(fs.readFileSync(STREAMING_CSV_PATH, 'utf8'), {
    columns: (headers) => headers.map((h) => h.trim()),
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });

  const streamingByTmdbId = new Map();
  for (const row of rawStreaming) {
    const tid = cleanVal(row.tmdb_id);
    if (!tid || BLOCKED_TMDB_IDS.has(tid)) continue;
    const providerName = cleanVal(row.source_name);
    if (!providerName) continue;
    const streamingType = mapStreamingType(row.source_type);
    const url = toHttps(row.web_url);
    const priceAmount = parseFloatOrNull(row.price);
    const priceCurrency = priceAmount !== null ? 'USD' : null;
    const presentationQuality = 'HD';

    const list = streamingByTmdbId.get(tid) || [];
    const dedupKey = `${providerName.toLowerCase()}::${streamingType}::${presentationQuality}`;
    if (!list.some((x) => `${x.providerName.toLowerCase()}::${x.streamingType}::${x.presentationQuality}` === dedupKey)) {
      list.push({
        providerName,
        watchmodeProviderId: parseIntOrNull(row.watchmode_id),
        streamingType,
        url,
        priceAmount,
        priceCurrency,
        presentationQuality,
      });
    }
    streamingByTmdbId.set(tid, list);
  }

  // 3. Process all 82 film/episode JSONs and group into unified MediaWork entries
  const jsonFiles = fs.readdirSync(FILMS_DIR).filter((f) => f.endsWith('.json')).sort();
  const worksMap = new Map(); // normTitle(workTitle) -> unified bundle work object
  const usedTmdbNormTitles = new Set();

  let fixedParentheticalCount = 0;
  let skippedInvalidIndividuals = [];
  let totalEpisodes = 0;
  let totalIndividuals = 0;
  let totalInvolvedPersons = 0;
  let totalStreamingLinks = 0;

  for (const file of jsonFiles) {
    const raw = JSON.parse(fs.readFileSync(path.join(FILMS_DIR, file), 'utf8'));
    const mw = raw.media_work || {};
    const mi = raw.media_item || {};

    const { title, tmdbLookupTitle, itemTitle, workType, fixedParenthetical } =
      normalizeSeriesTitleAndItem(mw.title, mi.item_title || mw.episode_title_raw, mw.work_type);

    if (fixedParenthetical) fixedParentheticalCount++;

    const workKey = normTitle(title);
    let entry = worksMap.get(workKey);

    if (!entry) {
      // Check TMDB match (skipping blocked IDs and skipping 2017 "Frank Serpico" doc for 1973 "Serpico" film)
      const tmdb = tmdbByNormTitle.get(normTitle(tmdbLookupTitle)) || null;
      const reviewWarnings = [];

      if (tmdb) {
        usedTmdbNormTitles.add(normTitle(tmdb.Title));
      } else {
        if (normTitle(title) === 'the suspect') {
          reviewWarnings.push('TMDB #157062 ("The Suspect" 2022 UK thriller) was a WRONG match and blocked. Needs correct TMDB lookup/poster for Amar Wala\'s documentary on Hassan Diab.');
        } else if (file === '9.7.frank_serpico.json') {
          reviewWarnings.push('Filename says "frank_serpico" (2017 doc, TMDB #454192) but JSON describes the 1973 Sidney Lumet film "Serpico". Did not attach 2017 TMDB data — verify which film you want.');
        } else if (!['CNN Special Report'].includes(title)) {
          reviewWarnings.push('No TMDB match in tmdb_data.csv — missing poster/TMDB ID (can enrich via /admin/film/add or TMDB lookup).');
        }
      }

      if (fixedParenthetical) {
        reviewWarnings.push(`Normalized parenthetical series title from legacy JSON ("${mw.title}" -> "${title}").`);
      }

      const tmdbId = tmdb ? cleanVal(tmdb.externalId) : null;
      const streamingProviders = tmdbId ? (streamingByTmdbId.get(tmdbId) || []) : [];

      const jsonYear = parseIntOrNull(mw.publication_or_release_year);
      const tmdbYear = tmdb ? parseIntOrNull(tmdb['Release Year']) : null;
      if (jsonYear && tmdbYear && Math.abs(jsonYear - tmdbYear) >= 2 && workType !== 'TV_SERIES') {
        reviewWarnings.push(`Release year mismatch: JSON says ${jsonYear}, TMDB says ${tmdbYear} — verify correct release year.`);
      }

      const creator = cleanVal(mw.creator_name || mw.director_name) || (tmdb ? cleanVal(tmdb['Creator Name(s)']) : null);
      const publisher = cleanVal(mw.publisher_or_network) || (tmdb ? cleanVal(tmdb['Publisher/Network(s)']) : null);
      const tmdbSummary = tmdb ? cleanVal(tmdb['Summary Notes (TMDB)']) : null;
      const jsonSummary = cleanVal(mw.summaryNotes);

      // Prefer TMDB summary for TV_SERIES/DOCUSERIES overview; for standalone FILM/DOC prefer curated research or TMDB
      const summaryNotes =
        workType === 'TV_SERIES'
          ? (tmdbSummary || jsonSummary)
          : (tmdbSummary || jsonSummary || cleanVal(mi.summary_notes));

      entry = {
        sourceFiles: [],
        sourceType: 'RESEARCH_JSON_MERGED',
        recommendedAction: 'CREATE',
        reviewWarnings,
        mediaWork: {
          title,
          workType,
          creatorName: creator,
          publicationOrReleaseYear: tmdbYear || jsonYear,
          publisherOrNetwork: publisher,
          focusOrTheme: cleanVal(mw.focus_or_theme),
          summaryNotes,
          availabilityNotes: cleanVal(mw.availabilityNotes),
          sourceUrl: toHttps(mw.sourceUrl),
          externalId: tmdbId,
          imagePath: tmdb ? toHttps(tmdb['Image Path']) : null,
          sourcingCredit: tmdb
            ? (cleanVal(tmdb.SourcingCredit) || 'This product uses the TMDB API but is not endorsed or certified by TMDB.')
            : null,
          aiGenerated: !tmdb,
        },
        streamingProviders,
        mediaItems: [],
      };
      worksMap.set(workKey, entry);
      totalStreamingLinks += streamingProviders.length;
    }

    entry.sourceFiles.push(file);

    // Build normalized MediaItem for this JSON file
    const defaultItemType =
      workType === 'TV_SERIES'
        ? 'TV_EPISODE'
        : workType === 'FILM'
          ? 'FILM_CONTENT'
          : 'DOCUMENTARY_CONTENT';
    const rawItemType = (mi.item_media_type || '').toUpperCase();
    const itemMediaType = VALID_ITEM_TYPES.has(rawItemType) ? rawItemType : defaultItemType;

    const itemFactors = new Set();
    const { codes: sysCodes } = extractFactorsFromMixed(mi.systemic_issues_raw);
    sysCodes.forEach((c) => itemFactors.add(c));

    // Normalize featured_individuals
    const featuredIndividuals = [];
    const featuredNameKeys = new Set();
    for (const rawInd of raw.featured_individuals || []) {
      const { firstName, middleName, lastName, suffix, full } = parseNameParts(rawInd);
      if (!isValidPersonName(firstName, lastName)) {
        skippedInvalidIndividuals.push({ file, title, rawName: full || `${firstName || ''} ${lastName || ''}`.trim() });
        entry.reviewWarnings.push(`Skipped placeholder/invalid individual "${full || 'blank'}" from ${file}.`);
        continue;
      }

      const status = mapIndividualStatus(rawInd.status);
      const claimStrength = inferClaimStrength(status);
      const crimeRaw = cleanVal(rawInd.crime_convicted_of_raw);
      const crimeCategoryName = crimeRaw ? resolveCrimeCategoryName(crimeRaw) : null;
      const { codes: indFactorCodes } = extractFactorsFromMixed(rawInd.contributing_factors_raw);
      indFactorCodes.forEach((c) => itemFactors.add(c));

      const organizations = [];
      const orgSeen = new Set();
      const rawOrgs = Array.isArray(rawInd.organizations_involved_raw)
        ? rawInd.organizations_involved_raw
        : typeof rawInd.organizations_involved_raw === 'string'
          ? [rawInd.organizations_involved_raw]
          : [];
      for (const o of rawOrgs) {
        const orgName = cleanVal(typeof o === 'string' ? o : o?.name);
        if (!orgName || orgName.toLowerCase() === 'none mentioned') continue;
        const oKey = orgName.toLowerCase();
        if (!orgSeen.has(oKey)) {
          orgSeen.add(oKey);
          organizations.push({ name: orgName, type: inferOrganizationType(orgName) });
        }
      }

      featuredNameKeys.add(`${firstName.toLowerCase()}::${lastName.toLowerCase()}`);
      featuredIndividuals.push({
        firstName,
        middleName,
        lastName,
        suffix,
        status,
        claimStrength,
        crimeCategoryName,
        convictionYear: parseIntOrNull(rawInd.conviction_year),
        exonerationOrReleaseYear: parseIntOrNull(rawInd.exoneration_or_release_year),
        timeServed: cleanVal(rawInd.time_served),
        sentence: cleanVal(rawInd.sentence),
        caseLocationCity: cleanVal(rawInd.case_location_city),
        caseLocationCounty: null,
        caseLocationState: cleanVal(rawInd.case_location_state),
        caseLocationCountry: 'USA',
        narrativeSummary: cleanVal(rawInd.narrative_summary),
        contributingFactorCodes: indFactorCodes,
        organizations,
      });
      totalIndividuals++;
    }

    // Normalize involved_persons (excluding anyone already in featuredIndividuals and invalid placeholders)
    const involvedPersons = [];
    const seenOip = new Set();
    for (const rawP of raw.involved_persons || []) {
      const { firstName, middleName, lastName, suffix } = parseNameParts(rawP);
      if (!isValidPersonName(firstName, lastName)) continue;
      const nameKey = `${firstName.toLowerCase()}::${lastName.toLowerCase()}`;
      if (featuredNameKeys.has(nameKey)) continue; // Avoid duplicating exoneree into involved_persons
      const rawRole = (rawP.role || 'OTHER').toUpperCase().trim();
      const role = VALID_ROLES.has(rawRole) ? rawRole : 'OTHER';
      if (seenOip.has(nameKey)) continue;
      seenOip.add(nameKey);
      involvedPersons.push({ firstName, middleName, lastName, suffix, role });
      totalInvolvedPersons++;
    }

    const keyQuotes = Array.isArray(mi.key_quotes_raw)
      ? mi.key_quotes_raw.map((q) => cleanVal(q)).filter(Boolean).join('\n\n') || null
      : cleanVal(mi.key_quotes_raw);

    const externalLinks = extractUrlsFromRaw(mi.external_links_raw);
    const resolvedItemTitle =
      itemTitle ||
      (workType === 'TV_SERIES'
        ? path.basename(file, '.json')
        : `${title} (${workType === 'FILM' ? 'Film' : 'Documentary'})`);

    entry.mediaItems.push({
      sourceFileName: file,
      itemTitle: resolvedItemTitle,
      itemNumber: cleanVal(mi.item_number),
      itemMediaType,
      releaseDate: parseIsoDateOrNull(mi.release_date),
      hostOrNarrator: cleanVal(mi.hostOrNarrator),
      focusOrTheme: cleanVal(mi.focus_or_theme) || cleanVal(mw.focus_or_theme),
      summaryNotes: cleanVal(mi.summary_notes) || cleanVal(mw.summaryNotes),
      keyQuotes,
      sourceUrl: toHttps(mi.sourceUrl) || toHttps(mw.sourceUrl),
      contributingFactorCodes: Array.from(itemFactors),
      featuredIndividuals,
      involvedPersons,
      externalLinks,
    });
    totalEpisodes++;
  }

  // Flag standalone research docs/films with 0 linked individuals (editorial sanity check)
  for (const entry of worksMap.values()) {
    const totalLinkedInds = entry.mediaItems.reduce((acc, it) => acc + it.featuredIndividuals.length, 0);
    if (totalLinkedInds === 0) {
      entry.reviewWarnings.push('0 wrongfully convicted individuals linked — verify whether this is a broader criminal-justice title or needs case links added.');
    }
  }

  // 4. Add remaining TMDB-only titles (not already covered by films/*.json)
  let tmdbOnlyCount = 0;
  let tmdbOnlyFlaggedSkip = 0;
  for (const row of rawTmdb) {
    const id = cleanVal(row.externalId);
    const title = cleanVal(row.Title);
    if (!title) continue;
    if (id && BLOCKED_TMDB_IDS.has(id)) continue;
    const nTitle = normTitle(title);
    if (usedTmdbNormTitles.has(nTitle) || worksMap.has(nTitle)) continue;

    const reviewWarnings = [];
    let recommendedAction = 'CREATE';

    if (id && SUSPECT_TMDB_ROWS[id]) {
      reviewWarnings.push(SUSPECT_TMDB_ROWS[id]);
      recommendedAction = 'SKIP';
      tmdbOnlyFlaggedSkip++;
    }
    if (!id) {
      reviewWarnings.push('Missing TMDB externalId in tmdb_data.csv — verify TMDB ID before committing.');
      recommendedAction = 'SKIP';
      tmdbOnlyFlaggedSkip++;
    }
    const imagePath = toHttps(row['Image Path']);
    if (!imagePath) {
      reviewWarnings.push('No TMDB poster imagePath in CSV.');
    }

    let workType = 'FILM';
    if (row.Type === 'TV Show') {
      workType = TMDB_DOCUSERIES_TITLES.has(nTitle) ? 'DOCUSERIES' : 'TV_SERIES';
    } else if (
      /documentary|story|case|innocent|exonerated|willin|behind bars|frank serpico/i.test(
        `${title} ${row['Summary Notes (TMDB)'] || ''}`
      )
    ) {
      workType = 'DOCUMENTARY';
    }

    const streamingProviders = id ? (streamingByTmdbId.get(id) || []) : [];
    const summaryNotes = cleanVal(row['Summary Notes (TMDB)']);
    const releaseYear = parseIntOrNull(row['Release Year']);
    const itemMediaType =
      workType === 'FILM'
        ? 'FILM_CONTENT'
        : workType === 'DOCUMENTARY' || workType === 'DOCUSERIES'
          ? 'DOCUMENTARY_CONTENT'
          : 'TV_EPISODE';

    const tmdbEntry = {
      sourceFiles: ['tmdb_data.csv'],
      sourceType: 'TMDB_ONLY',
      recommendedAction,
      reviewWarnings,
      mediaWork: {
        title,
        workType,
        creatorName: cleanVal(row['Creator Name(s)']),
        publicationOrReleaseYear: releaseYear,
        publisherOrNetwork: cleanVal(row['Publisher/Network(s)']),
        focusOrTheme: null,
        summaryNotes,
        availabilityNotes: null,
        sourceUrl: null,
        externalId: id,
        imagePath,
        sourcingCredit: cleanVal(row.SourcingCredit) || 'This product uses the TMDB API but is not endorsed or certified by TMDB.',
        aiGenerated: false,
      },
      streamingProviders,
      mediaItems:
        workType === 'TV_SERIES'
          ? [] // Ongoing TV series without researched episodes yet don't need a placeholder episode
          : [
              {
                sourceFileName: 'tmdb_data.csv',
                itemTitle: `${title} (${workType === 'FILM' ? 'Film' : workType === 'DOCUSERIES' ? 'Docuseries' : 'Documentary'})`,
                itemNumber: null,
                itemMediaType,
                releaseDate: releaseYear ? `${releaseYear}-01-01` : null,
                hostOrNarrator: null,
                focusOrTheme: null,
                summaryNotes,
                keyQuotes: null,
                sourceUrl: null,
                contributingFactorCodes: [],
                featuredIndividuals: [],
                involvedPersons: [],
                externalLinks: [],
              },
            ],
    };

    worksMap.set(nTitle, tmdbEntry);
    totalStreamingLinks += streamingProviders.length;
    tmdbOnlyCount++;
  }

  // 5. Sort bundle cleanly (researched works first alphabetically, then TMDB-only alphabetically)
  const bundle = Array.from(worksMap.values()).sort((a, b) => {
    if (a.sourceType !== b.sourceType) {
      return a.sourceType === 'RESEARCH_JSON_MERGED' ? -1 : 1;
    }
    return a.mediaWork.title.localeCompare(b.mediaWork.title);
  });

  // Write individual normalized JSONs + combined bundle
  bundle.forEach((entry, idx) => {
    const prefix = String(idx + 1).padStart(2, '0');
    const outName = `${prefix}_${slugify(entry.mediaWork.title)}.json`;
    fs.writeFileSync(path.join(OUT_DIR, outName), JSON.stringify(entry, null, 2) + '\n', 'utf8');
  });

  const bundlePath = path.join(OUT_DIR, 'all_films_bundle.json');
  fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2) + '\n', 'utf8');

  // 6. Write human-readable AUDIT_REPORT.md
  const workTypeCounts = {};
  for (const e of bundle) {
    workTypeCounts[e.mediaWork.workType] = (workTypeCounts[e.mediaWork.workType] || 0) + 1;
  }
  const withWarnings = bundle.filter((e) => e.reviewWarnings.length > 0);
  const flaggedSkip = bundle.filter((e) => e.recommendedAction === 'SKIP');
  const withStreaming = bundle.filter((e) => e.streamingProviders.length > 0);
  const withPosters = bundle.filter((e) => Boolean(e.mediaWork.imagePath));

  const lines = [
    '# Films, Series & Streaming Bundle — Data Hygiene Audit Report',
    '',
    '## Summary',
    `- **Total normalized MediaWorks in bundle:** ${bundle.length} (${bundle.length - tmdbOnlyCount} from 82 researched JSONs + ${tmdbOnlyCount} TMDB-only titles)`,
    `- **Work types:** ${Object.entries(workTypeCounts).map(([k, v]) => `${k}: ${v}`).join(' · ')}`,
    `- **Total researched MediaItems / Episodes:** ${totalEpisodes}`,
    `- **Broken parenthetical TV series titles auto-fixed:** ${fixedParentheticalCount}`,
    `- **Works with TMDB poster:** ${withPosters.length} / ${bundle.length}`,
    `- **Works with US streaming links (Watchmode):** ${withStreaming.length} (${totalStreamingLinks} total streaming provider rows)`,
    `- **Featured Individuals extracted:** ${totalIndividuals} (skipped ${skippedInvalidIndividuals.length} invalid/placeholder)`,
    `- **Other Involved Persons extracted (deduped against exonerees):** ${totalInvolvedPersons}`,
    `- **Works flagged with review warnings:** ${withWarnings.length} (${flaggedSkip.length} defaulted to \`SKIP\` in /admin/import)`,
    '',
    '## Hard-Blocked / Excluded Bad TMDB Rows',
    ...excludedTmdbRows.map((x) => `- **${x.title}** (TMDB \`#${x.externalId}\`): ${x.reason}`),
    '',
    '## Flagged `SKIP` by Default (Verify Before Committing)',
    ...flaggedSkip.map((e) => `- **${e.mediaWork.title}** (\`${e.mediaWork.workType}\`, TMDB \`#${e.mediaWork.externalId || 'NONE'}\`): ${e.reviewWarnings.join(' | ')}`),
    '',
    '## Other Review Warnings (Keep or Edit During Verification)',
    ...withWarnings
      .filter((e) => e.recommendedAction !== 'SKIP')
      .map((e) => `- **${e.mediaWork.title}** (\`${e.mediaWork.workType}\`): ${e.reviewWarnings.join(' | ')}`),
    '',
  ];

  fs.writeFileSync(path.join(OUT_DIR, 'AUDIT_REPORT.md'), lines.join('\n'), 'utf8');

  console.log('=== prepare_films_bundle.js COMPLETE ===');
  console.log(`Bundle written to: ${bundlePath}`);
  console.log(`Total MediaWorks: ${bundle.length} (${bundle.length - tmdbOnlyCount} researched + ${tmdbOnlyCount} TMDB-only)`);
  console.log(`Work types:`, workTypeCounts);
  console.log(`Episodes/Items from JSONs: ${totalEpisodes} | Parenthetical series titles fixed: ${fixedParentheticalCount}`);
  console.log(`Posters: ${withPosters.length}/${bundle.length} | Streaming links: ${totalStreamingLinks} across ${withStreaming.length} works`);
  console.log(`Individuals: ${totalIndividuals} (skipped ${skippedInvalidIndividuals.length}) | InvolvedPersons: ${totalInvolvedPersons}`);
  console.log(`Hard-blocked TMDB rows: ${excludedTmdbRows.length} | Flagged SKIP: ${flaggedSkip.length} | Total with warnings: ${withWarnings.length}`);
}

main();
