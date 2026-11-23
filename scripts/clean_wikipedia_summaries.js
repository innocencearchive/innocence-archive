// scripts/clean_wikipedia_summaries.js
// Re-extracts clean, properly-spaced narrativeSummary prose from Wikipedia's
// "List of wrongful convictions in the United States" via MediaWiki API wikitext,
// replaces the glued-word summaries in wikipedia_v2/all_wikipedia_individuals_bundle.json,
// and emits wikipedia_v2/clean_wikipedia_summaries_patch.json for one-click upload in /admin/import.

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const SERVER = path.join(REPO, 'server');
const SEED = path.join(SERVER, 'prisma', 'seed_files');
const OUT_DIR = path.join(SEED, 'wikipedia_v2');

const axios = require(require.resolve('axios', { paths: [SERVER] }));
const humanparser = require(require.resolve('humanparser', { paths: [SERVER] }));

const UA = 'InnocenceArchiveResearchBot/1.0 (https://innocencearchive.org; summary cleanup)';

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

function stripWikiNameCell(raw) {
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

/**
 * Clean Wikipedia wikitext prose while preserving parentheticals, quotes, and spaces!
 */
function stripWikiProse(raw) {
  if (!raw) return '';
  let s = String(raw);

  // Remove HTML comments and <ref> tags (both paired and self-closing)
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '');
  s = s.replace(/<ref[^>]*\/>/gi, '');

  // Handle common inline templates cleanly before stripping remaining templates
  s = s.replace(/\{\{sortname\|([^|}]+)\|([^|}]+)(?:\|[^}]*)?\}\}/gi, '$1 $2');
  s = s.replace(/\{\{circa\|([^|}]+)(?:\|[^}]*)?\}\}/gi, 'c. $1');
  s = s.replace(/\{\{convert\|([^|}]+)\|([^|}]+)(?:\|[^}]*)?\}\}/gi, '$1 $2');
  s = s.replace(/\{\{(?:ndash|endash|--)\}\}/gi, '–');
  s = s.replace(/\{\{(?:mdash|emdash)\}\}/gi, '—');
  s = s.replace(/\{\{nbsp\}\}/gi, ' ');
  s = s.replace(/\{\{sic(?:\|[^}]*)?\}\}/gi, '[sic]');
  s = s.replace(/\{\{efn\|[\s\S]*?\}\}/gi, '');
  s = s.replace(/\{\{sfn\|[\s\S]*?\}\}/gi, '');
  s = s.replace(/\{\{citation needed[^}]*\}\}/gi, '');
  s = s.replace(/\{\{clarify[^}]*\}\}/gi, '');
  s = s.replace(/\{\{who[^}]*\}\}/gi, '');
  s = s.replace(/\{\{when[^}]*\}\}/gi, '');
  // Unwrap nested templates iteratively (e.g. {{nowrap|...}}, {{lang|en|...}}, etc.)
  for (let pass = 0; pass < 3; pass++) {
    s = s.replace(/\{\{(?:nowrap|small|abbr|lang\|[^|]+)\|([^{}]+)\}\}/gi, '$1');
    s = s.replace(/\{\{[^{}]*\}\}/g, ' ');
  }

  // Convert wiki links [[Target|Display]] -> Display and [[Target]] -> Target
  s = s.replace(/\[\[(?:File|Image):[^\]]+\]\]/gi, '');
  s = s.replace(/\[\[[^|\]]*\|([^\]]+)\]\]/g, '$1');
  s = s.replace(/\[\[([^\]]+)\]\]/g, '$1');

  // External links [https://... Label] -> Label, bare [https://...] -> ''
  s = s.replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, '$1');
  s = s.replace(/\[https?:\/\/\S+\]/g, '');

  // Remove bold/italic wikitext quotes
  s = s.replace(/''+/g, '');

  // HTML entities & tags
  s = s.replace(/<br\s*\/?>/gi, ' ');
  s = s.replace(/<[^>]+>/g, ' ');
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—');

  // Remove stray footnote markers like [1], [a]
  s = s.replace(/\[(?:\d+|[a-z])\]/g, '');

  // Normalize punctuation spacing
  s = s.replace(/\s+([.,;:!?])/g, '$1');
  s = s.replace(/([.?!,;:])([A-Z])/g, '$1 $2');
  s = s.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}

