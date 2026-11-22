// routes/search.js
const express = require('express');
const { PrismaClient, MediaWorkType, MediaItemType } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Helper to format enum/type names nicely
const formatTypeName = (typeStr) => {
  if (!typeStr) return '';
  return typeStr.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
};

// Helper function to determine the correct path for media results
const getMediaPath = (mediaObject, resultCategory) => {
  const workType = resultCategory === 'mediaWork' ? mediaObject.workType : mediaObject.work?.workType;
  const itemType = resultCategory === 'mediaItem' ? mediaObject.itemMediaType : null;
  const workId = resultCategory === 'mediaWork' ? mediaObject.id : mediaObject.work?.id;
  const itemId = resultCategory === 'mediaItem' ? mediaObject.id : null;

  if (resultCategory === 'mediaWork' && (workType === MediaWorkType.FILM || workType === MediaWorkType.DOCUMENTARY)) {
    if (workId) return `/film/${workId}`;
    return '#';
  }
  if (resultCategory === 'mediaWork' && workType === MediaWorkType.BOOK) {
    if (workId) return `/book/${workId}`;
    return '#';
  }
  if (resultCategory === 'mediaItem' && (itemType === MediaItemType.FILM_CONTENT || itemType === MediaItemType.DOCUMENTARY_CONTENT)) {
    if (workId) return `/film/${workId}`;
    return itemId ? `/item/${itemId}` : '#';
  }
  if (resultCategory === 'mediaItem' && itemType === MediaItemType.BOOK_CONTENT) {
    if (workId) return `/book/${workId}`;
    return itemId ? `/item/${itemId}` : '#';
  }
  if (
    resultCategory === 'mediaItem' &&
    itemId &&
    itemType &&
    itemType !== MediaItemType.BOOK_CONTENT &&
    itemType !== MediaItemType.FILM_CONTENT &&
    itemType !== MediaItemType.DOCUMENTARY_CONTENT
  ) {
    return `/item/${itemId}`;
  }
  if (
    resultCategory === 'mediaWork' &&
    workId &&
    workType &&
    workType !== MediaWorkType.BOOK &&
    workType !== MediaWorkType.FILM &&
    workType !== MediaWorkType.DOCUMENTARY
  ) {
    return `/media/${workId}`;
  }
  if (resultCategory === 'mediaItem' && itemId) return `/item/${itemId}`;
  if (resultCategory === 'mediaWork' && workId) return `/media/${workId}`;
  return '#';
};

// Rich select for MediaWork editorial cards (cover, author/creator, summary, factors, linked cases count)
const MEDIA_WORK_CARD_SELECT = {
  id: true,
  title: true,
  workType: true,
  creatorName: true,
  summaryNotes: true,
  imagePath: true,
  items: {
    select: {
      id: true,
      summaryNotes: true,
      individualsFeatured: {
        select: { id: true },
      },
      contributingFactorsMentioned: {
        select: { id: true, code: true, name: true },
      },
    },
  },
};

function formatMediaWorkCard(work) {
  const factorMap = new Map();
  const individualIdSet = new Set();
  let itemSummaryFallback = '';

  for (const item of work.items || []) {
    if (!itemSummaryFallback && item.summaryNotes?.trim()) {
      itemSummaryFallback = item.summaryNotes.trim();
    }
    for (const ind of item.individualsFeatured || []) {
      individualIdSet.add(ind.id);
    }
    for (const f of item.contributingFactorsMentioned || []) {
      if (!factorMap.has(f.id)) {
        factorMap.set(f.id, { id: f.id, code: f.code, name: f.name });
      }
    }
  }

  const rawSummary = (work.summaryNotes || itemSummaryFallback || '').trim();
  const detail = rawSummary
    ? rawSummary.length > 260
      ? `${rawSummary.substring(0, 257).trim()}...`
      : rawSummary
    : '';

  return {
    id: work.id,
    type: 'mediaWork',
    name: work.title,
    workType: work.workType,
    creatorName: work.creatorName || null,
    imagePath: work.imagePath || null,
    detail,
    contributingFactors: Array.from(factorMap.values()),
    linkedCasesCount: individualIdSet.size,
    episodeCount: (work.items || []).length,
    path: getMediaPath(work, 'mediaWork'),
  };
}

function getWorkTypeWhere(typeFilter) {
  switch (typeFilter) {
    case 'BOOK':
      return { workType: MediaWorkType.BOOK };
    case 'FILM':
      return {
        workType: {
          in: [MediaWorkType.FILM, MediaWorkType.DOCUMENTARY, MediaWorkType.DOCUSERIES],
        },
      };
    case 'DOCUMENTARY':
      return {
        workType: {
          in: [MediaWorkType.DOCUMENTARY, MediaWorkType.DOCUSERIES],
        },
      };
    case 'PODCAST_SERIES':
      return { workType: MediaWorkType.PODCAST_SERIES };
    case 'TV_SERIES':
      return { workType: MediaWorkType.TV_SERIES };
    default:
      return null;
  }
}

