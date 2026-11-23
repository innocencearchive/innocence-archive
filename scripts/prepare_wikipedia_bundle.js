// scripts/prepare_wikipedia_bundle.js
// Audits and normalizes server/prisma/seed_files/wrongful_convictions_summarized.csv (340 rows)
// against nre_v2/all_nre_individuals_bundle.json and canonicalCatalog.js.
// Outputs:
//   - server/prisma/seed_files/wikipedia_v2/all_wikipedia_individuals_bundle.json (all 339 cleaned rows)
//   - server/prisma/seed_files/wikipedia_v2/wikipedia_only_new_bundle.json (only rows NOT in NRE v2)
//   - server/prisma/seed_files/wikipedia_v2/AUDIT_REPORT.md

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const SERVER = path.join(REPO, 'server');
const SEED = path.join(SERVER, 'prisma', 'seed_files');
const OUT_DIR = path.join(SEED, 'wikipedia_v2');

const { parse } = require(require.resolve('csv-parse/sync', { paths: [SERVER] }));
const humanparser = require(require.resolve('humanparser', { paths: [SERVER] }));
const { resolveCrimeCategoryName } = require('../server/utils/canonicalCatalog');

const WIKI_URL = 'https://en.wikipedia.org/wiki/List_of_wrongful_convictions_in_the_United_States';

// Known truncated / prefixed Wikipedia names fixed cleanly
const EXACT_NAME_FIXES = {
  'Thomas': 'Thomas Griffin', // Row 22: 1913 Chester County, SC ("The Griffin brothers...")
  'Dan': 'Dan Keller',        // Row 208: 1991 Oak Hill, TX ("The Kellers, owners of a daycare...")
  'Richard': 'Richard Winfrey', // Row 295: Aug 2004 San Jacinto County, TX (Murray Burr case)
  'West Memphis Three:Damien Echols': 'Damien Echols',
};

// Group rows that represent multiple people (should be in IndividualGroup, not Individual)
const EXCLUDED_GROUP_NAMES = new Set(['Scottsboro Boys']);

// Verified nickname -> canonical NRE name aliases so Wikipedia safely MERGEs into NRE instead of duplicating
const NRE_NICKNAME_ALIASES = {
  'sam|sheppard': { firstName: 'Samuel', lastName: 'Sheppard', nickname: 'Sam' },
  'nick|yarris': { firstName: 'Nicholas', lastName: 'Yarris', nickname: 'Nick' },
  'ron|williamson': { firstName: 'Ronald', lastName: 'Williamson', nickname: 'Ron' },
  'kathy|gonzalez': { firstName: 'Kathleen', lastName: 'Gonzalez', nickname: 'Kathy' },
  'tim|cole': { firstName: 'Timothy', lastName: 'Cole', nickname: 'Tim' },
  'tim|masters': { firstName: 'Timothy', lastName: 'Masters', nickname: 'Tim' },
  'chris|ochoa': { firstName: 'Christopher', lastName: 'Ochoa', nickname: 'Chris' },
  'francisco|carrillo': { firstName: 'Franky', lastName: 'Carrillo', nickname: 'Franky' },
  'ken|wyniemko': { firstName: 'Kenneth', lastName: 'Wyniemko', nickname: 'Ken' },
  'cal|harris': { firstName: 'Calvin', lastName: 'Harris', nickname: 'Cal' },
  'russ|faria': { firstName: 'Russell', lastName: 'Faria', nickname: 'Russ' },
  'greg|kelley': { firstName: 'Gregory', lastName: 'Kelley', nickname: 'Greg' },
  'dan|keller': { firstName: 'Daniel', lastName: 'Keller', nickname: 'Dan' },
};

