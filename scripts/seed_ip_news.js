// scripts/seed_ip_news.js
// 1. Audits & imports historical Innocence Project news from server/prisma/seed_files/innocenceproject_news_processed.csv
//    into NewsArticle (deduplicated by unique URL, auto-categorized, linked to unambiguous matching Individuals).
// 2. Fetches latest live stories from https://innocenceproject.org/feed/ (with real publish dates & summaries)
//    so the Homepage Recent News rail and News Hub immediately display live current dispatches.

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SERVER_DIR = path.join(REPO_ROOT, 'server');
const CSV_PATH = path.join(SERVER_DIR, 'prisma', 'seed_files', 'innocenceproject_news_processed.csv');

const axios = require(require.resolve('axios', { paths: [SERVER_DIR] }));
const { parse } = require(require.resolve('csv-parse/sync', { paths: [SERVER_DIR] }));
const humanparser = require(require.resolve('humanparser', { paths: [SERVER_DIR] }));
const { PrismaClient } = require(require.resolve('@prisma/client', { paths: [SERVER_DIR] }));

function norm(s) {
  return (s || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function suggestCategory(headline, summary = '') {
  const txt = `${headline || ''} ${summary || ''}`.toLowerCase();
  if (/\b(petition|take action|call now|sign the|urge governor|clemency petition|stop the execution|call for action|write to)\b/.test(txt)) {
    return 'CALL_FOR_ACTION';
  }
  if (/\b(exonerat|freed after|walks free|regains.*freedom|cleared of|conviction vacated|pardoned|released after \d+ years|set free|experiences freedom)\b/.test(txt)) {
    return 'EXONERATION';
  }
  if (/\b(executed|execution scheduled|denied new trial|appeals court denies|rejects appeal|conviction upheld|setback|refuses dna)\b/.test(txt)) {
    return 'CASE_SETBACK';
  }
  if (/\b(documentary|docuseries|podcast|new book|memoir|netflix|hbo|film|streaming|watch now|listen now)\b/.test(txt)) {
    return 'NEW_MEDIA';
  }
  if (/\b(dna testing|new trial|hearing|evidentiary|appeal|brief|innocence claim|conviction overturned|alford plea|new evidence|fight to prove|dna evidence)\b/.test(txt)) {
    return 'CASE_UPDATE';
  }
  if (/\b(legislation|bill|law|policy|compensation|reform|supreme court|commission|forensic standard|editorial)\b/.test(txt)) {
    return 'POLICY';
  }
  return 'GENERAL';
}

function decodeEntities(str) {
  if (!str) return '';
  return String(str)
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
    .replace(/&#8230;/g, '…')
    .replace(/&nbsp;/g, ' ');
}

function stripHtml(str) {
  return decodeEntities(str).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractTag(block, tagName) {
  const re = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const m = block.match(re);
  return m ? m[1].trim() : null;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function main() {
  const prisma = new PrismaClient();

  try {
    const ipSource = await prisma.newsSource.upsert({
      where: { name: 'Innocence Project' },
      update: {
        feedUrl: 'https://innocenceproject.org/feed/?post_type=news',
      },
      create: {
        name: 'Innocence Project',
        feedUrl: 'https://innocenceproject.org/feed/?post_type=news',
        websiteUrl: 'https://innocenceproject.org/news/',
        isActive: true,
        notes: 'Official Innocence Project news & case updates RSS feed.',
      },
    });

    // Load all Individuals for exact safe matching
    const allIndividuals = await prisma.individual.findMany({
      select: { id: true, firstName: true, lastName: true, nickname: true, caseLocationState: true },
    });

    const byName = new Map();
    const byLastLower = new Map();
    for (const ind of allIndividuals) {
      const k1 = `${norm(ind.firstName)}|${norm(ind.lastName)}`;
      if (!byName.has(k1)) byName.set(k1, []);
      byName.get(k1).push(ind);
      if (ind.nickname) {
        const k2 = `${norm(ind.nickname)}|${norm(ind.lastName)}`;
        if (!byName.has(k2)) byName.set(k2, []);
        byName.get(k2).push(ind);
      }
      const ln = (ind.lastName || '').trim().toLowerCase();
      if (ln.length >= 3 && (ind.firstName || '').trim().length >= 2) {
        if (!byLastLower.has(ln)) byLastLower.set(ln, []);
        byLastLower.get(ln).push(ind);
      }
    }

    // -------------------------------------------------------------------------
    // PART 1: Historical innocenceproject_news_processed.csv
    // -------------------------------------------------------------------------
    const rawRows = parse(fs.readFileSync(CSV_PATH, 'utf8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true,
    });

    // Deduplicate by URL, merging all named individuals per article
    const byUrl = new Map();
    for (const r of rawRows) {
      const url = (r.link || '').trim();
      const headline = (r.headline || '').trim();
      if (!url.startsWith('http') || !headline) continue;
      if (!byUrl.has(url)) {
        byUrl.set(url, { headline, url, names: new Set() });
      }
      if (r.name && r.name.trim()) {
        byUrl.get(url).names.add(r.name.trim());
      }
    }

    const existingUrls = new Set(
      (await prisma.newsArticle.findMany({ select: { url: true } }))
        .map((a) => a.url)
        .filter(Boolean)
    );

    let histCreated = 0;
    let histSkipped = 0;
    let histLinkedArticles = 0;
    let totalIndLinks = 0;
    const catCounts = {};

    const toProcess = Array.from(byUrl.values()).filter((a) => !existingUrls.has(a.url));
    console.log(`Historical CSV unique URLs: ${byUrl.size} (${toProcess.length} new to insert)`);

    // Batch process in small concurrent chunks (10 at a time) for speed
    const CHUNK = 15;
    for (let i = 0; i < toProcess.length; i += CHUNK) {
      const slice = toProcess.slice(i, i + CHUNK);
      await Promise.all(
        slice.map(async (art) => {
          const matchedIds = new Set();
          const lowerHead = art.headline.toLowerCase();

          for (const rawName of art.names) {
            const p = humanparser.parseName(rawName);
            if (!p.firstName || !p.lastName) continue;
            const cands = byName.get(`${norm(p.firstName)}|${norm(p.lastName)}`) || [];
            if (cands.length === 1) {
              matchedIds.add(cands[0].id);
            } else if (cands.length > 1) {
              // Disambiguate by state mentioned in headline if possible
              const stateHit = cands.find(
                (c) => c.caseLocationState && lowerHead.includes(c.caseLocationState.toLowerCase())
              );
              if (stateHit) matchedIds.add(stateHit.id);
            }
          }

          const category = suggestCategory(art.headline);
          catCounts[category] = (catCounts[category] || 0) + 1;
          const connectIds = Array.from(matchedIds).map((id) => ({ id }));
          if (connectIds.length > 0) {
            histLinkedArticles++;
            totalIndLinks += connectIds.length;
          }

          try {
            await prisma.newsArticle.create({
              data: {
                headline: art.headline,
                url: art.url,
                category,
                status: 'PUBLISHED',
                showOnHomepage: false,
                isPinned: false,
                sourceId: ipSource.id,
                sourceName: ipSource.name,
                ...(connectIds.length > 0 ? { individuals: { connect: connectIds } } : {}),
              },
            });
            histCreated++;
          } catch (err) {
            if (err.code === 'P2002') histSkipped++;
            else console.error('Insert err:', art.url, err.message);
          }
        })
      );
    }

    console.log('Historical IP News seeded:', { histCreated, histSkipped, histLinkedArticles, totalIndLinks, catCounts });

    // -------------------------------------------------------------------------
    // PART 2: Pull latest live RSS stories from Innocence Project so Homepage has fresh 2026 items
    // -------------------------------------------------------------------------
    let liveCreated = 0;
    try {
      const resp = await axios.get(ipSource.feedUrl, {
        timeout: 15000,
        headers: { 'User-Agent': 'InnocenceArchiveNewsBot/1.0' },
        responseType: 'text',
      });
      const rssBlocks = String(resp.data || '').match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];
      const topBlocks = rssBlocks.slice(0, 10);

      for (let idx = 0; idx < topBlocks.length; idx++) {
        const block = topBlocks[idx];
        const headline = stripHtml(extractTag(block, 'title') || '');
        const url = stripHtml(extractTag(block, 'link') || '');
        const summary = stripHtml(extractTag(block, 'description') || '').slice(0, 400) || null;
        const pubRaw = extractTag(block, 'pubDate');
        const pubDate = pubRaw ? new Date(stripHtml(pubRaw)) : new Date();
        const publishedAt = !Number.isNaN(pubDate.getTime()) ? pubDate : new Date();
        if (!headline || !url) continue;

        // Match individuals mentioned in live RSS story
        const combined = `${headline} ${summary || ''}`;
        const words = new Set(combined.toLowerCase().match(/[a-z'-]{3,}/g) || []);
        const matchedIds = new Set();
        for (const w of words) {
          const cands = byLastLower.get(w);
          if (!cands) continue;
          for (const ind of cands) {
            const re = new RegExp(`\\b${escapeRegExp(ind.firstName)}\\s+${escapeRegExp(ind.lastName)}\\b`, 'i');
            if (re.test(combined)) matchedIds.add(ind.id);
          }
        }
        const connectIds = Array.from(matchedIds).slice(0, 6).map((id) => ({ id }));
        const category = suggestCategory(headline, summary);

        await prisma.newsArticle.upsert({
          where: { url },
          update: {
            summary,
            publishedAt,
            category,
            showOnHomepage: idx < 4,
            ...(connectIds.length > 0 ? { individuals: { connect: connectIds } } : {}),
          },
          create: {
            headline,
            url,
            summary,
            publishedAt,
            category,
            status: 'PUBLISHED',
            showOnHomepage: idx < 4,
            isPinned: false,
            sourceId: ipSource.id,
            sourceName: ipSource.name,
            ...(connectIds.length > 0 ? { individuals: { connect: connectIds } } : {}),
          },
        });
        liveCreated++;
      }

      await prisma.newsSource.update({
        where: { id: ipSource.id },
        data: { lastCheckedAt: new Date() },
      });
      console.log(`Synced ${liveCreated} live RSS articles from Innocence Project (top 4 featured on Homepage).`);
    } catch (rssErr) {
      console.warn('Live RSS seed skipped (can run from /admin/news anytime):', rssErr.message);
    }

    const totalNow = await prisma.newsArticle.count();
    console.log('Total NewsArticles now in live DB:', totalNow);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Fatal error seeding IP news:', err);
  process.exit(1);
});
