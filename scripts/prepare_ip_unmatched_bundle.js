// scripts/prepare_ip_unmatched_bundle.js
// Audits server/prisma/seed_files/innocenceproject_news_processed.csv against NRE v2, Wikipedia v2,
// Books v2, and Films v2, and produces a clean staging bundle of unmatched Innocence Project individuals
// (active cases, executed individuals, non-exonerated releases, etc.) ready for /admin/import.
// Outputs:
//   - server/prisma/seed_files/ip_news_v2/unmatched_ip_individuals_bundle.json
//   - server/prisma/seed_files/ip_news_v2/AUDIT_REPORT.md

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const SERVER = path.join(REPO, 'server');
const SEED = path.join(SERVER, 'prisma', 'seed_files');
const OUT_DIR = path.join(SEED, 'ip_news_v2');

const { parse } = require(require.resolve('csv-parse/sync', { paths: [SERVER] }));
const humanparser = require(require.resolve('humanparser', { paths: [SERVER] }));

// Known CSV glitches or non-individual fragments to skip
const EXCLUDED_RAW_NAMES = new Set(['Jr.', 'Sr.', 'III', 'II', 'IV']);

// Known aliases where the person IS already in NRE/Wikipedia/Media under another name
const KNOWN_ALIAS_TO_EXISTING = new Set([
  'bill|dillon',          // William Dillon (in NRE)
  'sunny|jacobs',         // Sonia Jacobs (in NRE)
  'jessie|misskelley',    // Jessie Misskelley Jr. (in Books/Films/Wiki)
]);

// Consolidate duplicate spellings within the IP News CSV itself
const INTERNAL_CONSOLIDATIONS = {
  'troy anthony davis': 'Troy Davis',
};

// Detect international (non-USA) cases from headline/name so caseLocationCountry is accurate
const INTERNATIONAL_HINTS = [
  { pattern: /\bcanad(a|ian)\b/i, country: 'Canada' },
  { pattern: /\btaiwan\b/i, country: 'Taiwan' },
  { pattern: /\bital(y|ian)\b/i, country: 'Italy' },
  { pattern: /\bphilippines\b|paco larranaga/i, country: 'Philippines' },
  { pattern: /\buk\b|british|england|scotland/i, country: 'United Kingdom' },
];

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming',
];

const STATE_ABBR_HINTS = [
  { re: /\bNYC\b|\bNY\b/i, state: 'New York' },
  { re: /\bNC\b/i, state: 'North Carolina' },
  { re: /\bSC\b/i, state: 'South Carolina' },
  { re: /\bTX\b/i, state: 'Texas' },
  { re: /\bLA\b|New Orleans/i, state: 'Louisiana' },
  { re: /\bAtlanta\b/i, state: 'Georgia' },
  { re: /\bTulsa\b/i, state: 'Oklahoma' },
  { re: /\bLos Angeles\b/i, state: 'California' },
];

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
  const nickMatch = s.match(/["“‘']([^"”’']+)["”’']/);
  const nickname = nickMatch ? nickMatch[1].trim() : null;
  if (nickMatch) s = s.replace(/["“‘'][^"”’']+["”’']/, ' ').replace(/\s+/g, ' ').trim();
  const p = humanparser.parseName(s);
  return {
    firstName: (p.firstName || '').trim(),
    middleName: (p.middleName || '').trim() || null,
    lastName: (p.lastName || '').trim(),
    suffix: (p.suffix || '').trim() || null,
    nickname,
  };
}

function inferStateAndCountry(headlinesText, fullName) {
  const combined = `${fullName} ${headlinesText}`;
  for (const h of INTERNATIONAL_HINTS) {
    if (h.pattern.test(combined)) {
      return { state: null, country: h.country };
    }
  }
  for (const st of US_STATES) {
    if (new RegExp(`\\b${st}\\b`, 'i').test(headlinesText)) {
      return { state: st, country: 'USA' };
    }
  }
  for (const abbr of STATE_ABBR_HINTS) {
    if (abbr.re.test(headlinesText)) {
      return { state: abbr.state, country: 'USA' };
    }
  }
  return { state: null, country: 'USA' };
}

