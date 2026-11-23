// scripts/check_source_deltas.js
// Compares Spring 2025 snapshots (wikipedia_v2, ip_news_v2, nre_v2) against live Nov 2026 public sources:
//   1. Wikipedia MediaWiki API (List of wrongful convictions in the United States)
//   2. Innocence Project WordPress REST API / RSS feed (backfill 2025-2026 gap)
//   3. National Registry of Exonerations (checks max local Case ID + probes public endpoint)

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const SERVER = path.join(REPO, 'server');
const SEED = path.join(SERVER, 'prisma', 'seed_files');

const axios = require(require.resolve('axios', { paths: [SERVER] }));
const { parse } = require(require.resolve('csv-parse/sync', { paths: [SERVER] }));
const humanparser = require(require.resolve('humanparser', { paths: [SERVER] }));
const { resolveCrimeCategoryName } = require('../server/utils/canonicalCatalog');

const UA = 'InnocenceArchiveResearchBot/1.0 (https://innocencearchive.org; research delta check)';

function norm(s) {
  return (s || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function stripWikiMarkup(raw) {
  if (!raw) return '';
  return String(raw)
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\{\{sortname\|([^|}]+)\|([^|}]+)(?:\|[^}]*)?\}\}/gi, '$1 $2')
    .replace(/\{\{dts\|([^}]+)\}\}/gi, '$1')
    .replace(/\{\{[^}]+\}\}/g, ' ')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
    .replace(/''+/g, '')
    .replace(/<br\s*\/?>/gi, ', ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
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

function decodeHtml(str) {
  return String(str || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&#039;/g, "'")
    .replace(/&#8217;|&#x2019;/g, '’')
    .replace(/&#8216;|&#x2018;/g, '‘')
    .replace(/&#8220;|&#x201c;/g, '“')
    .replace(/&#8221;|&#x201d;/g, '”')
    .replace(/&#8211;|&#x2013;/g, '–')
    .replace(/&#8212;|&#x2014;/g, '—')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// -----------------------------------------------------------------------------
// 1. WIKIPEDIA DELTA
// -----------------------------------------------------------------------------
async function checkWikipediaDelta(nreByFL) {
  console.log('\n=== 1. WIKIPEDIA LIVE DELTA CHECK ===');
  const wikiOld = JSON.parse(
    fs.readFileSync(path.join(SEED, 'wikipedia_v2', 'all_wikipedia_individuals_bundle.json'), 'utf8')
  );
  const oldByKey = new Map();
  for (const r of wikiOld) {
    oldByKey.set(`${norm(r.firstName)}|${norm(r.lastName)}`, r);
    if (r.nickname) oldByKey.set(`${norm(r.nickname)}|${norm(r.lastName)}`, r);
  }

  const url = 'https://en.wikipedia.org/w/api.php';
  const resp = await axios.get(url, {
    params: {
      action: 'parse',
      page: 'List_of_wrongful_convictions_in_the_United_States',
      prop: 'wikitext',
      format: 'json',
    },
    headers: { 'User-Agent': UA },
    timeout: 20000,
  });

  const wikitext = resp.data?.parse?.wikitext?.['*'] || '';
  if (!wikitext) {
    console.error('Wikipedia API returned empty wikitext.');
    return;
  }

  // Extract wikitable rows (rows split by \n|-)
  const tableBlocks = wikitext.match(/\{\|[\s\S]*?\|\}/g) || [];
  const liveRows = [];

  for (const tbl of tableBlocks) {
    if (!/Date of crime|Name/i.test(tbl)) continue;
    const rawRows = tbl.split(/\n\|-[^\n]*\n/);
    for (let i = 1; i < rawRows.length; i++) {
      const block = rawRows[i];
      if (!block.trim() || block.trim().startsWith('!')) continue;
      // Split cells by \n| or ||
      const cells = [];
      for (const line of block.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === '|}' || trimmed.startsWith('!')) continue;
        if (trimmed.startsWith('|')) {
          const parts = trimmed.slice(1).split('||');
          for (const part of parts) {
            // Strip leading cell attributes like style="..." |
            const attrSplit = part.match(/^[^[\]{}|]*\|(.*)$/);
            cells.push(stripWikiMarkup(attrSplit ? attrSplit[1] : part));
          }
        } else if (cells.length > 0) {
          cells[cells.length - 1] = `${cells[cells.length - 1]} ${stripWikiMarkup(trimmed)}`.trim();
        }
      }
      // Typical columns: Date of Crime, Name, Crime, Location, Sentence, Time Served, Status of Exoneration, Summary
      if (cells.length >= 4 && cells[1] && cells[1].length >= 3) {
        liveRows.push({
          dateOfCrime: cells[0] || '',
          rawName: cells[1] || '',
          crime: cells[2] || '',
          location: cells[3] || '',
          sentence: cells[4] || '',
          timeServed: cells[5] || '',
          statusRaw: cells[6] || '',
          summary: cells[7] || '',
        });
      }
    }
  }

  console.log(`Parsed ${liveRows.length} live Wikipedia table rows (vs ${wikiOld.length} in Spring 2025 snapshot).`);

  const newEntries = [];
  const statusChanges = [];

  for (const lr of liveRows) {
    const p = parseNameClean(lr.rawName);
    if (!p.firstName || !p.lastName) continue;
    const key = `${norm(p.firstName)}|${norm(p.lastName)}`;
    const prev = oldByKey.get(key);

    if (!prev) {
      const inNre = nreByFL.has(key);
      newEntries.push({
        firstName: p.firstName,
        middleName: p.middleName,
        lastName: p.lastName,
        suffix: p.suffix,
        nickname: p.nickname,
        status: /^yes/i.test(lr.statusRaw) ? 'EXONERATED' : /executed/i.test(lr.sentence) ? 'EXECUTED' : 'UNKNOWN',
        claimStrength: /^yes/i.test(lr.statusRaw) ? 'FORMALLY_EXONERATED' : 'CREDIBLE_CLAIM',
        crimeCategory: resolveCrimeCategoryName(lr.crime),
        timeServed: lr.timeServed || null,
        sentence: lr.sentence || null,
        caseLocationState: lr.location ? lr.location.split(',').pop().trim() : null,
        caseLocationCountry: 'USA',
        narrativeSummary: lr.summary || null,
        sourceName: 'Wikipedia',
        sourceUrl: 'https://en.wikipedia.org/wiki/List_of_wrongful_convictions_in_the_United_States',
        headline: `Wikipedia (Nov 2026 delta): ${lr.rawName}`,
        reviewWarnings: [
          inNre ? 'Already exists in NRE v2 — will MERGE safely.' : 'New entry not in Spring 2025 Wikipedia or NRE v2.',
        ],
        _meta: { rawName: lr.rawName, dateOfCrime: lr.dateOfCrime, location: lr.location, statusRaw: lr.statusRaw, inNre },
      });
    } else if (/^yes/i.test(lr.statusRaw) && prev.status !== 'EXONERATED') {
      statusChanges.push({
        name: `${prev.firstName} ${prev.lastName}`,
        oldStatus: prev.status,
        newWikiStatus: lr.statusRaw,
        dateOfCrime: lr.dateOfCrime,
      });
    }
  }

  const outDir = path.join(SEED, 'wikipedia_v2');
  fs.writeFileSync(path.join(outDir, 'delta_2025_2026.json'), JSON.stringify(newEntries, null, 2), 'utf8');

  const md = [
    '# Wikipedia Live Delta Report (Spring 2025 → Nov 2026)',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `- **Live Wikipedia table rows parsed:** ${liveRows.length}`,
    `- **Spring 2025 snapshot rows:** ${wikiOld.length}`,
    `- **New / Unmatched Entries Found (\`delta_2025_2026.json\`):** ${newEntries.length} (${newEntries.filter((e) => !e._meta.inNre).length} also not in NRE v2)`,
    `- **Status Upgrades (Non-Exonerated → Exonerated):** ${statusChanges.length}`,
    '',
    '## Status Upgrades',
    ...(statusChanges.length
      ? statusChanges.map((s) => `- **${s.name}**: \`${s.oldStatus}\` → \`${s.newWikiStatus}\``)
      : ['- None detected.']),
    '',
    '## New Entries Added Since Spring 2025 (First 50)',
    '| Name | Crime Date | Location | Status | In NRE v2? |',
    '| --- | --- | --- | --- | :---: |',
    ...newEntries.slice(0, 50).map(
      (e) => `| **${e._meta.rawName}** | ${e._meta.dateOfCrime || '—'} | ${e._meta.location || '—'} | ${e._meta.statusRaw || '—'} | ${e._meta.inNre ? 'Yes' : 'No'} |`
    ),
    '',
  ];
  fs.writeFileSync(path.join(outDir, 'DELTA_REPORT.md'), md.join('\n'), 'utf8');

  console.log(`Wikipedia new/delta entries: ${newEntries.length} (status upgrades: ${statusChanges.length})`);
}

// -----------------------------------------------------------------------------
// 2. INNOCENCE PROJECT NEWS DELTA (WP REST API or Paginated RSS)
// -----------------------------------------------------------------------------
async function checkIpNewsDelta() {
  console.log('\n=== 2. INNOCENCE PROJECT NEWS DELTA CHECK ===');
  const csvRows = parse(
    fs.readFileSync(path.join(SEED, 'innocenceproject_news_processed.csv'), 'utf8'),
    { columns: true, skip_empty_lines: true, trim: true, relax_quotes: true, relax_column_count: true }
  );
  const existingUrls = new Set(
    csvRows.map((r) => (r.link || '').trim().replace(/\/+$/, '').toLowerCase()).filter(Boolean)
  );
  console.log(`Spring 2025 IP News CSV unique URLs: ${existingUrls.size}`);

  const newArticles = [];
  let methodUsed = '';

  // Try WP REST API first (fast, structured, 100/page)
  const wpEndpoints = [
    'https://innocenceproject.org/wp-json/wp/v2/news',
    'https://innocenceproject.org/wp-json/wp/v2/posts',
  ];

  for (const ep of wpEndpoints) {
    try {
      const test = await axios.get(ep, {
        params: { per_page: 5, page: 1 },
        headers: { 'User-Agent': UA },
        timeout: 12000,
      });
      if (Array.isArray(test.data) && test.data.length > 0) {
        methodUsed = `WP REST API (${ep})`;
        console.log(`Connected via ${methodUsed}`);
        for (let page = 1; page <= 10; page++) {
          const r = await axios.get(ep, {
            params: { per_page: 100, page, after: '2025-01-01T00:00:00' },
            headers: { 'User-Agent': UA },
            timeout: 15000,
          }).catch((e) => (e.response?.status === 400 ? { data: [] } : Promise.reject(e)));

          const posts = Array.isArray(r.data) ? r.data : [];
          if (posts.length === 0) break;

          for (const p of posts) {
            const link = (p.link || '').trim();
            const normLink = link.replace(/\/+$/, '').toLowerCase();
            if (!existingUrls.has(normLink)) {
              newArticles.push({
                headline: decodeHtml(p.title?.rendered || ''),
                url: link,
                publishedAt: p.date || null,
                summary: decodeHtml(p.excerpt?.rendered || '').slice(0, 400),
              });
            }
          }
          if (posts.length < 100) break;
        }
        break;
      }
    } catch (e) {
      // Try next endpoint
    }
  }

  // Fallback to paginated RSS if WP REST API unavailable
  if (!methodUsed) {
    methodUsed = 'Paginated RSS (https://innocenceproject.org/feed/?post_type=news)';
    console.log(`Falling back to ${methodUsed}`);
    for (let page = 1; page <= 15; page++) {
      try {
        const r = await axios.get(`https://innocenceproject.org/feed/?post_type=news&paged=${page}`, {
          headers: { 'User-Agent': UA },
          timeout: 15000,
          responseType: 'text',
        });
        const blocks = String(r.data || '').match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];
        if (blocks.length === 0) break;
        let hitPre2025 = false;
        for (const b of blocks) {
          const title = decodeHtml((b.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
          const link = decodeHtml((b.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1] || '');
          const pub = decodeHtml((b.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || [])[1] || '');
          const desc = decodeHtml((b.match(/<description[^>]*>([\s\S]*?)<\/description>/i) || [])[1] || '').slice(0, 400);
          const dt = pub ? new Date(pub) : null;
          if (dt && !Number.isNaN(dt.getTime()) && dt.getFullYear() < 2025) {
            hitPre2025 = true;
            continue;
          }
          const normLink = link.replace(/\/+$/, '').toLowerCase();
          if (link && !existingUrls.has(normLink) && !newArticles.some((a) => a.url === link)) {
            newArticles.push({
              headline: title,
              url: link,
              publishedAt: dt && !Number.isNaN(dt.getTime()) ? dt.toISOString() : null,
              summary: desc,
            });
          }
        }
        if (hitPre2025) break;
      } catch (e) {
        break;
      }
    }
  }

  const outDir = path.join(SEED, 'ip_news_v2');
  fs.writeFileSync(path.join(outDir, 'delta_news_2025_2026.json'), JSON.stringify(newArticles, null, 2), 'utf8');

  const md = [
    '# Innocence Project News Delta Report (2025–2026)',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Method: ${methodUsed}`,
    '',
    `- **Spring 2025 CSV unique URLs:** ${existingUrls.size}`,
    `- **New 2025–2026 Articles Not in CSV (\`delta_news_2025_2026.json\`):** ${newArticles.length}`,
    '',
    '## Latest 35 New Articles (2025–2026)',
    '| Date | Headline | URL |',
    '| --- | --- | --- |',
    ...newArticles.slice(0, 35).map(
      (a) => `| ${(a.publishedAt || '—').slice(0, 10)} | ${(a.headline || '').replace(/\|/g, '/')} | ${a.url} |`
    ),
    '',
  ];
  fs.writeFileSync(path.join(outDir, 'DELTA_REPORT.md'), md.join('\n'), 'utf8');
  console.log(`IP News new 2025-2026 articles found: ${newArticles.length}`);
}

// -----------------------------------------------------------------------------
// 3. NRE MAX CASE ID & PUBLIC ENDPOINT PROBE
// -----------------------------------------------------------------------------
async function checkNreStatus(nreBundle) {
  console.log('\n=== 3. NATIONAL REGISTRY OF EXONERATIONS (NRE) CHECK ===');
  let maxId = 0;
  let maxExonYear = 0;
  for (const ind of nreBundle) {
    if (ind.exonerationOrReleaseYear && ind.exonerationOrReleaseYear > maxExonYear) {
      maxExonYear = ind.exonerationOrReleaseYear;
    }
    for (const l of ind.sourceLinks || []) {
      const m = String(l.sourceUrl || '').match(/\/cases\/(\d+)/);
      if (m) {
        const id = parseInt(m[1], 10);
        if (id > maxId) maxId = id;
      }
    }
  }
  console.log(`Local nre_v2 snapshot: ${nreBundle.length} individuals | Max Exoneration Year: ${maxExonYear} | Max NRE Case ID: #${maxId}`);

  try {
    const resp = await axios.get('https://exonerationregistry.org/cases', {
      headers: { 'User-Agent': UA },
      timeout: 15000,
      validateStatus: () => true,
    });
    const html = String(resp.data || '');
    const countMatch = html.match(/([\d,]+)\s+exonerations/i) || html.match(/Showing\s+\d+\s*[-–]\s*\d+\s+of\s+([\d,]+)/i);
    console.log(`Live exonerationregistry.org/cases HTTP ${resp.status} | Detected count text: ${countMatch ? countMatch[0] : 'not in static HTML (JS-rendered or API-backed)'}`);
  } catch (e) {
    console.log(`Could not reach exonerationregistry.org: ${e.message}`);
  }
}

async function main() {
  const nreBundle = JSON.parse(
    fs.readFileSync(path.join(SEED, 'nre_v2', 'all_nre_individuals_bundle.json'), 'utf8')
  );
  const nreByFL = new Map();
  for (const ind of nreBundle) {
    nreByFL.set(`${norm(ind.firstName)}|${norm(ind.lastName)}`, ind);
  }

  try { await checkWikipediaDelta(nreByFL); } catch (e) { console.error('Wikipedia check failed:', e.message); }
  try { await checkIpNewsDelta(); } catch (e) { console.error('IP News check failed:', e.message); }
  try { await checkNreStatus(nreBundle); } catch (e) { console.error('NRE check failed:', e.message); }
}

main();
