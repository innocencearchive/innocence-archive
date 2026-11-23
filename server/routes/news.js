// server/routes/news.js
// Public & Admin API for News Hub, Homepage Recent News, Individual News links,
// and Live RSS/Atom News Feed Checking.

const express = require('express');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, authorizeRole } = require('../middleware/authenticateToken');

const router = express.Router();
const prisma = new PrismaClient();

const VALID_CATEGORIES = new Set([
  'EXONERATION',
  'CASE_UPDATE',
  'CASE_SETBACK',
  'CALL_FOR_ACTION',
  'NEW_MEDIA',
  'POLICY',
  'GENERAL',
]);

const VALID_STATUSES = new Set(['PUBLISHED', 'DRAFT', 'ARCHIVED']);

const requireAdmin = (req, res, next) =>
  authenticateToken(req, res, () => authorizeRole(['ADMIN', 'EDITOR'])(req, res, next));

const ARTICLE_INCLUDE = {
  source: { select: { id: true, name: true, websiteUrl: true } },
  individuals: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      nickname: true,
      caseLocationState: true,
    },
  },
  mediaWork: {
    select: {
      id: true,
      title: true,
      workType: true,
    },
  },
};

// --- Helpers for RSS/Atom parsing & auto-classification ---

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
  return decodeEntities(str)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTag(block, tagName) {
  const re = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const m = block.match(re);
  return m ? m[1].trim() : null;
}

function parseRssOrAtom(xmlText) {
  const items = [];
  const xml = String(xmlText || '');

  // RSS 2.0 <item>
  const rssMatches = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];
  if (rssMatches.length > 0) {
    for (const block of rssMatches) {
      const headline = stripHtml(extractTag(block, 'title') || '');
      let link = stripHtml(extractTag(block, 'link') || '');
      if (!link) {
        const guid = stripHtml(extractTag(block, 'guid') || '');
        if (guid.startsWith('http')) link = guid;
      }
      const rawDesc = extractTag(block, 'description') || extractTag(block, 'content:encoded') || '';
      const summary = stripHtml(rawDesc).slice(0, 420) || null;
      const pubDateRaw = extractTag(block, 'pubDate') || extractTag(block, 'dc:date') || null;
      const parsedDate = pubDateRaw ? new Date(stripHtml(pubDateRaw)) : null;
      const publishedAt = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null;

      if (headline && link) {
        items.push({ headline, url: link, summary, publishedAt });
      }
    }
    return items;
  }

  // Atom <entry>
  const atomMatches = xml.match(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi) || [];
  for (const block of atomMatches) {
    const headline = stripHtml(extractTag(block, 'title') || '');
    const hrefMatch = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);
    const link = hrefMatch ? decodeEntities(hrefMatch[1]).trim() : '';
    const rawDesc = extractTag(block, 'summary') || extractTag(block, 'content') || '';
    const summary = stripHtml(rawDesc).slice(0, 420) || null;
    const pubDateRaw = extractTag(block, 'published') || extractTag(block, 'updated') || null;
    const parsedDate = pubDateRaw ? new Date(stripHtml(pubDateRaw)) : null;
    const publishedAt = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null;

    if (headline && link) {
      items.push({ headline, url: link, summary, publishedAt });
    }
  }
  return items;
}