function inferStatusAndClaimFromHeadlines(headlinesText) {
  const txt = headlinesText.toLowerCase();
  if (/\b(execution of|was executed|executed in|years after the execution|denied dna testing before execution)\b/.test(txt)) {
    return { status: 'EXECUTED', claimStrength: 'STRONG_NEW_EVIDENCE' };
  }
  if (/\b(exonerat|cleared of|charges dropped|charges.*dismissed|posthumous pardon)\b/.test(txt)) {
    return { status: 'EXONERATED', claimStrength: 'FORMALLY_EXONERATED' };
  }
  if (/\b(clemency|commut|pardoned)\b/.test(txt)) {
    return { status: 'RELEASED_CLEMENCY', claimStrength: 'OFFICIAL_RELIEF_NO_EXONERATION' };
  }
  if (/\b(conviction overturned|conviction.*vacated|new trial|set free|released after|goes home after|is freed|ordered released)\b/.test(txt)) {
    return { status: 'CONVICTION_OVERTURNED', claimStrength: 'STRONG_NEW_EVIDENCE' };
  }
  if (/\b(death row|scheduled for execution|stay of execution|facing execution|dna testing|fight.*innocence|innocence claim)\b/.test(txt)) {
    return { status: 'CONVICTED', claimStrength: 'STRONG_NEW_EVIDENCE' };
  }
  return { status: 'UNKNOWN', claimStrength: 'CREDIBLE_CLAIM' };
}