// GET /api/search?q=<query>&type=<type>&factor=<code|name>&sort=<title|creator|cases>&page=<page>&limit=<limit>
router.get('/', async (req, res) => {
  const query = req.query.q?.trim() || '';
  const typeFilter = req.query.type?.toUpperCase() || '';
  const factorFilter = req.query.factor?.trim() || '';
  const sortParam = (req.query.sort || 'title').toLowerCase();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || (typeFilter ? 8 : 20)));
  const skip = (page - 1) * limit;

  console.log(
    `GET /api/search: query='${query}', type='${typeFilter}', factor='${factorFilter}', sort='${sortParam}', page=${page}, limit=${limit}`
  );

  if (!typeFilter && !query) {
    return res.status(400).json({ message: 'Search query cannot be empty when no type filter is specified.' });
  }

  try {
    // --- Mode 1: Media Collection Browse (supports combined type + q + factor + sort + pagination) ---
    if (typeFilter) {
      const baseTypeWhere = getWorkTypeWhere(typeFilter);
      if (!baseTypeWhere) {
        return res.json({
          results: [],
          availableFactors: [],
          currentPage: page,
          limit,
          totalCount: 0,
        });
      }

      // Build optional keyword filter within this media collection
      const searchAnd = [baseTypeWhere];
      if (query) {
        searchAnd.push({
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { creatorName: { contains: query, mode: 'insensitive' } },
            { focusOrTheme: { contains: query, mode: 'insensitive' } },
            { summaryNotes: { contains: query, mode: 'insensitive' } },
            {
              items: {
                some: {
                  OR: [
                    { summaryNotes: { contains: query, mode: 'insensitive' } },
                    {
                      individualsFeatured: {
                        some: {
                          OR: [
                            { firstName: { contains: query, mode: 'insensitive' } },
                            { lastName: { contains: query, mode: 'insensitive' } },
                          ],
                        },
                      },
                    },
                  ],
                },
              },
            },
          ],
        });
      }

      // Fetch collection works to compute availableFactors accurately and support linkedCasesCount sorting
      const allCollectionWorks = await prisma.mediaWork.findMany({
        where: { AND: searchAnd },
        select: MEDIA_WORK_CARD_SELECT,
      });

      const formattedAll = allCollectionWorks.map(formatMediaWorkCard);

      // Build availableFactors list (sorted by count desc, then name asc) from the collection before factor filter
      const factorCounts = new Map();
      for (const card of formattedAll) {
        for (const f of card.contributingFactors) {
          const key = f.code || f.name;
          const prev = factorCounts.get(key) || { code: f.code, name: f.name, count: 0 };
          prev.count += 1;
          factorCounts.set(key, prev);
        }
      }
      const availableFactors = Array.from(factorCounts.values()).sort(
        (a, b) => b.count - a.count || a.name.localeCompare(b.name)
      );

      // Apply optional factor filter
      let filtered = formattedAll;
      if (factorFilter) {
        const needle = factorFilter.toLowerCase();
        filtered = formattedAll.filter((card) =>
          card.contributingFactors.some(
            (f) =>
              (f.code && f.code.toLowerCase() === needle) ||
              (f.name && f.name.toLowerCase() === needle)
          )
        );
      }

      // Sort
      filtered.sort((a, b) => {
        if (sortParam === 'creator') {
          const ca = (a.creatorName || 'zzzz').toLowerCase();
          const cb = (b.creatorName || 'zzzz').toLowerCase();
          return ca.localeCompare(cb) || a.name.localeCompare(b.name);
        }
        if (sortParam === 'cases') {
          return b.linkedCasesCount - a.linkedCasesCount || a.name.localeCompare(b.name);
        }
        return a.name.localeCompare(b.name);
      });

      const totalCount = filtered.length;
      const pagedResults = filtered.slice(skip, skip + limit);

      return res.json({
        results: pagedResults,
        availableFactors,
        currentPage: page,
        limit,
        totalCount,
      });
    }

    // --- Mode 2: Global Keyword Search across all entity types ---
    const KEYWORD_SEARCH_LIMIT_PER_ENTITY = 25;

    const individualOrConditions = [
      { narrativeSummary: { contains: query, mode: 'insensitive' } },
      { firstName: { contains: query, mode: 'insensitive' } },
      { lastName: { contains: query, mode: 'insensitive' } },
    ];

    if (query.includes(',')) {
      const parts = query.split(',');
      if (parts.length === 2) {
        const lastNamePart = parts[0].trim();
        const firstNamePart = parts[1].trim();
        if (lastNamePart && firstNamePart) {
          individualOrConditions.push({
            AND: [
              { lastName: { contains: lastNamePart, mode: 'insensitive' } },
              { firstName: { contains: firstNamePart, mode: 'insensitive' } },
            ],
          });
        }
      }
    } else if (query.includes(' ')) {
      const parts = query.split(/\s+/);
      if (parts.length >= 2) {
        const firstWord = parts[0].trim();
        const lastWord = parts[parts.length - 1].trim();
        if (firstWord && lastWord) {
          individualOrConditions.push({
            AND: [
              { firstName: { contains: firstWord, mode: 'insensitive' } },
              { lastName: { contains: lastWord, mode: 'insensitive' } },
            ],
          });
          individualOrConditions.push({
            AND: [
              { firstName: { contains: lastWord, mode: 'insensitive' } },
              { lastName: { contains: firstWord, mode: 'insensitive' } },
            ],
          });
        }
      }
    }

    const commonWhereMedia = (fields) => ({
      OR: fields.map((field) => ({ [field]: { contains: query, mode: 'insensitive' } })),
    });

    const [individuals, mediaWorks, mediaItems, organizations] = await Promise.all([
      prisma.individual.findMany({
        where: { OR: individualOrConditions },
        select: { id: true, firstName: true, lastName: true, narrativeSummary: true },
        take: KEYWORD_SEARCH_LIMIT_PER_ENTITY,
      }),
      prisma.mediaWork.findMany({
        where: commonWhereMedia(['title', 'creatorName', 'focusOrTheme', 'summaryNotes', 'publisherOrNetwork']),
        select: MEDIA_WORK_CARD_SELECT,
        take: KEYWORD_SEARCH_LIMIT_PER_ENTITY,
      }),
      prisma.mediaItem.findMany({
        where: commonWhereMedia(['itemTitle', 'hostOrNarrator', 'focusOrTheme', 'summaryNotes', 'keyQuotes']),
        select: {
          id: true,
          itemTitle: true,
          itemMediaType: true,
          summaryNotes: true,
          work: { select: { id: true, title: true, workType: true } },
        },
        take: KEYWORD_SEARCH_LIMIT_PER_ENTITY,
      }),
      prisma.organization.findMany({
        where: commonWhereMedia(['name', 'notes']),
        select: { id: true, name: true, type: true, notes: true },
        take: KEYWORD_SEARCH_LIMIT_PER_ENTITY,
      }),
    ]);

    const combinedResults = [];
    const addedMediaWorkIds = new Set();

    individuals.forEach((ind) =>
      combinedResults.push({
        id: ind.id,
        type: 'individual',
        name: `${ind.firstName} ${ind.lastName}`,
        detail: ind.narrativeSummary ? `${ind.narrativeSummary.substring(0, 150)}...` : 'No summary.',
        path: `/profile/${ind.id}`,
      })
    );

    mediaWorks.forEach((work) => {
      combinedResults.push(formatMediaWorkCard(work));
      if (
        work.workType === MediaWorkType.BOOK ||
        work.workType === MediaWorkType.FILM ||
        work.workType === MediaWorkType.DOCUMENTARY
      ) {
        addedMediaWorkIds.add(work.id);
      }
    });

    mediaItems.forEach((item) => {
      if (
        (item.itemMediaType === MediaItemType.BOOK_CONTENT ||
          item.itemMediaType === MediaItemType.FILM_CONTENT ||
          item.itemMediaType === MediaItemType.DOCUMENTARY_CONTENT) &&
        item.work &&
        addedMediaWorkIds.has(item.work.id)
      ) {
        return;
      }
      combinedResults.push({
        id: item.id,
        type: 'mediaItem',
        name: item.itemTitle || 'Untitled Item',
        parentWorkTitle: item.work?.title || 'Unknown Work',
        itemMediaType: item.itemMediaType,
        parentWorkType: item.work?.workType,
        detail: item.summaryNotes
          ? `${item.summaryNotes.substring(0, 150)}...`
          : `Type: ${formatTypeName(item.itemMediaType)}`,
        path: getMediaPath(item, 'mediaItem'),
      });
    });

    organizations.forEach((org) =>
      combinedResults.push({
        id: org.id,
        type: 'organization',
        name: org.name,
        orgType: org.type,
        detail: org.notes ? `${org.notes.substring(0, 150)}...` : `Type: ${formatTypeName(org.type)}`,
        path: `/organization/${org.id}`,
      })
    );

    res.json({
      results: combinedResults,
      availableFactors: [],
      currentPage: page,
      limit,
      totalCount: combinedResults.length,
    });
  } catch (error) {
    console.error('Error during search:', error.message, error.stack);
    res.status(500).json({ message: 'Search failed due to an internal error.' });
  }
});

module.exports = router;
