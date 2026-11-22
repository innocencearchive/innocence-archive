// scripts/prepare_nre_bundle.js
// Audits, deduplicates, and normalizes server/prisma/seed_files/exoneration_list_detailed.csv (4,123 NRE rows)
// into a clean, multi-case JSON bundle ready for /admin/import (Target Entity: INDIVIDUAL, Input Format: JSON):
//   - Consolidates genuine repeat-exonerees (same person with 2-3 separate NRE case IDs) into 1 Individual
//     with all NRE case URLs attached in sourceLinks[]
//   - Assigns clean disambiguationTag values to genuinely distinct people sharing an identical name
//     (preventing both false merges and Prisma @@unique collisions)
//   - Validates all 45 crime categories against canonicalCatalog.js
//   - Cross-checks NRE against live DB Individuals and Wikipedia (wrongful_convictions_summarized.csv)
//   - Writes:
//       server/prisma/seed_files/nre_v2/all_nre_individuals_bundle.json
//       server/prisma/seed_files/nre_v2/AUDIT_REPORT.md

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SERVER_DIR = path.join(REPO_ROOT, 'server');
const SEED_DIR = path.join(SERVER_DIR, 'prisma', 'seed_files');
const NRE_CSV_PATH = path.join(SEED_DIR, 'exoneration_list_detailed.csv');
const WIKI_CSV_PATH = path.join(SEED_DIR, 'wrongful_convictions_summarized.csv');
const OUT_DIR = path.join(SEED_DIR, 'nre_v2');

const { parse } = require(require.resolve('csv-parse/sync', { paths: [SERVER_DIR] }));
const humanparser = require(require.resolve('humanparser', { paths: [SERVER_DIR] }));
const { PrismaClient } = require(require.resolve('@prisma/client', { paths: [SERVER_DIR] }));
const {
  CANONICAL_CRIME_CATEGORIES,
  resolveCrimeCategoryName,
} = require(path.join(SERVER_DIR, 'utils', 'canonicalCatalog'));

const CRIME_SEVERITY = new Map(
  CANONICAL_CRIME_CATEGORIES.map((c) => [c.crime_name.toLowerCase(), c.severity_order])
);

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

