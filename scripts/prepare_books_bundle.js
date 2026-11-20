// scripts/prepare_books_bundle.js
// Merges server/prisma/seed_files/books/*.json with server/prisma/seed_files/bookdata_enhanced.csv,
// normalizes all fields to the current Prisma schema enums (ContributingFactorCode, IndividualStatus,
// InnocenceClaimStrength, OrganizationType, InvolvedPersonRole, MediaWorkType, MediaItemType, CrimeCategory),
// and writes:
//   - server/prisma/seed_files/books_v2/<file>.json (individual normalized files)
//   - server/prisma/seed_files/books_v2/all_books_bundle.json (combined array for /admin/import)

const fs = require('fs');
const path = require('path');
const { parse } = require(require.resolve('csv-parse/sync', { paths: [path.resolve(__dirname, '../server')] }));
const humanparser = require(require.resolve('humanparser', { paths: [path.resolve(__dirname, '../server')] }));
const {
  resolveContributingFactorCodes,
  resolveCrimeCategoryName,
} = require('../server/utils/canonicalCatalog');

const SEED_DIR = path.resolve(__dirname, '../server/prisma/seed_files');
const BOOKS_DIR = path.join(SEED_DIR, 'books');
const CSV_PATH = path.join(SEED_DIR, 'bookdata_enhanced.csv');
const OUT_DIR = path.join(SEED_DIR, 'books_v2');

const VALID_ROLES = new Set([
  'LAWYER_DEFENSE', 'LAWYER_PROSECUTION', 'JUDGE', 'WITNESS_EYEWITNESS', 'WITNESS_ALIBI',
  'WITNESS_EXPERT', 'WITNESS_INFORMANT', 'POLICE_DETECTIVE', 'POLICE_OFFICER', 'VICTIM',
  'FAMILY_MEMBER', 'JOURNALIST', 'AUTHOR', 'DIRECTOR', 'HOST', 'ACTIVIST', 'ACCUSER',
  'ACTUAL_PERPETRATOR', 'CO_DEFENDANT', 'SUBJECT_EXONEREE', 'SUBJECT_OTHER', 'OTHER', 'UNKNOWN',
]);