function suggestCategory(headline, summary) {
  const txt = `${headline || ''} ${summary || ''}`.toLowerCase();
  if (/\b(petition|take action|call now|sign the|urge governor|clemency petition|stop the execution|call for action|write to)\b/.test(txt)) {
    return 'CALL_FOR_ACTION';
  }
  if (/\b(exonerat|freed after|walks free|regains.*freedom|cleared of|conviction vacated|pardoned|released after \d+ years|set free)\b/.test(txt)) {
    return 'EXONERATION';
  }
  if (/\b(executed|execution scheduled|denied new trial|appeals court denies|rejects appeal|conviction upheld|setback|refuses dna)\b/.test(txt)) {
    return 'CASE_SETBACK';
  }
  if (/\b(documentary|docuseries|podcast|new book|memoir|netflix|hbo|film|streaming|watch now|listen now)\b/.test(txt)) {
    return 'NEW_MEDIA';
  }
  if (/\b(dna testing|new trial|hearing|evidentiary|appeal|brief|innocence claim|conviction overturned|alford plea|new evidence)\b/.test(txt)) {
    return 'CASE_UPDATE';
  }
  if (/\b(legislation|bill|law|policy|compensation|reform|supreme court|commission|forensic standard)\b/.test(txt)) {
    return 'POLICY';
  }
  return 'GENERAL';
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// PUBLIC ROUTES
// ============================================================================

// GET /api/news/homepage?limit=5
router.get('/homepage', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 12);

    // 1. Stories explicitly flagged for Homepage (pinned first, then newest)
    const homeFeatured = await prisma.newsArticle.findMany({
      where: { status: 'PUBLISHED', showOnHomepage: true },
      orderBy: [
        { isPinned: 'desc' },
        { publishedAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
      take: limit,
      include: ARTICLE_INCLUDE,
    });

    let results = homeFeatured;
    // 2. If fewer than limit are marked showOnHomepage, backfill with latest published news
    if (results.length < limit) {
      const existingIds = results.map((r) => r.id);
      const backfill = await prisma.newsArticle.findMany({
        where: {
          status: 'PUBLISHED',
          ...(existingIds.length > 0 ? { id: { notIn: existingIds } } : {}),
        },
        orderBy: [
          { isPinned: 'desc' },
          { publishedAt: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'desc' },
        ],
        take: limit - results.length,
        include: ARTICLE_INCLUDE,
      });
      results = [...results, ...backfill];
    }

    res.json({ items: results });
  } catch (error) {
    console.error('Error fetching homepage news:', error);
    res.status(500).json({ message: 'Failed to load homepage news.', error: error.message });
  }
});

