// scripts/prepare_nre_delta.js
// Diffs server/prisma/seed_files/nre_v2/nre_additions_2025_2026.csv against:
//   - nre_v2/all_nre_individuals_bundle.json (Spring 2025 NRE snapshot)
//   - wikipedia_v2 & ip_news_v2 bundles (to flag overlaps & cross-enrichment)
// Outputs:
//   - server/prisma/seed_files/nre_v2/delta_2025_2026.json  (upload-ready for /admin/import)
//   - server/prisma/seed_files/nre_v2/DELTA_REPORT.md

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const SERVER = path.join(REPO, 'server');
const SEED = path.join(SERVER, 'prisma', 'seed_files');
const OUT_DIR = path.join(SEED, 'nre_v2');

const { parse } = require(require.resolve('csv-parse/sync', { paths: [SERVER] }));
const { resolveCrimeCategoryName } = require('../server/utils/canonicalCatalog');

function norm(s) {
  return (s || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseLastFirst(raw) {
  const parts = String(raw || '').split(',');
  const lastName = (parts[0] || '').trim();
  const rest = (parts.slice(1).join(',') || '').trim();
  const tokens = rest.split(/\s+/).filter(Boolean);

  let suffix = null;
  if (tokens.length > 1 && /^(Jr\.?|Sr\.?|II|III|IV|V)$/i.test(tokens[tokens.length - 1])) {
    suffix = tokens.pop();
  }
  const firstName = tokens.shift() || '';
  const middleName = tokens.length > 0 ? tokens.join(' ') : null;
  return { firstName, middleName, lastName, suffix };
}

function normalizeState(rawState) {
  const s = (rawState || '').trim();
  if (!s) return null;
  if (s === 'Fed-TX') return 'Texas';
  return s;
}

function formatSentence(sent, term) {
  const s = (sent || '').trim();
  const t = (term || '').trim().replace(/\s+/g, ' ');
  if (s === 'Term of Years' && t) return t;
  if (s && t) return `${s} (${t})`;
  return s || t || null;
}

function formatTimeServed(yearsLost) {
  const n = parseFloat(yearsLost);
  if (Number.isNaN(n) || n <= 0) return null;
  return `${n} years`;
}

function main() {
  const nreOld = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'all_nre_individuals_bundle.json'), 'utf8'));
  const oldByKeyState = new Set();
  const oldByFL = new Map();
  for (const r of nreOld) {
    const fl = `${norm(r.firstName)}|${norm(r.lastName)}`;
    if (!oldByFL.has(fl)) oldByFL.set(fl, []);
    oldByFL.get(fl).push(r);
    oldByKeyState.add(`${fl}|${norm(r.caseLocationState)}|${r.convictionYear || ''}`);
  }

  // Also index IP & Wiki 2025-2026 bundles so we flag cross-source overlaps
  const otherNewByFL = new Map();
  for (const [rel, label] of [
    ['wikipedia_v2/delta_2025_2026.json', 'Wiki delta'],
    ['ip_news_v2/unmatched_ip_individuals_bundle.json', 'IP unmatched'],
    ['ip_news_v2/delta_individuals_2025_2026.json', 'IP 2025-2026 delta'],
  ]) {
    const p = path.join(SEED, rel);
    if (!fs.existsSync(p)) continue;
    for (const r of JSON.parse(fs.readFileSync(p, 'utf8'))) {
      const fl = `${norm(r.firstName)}|${norm(r.lastName)}`;
      if (!otherNewByFL.has(fl)) otherNewByFL.set(fl, []);
      otherNewByFL.get(fl).push(label);
    }
  }

  const csvRows = parse(fs.readFileSync(path.join(OUT_DIR, 'nre_additions_2025_2026.csv'), 'utf8'), {
    columns: true, skip_empty_lines: true, trim: true, bom: true,
  });

  // Consolidate repeat exonerees within the new CSV (same name + same state)
  const consolidated = new Map();
  const distinctSameName = new Map(); // track same first+last across different states

  for (const r of csvRows) {
    const p = parseLastFirst(r.Name);
    const state = normalizeState(r.State);
    const convYear = parseInt(r.Convicted, 10) || null;
    const exonYear = parseInt(r.Exonerated, 10) || null;
    const fl = `${norm(p.firstName)}|${norm(p.lastName)}`;
    const groupKey = `${fl}|${norm(state)}`;

    if (!distinctSameName.has(fl)) distinctSameName.set(fl, new Set());
    distinctSameName.get(fl).add(norm(state));

    if (!consolidated.has(groupKey)) {
      consolidated.set(groupKey, { parsed: p, state, cases: [] });
    }
    consolidated.get(groupKey).cases.push({
      county: (r.County || '').trim() || null,
      convYear,
      exonYear,
      crime: resolveCrimeCategoryName(r.Crime),
      rawCrime: r.Crime,
      sentence: formatSentence(r.Sentence, r['Term of Years']),
      yearsLost: parseFloat(r['Years lost']) || 0,
      recantationYear: (r['Year of recantation'] || '').trim() || null,
      releaseYear: (r['Date of Release'] || '').trim() || null,
    });
  }

  const alreadyInOldNre = [];
  const brandNewNre = [];
  const sameNameCollisions = [];
  const crossSourceOverlaps = [];
  let consolidatedRepeats = 0;

  for (const entry of consolidated.values()) {
    const { parsed: p, state, cases } = entry;
    if (cases.length > 1) consolidatedRepeats++;

    // Pick primary case (most severe / longest years lost, or earliest convYear)
    const primary = [...cases].sort((a, b) => (b.yearsLost - a.yearsLost) || ((a.convYear || 9999) - (b.convYear || 9999)))[0];
    const totalYearsLost = cases.reduce((sum, c) => sum + (c.yearsLost || 0), 0);
    const fl = `${norm(p.firstName)}|${norm(p.lastName)}`;

    const oldMatches = oldByFL.get(fl) || [];
    const exactOld = oldMatches.find(
      (o) =>
        (!o.caseLocationState || norm(o.caseLocationState) === norm(state)) &&
        (!o.convictionYear || !primary.convYear || Math.abs(o.convictionYear - primary.convYear) <= 2)
    );

    if (exactOld) {
      alreadyInOldNre.push({
        name: `${p.firstName} ${p.lastName}`,
        state,
        convYear: primary.convYear,
        exonYear: primary.exonYear,
        oldExonYear: exactOld.exonerationOrReleaseYear,
      });
      continue;
    }

    const reviewWarnings = [];
    let disambiguationTag = null;

    // Check if distinct same-name person exists in another state (in old NRE or within this CSV)
    const diffStateInOld = oldMatches.some((o) => o.caseLocationState && norm(o.caseLocationState) !== norm(state));
    const diffStateInNew = (distinctSameName.get(fl)?.size || 0) > 1;
    if (diffStateInOld || diffStateInNew) {
      disambiguationTag = [state, primary.convYear].filter(Boolean).join(', ');
      sameNameCollisions.push({ name: `${p.firstName} ${p.lastName}`, tag: disambiguationTag });
      reviewWarnings.push(`Same-name distinct person auto-disambiguated with tag "${disambiguationTag}".`);
    }

    if (cases.length > 1) {
      reviewWarnings.push(`Consolidated ${cases.length} NRE cases for this individual.`);
    }

    const otherHits = otherNewByFL.get(fl);
    if (otherHits) {
      crossSourceOverlaps.push({ name: `${p.firstName} ${p.lastName}`, state, sources: Array.from(new Set(otherHits)) });
      reviewWarnings.push(`Also present in ${Array.from(new Set(otherHits)).join(', ')} — will MERGE cleanly.`);
    }

    brandNewNre.push({
      firstName: p.firstName,
      middleName: p.middleName,
      lastName: p.lastName,
      suffix: p.suffix,
      nickname: null,
      disambiguationTag,
      status: 'EXONERATED',
      claimStrength: 'FORMALLY_EXONERATED',
      crimeCategory: primary.crime,
      convictionYear: primary.convYear,
      exonerationOrReleaseYear: primary.exonYear,
      timeServed: formatTimeServed(totalYearsLost),
      sentence: primary.sentence,
      caseLocationCity: null,
      caseLocationCounty: primary.county,
      caseLocationState: state,
      caseLocationCountry: 'USA',
      narrativeSummary: null,
      sourceName: 'National Registry of Exonerations',
      sourceUrl: 'https://exonerationregistry.org/',
      headline: `NRE 2025–2026 Addition (${primary.crime || 'Exoneration'}, ${primary.convYear || '?'}→${primary.exonYear || '?'})`,
      reviewWarnings,
    });
  }

  fs.writeFileSync(path.join(OUT_DIR, 'delta_2025_2026.json'), JSON.stringify(brandNewNre, null, 2), 'utf8');

  const md = [
    '# National Registry of Exonerations (NRE) 2025–2026 Delta Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary Metrics',
    `- **Raw CSV Rows Provided:** ${csvRows.length}`,
    `- **Unique Individuals After Repeat Consolidation:** ${consolidated.size} (${consolidatedRepeats} repeat exonerees consolidated)`,
    `- **Already in Spring 2025 \`nre_v2\` Snapshot (Skipped):** ${alreadyInOldNre.length}`,
    `- **Brand-New NRE Individuals Ready for \`/admin/import\` (\`delta_2025_2026.json\`):** ${brandNewNre.length}`,
    `- **Same-Name Distinct-Person Collisions Auto-Disambiguated:** ${sameNameCollisions.length}`,
    `- **Cross-Source Overlaps (Wiki / IP News 2025–2026 — will MERGE cleanly):** ${crossSourceOverlaps.length}`,
    '',
    '## 1. Already in Spring 2025 NRE Snapshot (Skipped)',
    ...(alreadyInOldNre.length
      ? alreadyInOldNre.map((a) => `- **${a.name}** (${a.state}, ${a.convYear}→${a.exonYear})`)
      : ['- None! All rows are net-new since Spring 2025.']),
    '',
    '## 2. Same-Name Distinct Persons Auto-Disambiguated',
    ...(sameNameCollisions.length
      ? sameNameCollisions.map((c) => `- **${c.name}** → \`disambiguationTag: "${c.tag}"\``)
      : ['- None']),
    '',
    '## 3. Cross-Source Overlaps With Wikipedia / IP News 2025–2026',
    ...(crossSourceOverlaps.length
      ? crossSourceOverlaps.map((o) => `- **${o.name}** (${o.state}) — also in ${o.sources.join(', ')}`)
      : ['- None']),
    '',
    `## 4. Breakdown by Exoneration Year (New ${brandNewNre.length} Individuals)`,
    ...Object.entries(
      brandNewNre.reduce((acc, r) => {
        const y = r.exonerationOrReleaseYear || 'Unknown';
        acc[y] = (acc[y] || 0) + 1;
        return acc;
      }, {})
    )
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([y, cnt]) => `- **${y}:** ${cnt}`),
    '',
  ];

  fs.writeFileSync(path.join(OUT_DIR, 'DELTA_REPORT.md'), md.join('\n'), 'utf8');

  console.log('=== NRE 2025-2026 Delta Complete ===');
  console.log(`Raw CSV rows:            ${csvRows.length}`);
  console.log(`Already in nre_v2:       ${alreadyInOldNre.length}`);
  console.log(`Net-new NRE individuals: ${brandNewNre.length}`);
  console.log(`Repeats consolidated:    ${consolidatedRepeats}`);
  console.log(`Auto-disambiguated:      ${sameNameCollisions.length}`);
  console.log(`Cross-source overlaps:   ${crossSourceOverlaps.length}`);
}

main();