function norm(s) {
  return (s || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseNameClean(raw) {
  let s = (raw || '').trim();
  const nickMatch = s.match(/["“]([^"”]+)["”]/);
  const nickname = nickMatch ? nickMatch[1].trim() : null;
  if (nickMatch) s = s.replace(/["“][^"”]+["”]/, ' ').replace(/\s+/g, ' ').trim();
  const p = humanparser.parseName(s);
  return {
    firstName: (p.firstName || '').trim(),
    middleName: (p.middleName || '').trim() || null,
    lastName: (p.lastName || '').trim(),
    suffix: (p.suffix || '').trim() || null,
    nickname,
  };
}

function parseLocation(rawLoc) {
  if (!rawLoc || !rawLoc.trim()) return { city: null, county: null, state: null };
  // Fix missing spaces after commas like "Olympia,Washington Territory"
  const fixed = rawLoc.replace(/,([^\s])/g, ', $1').trim();
  const parts = fixed.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) return { city: parts[0], county: parts[1], state: parts[2] };
  if (parts.length === 2) {
    if (/county|parish/i.test(parts[0])) return { city: null, county: parts[0], state: parts[1] };
    return { city: parts[0], county: null, state: parts[1] };
  }
  if (parts.length === 1) {
    // Handle single-place exceptions
    if (parts[0] === 'Oak Hill') return { city: 'Oak Hill', county: 'Travis County', state: 'Texas' };
    return { city: null, county: null, state: parts[0] };
  }
  return { city: null, county: null, state: null };
}

function inferStatusAndClaim(rawStatus, sentence, summary) {
  const st = (rawStatus || '').trim().toLowerCase();
  const sent = (sentence || '').toLowerCase();
  const sum = (summary || '').toLowerCase();

  if (st === 'yes') {
    return { status: 'EXONERATED', claimStrength: 'FORMALLY_EXONERATED' };
  }
  if (st.includes('partially') || st.includes('vacated')) {
    return { status: 'CONVICTION_OVERTURNED', claimStrength: 'OFFICIAL_RELIEF_NO_EXONERATION' };
  }
  if (sum.includes('alford plea')) {
    return { status: 'RELEASED_ALFORD_PLEA', claimStrength: 'OFFICIAL_RELIEF_NO_EXONERATION' };
  }
  if (sent.includes('executed') || sum.includes('was executed') || sum.includes('executed in')) {
    return { status: 'EXECUTED', claimStrength: 'CREDIBLE_CLAIM' };
  }
  if (st === 'no') {
    if (sum.includes('pardon') || sum.includes('commut')) {
      return { status: 'RELEASED_CLEMENCY', claimStrength: 'OFFICIAL_RELIEF_NO_EXONERATION' };
    }
    return { status: 'CONVICTED', claimStrength: 'CREDIBLE_CLAIM' };
  }
  return { status: 'UNKNOWN', claimStrength: 'UNASSESSED' };
}

function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const nreBundle = JSON.parse(
    fs.readFileSync(path.join(SEED, 'nre_v2', 'all_nre_individuals_bundle.json'), 'utf8')
  );
  const nreByFL = new Map();
  for (const ind of nreBundle) {
    const k = `${norm(ind.firstName)}|${norm(ind.lastName)}`;
    if (!nreByFL.has(k)) nreByFL.set(k, []);
    nreByFL.get(k).push(ind);
  }

  const wikiRows = parse(
    fs.readFileSync(path.join(SEED, 'wrongful_convictions_summarized.csv'), 'utf8'),
    { columns: true, skip_empty_lines: true, trim: true, bom: true }
  );

  const allCleaned = [];
  const wikiOnlyNew = [];
  const excludedGroups = [];
  const nameFixesApplied = [];
  const aliasesResolved = [];
  const blankSummaryList = [];
  const unverifiedStatusList = [];

  for (let i = 0; i < wikiRows.length; i++) {
    const r = wikiRows[i];
    const rowNum = i + 1;
    let rawName = (r['Name'] || '').trim();

    if (EXCLUDED_GROUP_NAMES.has(rawName)) {
      excludedGroups.push({ rowNum, rawName, date: r['Date of Crime'], loc: r['Location'] });
      continue;
    }

    const reviewWarnings = [];
    if (EXACT_NAME_FIXES[rawName]) {
      const fixed = EXACT_NAME_FIXES[rawName];
      nameFixesApplied.push({ rowNum, from: rawName, to: fixed });
      reviewWarnings.push(`Fixed truncated/prefixed Wikipedia name "${rawName}" → "${fixed}".`);
      rawName = fixed;
    }

    let parsed = parseNameClean(rawName);
    const keyBefore = `${norm(parsed.firstName)}|${norm(parsed.lastName)}`;

    if (NRE_NICKNAME_ALIASES[keyBefore]) {
      const alias = NRE_NICKNAME_ALIASES[keyBefore];
      aliasesResolved.push({
        rowNum,
        from: `${parsed.firstName} ${parsed.lastName}`,
        to: `${alias.firstName} ${alias.lastName}`,
      });
      parsed = {
        ...parsed,
        firstName: alias.firstName,
        lastName: alias.lastName,
        nickname: parsed.nickname || alias.nickname,
      };
    }

    const keyAfter = `${norm(parsed.firstName)}|${norm(parsed.lastName)}`;
    const nreMatches = nreByFL.get(keyAfter) || [];
    const matchedNre = nreMatches.length > 0;

    const loc = parseLocation(r['Location']);
    const rawCrime = (r['Crime'] || '').trim();
    const crimeCategory = resolveCrimeCategoryName(rawCrime);
    if (rawCrime && crimeCategory && norm(rawCrime) !== norm(crimeCategory)) {
      reviewWarnings.push(`Normalized Wikipedia crime "${rawCrime}" → "${crimeCategory}".`);
    }

    const rawStatus = (r['Status of Exoneration'] || '').trim();
    const { status, claimStrength } = inferStatusAndClaim(rawStatus, r['Sentence'], r['Summary']);
    if (!['Yes', 'No'].includes(rawStatus)) {
      unverifiedStatusList.push({ rowNum, name: `${parsed.firstName} ${parsed.lastName}`, rawStatus: rawStatus || '(blank)', mapped: status });
      reviewWarnings.push(`Non-standard Wikipedia exoneration status "${rawStatus || '(blank)'}" mapped to ${status}.`);
    }

    const summary = (r['Summary'] || '').trim() || null;
    if (!summary) {
      blankSummaryList.push({ rowNum, name: `${parsed.firstName} ${parsed.lastName}` });
      reviewWarnings.push('Blank summary in Wikipedia CSV.');
    }

    // If matched to an unambiguous single NRE record, adopt NRE's canonical state/years if helpful
    const nreRef = nreMatches.length === 1 ? nreMatches[0] : null;
    const record = {
      firstName: parsed.firstName,
      middleName: parsed.middleName || nreRef?.middleName || null,
      lastName: parsed.lastName,
      suffix: parsed.suffix || nreRef?.suffix || null,
      nickname: parsed.nickname || nreRef?.nickname || null,
      disambiguationTag: nreRef?.disambiguationTag || null,
      status: nreRef ? nreRef.status : status,
      claimStrength: nreRef ? nreRef.claimStrength : claimStrength,
      crimeCategory: nreRef ? nreRef.crimeCategory : crimeCategory,
      convictionYear: nreRef?.convictionYear ?? null,
      exonerationOrReleaseYear: nreRef?.exonerationOrReleaseYear ?? null,
      timeServed: (r['Time Served'] || '').trim() || null,
      sentence: (r['Sentence'] || '').trim() || null,
      caseLocationCity: loc.city,
      caseLocationCounty: loc.county,
      caseLocationState: nreRef?.caseLocationState || loc.state,
      caseLocationCountry: 'USA',
      narrativeSummary: summary,
      sourceName: 'Wikipedia',
      sourceUrl: WIKI_URL,
      headline: `Wikipedia: List of wrongful convictions in the United States (${parsed.firstName} ${parsed.lastName})`,
      reviewWarnings,
      _auditMeta: {
        wikiRow: rowNum,
        matchedNre,
        rawDateOfCrime: (r['Date of Crime'] || '').trim() || null,
        rawCrime,
      },
    };

    allCleaned.push(record);
    if (!matchedNre) {
      wikiOnlyNew.push(record);
    }
  }

  fs.writeFileSync(
    path.join(OUT_DIR, 'all_wikipedia_individuals_bundle.json'),
    JSON.stringify(allCleaned, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    path.join(OUT_DIR, 'wikipedia_only_new_bundle.json'),
    JSON.stringify(wikiOnlyNew, null, 2),
    'utf8'
  );

  // Write AUDIT_REPORT.md
  const lines = [
    '# Wikipedia Wrongful Convictions Audit & Ingest Report (`wikipedia_v2`)',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary Metrics',
    `- **Raw Wikipedia CSV rows:** ${wikiRows.length}`,
    `- **Cleaned Individual Records (\`all_wikipedia_individuals_bundle.json\`):** ${allCleaned.length}`,
    `- **Excluded Group Rows (not single individuals):** ${excludedGroups.length}`,
    `- **Matched to NRE v2 (safe MERGE/enrichment):** ${allCleaned.length - wikiOnlyNew.length}`,
    `- **Wikipedia-Only New Individuals (\`wikipedia_only_new_bundle.json\`):** ${wikiOnlyNew.length}`,
    `- **Truncated / Prefixed Names Fixed:** ${nameFixesApplied.length}`,
    `- **Nickname Aliases Mapped to Canonical NRE Names (duplicates prevented):** ${aliasesResolved.length}`,
    `- **Blank Summary Rows Flagged:** ${blankSummaryList.length}`,
    '',
    '## 1. Truncated / Prefixed Names Fixed',
    '| Row | Original CSV Name | Corrected Name |',
    '| --- | --- | --- |',
    ...nameFixesApplied.map((f) => `| ${f.rowNum} | ${f.from} | **${f.to}** |`),
    '',
    '## 2. Group Rows Excluded (Add via Individual Groups Instead)',
    ...excludedGroups.map((g) => `- Row ${g.rowNum}: **${g.rawName}** (${g.date}, ${g.loc})`),
    '',
    '## 3. Nickname Aliases Resolved to Canonical NRE Names',
    '| Row | Wikipedia Name | Canonical NRE Name |',
    '| --- | --- | --- |',
    ...aliasesResolved.map((a) => `| ${a.rowNum} | ${a.from} | **${a.to}** |`),
    '',
    '## 4. Non-Standard Exoneration Statuses Normalized',
    '| Row | Name | Raw Status | Mapped Status |',
    '| --- | --- | --- | --- |',
    ...unverifiedStatusList.map((u) => `| ${u.rowNum} | ${u.name} | ${u.rawStatus} | \`${u.mapped}\` |`),
    '',
    `## 5. Wikipedia-Only New Individuals (${wikiOnlyNew.length})`,
    '| Row | Name | Crime Date (Raw) | Location | Status | Crime Category |',
    '| --- | --- | --- | --- | --- | --- |',
    ...wikiOnlyNew.map(
      (w) =>
        `| ${w._auditMeta.wikiRow} | **${w.firstName} ${w.lastName}** | ${w._auditMeta.rawDateOfCrime || '—'} | ${[w.caseLocationCity, w.caseLocationState].filter(Boolean).join(', ') || '—'} | \`${w.status}\` | ${w.crimeCategory || '—'} |`
    ),
    '',
  ];

  fs.writeFileSync(path.join(OUT_DIR, 'AUDIT_REPORT.md'), lines.join('\n'), 'utf8');

  console.log('=== Wikipedia v2 Bundle Complete ===');
  console.log(`All cleaned rows:   ${allCleaned.length}`);
  console.log(`NRE enrich matches: ${allCleaned.length - wikiOnlyNew.length}`);
  console.log(`Wiki-only new rows: ${wikiOnlyNew.length}`);
  console.log(`Excluded groups:    ${excludedGroups.length}`);
  console.log(`Output directory:   ${OUT_DIR}`);
}

main();