// GET /api/news — Public News Hub archive with search, category, source filter & pagination
router.get('/', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const category = (req.query.category || '').trim().toUpperCase();
    const sourceId = req.query.sourceId ? parseInt(req.query.sourceId, 10) : null;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 60);

    const where = { status: 'PUBLISHED' };
    if (category && VALID_CATEGORIES.has(category)) {
      where.category = category;
    }
    if (sourceId && !Number.isNaN(sourceId)) {
      where.sourceId = sourceId;
    }
    if (q) {
      where.OR = [
        { headline: { contains: q, mode: 'insensitive' } },
        { summary: { contains: q, mode: 'insensitive' } },
        { sourceName: { contains: q, mode: 'insensitive' } },
        {
          individuals: {
            some: {
              OR: [
                { firstName: { contains: q, mode: 'insensitive' } },
                { lastName: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    const [items, total, groupedCounts, sources] = await Promise.all([
      prisma.newsArticle.findMany({
        where,
        orderBy: [
          { isPinned: 'desc' },
          { publishedAt: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
        include: ARTICLE_INCLUDE,
      }),
      prisma.newsArticle.count({ where }),
      prisma.newsArticle.groupBy({
        by: ['category'],
        where: { status: 'PUBLISHED' },
        _count: { _all: true },
      }),
      prisma.newsSource.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, websiteUrl: true, _count: { select: { articles: true } } },
      }),
    ]);

    const categoryCounts = {};
    let totalPublished = 0;
    for (const g of groupedCounts) {
      categoryCounts[g.category] = g._count._all;
      totalPublished += g._count._all;
    }

    res.json({
      items,
      total,
      totalPublished,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      categoryCounts,
      sources,
    });
  } catch (error) {
    console.error('Error fetching news archive:', error);
    res.status(500).json({ message: 'Failed to fetch news archive.', error: error.message });
  }
});

// ============================================================================
// ADMIN ROUTES (Protected)
// ============================================================================

// GET /api/news/admin/articles
router.get('/admin/articles', requireAdmin, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const category = (req.query.category || '').trim().toUpperCase();
    const status = (req.query.status || '').trim().toUpperCase();
    const homepageOnly = req.query.homepageOnly === 'true';
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);

    const where = {};
    if (category && VALID_CATEGORIES.has(category)) where.category = category;
    if (status && VALID_STATUSES.has(status)) where.status = status;
    if (homepageOnly) where.showOnHomepage = true;
    if (q) {
      where.OR = [
        { headline: { contains: q, mode: 'insensitive' } },
        { summary: { contains: q, mode: 'insensitive' } },
        { sourceName: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.newsArticle.findMany({
        where,
        orderBy: [
          { isPinned: 'desc' },
          { showOnHomepage: 'desc' },
          { publishedAt: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
        include: ARTICLE_INCLUDE,
      }),
      prisma.newsArticle.count({ where }),
    ]);

    res.json({ items, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) {
    console.error('Error fetching admin news articles:', error);
    res.status(500).json({ message: 'Failed to load articles.', error: error.message });
  }
});

// POST /api/news/admin/articles
router.post('/admin/articles', requireAdmin, async (req, res) => {
  try {
    const {
      headline,
      url,
      summary,
      publishedAt,
      category = 'GENERAL',
      status = 'PUBLISHED',
      showOnHomepage = false,
      isPinned = false,
      actionUrl,
      actionLabel,
      sourceId,
      sourceName,
      mediaWorkId,
      individualIds = [],
    } = req.body || {};

    if (!headline || !headline.trim()) {
      return res.status(400).json({ message: 'Headline is required.' });
    }

    const cleanUrl = url && String(url).trim() ? String(url).trim() : null;
    const cleanSourceId = sourceId ? parseInt(sourceId, 10) : null;
    const cleanMediaWorkId = mediaWorkId ? parseInt(mediaWorkId, 10) : null;
    const parsedDate = publishedAt ? new Date(publishedAt) : new Date();
    const validDate = !Number.isNaN(parsedDate.getTime()) ? parsedDate : new Date();

    let resolvedSourceName = sourceName ? String(sourceName).trim() : null;
    if (cleanSourceId && !resolvedSourceName) {
      const src = await prisma.newsSource.findUnique({ where: { id: cleanSourceId }, select: { name: true } });
      if (src) resolvedSourceName = src.name;
    }

    const connectIndIds = Array.isArray(individualIds)
      ? individualIds.map((id) => parseInt(id, 10)).filter((n) => !Number.isNaN(n)).map((id) => ({ id }))
      : [];

    const created = await prisma.newsArticle.create({
      data: {
        headline: headline.trim(),
        url: cleanUrl,
        summary: summary ? String(summary).trim() : null,
        publishedAt: validDate,
        category: VALID_CATEGORIES.has(category) ? category : 'GENERAL',
        status: VALID_STATUSES.has(status) ? status : 'PUBLISHED',
        showOnHomepage: Boolean(showOnHomepage),
        isPinned: Boolean(isPinned),
        actionUrl: actionUrl && String(actionUrl).trim() ? String(actionUrl).trim() : null,
        actionLabel: actionLabel && String(actionLabel).trim() ? String(actionLabel).trim() : null,
        sourceId: cleanSourceId && !Number.isNaN(cleanSourceId) ? cleanSourceId : null,
        sourceName: resolvedSourceName,
        mediaWorkId: cleanMediaWorkId && !Number.isNaN(cleanMediaWorkId) ? cleanMediaWorkId : null,
        ...(connectIndIds.length > 0 ? { individuals: { connect: connectIndIds } } : {}),
      },
      include: ARTICLE_INCLUDE,
    });

    res.status(201).json(created);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'A news article with that exact URL already exists.' });
    }
    console.error('Error creating news article:', error);
    res.status(500).json({ message: 'Failed to create news article.', error: error.message });
  }
});

// PUT /api/news/admin/articles/:id
router.put('/admin/articles/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid article ID.' });

    const body = req.body || {};
    const data = {};

    if (body.headline !== undefined) data.headline = String(body.headline).trim();
    if (body.url !== undefined) data.url = body.url && String(body.url).trim() ? String(body.url).trim() : null;
    if (body.summary !== undefined) data.summary = body.summary ? String(body.summary).trim() : null;
    if (body.publishedAt !== undefined) {
      if (!body.publishedAt) data.publishedAt = null;
      else {
        const d = new Date(body.publishedAt);
        if (!Number.isNaN(d.getTime())) data.publishedAt = d;
      }
    }
    if (body.category !== undefined && VALID_CATEGORIES.has(body.category)) data.category = body.category;
    if (body.status !== undefined && VALID_STATUSES.has(body.status)) data.status = body.status;
    if (body.showOnHomepage !== undefined) data.showOnHomepage = Boolean(body.showOnHomepage);
    if (body.isPinned !== undefined) data.isPinned = Boolean(body.isPinned);
    if (body.actionUrl !== undefined) data.actionUrl = body.actionUrl && String(body.actionUrl).trim() ? String(body.actionUrl).trim() : null;
    if (body.actionLabel !== undefined) data.actionLabel = body.actionLabel && String(body.actionLabel).trim() ? String(body.actionLabel).trim() : null;
    if (body.sourceName !== undefined) data.sourceName = body.sourceName ? String(body.sourceName).trim() : null;
    if (body.sourceId !== undefined) {
      const sid = body.sourceId ? parseInt(body.sourceId, 10) : null;
      data.sourceId = sid && !Number.isNaN(sid) ? sid : null;
    }
    if (body.mediaWorkId !== undefined) {
      const mwid = body.mediaWorkId ? parseInt(body.mediaWorkId, 10) : null;
      data.mediaWorkId = mwid && !Number.isNaN(mwid) ? mwid : null;
    }
    if (Array.isArray(body.individualIds)) {
      const setIds = body.individualIds
        .map((n) => parseInt(n, 10))
        .filter((n) => !Number.isNaN(n))
        .map((n) => ({ id: n }));
      data.individuals = { set: setIds };
    }

    const updated = await prisma.newsArticle.update({
      where: { id },
      data,
      include: ARTICLE_INCLUDE,
    });

    res.json(updated);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'Another news article already uses that URL.' });
    }
    console.error('Error updating news article:', error);
    res.status(500).json({ message: 'Failed to update news article.', error: error.message });
  }
});