function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // Build set of all known individuals across NRE v2, Wikipedia v2, Books v2, Films v2
  const known = new Set();

  const nreBundle = JSON.parse(fs.readFileSync(path.join(SEED, 'nre_v2', 'all_nre_individuals_bundle.json'), 'utf8'));
  for (const ind of nreBundle) {
    known.add(`${norm(ind.firstName)}|${norm(ind.lastName)}`);
    if (ind.nickname) known.add(`${norm(ind.nickname)}|${norm(ind.lastName)}`);
  }

  const wikiBundlePath = path.join(SEED, 'wikipedia_v2', 'all_wikipedia_individuals_bundle.json');
  if (fs.existsSync(wikiBundlePath)) {
    const wikiBundle = JSON.parse(fs.readFileSync(wikiBundlePath, 'utf8'));
    for (const ind of wikiBundle) {
      known.add(`${norm(ind.firstName)}|${norm(ind.lastName)}`);
      if (ind.nickname) known.add(`${norm(ind.nickname)}|${norm(ind.lastName)}`);
    }
  }

  for (const rel of ['books_v2/all_books_bundle.json', 'films_v2/all_films_bundle.json']) {
    const p = path.join(SEED, rel);
    if (!fs.existsSync(p)) continue;
    const arr = JSON.parse(fs.readFileSync(p, 'utf8'));
    for (const item of arr) {
      for (const ind of item.featuredIndividuals || []) {
        if (ind.firstName && ind.lastName) {
          known.add(`${norm(ind.firstName)}|${norm(ind.lastName)}`);
        }
      }
    }
  }

  // Group Innocence Project CSV rows by normalized person
  const ipRows = parse(
    fs.readFileSync(path.join(SEED, 'innocenceproject_news_processed.csv'), 'utf8'),
    { columns: true, skip_empty_lines: true, trim: true, relax_quotes: true, relax_column_count: true }
  );

  const grouped = new Map();
  const excludedGlitches = [];
  const skippedKnownAliases = [];
  let alreadyKnownCount = 0;

  for (const r of ipRows) {
    let rawName = (r.name || '').trim();
    if (!rawName) continue;
    if (EXCLUDED_RAW_NAMES.has(rawName)) {
      excludedGlitches.push(rawName);
      continue;
    }

    const consolidated = INTERNAL_CONSOLIDATIONS[rawName.toLowerCase()];
    if (consolidated) rawName = consolidated;

    const p = parseNameClean(rawName);
    if (!p.firstName || !p.lastName) {
      excludedGlitches.push(rawName);
      continue;
    }

    const key = `${norm(p.firstName)}|${norm(p.lastName)}`;
    if (KNOWN_ALIAS_TO_EXISTING.has(key)) {
      if (!skippedKnownAliases.includes(rawName)) skippedKnownAliases.push(rawName);
      continue;
    }
    if (known.has(key)) {
      alreadyKnownCount++;
      continue;
    }

    if (!grouped.has(key)) {
      grouped.set(key, {
        rawName,
        parsed: p,
        articles: [],
      });
    }
    const url = (r.link || '').trim();
    const headline = (r.headline || '').trim();
    const entry = grouped.get(key);
    if (url.startsWith('http') && !entry.articles.some((a) => a.url === url)) {
      entry.articles.push({ url, headline });
    }
  }

  const bundle = [];
  const internationalCases = [];

  for (const entry of Array.from(grouped.values()).sort((a, b) => b.articles.length - a.articles.length)) {
    const allHeadlines = entry.articles.map((a) => a.headline).join(' | ');
    const { state, country } = inferStateAndCountry(allHeadlines, entry.rawName);
    const { status, claimStrength } = inferStatusAndClaimFromHeadlines(allHeadlines);
    const primaryArt = entry.articles[0] || { url: null, headline: null };

    const reviewWarnings = [
      `Auto-extracted from ${entry.articles.length} Innocence Project news article(s) — verify status, years, and crime category before marking VERIFIED.`,
    ];
    if (country !== 'USA') {
      reviewWarnings.push(`Non-USA case (${country}) — confirm whether to include in US-focused archive.`);
      internationalCases.push({ name: entry.rawName, country, articles: entry.articles.length });
    }
    if (!state && country === 'USA') {
      reviewWarnings.push('State not detected from headlines — please fill in during review.');
    }

    bundle.push({
      firstName: entry.parsed.firstName,
      middleName: entry.parsed.middleName,
      lastName: entry.parsed.lastName,
      suffix: entry.parsed.suffix,
      nickname: entry.parsed.nickname,
      disambiguationTag: null,
      status,
      claimStrength,
      crimeCategory: null,
      convictionYear: null,
      exonerationOrReleaseYear: null,
      caseLocationState: state,
      caseLocationCountry: country,
      narrativeSummary: `Featured in ${entry.articles.length} Innocence Project news article(s). Primary headline: "${primaryArt.headline || 'N/A'}"`,
      sourceName: 'Innocence Project',
      sourceUrl: primaryArt.url,
      headline: primaryArt.headline,
      sourceLinks: entry.articles.slice(0, 5).map((a) => ({
        sourceName: 'Innocence Project',
        sourceUrl: a.url,
        headline: a.headline,
      })),
      reviewWarnings,
      _auditMeta: {
        articleCount: entry.articles.length,
      },
    });
  }

  fs.writeFileSync(
    path.join(OUT_DIR, 'unmatched_ip_individuals_bundle.json'),
    JSON.stringify(bundle, null, 2),
    'utf8'
  );

  const lines = [
    '# Innocence Project News — Unmatched Individuals Audit Report (`ip_news_v2`)',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary Metrics',
    `- **Unmatched Individuals Staged (\`unmatched_ip_individuals_bundle.json\`):** ${bundle.length}`,
    `- **Known Aliases Skipped (already in NRE/Books/Films):** ${skippedKnownAliases.length} (${skippedKnownAliases.join(', ') || 'none'})`,
    `- **CSV Parsing Glitches Excluded:** ${new Set(excludedGlitches).size} (${Array.from(new Set(excludedGlitches)).join(', ') || 'none'})`,
    `- **International (Non-USA) Cases Flagged:** ${internationalCases.length}`,
    '',
    '## International Cases Flagged for Editorial Decision',
    '| Name | Country | Articles |',
    '| --- | --- | --- |',
    ...internationalCases.map((c) => `| **${c.name}** | ${c.country} | ${c.articles} |`),
    '',
    `## All ${bundle.length} Staged Innocence Project Individuals (Sorted by Article Count)`,
    '| # | Name | Articles | Inferred Status | State / Country | Sample Headline |',
    '| --- | --- | :---: | --- | --- | --- |',
    ...bundle.map(
      (b, idx) =>
        `| ${idx + 1} | **${[b.firstName, b.middleName, b.lastName, b.suffix].filter(Boolean).join(' ')}** | ${b._auditMeta.articleCount} | \`${b.status}\` | ${b.caseLocationState || b.caseLocationCountry} | ${(b.headline || '').replace(/\|/g, '/').slice(0, 70)} |`
    ),
    '',
  ];

  fs.writeFileSync(path.join(OUT_DIR, 'AUDIT_REPORT.md'), lines.join('\n'), 'utf8');

  console.log('=== IP News Unmatched Bundle Complete ===');
  console.log(`Staged unmatched individuals: ${bundle.length}`);
  console.log(`International cases flagged:  ${internationalCases.length}`);
  console.log(`Output directory:             ${OUT_DIR}`);
}

main();