// Exact word-glue & spacing fixes for the ~18 legacy Wikipedia entries no longer in the live Wikipedia table
const LEGACY_GLUE_FIXES = [
  [/\bMc Clinton\b/g, 'McClinton'],
  [/\bMc Knight\b/g, 'McKnight'],
  [/\bDe Luna\b/g, 'DeLuna'],
  [/personexecuted/g, 'person executed'],
  [/Catholicand/g, 'Catholic and'],
  [/anti-Irishimmigrantbias/g, 'anti-Irish immigrant bias'],
  [/Cranstontextilefactory/g, 'Cranston textile factory'],
  [/Yankeewitnesses/g, 'Yankee witnesses'],
  [/Chafeepardoned/g, 'Chafee pardoned'],
  [/theassassinationof/g, 'the assassination of'],
  [/Goebelin 1900/g, 'Goebel in 1900'],
  [/toprison/g, 'to prison'],
  [/Anappeals courtoverturned/g, 'An appeals court overturned'],
  [/ahung jury/g, 'a hung jury'],
  [/Willsonpardoned/g, 'Willson pardoned'],
  [/My Own Story\(1905\)/g, 'My Own Story (1905)'],
  [/Dukakisasked/g, 'Dukakis asked'],
  [/thefirst-degree murderof/g, 'the first-degree murder of'],
  [/Nophysical evidenceexisted/g, 'No physical evidence existed'],
  [/thecircumstantialfact/g, 'the circumstantial fact'],
  [/officersstarved/g, 'officers starved'],
  [/theall-white juryfound/g, 'the all-white jury found'],
  [/Stollsentenced/g, 'Stoll sentenced'],
  [/Johnstondenied/g, 'Johnston denied'],
  [/bycircuit courtjudge/g, 'by circuit court judge'],
  [/McKnightintroduced/g, 'McKnight introduced'],
  [/offirst-degree murderin/g, 'of first-degree murder in'],
  [/theNAACPon/g, 'the NAACP on'],
  [/Courtdismissed/g, 'Court dismissed'],
  [/forwrit ofcertiorarito theU\.S\./g, 'for writ of certiorari to the U.S.'],
  [/Wainwrightand/g, 'Wainwright and'],
  [/Trumpetand/g, 'Trumpet and'],
  [/electriccattle prod/g, 'electric cattle prod'],
  [/Pennsylvaniaruled/g, 'Pennsylvania ruled'],
  [/todouble jeopardyand/g, 'to double jeopardy and'],
  [/abusecases/g, 'abuse cases'],
  [/Remembersas/g, 'Remembers as'],
  [/notoriousinformantswho/g, 'notorious informants who'],
  [/hadsexually abuseda/g, 'had sexually abused a'],
  [/manytherapy sessions\(/g, 'many therapy sessions ('],
  [/Startcenter/g, 'Start center'],
  [/involvedrape,sodomy, andfellatio/g, 'involved rape, sodomy, and fellatio'],
  [/ofsharks/g, 'of sharks'],
  [/Westchestermurder/g, 'Westchester murder'],
  [/([.?!])"([A-Z])/g, '$1" $2'],
  [/,([a-z])/g, ', $1'],
];

/**
 * Fallback spacing fixer for any legacy summary not matched in live Wikipedia
 */
function fallbackFixSpacing(raw) {
  if (!raw) return '';
  let s = String(raw);
  s = s.replace(/\[(?:\d+|[a-z])\]/g, '');
  for (const [re, rep] of LEGACY_GLUE_FIXES) {
    s = s.replace(re, rep);
  }
  s = s.replace(/([a-z0-9])([.?!,;:])([A-Z])/g, '$1$2 $3');
  s = s.replace(/\s+([.,;:!?])/g, '$1');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function splitPeopleNames(rawCell) {
  let s = (rawCell || '').trim();
  if (!s || DATE_LIKE_RE.test(s)) return [];
  if (s.includes(':')) {
    s = s.split(':').slice(1).join(':').trim();
  }
  if (!s || SKIP_PHRASE_RE.test(s)) return [];

  const sharedLastMatch = s.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+and\s+([A-Z][a-z]+)\s+([A-Z][a-z]+)$/);
  if (sharedLastMatch && !sharedLastMatch[1].includes(' ')) {
    return [`${sharedLastMatch[1]} ${sharedLastMatch[3]}`, `${sharedLastMatch[2]} ${sharedLastMatch[3]}`];
  }
  if (s === 'Mary Ann and Joe Elizondo') {
    return ['Mary Ann Elizondo', 'Joe Elizondo'];
  }

  const rawParts = s
    .replace(/,\s*and\s+/gi, ', ')
    .replace(/\s+and\s+/gi, ', ')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

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
    lastName: (p.lastName || '').trim(),
    nickname,
  };
}

function auditSummaries(rows) {
  let totalWithSummary = 0;
  let missingAfterPunct = 0;
  let camelJoin = 0;
  let doubleSpace = 0;
  for (const row of rows) {
    const s = row.narrativeSummary || '';
    if (!s) continue;
    totalWithSummary++;
    if (/[a-z][.?!,:;][A-Z]/.test(s)) missingAfterPunct++;
    // Exclude legitimate Mc/Mac/De/La/O' names like McDonald, DePaul, LaSalle, O'Brien
    const cleanedForCamel = s.replace(/\b(?:Mc|Mac|De|La|Le|Di|Van|Du|St)[A-Z][a-z]+/g, '');
    if (/[a-z][A-Z][a-z]/.test(cleanedForCamel)) camelJoin++;
    if (/\s{2,}/.test(s)) doubleSpace++;
  }
  return { totalWithSummary, missingAfterPunct, camelJoin, doubleSpace };
}

async function main() {
  const bundlePath = path.join(OUT_DIR, 'all_wikipedia_individuals_bundle.json');
  const wikiBundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));

  console.log('BEFORE audit (all_wikipedia_individuals_bundle.json):', auditSummaries(wikiBundle));

  const cachePath = 'C:/Users/timsteen/.gemini/antigravity/brain/386504f2-8723-4851-b721-3e85e8ca8611/scratch/wiki_list.txt';
  let wikitext = '';
  if (fs.existsSync(cachePath)) {
    wikitext = fs.readFileSync(cachePath, 'utf8');
  } else {
    const resp = await axios.get('https://en.wikipedia.org/w/api.php', {
      params: {
        action: 'parse',
        page: 'List_of_wrongful_convictions_in_the_United_States',
        prop: 'wikitext',
        format: 'json',
      },
      headers: { 'User-Agent': UA },
      timeout: 25000,
    });
    wikitext = resp.data?.parse?.wikitext?.['*'] || '';
  }
  const tableBlocks = wikitext.match(/\{\|[\s\S]*?\|\}/g) || [];

  // Map canonical key -> clean summary prose
  const cleanSummaryByKey = new Map();
  const cleanSummaryByLastAndYear = new Map();

  for (const tbl of tableBlocks) {
    if (!/Date of crime|Defendants|Name/i.test(tbl)) continue;
    // Split on row separators (`|-` or `|--`)
    const rawRows = tbl.split(/\n\|-+[^\n]*\n/);
    let pendingPeople = [];
    let pendingYear = '';

    for (let i = 1; i < rawRows.length; i++) {
      const block = rawRows[i].trim();
      if (!block || block.startsWith('!')) continue;

      // Check if this row is the colspan summary row following a person row
      const colspanMatch = block.match(/^\|\s*colspan\s*=\s*"?\d+"?\s*\|([\s\S]*)$/i);
      if (colspanMatch) {
        const summaryRaw = colspanMatch[1].replace(/\|\}\s*$/, '').trim();
        const cleanSummary = stripWikiProse(summaryRaw);
        if (cleanSummary && cleanSummary.length >= 20 && pendingPeople.length > 0) {
          for (const p of pendingPeople) {
            let key = `${norm(p.firstName)}|${norm(p.lastName)}`;
            if (ALIAS_MAP[key]) key = ALIAS_MAP[key];
            if (!cleanSummaryByKey.has(key)) cleanSummaryByKey.set(key, cleanSummary);
            if (p.nickname) {
              const nk = `${norm(p.nickname)}|${norm(p.lastName)}`;
              if (!cleanSummaryByKey.has(nk)) cleanSummaryByKey.set(nk, cleanSummary);
            }
            if (pendingYear) {
              cleanSummaryByLastAndYear.set(`${norm(p.lastName)}|${pendingYear}`, cleanSummary);
            }
          }
        }
        pendingPeople = [];
        pendingYear = '';
        continue;
      }

      // Otherwise parse metadata row (Date, Defendants, Crime, Location, ...)
      const rawCells = [];
      for (const line of block.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === '|}' || trimmed.startsWith('!')) continue;
        if (trimmed.startsWith('|')) {
          const parts = trimmed.slice(1).split('||');
          for (const part of parts) {
            const attrSplit = part.match(/^[^[\]{}|]*\|(.*)$/);
            rawCells.push((attrSplit ? attrSplit[1] : part).trim());
          }
        } else if (rawCells.length > 0) {
          rawCells[rawCells.length - 1] = `${rawCells[rawCells.length - 1]} ${trimmed}`.trim();
        }
      }

      if (rawCells.length < 3) continue;
      const cell0Clean = stripWikiNameCell(rawCells[0] || '');
      const cell0HasYear = /\d{4}/.test(cell0Clean);
      const nameCellRaw = cell0HasYear ? rawCells[1] : rawCells[0];
      const nameCell = stripWikiNameCell(nameCellRaw);
      const yearMatch = cell0Clean.match(/\b(1[6-9]\d{2}|20\d{2})\b/);
      pendingYear = yearMatch ? yearMatch[1] : '';
      pendingPeople = [];

      const names = splitPeopleNames(nameCell);
      for (const nm of names) {
        const p = parseNameClean(nm);
        if (p.firstName && p.lastName) pendingPeople.push(p);
      }
    }
  }

  console.log(`Extracted ${cleanSummaryByKey.size} clean summaries from live Wikipedia wikitext.`);

  let replacedFromLive = 0;
  let fixedViaFallback = 0;
  let unchanged = 0;
  const patchRows = [];

  for (const row of wikiBundle) {
    let key = `${norm(row.firstName)}|${norm(row.lastName)}`;
    if (ALIAS_MAP[key]) key = ALIAS_MAP[key];

    let liveSummary = cleanSummaryByKey.get(key);
    if (!liveSummary && row.nickname) {
      liveSummary = cleanSummaryByKey.get(`${norm(row.nickname)}|${norm(row.lastName)}`);
    }
    if (!liveSummary && row.convictionYear) {
      liveSummary = cleanSummaryByLastAndYear.get(`${norm(row.lastName)}|${row.convictionYear}`);
    }

    const oldSummary = row.narrativeSummary || '';
    if (liveSummary) {
      if (liveSummary !== oldSummary) {
        row.narrativeSummary = liveSummary;
        replacedFromLive++;
      } else {
        unchanged++;
      }
      patchRows.push(row);
    } else if (oldSummary) {
      const fixed = fallbackFixSpacing(oldSummary);
      if (fixed !== oldSummary) {
        row.narrativeSummary = fixed;
        fixedViaFallback++;
      } else {
        unchanged++;
      }
      patchRows.push(row);
    }
  }

  console.log({ replacedFromLive, fixedViaFallback, unchanged, patchRowsCount: patchRows.length });
  console.log('AFTER audit (all_wikipedia_individuals_bundle.json):', auditSummaries(wikiBundle));

  fs.writeFileSync(bundlePath, JSON.stringify(wikiBundle, null, 2));
  const patchPath = path.join(OUT_DIR, 'clean_wikipedia_summaries_patch.json');
  fs.writeFileSync(patchPath, JSON.stringify(patchRows, null, 2));
  console.log(`Wrote updated ${bundlePath}`);
  console.log(`Wrote patch ${patchPath} (${patchRows.length} rows)`);

  // Also enrich delta_2025_2026.json with clean summaries!
  const deltaPath = path.join(OUT_DIR, 'delta_2025_2026.json');
  if (fs.existsSync(deltaPath)) {
    const delta = JSON.parse(fs.readFileSync(deltaPath, 'utf8'));
    let deltaEnriched = 0;
    for (const row of delta) {
      let key = `${norm(row.firstName)}|${norm(row.lastName)}`;
      if (ALIAS_MAP[key]) key = ALIAS_MAP[key];
      const liveSummary =
        cleanSummaryByKey.get(key) ||
        (row.nickname ? cleanSummaryByKey.get(`${norm(row.nickname)}|${norm(row.lastName)}`) : null);
      if (liveSummary) {
        row.narrativeSummary = liveSummary;
        deltaEnriched++;
      }
    }
    fs.writeFileSync(deltaPath, JSON.stringify(delta, null, 2));
    console.log(`Enriched ${deltaEnriched}/${delta.length} rows in delta_2025_2026.json with clean summaries.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