// DELETE /api/news/admin/articles/:id
router.delete('/admin/articles/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid article ID.' });
    await prisma.newsArticle.delete({ where: { id } });
    res.json({ message: 'Article deleted.', id });
  } catch (error) {
    console.error('Error deleting news article:', error);
    res.status(500).json({ message: 'Failed to delete article.', error: error.message });
  }
});

// POST /api/news/admin/articles/bulk-import — Commit selected RSS feed articles
router.post('/admin/articles/bulk-import', requireAdmin, async (req, res) => {
  try {
    const { items = [] } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'No articles provided.' });
    }

    let created = 0;
    let skipped = 0;
    const errors = [];

    for (const item of items) {
      const headline = (item.headline || '').trim();
      const url = (item.url || '').trim() || null;
      if (!headline) {
        skipped++;
        continue;
      }

      try {
        if (url) {
          const exists = await prisma.newsArticle.findUnique({ where: { url }, select: { id: true } });
          if (exists) {
            skipped++;
            continue;
          }
        }
        const parsedDate = item.publishedAt ? new Date(item.publishedAt) : new Date();
        const validDate = !Number.isNaN(parsedDate.getTime()) ? parsedDate : new Date();
        const connectIndIds = Array.isArray(item.individualIds)
          ? item.individualIds.map((n) => parseInt(n, 10)).filter((n) => !Number.isNaN(n)).map((id) => ({ id }))
          : [];

        await prisma.newsArticle.create({
          data: {
            headline,
            url,
            summary: item.summary ? String(item.summary).trim() : null,
            publishedAt: validDate,
            category: VALID_CATEGORIES.has(item.category) ? item.category : 'GENERAL',
            status: VALID_STATUSES.has(item.status) ? item.status : 'PUBLISHED',
            showOnHomepage: Boolean(item.showOnHomepage),
            isPinned: Boolean(item.isPinned),
            actionUrl: item.actionUrl ? String(item.actionUrl).trim() : null,
            actionLabel: item.actionLabel ? String(item.actionLabel).trim() : null,
            sourceId: item.sourceId ? parseInt(item.sourceId, 10) : null,
            sourceName: item.sourceName ? String(item.sourceName).trim() : null,
            ...(connectIndIds.length > 0 ? { individuals: { connect: connectIndIds } } : {}),
          },
        });
        created++;
      } catch (err) {
        errors.push({ headline, error: err.message });
      }
    }

    res.json({ created, skipped, errors });
  } catch (error) {
    console.error('Error bulk importing news:', error);
    res.status(500).json({ message: 'Bulk import failed.', error: error.message });
  }
});

