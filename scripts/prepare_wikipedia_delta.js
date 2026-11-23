// scripts/prepare_wikipedia_delta.js
// Tightened MediaWiki API parser for "List of wrongful convictions in the United States":
//   - Properly skips rowspan-shifted date cells and group labels
//   - Splits multi-person cells ("A and B", "Group: A, B, and C") into individual people
//   - Diffs against wikipedia_v2 + nre_v2 (including canonical nickname aliases)
//   - Outputs:
//       server/prisma/seed_files/wikipedia_v2/delta_2025_2026.json  (upload-ready for /admin/import)
//       server/prisma/seed_files/wikipedia_v2/DELTA_REPORT.md

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const SERVER = path.join(REPO, 'server');
const SEED = path.join(SERVER, 'prisma', 'seed_files');
const OUT_DIR = path.join(SEED, 'wikipedia_v2');

const axios = require(require.resolve('axios', { paths: [SERVER] }));
const humanparser = require(require.resolve('humanparser', { paths: [SERVER] }));
const { resolveCrimeCategoryName } = require('../server/utils/canonicalCatalog');

const UA = 'InnocenceArchiveResearchBot/1.0 (https://innocencearchive.org; research delta)';
const WIKI_URL = 'https://en.wikipedia.org/wiki/List_of_wrongful_convictions_in_the_United_States';

const ALIAS_MAP = {
  'sam|sheppard': 'samuel|sheppard',
  'nick|yarris': 'nicholas|yarris',
  'ron|williamson': 'ronald|williamson',
  'kathy|gonzalez': 'kathleen|gonzalez',
  'tim|cole': 'timothy|cole',
  'tim|masters': 'timothy|masters',
  'chris|ochoa': 'christopher|ochoa',
  'francisco|carrillo': 'franky|carrillo',
  'ken|wyniemko': 'kenneth|wyniemko',
  'cal|harris': 'calvin|harris',
  'russ|faria': 'russell|faria',
  'greg|kelley': 'gregory|kelley',
  'dan|keller': 'daniel|keller',
  'joe|salvati': 'joseph|salvati',
};

