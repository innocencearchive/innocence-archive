// scripts/prepare_ip_delta_2025_2026.js
// Builds two upload-ready files from the 82 new 2025-2026 Innocence Project articles:
//   1. server/prisma/seed_files/ip_news_v2/delta_news_2025_2026_bulk.json
//      -> Ready for /admin/news Bulk Import (all 82 articles, auto-categorized, with dates & summaries)
//   2. server/prisma/seed_files/ip_news_v2/delta_individuals_2025_2026.json
//      -> Ready for /admin/import (Target: Individuals, JSON) — brand-new 2025-2026 exonerees & case updates
//         not yet in nre_v2 / wikipedia_v2 / ip_news_v2
//   3. server/prisma/seed_files/ip_news_v2/DELTA_INDIVIDUALS_REPORT.md

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const SERVER = path.join(REPO, 'server');
const SEED = path.join(SERVER, 'prisma', 'seed_files');
const OUT_DIR = path.join(SEED, 'ip_news_v2');

const axios = require(require.resolve('axios', { paths: [SERVER] }));
const UA = 'InnocenceArchiveResearchBot/1.0 (https://innocencearchive.org; research delta)';

function norm(s) {
  return (s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function suggestCategory(headline, summary = '') {
  const txt = `${headline || ''} ${summary || ''}`.toLowerCase();
  if (/\b(petition|take action|call now|sign the|urge governor|clemency petition|stop the execution|call for action|write to|how you can help|toolkit)\b/.test(txt)) {
    return 'CALL_FOR_ACTION';
  }
  if (/\b(exonerat|freed after|walks free|regains.*freedom|cleared of|conviction vacated|pardoned|released after \d+ years|set free|declared innocent|charges dismissed|is released after)\b/.test(txt)) {
    return 'EXONERATION';
  }
  if (/\b(executed|execution scheduled|denied new trial|appeals court denies|rejects appeal|conviction upheld|setback|refuses dna|schedules.*execution|facing execution|rejects trial court)\b/.test(txt)) {
    return 'CASE_SETBACK';
  }
  if (/\b(documentary|docuseries|podcast|new book|memoir|netflix|hbo|film|streaming|watch now|listen now|broadway|novel|short film)\b/.test(txt)) {
    return 'NEW_MEDIA';
  }
  if (/\b(dna testing|new trial|hearing|evidentiary|appeal|brief|innocence claim|conviction overturned|alford plea|new evidence|fight to prove|dna evidence|execution is stayed|dna warrant|vacating conviction|habeas)\b/.test(txt)) {
    return 'CASE_UPDATE';
  }
  if (/\b(legislation|bill|law|policy|compensation|reform|supreme court|commission|forensic standard|editorial|qualified immunity|batson|commutation of death)\b/.test(txt)) {
    return 'POLICY';
  }
  return 'GENERAL';
}

function decodeHtml(str) {
  return String(str || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;|&#039;/g, "'")
    .replace(/&#8217;|&#x2019;/g, '’').replace(/&#8216;|&#x2018;/g, '‘')
    .replace(/&#8220;|&#x201c;/g, '“').replace(/&#8221;|&#x201d;/g, '”')
    .replace(/&#8211;|&#x2013;/g, '–').replace(/&#8212;|&#x2014;/g, '—')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function fetchSnippetBySlug(url) {
  try {
    const slug = url.replace(/\/+$/, '').split('/').pop();
    const resp = await axios.get('https://innocenceproject.org/wp-json/wp/v2/news', {
      params: { slug },
      headers: { 'User-Agent': UA },
      timeout: 12000,
    });
    const post = Array.isArray(resp.data) ? resp.data[0] : null;
    if (!post) return '';
    return decodeHtml(post.content?.rendered || post.excerpt?.rendered || '').slice(0, 800);
  } catch {
    return '';
  }
}

async function main() {
  const rawNews = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'delta_news_2025_2026.json'), 'utf8'));

  // 1. Build bulk-import JSON for /admin/news (all 82 articles)
  const bulkNews = rawNews.map((a) => ({
    headline: a.headline,
    url: a.url,
    summary: a.summary || null,
    publishedAt: a.publishedAt,
    category: suggestCategory(a.headline, a.summary),
    status: 'PUBLISHED',
    showOnHomepage: false,
    isPinned: false,
    sourceName: 'Innocence Project',
  }));

  fs.writeFileSync(
    path.join(OUT_DIR, 'delta_news_2025_2026_bulk.json'),
    JSON.stringify(bulkNews, null, 2),
    'utf8'
  );

  // 2. Fetch full text snippet for the 3-men Philadelphia article so we get exact full names
  const phillyArt = rawNews.find((a) => a.url.includes('philadelphia-men-exonerated'));
  let phillySnippet = '';
  if (phillyArt) {
    phillySnippet = await fetchSnippetBySlug(phillyArt.url);
    console.log('Philly exonerees snippet:', phillySnippet.slice(0, 300));
  }

  // Also check #34 ("Free After 31 Years, He Found Love in an Online Game") for the exoneree's name
  const gameArt = rawNews.find((a) => a.url.includes('free-after-31-years-he-found-love'));
  let gameSnippet = '';
  if (gameArt) {
    gameSnippet = await fetchSnippetBySlug(gameArt.url);
    console.log('Online game article snippet:', gameSnippet.slice(0, 260));
  }

  // Index existing individuals across nre_v2, wikipedia_v2, ip_news_v2
  const existing = new Set();
  for (const rel of [
    'nre_v2/all_nre_individuals_bundle.json',
    'wikipedia_v2/all_wikipedia_individuals_bundle.json',
    'ip_news_v2/unmatched_ip_individuals_bundle.json',
  ]) {
    const p = path.join(SEED, rel);
    if (!fs.existsSync(p)) continue;
    for (const ind of JSON.parse(fs.readFileSync(p, 'utf8'))) {
      if (ind.firstName && ind.lastName) existing.add(`${norm(ind.firstName)}|${norm(ind.lastName)}`);
    }
  }

  // Helper to locate article URL by keyword
  const findArt = (kw) => rawNews.find((a) => a.url.toLowerCase().includes(kw) || a.headline.toLowerCase().includes(kw));

  // Curated, verified 2025-2026 exonerees & major status updates from the 82 IP News articles
  const candidates = [
    {
      firstName: 'Tommy', middleName: 'Lee', lastName: 'Walker',
      status: 'EXONERATED', claimStrength: 'FORMALLY_EXONERATED',
      crimeCategory: 'Murder', convictionYear: 1954, exonerationOrReleaseYear: 2026,
      sentence: 'Death sentence (Executed 1956)', caseLocationCity: 'Dallas', caseLocationState: 'Texas',
      narrativeSummary: 'Posthumously declared innocent in January 2026 by Dallas County resolution 70 years after his 1956 execution.',
      artKw: 'tommy-lee-walker-is-declared-innocent',
    },
    {
      firstName: 'Ervin', middleName: null, lastName: 'Harris',
      status: 'EXONERATED', claimStrength: 'FORMALLY_EXONERATED',
      crimeCategory: 'Sexual Assault', exonerationOrReleaseYear: 2026, timeServed: '42 years',
      caseLocationCity: 'Birmingham', caseLocationState: 'Alabama',
      narrativeSummary: 'Exonerated in August 2026 of a rape conviction in Birmingham, Alabama after 42 years in prison.',
      artKw: 'ervin-harris-exonerated',
    },
    {
      firstName: 'James', middleName: null, lastName: 'Genrich', nickname: 'Jimmy',
      status: 'EXONERATED', claimStrength: 'FORMALLY_EXONERATED',
      crimeCategory: 'Murder', convictionYear: 1993, exonerationOrReleaseYear: 2026,
      caseLocationState: 'Colorado',
      narrativeSummary: '1993 Colorado pipe-bombing murder charges dismissed in April 2026 after forensic toolmark evidence was discredited.',
      artKw: 'jimmy-genrichs-1993-murder-charges-dismissed',
    },
    {
      firstName: 'Carmen', middleName: null, lastName: 'Mejia',
      status: 'EXONERATED', claimStrength: 'FORMALLY_EXONERATED',
      exonerationOrReleaseYear: 2026, timeServed: '22 years',
      caseLocationState: 'Texas',
      narrativeSummary: 'Walked free in March 2026 after 22 years of wrongful imprisonment in Texas for a crime that never happened.',
      artKw: 'carmen-mejia-exonerated',
    },
    {
      firstName: 'Jabar', middleName: null, lastName: 'Walker',
      status: 'EXONERATED', claimStrength: 'FORMALLY_EXONERATED',
      timeServed: '25 years', caseLocationCity: 'New York', caseLocationState: 'New York',
      narrativeSummary: 'Wrongfully convicted in New York and served 25 years before exoneration.',
      artKw: 'knicks-jabar-walker',
    },
    {
      firstName: 'Brian', middleName: null, lastName: 'Boles',
      status: 'EXONERATED', claimStrength: 'FORMALLY_EXONERATED',
      exonerationOrReleaseYear: 2025, caseLocationState: 'New York',
      narrativeSummary: 'Exonerated in New York in July 2025 alongside co-defendant Charles Collins after decades of wrongful conviction.',
      artKw: 'brian-boles-and-charles-collins',
    },
    {
      firstName: 'Charles', middleName: null, lastName: 'Collins',
      status: 'EXONERATED', claimStrength: 'FORMALLY_EXONERATED',
      exonerationOrReleaseYear: 2025, caseLocationState: 'New York',
      narrativeSummary: 'Exonerated in New York in July 2025 alongside co-defendant Brian Boles after decades of wrongful conviction.',
      artKw: 'brian-boles-and-charles-collins',
    },
    {
      firstName: 'Samuel', middleName: 'Scott', lastName: 'Minton', nickname: 'Scott',
      status: 'EXONERATED', claimStrength: 'FORMALLY_EXONERATED',
      exonerationOrReleaseYear: 2025, timeServed: '30+ years', caseLocationState: 'Tennessee',
      narrativeSummary: 'Exonerated in Tennessee in January 2025 after three decades of wrongful conviction.',
      artKw: 'scott-minton-is-exonerated',
    },
    {
      firstName: 'Jimmie', middleName: null, lastName: 'Duncan', nickname: 'Chris',
      status: 'CONVICTION_OVERTURNED', claimStrength: 'OFFICIAL_RELIEF_NO_EXONERATION',
      exonerationOrReleaseYear: 2025, timeServed: '27 years', caseLocationState: 'Louisiana',
      narrativeSummary: 'Released in November 2025 after 27 years on Louisiana death row; Louisiana Supreme Court affirmed vacating his conviction in June 2026.',
      artKw: 'jimmie-chris-duncan-is-released',
    },
    {
      firstName: 'Jermel', middleName: null, lastName: 'Shuler',
      status: 'EXONERATED', claimStrength: 'FORMALLY_EXONERATED',
      exonerationOrReleaseYear: 2026, timeServed: '28 years', caseLocationCity: 'Philadelphia', caseLocationState: 'Pennsylvania',
      narrativeSummary: 'One of three men exonerated in Philadelphia in May 2026 after 28 years of wrongful conviction.',
      artKw: 'philadelphia-men-exonerated',
    },
  ];

  // Try to parse the two other Philadelphia men's full names from the live snippet if fetched
  if (phillySnippet) {
    const britMatch = phillySnippet.match(/([A-Z][a-z]+)\s+Brittingham/);
    const turnMatch = phillySnippet.match(/([A-Z][a-z]+)\s+Turner/);
    if (britMatch) {
      candidates.push({
        firstName: britMatch[1], middleName: null, lastName: 'Brittingham',
        status: 'EXONERATED', claimStrength: 'FORMALLY_EXONERATED',
        exonerationOrReleaseYear: 2026, timeServed: '28 years', caseLocationCity: 'Philadelphia', caseLocationState: 'Pennsylvania',
        narrativeSummary: 'One of three men exonerated in Philadelphia in May 2026 after 28 years of wrongful conviction.',
        artKw: 'philadelphia-men-exonerated',
      });
    }
    if (turnMatch) {
      candidates.push({
        firstName: turnMatch[1], middleName: null, lastName: 'Turner',
        status: 'EXONERATED', claimStrength: 'FORMALLY_EXONERATED',
        exonerationOrReleaseYear: 2026, timeServed: '28 years', caseLocationCity: 'Philadelphia', caseLocationState: 'Pennsylvania',
        narrativeSummary: 'One of three men exonerated in Philadelphia in May 2026 after 28 years of wrongful conviction.',
        artKw: 'philadelphia-men-exonerated',
      });
    }
  }

  const individualsOut = candidates.map((c) => {
    const art = findArt(c.artKw) || {};
    const alreadyExists = existing.has(`${norm(c.firstName)}|${norm(c.lastName)}`);
    return {
      firstName: c.firstName,
      middleName: c.middleName || null,
      lastName: c.lastName,
      suffix: null,
      nickname: c.nickname || null,
      disambiguationTag: null,
      status: c.status,
      claimStrength: c.claimStrength,
      crimeCategory: c.crimeCategory || null,
      convictionYear: c.convictionYear || null,
      exonerationOrReleaseYear: c.exonerationOrReleaseYear || null,
      timeServed: c.timeServed || null,
      sentence: c.sentence || null,
      caseLocationCity: c.caseLocationCity || null,
      caseLocationState: c.caseLocationState || null,
      caseLocationCountry: 'USA',
      narrativeSummary: c.narrativeSummary,
      sourceName: 'Innocence Project',
      sourceUrl: art.url || null,
      headline: art.headline || null,
      reviewWarnings: [
        alreadyExists
          ? 'Already exists in earlier bundle — will MERGE/enrich with 2025–2026 update & IP source link.'
          : 'Brand-new 2025–2026 Innocence Project case — verify details before marking VERIFIED.',
      ],
    };
  });

  fs.writeFileSync(
    path.join(OUT_DIR, 'delta_individuals_2025_2026.json'),
    JSON.stringify(individualsOut, null, 2),
    'utf8'
  );

  const md = [
    '# Innocence Project 2025–2026 Individuals & News Delta Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `- **News Hub Bulk Import Ready (\`delta_news_2025_2026_bulk.json\`):** ${bulkNews.length} articles`,
    `- **2025–2026 Individuals Ready for \`/admin/import\` (\`delta_individuals_2025_2026.json\`):** ${individualsOut.length}`,
    '',
    '## Extracted 2025–2026 Individuals',
    '| Name | Status | State | Exoneration Year | Source Article |',
    '| --- | --- | --- | :---: | --- |',
    ...individualsOut.map(
      (ind) => `| **${ind.firstName} ${ind.lastName}** | \`${ind.status}\` | ${ind.caseLocationState || '—'} | ${ind.exonerationOrReleaseYear || '—'} | ${ind.sourceUrl || '—'} |`
    ),
    '',
  ];
  fs.writeFileSync(path.join(OUT_DIR, 'DELTA_INDIVIDUALS_REPORT.md'), md.join('\n'), 'utf8');

  console.log(`=== IP 2025-2026 Delta Complete ===`);
  console.log(`News Hub bulk JSON:     ${bulkNews.length} articles`);
  console.log(`New/updated individuals:${individualsOut.length}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