// --- News Source Management & One-Click RSS Feed Checker ---

// GET /api/news/admin/sources
router.get('/admin/sources', requireAdmin, async (req, res) => {
  try {
    const sources = await prisma.newsSource.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { articles: true } } },
    });
    res.json(sources);
  } catch (error) {
    console.error('Error loading news sources:', error);
    res.status(500).json({ message: 'Failed to load news sources.', error: error.message });
  }
});

// POST /api/news/admin/sources
router.post('/admin/sources', requireAdmin, async (req, res) => {
  try {
    const { name, feedUrl, websiteUrl, isActive = true, notes } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Source name is required.' });
    }
    const created = await prisma.newsSource.create({
      data: {
        name: name.trim(),
        feedUrl: feedUrl && String(feedUrl).trim() ? String(feedUrl).trim() : null,
        websiteUrl: websiteUrl && String(websiteUrl).trim() ? String(websiteUrl).trim() : null,
        isActive: Boolean(isActive),
        notes: notes ? String(notes).trim() : null,
      },
    });
    res.status(201).json(created);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'A news source with that name or feed URL already exists.' });
    }
    console.error('Error creating news source:', error);
    res.status(500).json({ message: 'Failed to create news source.', error: error.message });
  }
});

// PUT /api/news/admin/sources/:id
router.put('/admin/sources/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid source ID.' });
    const body = req.body || {};
    const data = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.feedUrl !== undefined) data.feedUrl = body.feedUrl && String(body.feedUrl).trim() ? String(body.feedUrl).trim() : null;
    if (body.websiteUrl !== undefined) data.websiteUrl = body.websiteUrl && String(body.websiteUrl).trim() ? String(body.websiteUrl).trim() : null;
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
    if (body.notes !== undefined) data.notes = body.notes ? String(body.notes).trim() : null;

    const updated = await prisma.newsSource.update({ where: { id }, data });
    res.json(updated);
  } catch (error) {
    console.error('Error updating news source:', error);
    res.status(500).json({ message: 'Failed to update news source.', error: error.message });
  }
});

// DELETE /api/news/admin/sources/:id
router.delete('/admin/sources/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid source ID.' });
    await prisma.newsSource.delete({ where: { id } });
    res.json({ message: 'News source deleted.', id });
  } catch (error) {
    console.error('Error deleting news source:', error);
    res.status(500).json({ message: 'Failed to delete news source.', error: error.message });
  }
});