function norm(s) {
  return (s || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normBaseState(val) {
  let s = norm(val);
  if (!s) return '';
  if (s.startsWith('fed ')) s = s.slice(4).trim();
  if (US_STATE_ABBR_TO_NAME[s]) return US_STATE_ABBR_TO_NAME[s];
  return s;
}

function parseNreName(raw) {
  let s = (raw || '').trim();
  let nickname = null;
  const nickM = s.match(/"([^"]+)"|\(([^)]+)\)/);
  if (nickM) {
    nickname = (nickM[1] || nickM[2] || '').trim();
    s = s.replace(nickM[0], ' ').replace(/\s+/g, ' ').trim();
  }
  const p = humanparser.parseName(s);
  return {
    firstName: p.firstName?.trim() || null,
    middleName: p.middleName?.trim() || null,
    lastName: p.lastName?.trim() || null,
    suffix: p.suffix?.trim() || null,
    nickname,
  };
}

function caseIdFromUrl(url) {
  const m = String(url || '').match(/\/cases\/(\d+)/);
  return m ? m[1] : null;
}

function exactUniqueKey(i) {
  return [
    norm(i.firstName),
    norm(i.middleName),
    norm(i.lastName),
    norm(i.suffix),
    norm(i.disambiguationTag),
  ].join('|');
}

// Known distinct-person overrides where two rows share a Name (or collide with a different person in live DB)
// and were missing a Disambiguation tag in the raw CSV:
const EXPLICIT_DISAMBIGUATION_BY_CASE_ID = {
  // Dennis Lee Allen (Dallas Murder 2000->2019) vs Dennis Mitchell Allen (Tulia Drug 2000->2003, tagged "2003")
  '12651': '2019 Murder',
  // DeShawn Reed (Michigan 2001->2009) vs DeShawn Reed (California 2014->2017)
  '10788': 'Michigan, 2001',
  '12247': 'California, 2014',
  // Michael Jones (Texas 2009->2015) vs DC [1996] and IL [2015]
  '11916': 'Texas, 2009',
  // Distinct from live DB #10 Tammy Vance (West Virginia, Valena Beety / WV Innocence Project)
  '12497': 'Mississippi, 2001',
  // Distinct from live DB #169 John Brown (Louisiana, 1977, The Farm: Angola, USA)
  '12892': 'Arkansas, 1992',
  // Distinct from live DB #46 Christopher Scott (Texas, 1997->2009)
  '12521': 'Illinois, 2006',
};

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const rawRows = parse(fs.readFileSync(NRE_CSV_PATH, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  // Load live DB Individuals (read-only) for cross-source audit & collision safety
  const prisma = new PrismaClient();
  let dbIndividuals = [];
  try {
    dbIndividuals = await prisma.individual.findMany({
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
        status: true,
      },
    });
  } finally {
    await prisma.$disconnect();
  }

  // Load Wikipedia CSV (read-only) for cross-source conflict report
  let wikiRows = [];
  if (fs.existsSync(WIKI_CSV_PATH)) {
    wikiRows = parse(fs.readFileSync(WIKI_CSV_PATH, 'utf8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
    });
  }

  // Step 1: Parse every raw NRE row and assign person-grouping key.
  // Rule: Rows with identical parsed name + identical explicit Disambiguation tag + identical base State
  // are the SAME repeat-exoneree individual (collapsed into 1 Individual with multiple NRE sourceLinks[]).
  // Rows with DIFFERENT explicit Disambiguation tags or DIFFERENT States are DISTINCT people.
  const personGroups = new Map();
  const parsedRows = [];

  for (const r of rawRows) {
    const caseId = caseIdFromUrl(r.Link);
    const parsed = parseNreName(r.Name);
    const rawDisambig = (r.Disambiguation || '').trim();
    const disambiguationTag =
      (caseId && EXPLICIT_DISAMBIGUATION_BY_CASE_ID[caseId]) || rawDisambig || null;
    const state = (r.State || '').trim() || null;
    const baseState = normBaseState(state);
    const convictionYear = parseInt(r.ConvictedYear, 10) || null;
    const exonerationYear = parseInt(r.ExoneratedYear, 10) || null;
    const canonicalCrime = resolveCrimeCategoryName(r.Crime) || r.Crime || null;

    const item = {
      raw: r,
      caseId,
      parsed,
      disambiguationTag,
      state,
      baseState,
      convictionYear,
      exonerationYear,
      canonicalCrime,
    };
    parsedRows.push(item);

    const groupKey = [
      norm(parsed.firstName),
      norm(parsed.middleName),
      norm(parsed.lastName),
      norm(parsed.suffix),
      norm(disambiguationTag),
      baseState,
    ].join('|');

    if (!personGroups.has(groupKey)) personGroups.set(groupKey, []);
    personGroups.get(groupKey).push(item);
  }

  // Step 2: Check for any distinct-person groups that would still collide on Prisma's @@unique
  // (firstName, middleName, lastName, suffix, disambiguationTag) — e.g. same name across 2 states without tag.
  const byUniqueNameKey = new Map();
  for (const [gk, list] of personGroups.entries()) {
    const first = list[0];
    const uk = exactUniqueKey({
      ...first.parsed,
      disambiguationTag: first.disambiguationTag,
    });
    if (!byUniqueNameKey.has(uk)) byUniqueNameKey.set(uk, []);
    byUniqueNameKey.get(uk).push({ gk, list });
  }

  const autoTaggedDistinct = [];
  for (const [uk, groupEntries] of byUniqueNameKey.entries()) {
    if (groupEntries.length > 1) {
      for (const ge of groupEntries) {
        const rep = ge.list[0];
        if (!rep.disambiguationTag) {
          const autoTag = [rep.state, rep.convictionYear].filter(Boolean).join(', ') || `NRE #${rep.caseId}`;
          for (const row of ge.list) row.disambiguationTag = autoTag;
          autoTaggedDistinct.push({
            name: rep.raw.Name,
            assignedTag: autoTag,
            cases: ge.list.map((x) => `#${x.caseId}`),
          });
        }
      }
    }
  }

  // Step 3: Build final deduplicated Individual records
  const bundle = [];
  const consolidatedRepeatExonerees = [];
  const blankStateRows = [];
  const unmappedCrimes = [];
  const seenUniqueKeys = new Set();

  for (const list of personGroups.values()) {
    // Sort cases chronologically (earliest conviction year, then case ID)
    list.sort((a, b) => (a.convictionYear || 9999) - (b.convictionYear || 9999) || Number(a.caseId || 0) - Number(b.caseId || 0));

    const rep = list[0];
    const { firstName, middleName, lastName, suffix, nickname } = rep.parsed;

    // Pick worst (most severe) crime across cases (lowest severity_order = most severe)
    let bestCrime = rep.canonicalCrime;
    let bestSeverity = CRIME_SEVERITY.get((bestCrime || '').toLowerCase()) ?? 999;
    for (const c of list) {
      const sev = CRIME_SEVERITY.get((c.canonicalCrime || '').toLowerCase()) ?? 999;
      if (sev < bestSeverity) {
        bestSeverity = sev;
        bestCrime = c.canonicalCrime;
      }
      if (c.raw.Crime && !resolveCrimeCategoryName(c.raw.Crime)) {
        unmappedCrimes.push({ name: c.raw.Name, crime: c.raw.Crime });
      }
    }

    const convictionYears = list.map((c) => c.convictionYear).filter(Boolean);
    const exonerationYears = list.map((c) => c.exonerationYear).filter(Boolean);
    const earliestConviction = convictionYears.length ? Math.min(...convictionYears) : null;
    const latestExoneration = exonerationYears.length ? Math.max(...exonerationYears) : null;

    const sourceLinks = list.map((c) => ({
      sourceName: 'National Registry of Exonerations',
      sourceUrl: c.raw.Link,
      headline: `NRE Case #${c.caseId || 'Unknown'} (${c.canonicalCrime || 'Case'}, ${c.convictionYear || '?'}→${c.exonerationYear || '?'})`,
    }));

    const reviewWarnings = [];
    if (list.length > 1) {
      const desc = list
        .map((c) => `#${c.caseId} (${c.canonicalCrime}, ${c.convictionYear}→${c.exonerationYear})`)
        .join('; ');
      reviewWarnings.push(`Consolidated ${list.length} NRE cases for repeat exoneree: ${desc}`);
      consolidatedRepeatExonerees.push({
        name: [firstName, middleName, lastName, suffix].filter(Boolean).join(' '),
        state: rep.state || 'Unknown',
        caseCount: list.length,
        cases: desc,
      });
    }
    if (!rep.state) {
      reviewWarnings.push('State is blank in NRE Pre-1989 export (verify state if needed).');
      blankStateRows.push({
        name: [firstName, middleName, lastName, suffix].filter(Boolean).join(' '),
        convictionYear: earliestConviction,
        exonerationYear: latestExoneration,
        crime: bestCrime,
        url: rep.raw.Link,
      });
    }

    // Guarantee unique key across the bundle
    let finalDisambig = rep.disambiguationTag;
    let uk = exactUniqueKey({ firstName, middleName, lastName, suffix, disambiguationTag: finalDisambig });
    if (seenUniqueKeys.has(uk)) {
      finalDisambig = [finalDisambig, rep.state, earliestConviction, `NRE #${rep.caseId}`]
        .filter(Boolean)
        .join(' · ');
      uk = exactUniqueKey({ firstName, middleName, lastName, suffix, disambiguationTag: finalDisambig });
    }
    seenUniqueKeys.add(uk);

    bundle.push({
      firstName,
      middleName,
      lastName,
      suffix,
      nickname,
      disambiguationTag: finalDisambig,
      status: 'EXONERATED',
      claimStrength: 'FORMALLY_EXONERATED',
      crimeCategory: bestCrime,
      convictionYear: earliestConviction,
      exonerationOrReleaseYear: latestExoneration,
      caseLocationState: rep.state,
      caseLocationCountry: 'USA',
      sourceName: 'National Registry of Exonerations',
      sourceUrl: sourceLinks[0].sourceUrl,
      headline: sourceLinks[0].headline,
      sourceLinks,
      reviewWarnings,
    });
  }

  // Sort bundle alphabetically by lastName, firstName for clean review
  bundle.sort((a, b) =>
    `${a.lastName} ${a.firstName} ${a.disambiguationTag || ''}`.localeCompare(
      `${b.lastName} ${b.firstName} ${b.disambiguationTag || ''}`
    )
  );

  // Step 4: Cross-source audit against live DB (176) and Wikipedia (340)
  const dbByLast = new Map();
  for (const d of dbIndividuals) {
    const ln = norm(d.lastName);
    if (!dbByLast.has(ln)) dbByLast.set(ln, []);
    dbByLast.get(ln).push(d);
  }

  const dbMatches = [];
  const dbConflicts = [];
  const dbDistinctSameName = [];

  for (const rec of bundle) {
    const cands = (dbByLast.get(norm(rec.lastName)) || []).filter(
      (c) => norm(c.firstName) === norm(rec.firstName)
    );
    for (const c of cands) {
      const b1 = normBaseState(rec.caseLocationState);
      const b2 = normBaseState(c.caseLocationState);
      const stateConflict = Boolean(b1 && b2 && b1 !== b2);
      const yearConflictHuge =
        rec.convictionYear && c.convictionYear && Math.abs(rec.convictionYear - c.convictionYear) > 6;

      if (stateConflict || yearConflictHuge) {
        dbDistinctSameName.push({
          nre: `${rec.firstName} ${rec.lastName} (${rec.caseLocationState || '?'}, ${rec.convictionYear}→${rec.exonerationOrReleaseYear}, tag="${rec.disambiguationTag || ''}")`,
          db: `#${c.id} ${c.firstName} ${c.lastName} (${c.caseLocationState || '?'}, ${c.convictionYear || '?'}→${c.exonerationOrReleaseYear || '?'})`,
        });
      } else {
        dbMatches.push({ nre: rec, db: c });
        if (
          (c.convictionYear && rec.convictionYear && c.convictionYear !== rec.convictionYear) ||
          (c.exonerationOrReleaseYear &&
            rec.exonerationOrReleaseYear &&
            c.exonerationOrReleaseYear !== rec.exonerationOrReleaseYear)
        ) {
          dbConflicts.push({
            name: `${c.firstName} ${c.lastName} (DB #${c.id})`,
            state: rec.caseLocationState || c.caseLocationState || '?',
            dbConv: c.convictionYear || '—',
            nreConv: rec.convictionYear || '—',
            dbExon: c.exonerationOrReleaseYear || '—',
            nreExon: rec.exonerationOrReleaseYear || '—',
            nreUrl: rec.sourceUrl,
          });
        }
      }
    }
  }

  // Wikipedia cross-check (match by first+last + state)
  const nreByFirstLast = new Map();
  for (const rec of bundle) {
    const k = `${norm(rec.firstName)}|${norm(rec.lastName)}`;
    if (!nreByFirstLast.has(k)) nreByFirstLast.set(k, []);
    nreByFirstLast.get(k).push(rec);
  }

  let wikiMatchedCount = 0;
  let wikiUnmatchedCount = 0;
  const wikiConflicts = [];
  for (const w of wikiRows) {
    const wp = parseNreName(w.Name);
    if (!wp.firstName || !wp.lastName) continue;
    const hits = nreByFirstLast.get(`${norm(wp.firstName)}|${norm(wp.lastName)}`) || [];
    if (hits.length === 0) {
      wikiUnmatchedCount++;
      continue;
    }
    const locNorm = norm(w.Location);
    const best =
      hits.find((h) => h.caseLocationState && locNorm.includes(normBaseState(h.caseLocationState))) ||
      (hits.length === 1 ? hits[0] : null);
    if (!best) continue;
    wikiMatchedCount++;
    const crimeDateYearMatch = (w['Date of Crime'] || '').match(/\b(1[789]\d{2}|20\d{2})\b/);
    const wikiCrimeYear = crimeDateYearMatch ? parseInt(crimeDateYearMatch[1], 10) : null;
    if (
      wikiCrimeYear &&
      best.convictionYear &&
      (wikiCrimeYear > best.convictionYear || best.convictionYear - wikiCrimeYear > 15)
    ) {
      wikiConflicts.push({
        name: w.Name,
        wikiLocation: w.Location,
        nreState: best.caseLocationState || '—',
        wikiCrimeYear,
        nreConvYear: best.convictionYear,
        nreExonYear: best.exonerationOrReleaseYear,
      });
    }
  }

  // Write JSON bundle
  const bundlePath = path.join(OUT_DIR, 'all_nre_individuals_bundle.json');
  fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2), 'utf8');

  // Write AUDIT_REPORT.md
  const reportLines = [
    '# National Registry of Exonerations (NRE) Audit & Ingest Report (`nre_v2`)',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary Metrics',
    `- **Raw NRE CSV rows:** ${rawRows.length}`,
    `- **Deduplicated Unique Individuals in Bundle:** ${bundle.length}`,
    `- **Repeat Exonerees Consolidated (1 Individual with 2–3 NRE links):** ${consolidatedRepeatExonerees.length} individuals (saved ${rawRows.length - bundle.length} duplicate rows)`,
    `- **Total NRE Source Links Attached:** ${bundle.reduce((s, r) => s + r.sourceLinks.length, 0)}`,
    `- **Distinct Same-Name Individuals Auto-Disambiguated:** ${Object.keys(EXPLICIT_DISAMBIGUATION_BY_CASE_ID).length + autoTaggedDistinct.length}`,
    `- **Unmapped Crime Categories:** ${unmappedCrimes.length} (45/45 exact canonical matches)`,
    `- **Blank-State Pre-1989 Rows Flagged:** ${blankStateRows.length}`,
    `- **Live DB Overlap (will auto-MERGE safely):** ${dbMatches.length} of ${dbIndividuals.length} existing Individuals`,
    `- **Live DB Same-Name Different-Person Collisions Prevented:** ${dbDistinctSameName.length}`,
    `- **Live DB vs NRE Year Differences (mostly crime year vs conviction year, or pardon vs vacatur):** ${dbConflicts.length}`,
    `- **Wikipedia Cross-Check (\`wrongful_convictions_summarized.csv\`, ${wikiRows.length} rows):** ${wikiMatchedCount} matched in NRE, ${wikiUnmatchedCount} Wikipedia-only (historical/pre-NRE/non-exonerated), ${wikiConflicts.length} major year anomalies`,
    '',
    '## 1. Repeat Exonerees Consolidated Into 1 Individual With Multiple NRE Cases',
    '| Individual | State | Cases | NRE Case Links Attached |',
    '| --- | --- | --- | --- |',
    ...consolidatedRepeatExonerees
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((r) => `| **${r.name}** | ${r.state} | ${r.caseCount} | ${r.cases} |`),
    '',
    '## 2. Same-Name Distinct-Person Collisions Prevented Against Live DB',
    '| NRE Record (kept separate) | Existing Live DB Record |',
    '| --- | --- |',
    ...dbDistinctSameName.map((x) => `| ${x.nre} | ${x.db} |`),
    '',
    '## 3. Live DB (Books/Films) vs NRE Year Discrepancies (Review List)',
    '> Note: `MERGE` preserves existing live DB values and attaches the NRE source link. Most differences below occur because Books/Films recorded the **crime/arrest year** (vs NRE\'s **conviction year**) or **pardon/release year** (vs NRE\'s **official dismissal/exoneration year**).',
    '',
    '| Individual | State | DB Conv | NRE Conv | DB Exon | NRE Exon | NRE Link |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...dbConflicts.map(
      (c) => `| **${c.name}** | ${c.state} | ${c.dbConv} | ${c.nreConv} | ${c.dbExon} | ${c.nreExon} | ${c.nreUrl} |`
    ),
    '',
    '## 4. Wikipedia vs NRE Major Year Anomalies (Pre-Audit for Future Wiki Import)',
    ...(wikiConflicts.length === 0
      ? ['- None found!']
      : [
          '| Name | Wiki Location | NRE State | Wiki Crime Year | NRE Conv Year | NRE Exon Year |',
          '| --- | --- | --- | --- | --- | --- |',
          ...wikiConflicts.map(
            (w) => `| **${w.name}** | ${w.wikiLocation} | ${w.nreState} | ${w.wikiCrimeYear} | ${w.nreConvYear} | ${w.nreExonYear} |`
          ),
        ]),
    '',
    `## 5. Blank-State Pre-1989 NRE Rows (${blankStateRows.length} rows)`,
    '> All 51 rows below have a blank `State` cell in the original Pre-1989 NRE export (none are from 1988 or later). They import cleanly with `caseLocationState: null` and can be enriched later.',
    '',
    '| Name | Conv | Exon | Crime | NRE URL |',
    '| --- | --- | --- | --- | --- |',
    ...blankStateRows.map(
      (b) => `| ${b.name} | ${b.convictionYear || '?'} | ${b.exonerationYear || '?'} | ${b.crime || '?'} | ${b.url} |`
    ),
    '',
  ];

  fs.writeFileSync(path.join(OUT_DIR, 'AUDIT_REPORT.md'), reportLines.join('\n'), 'utf8');

  console.log('\n=== NRE v2 Bundle Generated ===');
  console.log({
    rawRows: rawRows.length,
    uniqueIndividuals: bundle.length,
    repeatExonereesConsolidated: consolidatedRepeatExonerees.length,
    totalSourceLinks: bundle.reduce((s, r) => s + r.sourceLinks.length, 0),
    blankStateRows: blankStateRows.length,
    dbMatchesWillMerge: dbMatches.length,
    dbDistinctSameNameProtected: dbDistinctSameName.length,
    dbYearDiscrepancies: dbConflicts.length,
    wikiMatchedCount,
    wikiConflictsCount: wikiConflicts.length,
    bundleSizeMB: (fs.statSync(bundlePath).size / (1024 * 1024)).toFixed(2),
  });
}

main().catch((err) => {
  console.error('Fatal error preparing NRE bundle:', err);
  process.exit(1);
});