const SKIP_PHRASE_RE = /\b(boys|four|five|six|seven|nine|three|people|defendants|men|women|victims|various|unnamed|unknown|at least|and others|et al|employees|facility|staff)\b/i;
const DATE_LIKE_RE = /\b(january|february|march|april|may|june|july|august|september|october|november|december|abbr=|format=|years?|months?|executed|life|prison|murder|rape|arson|robbery)\b|^\d{4}|^--$/i;

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
    .replace(/\{\{dts\|([^|}]+)(?:\|[^}]*)?\}\}/gi, '$1')
    .replace(/\{\{[^}]+\}\}/g, ' ')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
    .replace(/''+/g, '')
    .replace(/<br\s*\/?>/gi, ', ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitPeopleNames(rawCell) {
  let s = (rawCell || '').trim();
  if (!s || DATE_LIKE_RE.test(s)) return [];
  // Strip leading group prefix like "Beatrice Six: " or "The Ford Heights Four: "
  if (s.includes(':')) {
    s = s.split(':').slice(1).join(':').trim();
  }
  if (!s || SKIP_PHRASE_RE.test(s)) return [];

  // Handle "Mary Ann and Joe Elizondo" -> ["Mary Ann Elizondo", "Joe Elizondo"]
  const sharedLastMatch = s.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+and\s+([A-Z][a-z]+)\s+([A-Z][a-z]+)$/);
  if (sharedLastMatch && !sharedLastMatch[1].includes(' ')) {
    return [`${sharedLastMatch[1]} ${sharedLastMatch[3]}`, `${sharedLastMatch[2]} ${sharedLastMatch[3]}`];
  }
  if (s === 'Mary Ann and Joe Elizondo') {
    return ['Mary Ann Elizondo', 'Joe Elizondo'];
  }

  // Split on ", and ", " and ", or ","
  const rawParts = s
    .replace(/,\s*and\s+/gi, ', ')
    .replace(/\s+and\s+/gi, ', ')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

  // Re-attach suffixes like "Jr." / "Sr." / "III" if split by comma
  const merged = [];
  for (const part of rawParts) {
    if (/^(Jr\.?|Sr\.?|II|III|IV)$/i.test(part) && merged.length > 0) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${part}`;
    } else if (!SKIP_PHRASE_RE.test(part) && !DATE_LIKE_RE.test(part)) {
      merged.push(part);
    }
  }
  return merged;
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

function parseLocation(rawLoc) {
  if (!rawLoc || !rawLoc.trim()) return { city: null, county: null, state: null };
  const fixed = rawLoc.replace(/,([^\s])/g, ', $1').trim();
  const parts = fixed.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) return { city: parts[0], county: parts[1], state: parts[2] };
  if (parts.length === 2) {
    if (/county|parish/i.test(parts[0])) return { city: null, county: parts[0], state: parts[1] };
    return { city: parts[0], county: null, state: parts[1] };
  }
  if (parts.length === 1) return { city: null, county: null, state: parts[0] };
  return { city: null, county: null, state: null };
}

async function main() {
  const wikiOld = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'all_wikipedia_individuals_bundle.json'), 'utf8'));
  const nreBundle = JSON.parse(fs.readFileSync(path.join(SEED, 'nre_v2', 'all_nre_individuals_bundle.json'), 'utf8'));

  const oldWikiByKey = new Map();
  for (const r of wikiOld) {
    const k = `${norm(r.firstName)}|${norm(r.lastName)}`;
    oldWikiByKey.set(k, r);
    if (r.nickname) oldWikiByKey.set(`${norm(r.nickname)}|${norm(r.lastName)}`, r);
  }

  const nreByKey = new Map();
  for (const r of nreBundle) {
    const k = `${norm(r.firstName)}|${norm(r.lastName)}`;
    nreByKey.set(k, r);
    if (r.nickname) nreByKey.set(`${norm(r.nickname)}|${norm(r.lastName)}`, r);
  }

  const resp = await axios.get('https://en.wikipedia.org/w/api.php', {
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
  const tableBlocks = wikitext.match(/\{\|[\s\S]*?\|\}/g) || [];

  const newEntries = [];
  const updatedKnown = [];
  const seenKeys = new Set();

  for (const tbl of tableBlocks) {
    if (!/Date of crime|Name/i.test(tbl)) continue;
    const rawRows = tbl.split(/\n\|-[^\n]*\n/);
    for (let i = 1; i < rawRows.length; i++) {
      const block = rawRows[i];
      if (!block.trim() || block.trim().startsWith('!')) continue;

      const cells = [];
      for (const line of block.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === '|}' || trimmed.startsWith('!')) continue;
        if (trimmed.startsWith('|')) {
          const parts = trimmed.slice(1).split('||');
          for (const part of parts) {
            const attrSplit = part.match(/^[^[\]{}|]*\|(.*)$/);
            cells.push(stripWikiMarkup(attrSplit ? attrSplit[1] : part));
          }
        } else if (cells.length > 0) {
          cells[cells.length - 1] = `${cells[cells.length - 1]} ${stripWikiMarkup(trimmed)}`.trim();
        }
      }

      if (cells.length < 4) continue;
      // Detect rowspan-shifted rows where cell[0] is NOT a date (already shifted) vs normal (cell[0]=date, cell[1]=name)
      const cell0HasYear = /\d{4}/.test(cells[0] || '');
      const dateOfCrime = cell0HasYear ? cells[0] : '';
      const nameCell = cell0HasYear ? cells[1] : cells[0];
      const crimeCell = cell0HasYear ? cells[2] : cells[1];
      const locCell = cell0HasYear ? cells[3] : cells[2];
      const sentCell = cell0HasYear ? cells[4] : cells[3];
      const timeCell = cell0HasYear ? cells[5] : cells[4];
      const statusCell = cell0HasYear ? cells[6] : cells[5];
      const summaryCell = cell0HasYear ? cells[7] : cells[6];

      const names = splitPeopleNames(nameCell);
      for (const nm of names) {
        const p = parseNameClean(nm);
        if (!p.firstName || !p.lastName || p.firstName.length < 2 || p.lastName.length < 2) continue;

        let key = `${norm(p.firstName)}|${norm(p.lastName)}`;
        if (ALIAS_MAP[key]) key = ALIAS_MAP[key];
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        const prevWiki = oldWikiByKey.get(key);
        const nreMatch = nreByKey.get(key);
        const loc = parseLocation(locCell);
        const isYes = /^yes\b/i.test(statusCell || '');
        const isExec = /executed/i.test(sentCell || '');
        const mappedStatus = isYes ? 'EXONERATED' : isExec ? 'EXECUTED' : /^no\b/i.test(statusCell || '') ? 'CONVICTED' : 'UNKNOWN';
        const mappedClaim = isYes ? 'FORMALLY_EXONERATED' : 'CREDIBLE_CLAIM';

        const rec = {
          firstName: nreMatch?.firstName || p.firstName,
          middleName: p.middleName || nreMatch?.middleName || null,
          lastName: nreMatch?.lastName || p.lastName,
          suffix: p.suffix || nreMatch?.suffix || null,
          nickname: p.nickname || nreMatch?.nickname || null,
          disambiguationTag: nreMatch?.disambiguationTag || null,
          status: nreMatch ? nreMatch.status : mappedStatus,
          claimStrength: nreMatch ? nreMatch.claimStrength : mappedClaim,
          crimeCategory: nreMatch ? nreMatch.crimeCategory : resolveCrimeCategoryName(crimeCell),
          convictionYear: nreMatch?.convictionYear ?? null,
          exonerationOrReleaseYear: nreMatch?.exonerationOrReleaseYear ?? null,
          timeServed: timeCell || null,
          sentence: sentCell || null,
          caseLocationCity: loc.city,
          caseLocationCounty: loc.county,
          caseLocationState: nreMatch?.caseLocationState || loc.state,
          caseLocationCountry: /japan/i.test(locCell || '') ? 'Japan' : 'USA',
          narrativeSummary: summaryCell || null,
          sourceName: 'Wikipedia',
          sourceUrl: WIKI_URL,
          headline: `Wikipedia (Nov 2026 delta): ${nm}`,
          reviewWarnings: [],
          _meta: { rawName: nm, dateOfCrime, location: locCell, statusRaw: statusCell, inNre: Boolean(nreMatch) },
        };

        if (!prevWiki) {
          rec.reviewWarnings.push(
            nreMatch ? 'Already in NRE v2 — will MERGE summary & Wikipedia link safely.' : 'Net-new individual added to Wikipedia since Spring 2025.'
          );
          newEntries.push(rec);
        } else {
          // Check if known individual gained an exoneration status or newly filled summary
          const statusUpgraded = isYes && prevWiki.status !== 'EXONERATED';
          const gainedSummary = !prevWiki.narrativeSummary && Boolean(summaryCell && summaryCell.length > 20);
          if (statusUpgraded || gainedSummary) {
            const reasons = [];
            if (statusUpgraded) reasons.push(`Status upgraded (${prevWiki.status} -> EXONERATED)`);
            if (gainedSummary) reasons.push('Added newly written Wikipedia summary');
            rec.reviewWarnings.push(reasons.join('; '));
            updatedKnown.push(rec);
          }
        }
      }
    }
  }

  const combinedUpload = [...newEntries, ...updatedKnown];
  fs.writeFileSync(path.join(OUT_DIR, 'delta_2025_2026.json'), JSON.stringify(combinedUpload, null, 2), 'utf8');

  const md = [
    '# Wikipedia Tightened Delta Report (Spring 2025 → Nov 2026)',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `- **Net-New Individuals Added on Wikipedia:** ${newEntries.length} (${newEntries.filter((x) => !x._meta.inNre).length} not in NRE v2; ${newEntries.filter((x) => x._meta.inNre).length} already in NRE v2 for safe MERGE)`,
    `- **Known Individuals With Updates (Status Upgrade or New Summary):** ${updatedKnown.length}`,
    `- **Total Upload-Ready Delta Records (\`delta_2025_2026.json\`):** ${combinedUpload.length}`,
    '',
    '## 1. Known Individuals Updated',
    ...(updatedKnown.length
      ? updatedKnown.map((u) => `- **${u.firstName} ${u.lastName}**: ${u.reviewWarnings.join('; ')}`)
      : ['- None']),
    '',
    `## 2. Net-New Wikipedia Individuals (${newEntries.length})`,
    '| Name | Crime Date | Location | Status | In NRE v2? |',
    '| --- | --- | --- | --- | :---: |',
    ...newEntries.map(
      (e) => `| **${e.firstName} ${e.lastName}** | ${e._meta.dateOfCrime || '—'} | ${e._meta.location || '—'} | \`${e.status}\` | ${e._meta.inNre ? 'Yes (MERGE)' : 'No (NEW)'} |`
    ),
    '',
  ];
  fs.writeFileSync(path.join(OUT_DIR, 'DELTA_REPORT.md'), md.join('\n'), 'utf8');

  console.log(`=== Wikipedia Tightened Delta Complete ===`);
  console.log(`Net-new individuals:  ${newEntries.length} (${newEntries.filter((x) => !x._meta.inNre).length} brand-new, ${newEntries.filter((x) => x._meta.inNre).length} in NRE)`);
  console.log(`Updated known rows:   ${updatedKnown.length}`);
  console.log(`Total in delta JSON:  ${combinedUpload.length}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