// POST /api/news/admin/sources/:id/check — Fetch live RSS/Atom feed & match against DB
router.post('/admin/sources/:id/check', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid source ID.' });

    const source = await prisma.newsSource.findUnique({ where: { id } });
    if (!source) return res.status(404).json({ message: 'News source not found.' });
    if (!source.feedUrl) {
      return res.status(400).json({ message: `"${source.name}" has no RSS/Atom feed URL configured.` });
    }

    const response = await axios.get(source.feedUrl, {
      timeout: 15000,
      headers: {
        'User-Agent': 'InnocenceArchiveNewsBot/1.0 (+https://innocence-archive.onrender.com)',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
      responseType: 'text',
    });

    const parsedItems = parseRssOrAtom(response.data).slice(0, 40);

    // Check which URLs already exist in news_articles
    const candidateUrls = parsedItems.map((i) => i.url).filter(Boolean);
    const existingArticles = candidateUrls.length
      ? await prisma.newsArticle.findMany({
          where: { url: { in: candidateUrls } },
          select: { url: true },
        })
      : [];
    const existingUrlSet = new Set(existingArticles.map((a) => a.url));

    // Load Individuals for fast exact full-name auto-matching
    const allIndividuals = await prisma.individual.findMany({
      select: { id: true, firstName: true, lastName: true, nickname: true, caseLocationState: true },
    });

    // Build quick lookup by lastName (skipping 1-2 char last names to prevent noise)
    const indsByLastLower = new Map();
    for (const ind of allIndividuals) {
      const ln = (ind.lastName || '').trim().toLowerCase();
      const fn = (ind.firstName || '').trim();
      if (ln.length < 3 || fn.length < 2) continue;
      if (!indsByLastLower.has(ln)) indsByLastLower.set(ln, []);
      indsByLastLower.get(ln).push(ind);
    }

    const enriched = parsedItems.map((item, idx) => {
      const combinedText = `${item.headline} ${item.summary || ''}`;
      const lowerText = combinedText.toLowerCase();
      const matchedIndividuals = [];
      const seenIndIds = new Set();

      // Tokenize words in text and check candidate lastNames
      const words = new Set(lowerText.match(/[a-z'-]{3,}/g) || []);
      for (const word of words) {
        const cands = indsByLastLower.get(word);
        if (!cands) continue;
        for (const ind of cands) {
          if (seenIndIds.has(ind.id)) continue;
          const fullRe = new RegExp(`(?<![A-Z][a-z]+\\s)\\b${escapeRegExp(ind.firstName)}\\s+(?:[A-Z]\\.\\s+)?${escapeRegExp(ind.lastName)}\\b`);
          const nickRe = ind.nickname
            ? new RegExp(`(?<![A-Z][a-z]+\\s)\\b${escapeRegExp(ind.nickname)}\\s+${escapeRegExp(ind.lastName)}\\b`)
            : null;
          if (fullRe.test(combinedText) || (nickRe && nickRe.test(combinedText))) {
            seenIndIds.add(ind.id);
            matchedIndividuals.push({
              id: ind.id,
              name: `${ind.firstName} ${ind.lastName}`,
              state: ind.caseLocationState,
            });
          }
        }
      }

      return {
        tempIndex: idx + 1,
        headline: item.headline,
        url: item.url,
        summary: item.summary,
        publishedAt: item.publishedAt,
        alreadyImported: existingUrlSet.has(item.url),
        suggestedCategory: suggestCategory(item.headline, item.summary),
        matchedIndividuals: matchedIndividuals.slice(0, 6),
        sourceId: source.id,
        sourceName: source.name,
      };
    });

    await prisma.newsSource.update({
      where: { id: source.id },
      data: { lastCheckedAt: new Date() },
    });

    res.json({
      source: { id: source.id, name: source.name, feedUrl: source.feedUrl },
      totalFetched: enriched.length,
      newCount: enriched.filter((e) => !e.alreadyImported).length,
      items: enriched,
    });
  } catch (error) {
    console.error('Error checking RSS feed:', error);
    res.status(502).json({
      message: `Failed to fetch RSS feed: ${error.message}`,
      error: error.message,
    });
  }
});

// GET /api/news/admin/search-individuals?q= — Quick typeahead for linking individuals to news
router.get('/admin/search-individuals', requireAdmin, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json([]);
    const parts = q.split(/\s+/).filter(Boolean);
    const where =
      parts.length >= 2
        ? {
            AND: [
              {
                OR: [
                  { firstName: { contains: parts[0], mode: 'insensitive' } },
                  { nickname: { contains: parts[0], mode: 'insensitive' } },
                ],
              },
              { lastName: { contains: parts[parts.length - 1], mode: 'insensitive' } },
            ],
          }
        : {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { nickname: { contains: q, mode: 'insensitive' } },
            ],
          };

    const hits = await prisma.individual.findMany({
      where,
      take: 15,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        nickname: true,
        caseLocationState: true,
        convictionYear: true,
        exonerationOrReleaseYear: true,
      },
    });
    res.json(hits);
  } catch (error) {
    res.status(500).json({ message: 'Individual search failed.', error: error.message });
  }
});

// GET /api/news/admin/search-media?q= — Quick typeahead for linking MediaWorks (New Media news)
router.get('/admin/search-media', requireAdmin, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json([]);
    const hits = await prisma.mediaWork.findMany({
      where: { title: { contains: q, mode: 'insensitive' } },
      take: 15,
      orderBy: { title: 'asc' },
      select: { id: true, title: true, workType: true, publicationOrReleaseYear: true },
    });
    res.json(hits);
  } catch (error) {
    res.status(500).json({ message: 'Media search failed.', error: error.message });
  }
});

module.exports = router;