function normTitle(t) {
  return (t || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function toHttps(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed === 'NULL' || trimmed === '&h=600') return null;
  if (trimmed.startsWith('http://')) return 'https://' + trimmed.slice(7);
  return trimmed;
}

function cleanCsvVal(val) {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  if (!s || s.toUpperCase() === 'NULL') return null;
  return s;
}

function parseIntOrNull(val) {
  const s = cleanCsvVal(val);
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}

function parseFloatOrNull(val) {
  const s = cleanCsvVal(val);
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

function mapIndividualStatus(statusRaw) {
  const text = Array.isArray(statusRaw) ? statusRaw.join(' ') : String(statusRaw || '');
  const lower = text.toLowerCase();
  if (!lower.trim()) return 'UNKNOWN';
  if (lower.includes('exonerat')) return 'EXONERATED';
  if (lower.includes('alford')) return 'RELEASED_ALFORD_PLEA';
  if (lower.includes('pardon') || lower.includes('clemency') || lower.includes('commut')) return 'RELEASED_CLEMENCY';
  if (lower.includes('time served')) return 'RELEASED_TIME_SERVED';
  if (lower.includes('overturned') || lower.includes('vacated') || lower.includes('dismissed')) return 'CONVICTION_OVERTURNED';
  if (lower.includes('executed')) return 'EXECUTED';
  if (lower.includes('convicted') || lower.includes('incarcerated') || lower.includes('death row') || lower.includes('sentenced') || lower.includes('prison')) return 'CONVICTED';
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
  if (lower.includes('innocence') || lower.includes('equal justice') || lower.includes('centurion') || lower.includes('wrongful conviction') || lower.includes('exoneration') || lower.includes('justice project') || lower.includes('midwest innocence')) {
    return 'INNOCENCE_ORG';
  }
  if (lower.includes('legal aid') || lower.includes('public defender') || lower.includes('defender') || lower.includes('aclu') || lower.includes('naacp') || lower.includes('southern center')) {
    return 'LEGAL_AID';
  }
  if (lower.includes('law firm') || lower.includes('llp') || lower.includes('&')) return 'LAW_FIRM';
  if (lower.includes('police') || lower.includes('sheriff') || lower.includes('district attorney') || lower.includes('prosecut') || lower.includes('fbi') || lower.includes('attorney general')) {
    return 'LAW_ENFORCEMENT';
  }
  if (lower.includes('university') || lower.includes('school of law') || lower.includes('college') || lower.includes('clinic')) {
    return 'UNIVERSITY';
  }
  if (lower.includes('department of') || lower.includes('commission') || lower.includes('court') || lower.includes('board of')) {
    return 'GOVERNMENT_AGENCY';
  }
  if (lower.includes('support') || lower.includes('reentry') || lower.includes('after innocence') || lower.includes('healing')) {
    return 'SUPPORT_GROUP';
  }
  if (lower.includes('press') || lower.includes('books') || lower.includes('publishing') || lower.includes('times') || lower.includes('tribune') || lower.includes('media')) {
    return 'MEDIA_ORG';
  }
  return 'OTHER';
}

function parseLocation(locStr) {
  if (!locStr || typeof locStr !== 'string') return { city: null, county: null, state: null };
  const parts = locStr.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) return { city: parts[0], county: parts[1], state: parts[2] };
  if (parts.length === 2) {
    if (parts[0].toLowerCase().includes('county')) return { city: null, county: parts[0], state: parts[1] };
    return { city: parts[0], county: null, state: parts[1] };
  }
  if (parts.length === 1) return { city: null, county: null, state: parts[0] };
  return { city: null, county: null, state: null };
}

function extractFactorsFromArray(arr) {
  const codes = new Set();
  const unmapped = [];
  if (!Array.isArray(arr)) return { codes: [], unmapped: [] };
  for (const entry of arr) {
    if (!entry || typeof entry !== 'string') continue;
    // Split comma/semicolon lists inside a single string
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

function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // 1. Load bookdata_enhanced.csv indexed by normalized title
  const csvRecords = parse(fs.readFileSync(CSV_PATH, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });

  const enhancedByTitle = new Map();
  for (const row of csvRecords) {
    const key = normTitle(row.title);
    if (key) enhancedByTitle.set(key, row);
  }

  // 2. Process all book JSONs
  const files = fs.readdirSync(BOOKS_DIR).filter((f) => f.endsWith('.json')).sort();
  const bundle = [];

  let matchedEnhanced = 0;
  let unmatchedEnhanced = 0;
  let totalIndividuals = 0;
  let totalOrgs = 0;
  let totalInvolvedPersons = 0;
  const unmatchedBookTitles = [];
  const suspiciousMatches = [];

  for (const file of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(BOOKS_DIR, file), 'utf8'));
    const mw = raw.media_work || {};
    const mi = raw.media_item || {};
    const title = (mw.title || '').trim();
    const reviewWarnings = [];

    // Find matching enhancement row (exact normalized title, then prefix/substring fallback)
    let enh = enhancedByTitle.get(normTitle(title)) || null;
    if (!enh && title) {
      const target = normTitle(title);
      const shortTarget = normTitle(title.split(':')[0]);
      for (const [k, row] of enhancedByTitle.entries()) {
        if (k.startsWith(shortTarget) && shortTarget.length >= 6) {
          enh = row;
          break;
        }
        if (target.startsWith(k.split(' ')[0]) && k.includes(shortTarget) && shortTarget.length >= 8) {
          enh = row;
          break;
        }
      }
    }

    let bookPurchaseDetails = null;
    let externalId = null;
    let imagePath = null;
    let sourcingCredit = null;

    if (enh) {
      matchedEnhanced++;
      externalId = cleanCsvVal(enh.isbn_13_api);
      imagePath = toHttps(enh.enlargedThumbnailLink_api) || toHttps(enh.thumbnailLink_api);
      sourcingCredit = 'Data from Google Books';

      const pageCount = parseIntOrNull(enh.pageCount_api);
      const apiAuthors = cleanCsvVal(enh.authors_api);
      const apiSubtitle = cleanCsvVal(enh.subtitle_api);
      const apiDesc = cleanCsvVal(enh.description_api);

      if (
        (apiAuthors && /worth books|instaread|bookrags|summary/i.test(apiAuthors)) ||
        (apiSubtitle && /based on the book by/i.test(apiSubtitle)) ||
        (pageCount !== null && pageCount > 0 && pageCount < 60)
      ) {
        const warn = `Google Books row may be a third-party summary (${apiAuthors || 'unknown'}, ${pageCount}p) — verify ISBN & description.`;
        reviewWarnings.push(warn);
        suspiciousMatches.push({ file, title, apiAuthors, pageCount });
      }

      const categories = cleanCsvVal(enh.categories_api)
        ? cleanCsvVal(enh.categories_api).split(',').map((c) => c.trim()).filter(Boolean)
        : [];

      bookPurchaseDetails = {
        subtitle: apiSubtitle,
        pageCount: pageCount && pageCount > 0 ? pageCount : null,
        googleBooksPreviewLink: toHttps(enh.googleBooksPreviewLink_api),
        googleBooksWebReaderLink: toHttps(enh.googleBooksWebReaderLink_api),
        googleBooksBuyLink: toHttps(enh.googleBooksBuyLink_api),
        googleBooksCategories: categories,
        amazonPurchaseUrl: externalId ? `https://www.amazon.com/dp/${externalId}` : null,
        listPriceAmount: parseFloatOrNull(enh.listPriceAmount_api),
        listPriceCurrency: cleanCsvVal(enh.listPriceCurrency_api),
        retailPriceAmount: parseFloatOrNull(enh.retailPriceAmount_api),
        retailPriceCurrency: cleanCsvVal(enh.retailPriceCurrency_api),
        isEbookGoogle: cleanCsvVal(enh.isEbookGoogle_api) === 'TRUE',
        saleabilityGoogle: cleanCsvVal(enh.saleabilityGoogle_api),
        viewabilityGoogle: cleanCsvVal(enh.viewabilityGoogle_api),
      };

      if (!externalId) {
        reviewWarnings.push('Matched Google Books row has no ISBN-13.');
      }
    } else {
      unmatchedEnhanced++;
      unmatchedBookTitles.push({ file, title });
      reviewWarnings.push('No matching row found in bookdata_enhanced.csv (missing Google Books metadata/ISBN).');
    }

    // Normalize featured individuals
    const allBookFactors = new Set();
    const featuredIndividuals = (raw.featured_individuals || [])
      .filter((ind) => ind && (ind.full_name || ind.first_name || ind.last_name))
      .map((ind) => {
        let firstName = ind.first_name?.trim() || null;
        let middleName = ind.middle_name?.trim() || null;
        let lastName = ind.last_name?.trim() || null;
        let suffix = ind.suffix?.trim() || null;

        if ((!firstName || !lastName) && ind.full_name) {
          const parsed = humanparser.parseName(ind.full_name.trim());
          if (!firstName && parsed.firstName) firstName = parsed.firstName;
          if (!middleName && parsed.middleName) middleName = parsed.middleName;
          if (!lastName && parsed.lastName) lastName = parsed.lastName;
          if (!suffix && parsed.suffix) suffix = parsed.suffix;
        }

        const loc = parseLocation(ind.case_location);
        const status = mapIndividualStatus(ind.status_raw);
        const claimStrength = inferClaimStrength(status);
        const crimeCategoryName = resolveCrimeCategoryName(ind.crime_convicted_of);
        const { codes: factorCodes } = extractFactorsFromArray(ind.contributing_factors_raw);
        factorCodes.forEach((c) => allBookFactors.add(c));

        const organizations = (ind.organizations_involved_raw || [])
          .filter((o) => typeof o === 'string' && o.trim())
          .map((orgName) => ({
            name: orgName.trim(),
            type: inferOrganizationType(orgName.trim()),
          }));
        totalOrgs += organizations.length;

        totalIndividuals++;
        return {
          firstName: firstName || 'Unknown',
          middleName,
          lastName: lastName || 'Unknown',
          suffix,
          status,
          claimStrength,
          crimeCategoryName,
          convictionYear: parseIntOrNull(ind.conviction_year),
          exonerationOrReleaseYear: parseIntOrNull(ind.exoneration_or_release_year),
          timeServed: ind.time_served ? String(ind.time_served).trim() : null,
          sentence: ind.sentence ? String(ind.sentence).trim() : null,
          caseLocationCity: loc.city,
          caseLocationCounty: loc.county,
          caseLocationState: loc.state,
          caseLocationCountry: 'USA',
          narrativeSummary: ind.individual_notes ? String(ind.individual_notes).trim() : null,
          contributingFactorCodes: factorCodes,
          organizations,
          crossReferenceNotes: ind.cross_reference ? String(ind.cross_reference).trim() : null,
        };
      });

    // Also resolve systemic issues on the MediaItem into canonical contributing factors
    const { codes: itemSystemicCodes } = extractFactorsFromArray(mi.systemic_issues_raw);
    itemSystemicCodes.forEach((c) => allBookFactors.add(c));

    // Normalize involved persons
    const involvedPersons = (raw.involved_persons || [])
      .filter((p) => p && (p.full_name || p.first_name || p.last_name))
      .map((p) => {
        let firstName = p.first_name?.trim() || null;
        let middleName = p.middle_name?.trim() || null;
        let lastName = p.last_name?.trim() || null;
        let suffix = p.suffix?.trim() || null;

        if ((!firstName || !lastName) && p.full_name) {
          const parsed = humanparser.parseName(p.full_name.trim());
          if (!firstName && parsed.firstName) firstName = parsed.firstName;
          if (!middleName && parsed.middleName) middleName = parsed.middleName;
          if (!lastName && parsed.lastName) lastName = parsed.lastName;
          if (!suffix && parsed.suffix) suffix = parsed.suffix;
        }

        const rawRole = (p.role || 'OTHER').toString().trim().toUpperCase();
        const role = VALID_ROLES.has(rawRole) ? rawRole : 'OTHER';
        totalInvolvedPersons++;
        return {
          firstName: firstName || 'Unknown',
          middleName,
          lastName: lastName || 'Unknown',
          suffix,
          role,
        };
      });

    const mergedBook = {
      sourceFileName: raw.source_file_name || file,
      reviewWarnings,
      mediaWork: {
        title,
        workType: 'BOOK',
        creatorName: mw.creator_name?.trim() || cleanCsvVal(enh?.authors_api) || null,
        publicationOrReleaseYear: parseIntOrNull(mw.publication_or_release_year) || parseIntOrNull(enh?.publicationOrReleaseYear),
        publisherOrNetwork: mw.publisher_or_network?.trim() || cleanCsvVal(enh?.publisher_api) || null,
        focusOrTheme: mw.focus_or_theme?.trim() || cleanCsvVal(enh?.focusOrTheme) || null,
        summaryNotes: mi.summary_notes?.trim() || cleanCsvVal(enh?.description_api) || null,
        availabilityNotes: mw.format?.trim() || null,
        sourceUrl: bookPurchaseDetails?.googleBooksPreviewLink || null,
        externalId,
        imagePath,
        sourcingCredit,
        aiGenerated: true,
        verificationStatus: 'UNVERIFIED',
      },
      bookPurchaseDetails,
      mediaItem: {
        itemTitle: mi.item_title?.trim() || `Book Content: ${title}`,
        itemMediaType: 'BOOK_CONTENT',
        focusOrTheme: mi.focus_or_theme?.trim() || mw.focus_or_theme?.trim() || null,
        summaryNotes: mi.summary_notes?.trim() || null,
        contributingFactorCodes: Array.from(allBookFactors),
        aiGenerated: true,
        verificationStatus: 'UNVERIFIED',
      },
      featuredIndividuals,
      involvedPersons,
    };

    bundle.push(mergedBook);
    fs.writeFileSync(path.join(OUT_DIR, file), JSON.stringify(mergedBook, null, 2), 'utf8');
  }

  // Write combined bundle JSON
  const bundlePath = path.join(OUT_DIR, 'all_books_bundle.json');
  fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2), 'utf8');

  console.log('=== Books Normalization & Merge Complete ===');
  console.log(`Processed JSON files:      ${files.length}`);
  console.log(`Matched Google Books CSV:  ${matchedEnhanced}`);
  console.log(`Unmatched in CSV:          ${unmatchedEnhanced}`);
  console.log(`Total Featured Individuals:${totalIndividuals}`);
  console.log(`Total Org Links:           ${totalOrgs}`);
  console.log(`Total Involved Persons:    ${totalInvolvedPersons}`);
  console.log(`Output directory:          ${OUT_DIR}`);
  console.log(`Combined bundle:           ${bundlePath}`);

  if (unmatchedBookTitles.length > 0) {
    console.log('\nUnmatched in bookdata_enhanced.csv:');
    unmatchedBookTitles.forEach((u) => console.log(`  - ${u.file}: "${u.title}"`));
  }
  if (suspiciousMatches.length > 0) {
    console.log('\nSuspicious Google Books matches (flagged in reviewWarnings):');
    suspiciousMatches.forEach((s) =>
      console.log(`  - ${s.file}: "${s.title}" -> API author="${s.apiAuthors}", pages=${s.pageCount}`)
    );
  }
}

main();
