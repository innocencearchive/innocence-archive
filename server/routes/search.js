// routes/search.js
const express = require('express');
const { PrismaClient, MediaWorkType, MediaItemType } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Helper function to determine the correct path for media results
const getMediaPath = (mediaObject, resultCategory) => { // resultCategory is 'mediaWork' or 'mediaItem'
  const workType = resultCategory === 'mediaWork' ? mediaObject.workType : mediaObject.work?.workType;
  const itemType = resultCategory === 'mediaItem' ? mediaObject.itemMediaType : null;
  const workId = resultCategory === 'mediaWork' ? mediaObject.id : mediaObject.work?.id;
  const itemId = resultCategory === 'mediaItem' ? mediaObject.id : null;

  if (resultCategory === 'mediaWork' && (workType === MediaWorkType.FILM || workType === MediaWorkType.DOCUMENTARY)) {
    if (workId) return `/film/${workId}`;
    console.warn(`Search API: Missing workId for FILM/DOCUMENTARY type (${workType}) ID ${mediaObject.id}`);
    return '#';
  }
  // MODIFIED LINE FOR MediaWork BOOK
  if (resultCategory === 'mediaWork' && workType === MediaWorkType.BOOK) {
    if (workId) return `/book/${workId}`; // Changed from /combined/
    console.warn(`Search API: Missing workId for BOOK type (${workType}) ID ${mediaObject.id}`);
    return '#';
  }
  if (resultCategory === 'mediaItem' && (itemType === MediaItemType.FILM_CONTENT || itemType === MediaItemType.DOCUMENTARY_CONTENT)) {
    if (workId) return `/film/${workId}`;
    console.warn(`Search API: Missing parent workId for ${itemType} ID ${itemId}`);
    return itemId ? `/item/${itemId}` : '#';
  }
  // MODIFIED LINE FOR MediaItem BOOK_CONTENT
   if (resultCategory === 'mediaItem' && itemType === MediaItemType.BOOK_CONTENT) {
    if (workId) return `/book/${workId}`; // Changed from /combined/
    console.warn(`Search API: Missing parent workId for ${itemType} ID ${itemId}`);
    // If for some reason a BOOK_CONTENT item doesn't have a workId,
    // it's better to link to the item page itself or a placeholder than CombinedMediaPage.
    // However, BOOK_CONTENT items should always have a parent work.
    return itemId ? `/item/${itemId}` : '#';
  }
  if (resultCategory === 'mediaItem' && itemId && itemType &&
      itemType !== MediaItemType.BOOK_CONTENT &&
      itemType !== MediaItemType.FILM_CONTENT &&
      itemType !== MediaItemType.DOCUMENTARY_CONTENT) {
    return `/item/${itemId}`;
  }
  if (resultCategory === 'mediaWork' && workId && workType &&
      workType !== MediaWorkType.BOOK &&
      workType !== MediaWorkType.FILM &&
      workType !== MediaWorkType.DOCUMENTARY) {
    return `/media/${workId}`; // For series
  }
  if (resultCategory === 'mediaItem' && itemId) {
    console.warn(`Search API: Fallback to /item/${itemId} for item:`, mediaObject);
    return `/item/${itemId}`;
  }
  if (resultCategory === 'mediaWork' && workId) {
    console.warn(`Search API: Fallback to /media/${workId} for work:`, mediaObject);
    return `/media/${workId}`;
  }
  console.error("Search API: Could not determine path for media object:", mediaObject);
  return "#";
};


// GET /api/search?q=<query>&type=<type>&page=<page>&limit=<limit>
router.get('/', async (req, res) => {
  const query = req.query.q?.trim() || ''; // Ensure query is a string and trimmed
  const typeFilter = req.query.type?.toUpperCase();
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  console.log(`Request received for GET /api/search: query='${query}', type='${typeFilter}', page=${page}, limit=${limit}`);

  if (!typeFilter && !query) { // Check if query is empty after trim
    return res.status(400).json({ message: 'Search query cannot be empty when no type filter is specified.' });
  }

  let individualPromise = Promise.resolve({ data: [], totalCount: 0 });
  let mediaWorkPromise = Promise.resolve({ data: [], totalCount: 0 });
  let mediaItemPromise = Promise.resolve({ data: [], totalCount: 0 });
  let organizationPromise = Promise.resolve({ data: [], totalCount: 0 });

  const KEYWORD_SEARCH_LIMIT_PER_ENTITY = 25;

  try {
    if (typeFilter) {
      console.log(`Performing type-specific search for: ${typeFilter}, page: ${page}, limit: ${limit}`);
      let queryOptions = {
        skip,
        take: limit,
        orderBy: { title: 'asc' },
        select: { id: true, title: true, workType: true, summaryNotes: true, imagePath: true }
      };
      let countOptions = {};
      let targetModel = 'mediaWork'; // Default to mediaWork for type filters

      switch (typeFilter) {
        case 'BOOK':
          queryOptions.where = { workType: MediaWorkType.BOOK };
          countOptions.where = { workType: MediaWorkType.BOOK };
          break;
        case 'FILM':
          queryOptions.where = { workType: MediaWorkType.FILM };
          countOptions.where = { workType: MediaWorkType.FILM };
          break;
        case 'DOCUMENTARY':
          queryOptions.where = { workType: MediaWorkType.DOCUMENTARY };
          countOptions.where = { workType: MediaWorkType.DOCUMENTARY };
          break;
        // Add other type filters here if they target different models or have different base queries
        default:
          console.log(`Unsupported type filter received: ${typeFilter}. Returning no results for this type.`);
          // Ensure we don't proceed with a DB query for unsupported types
          mediaWorkPromise = Promise.resolve({ data: [], totalCount: 0 }); // Or appropriate promise
          // Skip further processing for this switch case
          targetModel = null;
          break;
      }

      if (targetModel === 'mediaWork' && queryOptions.where) { // Check if where clause was set
         mediaWorkPromise = Promise.all([
            prisma.mediaWork.findMany(queryOptions),
            prisma.mediaWork.count(countOptions)
          ]).then(([data, total]) => ({ data, totalCount: total }));
      }
      // Add similar blocks if typeFilter can target individuals, items, or orgs directly with pagination

    } else if (query) { // Only proceed with keyword search if query is not empty
      console.log(`Performing keyword search for: "${query}"`);

      // --- Enhanced Individual Search Logic ---
      const individualOrConditions = [
        { narrativeSummary: { contains: query, mode: 'insensitive' } },
        // Broad search for full query in first or last name
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
                { firstName: { contains: firstNamePart, mode: 'insensitive' } }
              ]
            });
          }
        }
      } else if (query.includes(' ')) {
        const parts = query.split(/\s+/); // Split by one or more spaces
        if (parts.length >= 2) { // Handle cases with more than two words by taking first and last significant
          const firstWord = parts[0].trim();
          const lastWord = parts[parts.length -1].trim(); // Use the actual last word
          if (firstWord && lastWord) {
            // "First Last"
            individualOrConditions.push({
              AND: [
                { firstName: { contains: firstWord, mode: 'insensitive' } },
                { lastName: { contains: lastWord, mode: 'insensitive' } }
              ]
            });
            // "Last First" (less common for input but good to cover)
             individualOrConditions.push({
              AND: [
                { firstName: { contains: lastWord, mode: 'insensitive' } },
                { lastName: { contains: firstWord, mode: 'insensitive' } }
              ]
            });
          }
        }
      }
      // If it's a single word, the broad firstName/lastName contains above will handle it.

      individualPromise = prisma.individual.findMany({
        where: { OR: individualOrConditions },
        select: { id: true, firstName: true, lastName: true, narrativeSummary: true },
        take: KEYWORD_SEARCH_LIMIT_PER_ENTITY
      }).then(data => ({ data, totalCount: data.length }));
      // --- End of Enhanced Individual Search Logic ---

      const commonWhereMedia = (fields) => ({
        OR: fields.map(field => ({ [field]: { contains: query, mode: 'insensitive' } }))
      });

      mediaWorkPromise = prisma.mediaWork.findMany({
        where: commonWhereMedia(['title', 'creatorName', 'focusOrTheme', 'summaryNotes', 'publisherOrNetwork']),
        select: { id: true, title: true, workType: true, summaryNotes: true, imagePath: true },
        take: KEYWORD_SEARCH_LIMIT_PER_ENTITY
      }).then(data => ({ data, totalCount: data.length }));

      mediaItemPromise = prisma.mediaItem.findMany({
        where: commonWhereMedia(['itemTitle', 'hostOrNarrator', 'focusOrTheme', 'summaryNotes', 'keyQuotes']),
        select: {
          id: true, itemTitle: true, itemMediaType: true, summaryNotes: true,
          work: { select: { id: true, title: true, workType: true } }
        },
        take: KEYWORD_SEARCH_LIMIT_PER_ENTITY
      }).then(data => ({ data, totalCount: data.length }));

      organizationPromise = prisma.organization.findMany({
        where: commonWhereMedia(['name', 'notes']),
        select: { id: true, name: true, type: true, notes: true },
        take: KEYWORD_SEARCH_LIMIT_PER_ENTITY
      }).then(data => ({ data, totalCount: data.length }));
    }

    const [
      individualsResult,
      mediaWorksResult,
      mediaItemsResult,
      organizationsResult
    ] = await Promise.all([
      individualPromise,
      mediaWorkPromise,
      mediaItemPromise,
      organizationPromise
    ]);

    const combinedResults = [];
    const addedMediaWorkIds = new Set();

    individualsResult.data.forEach(ind => combinedResults.push({
      id: ind.id, type: 'individual', name: `${ind.firstName} ${ind.lastName}`,
      detail: ind.narrativeSummary ? ind.narrativeSummary.substring(0, 150) + '...' : 'No summary.',
      path: `/profile/${ind.id}`
    }));

    mediaWorksResult.data.forEach(work => {
      combinedResults.push({
        id: work.id, type: 'mediaWork', name: work.title,
        workType: work.workType, imagePath: work.imagePath,
        detail: work.summaryNotes ? work.summaryNotes.substring(0, 150) + '...' : `Type: ${formatTypeName(work.workType)}`,
        path: getMediaPath(work, 'mediaWork')
      });
      if (work.workType === MediaWorkType.BOOK || work.workType === MediaWorkType.FILM || work.workType === MediaWorkType.DOCUMENTARY) {
        addedMediaWorkIds.add(work.id);
      }
    });

    mediaItemsResult.data.forEach(item => {
      if (
        (item.itemMediaType === MediaItemType.BOOK_CONTENT ||
         item.itemMediaType === MediaItemType.FILM_CONTENT ||
         item.itemMediaType === MediaItemType.DOCUMENTARY_CONTENT) &&
        item.work && addedMediaWorkIds.has(item.work.id)
      ) {
        console.log(`Skipping MediaItem ${item.id} (${item.itemMediaType}) as parent MediaWork ${item.work.id} is already included.`);
        return;
      }
      combinedResults.push({
        id: item.id, type: 'mediaItem', name: item.itemTitle || 'Untitled Item',
        parentWorkTitle: item.work?.title || 'Unknown Work',
        itemMediaType: item.itemMediaType, parentWorkType: item.work?.workType,
        detail: item.summaryNotes ? item.summaryNotes.substring(0, 150) + '...' : `Type: ${formatTypeName(item.itemMediaType)}`,
        path: getMediaPath(item, 'mediaItem')
      });
    });

    organizationsResult.data.forEach(org => combinedResults.push({
      id: org.id, type: 'organization', name: org.name,
      orgType: org.type,
      detail: org.notes ? org.notes.substring(0, 150) + '...' : `Type: ${formatTypeName(org.type)}`,
      path: `/organization/${org.id}`
    }));

    let totalCountForResponse = 0;
    if (typeFilter) {
      // This assumes typeFilter primarily targets mediaWorks. Adapt if other types get paginated.
      totalCountForResponse = mediaWorksResult.totalCount;
    } else {
      totalCountForResponse = combinedResults.length;
    }

    console.log(`Returning ${combinedResults.length} results. Total count for pagination (if applicable): ${totalCountForResponse}`);
    res.json({
        results: combinedResults,
        currentPage: page,
        limit, // Send back the limit used
        totalCount: totalCountForResponse
    });

  } catch (error) {
    console.error(`Error during search:`, error.message, error.stack);
    if (error.code) { console.error(`Prisma Error Code: ${error.code}`); }
    res.status(500).json({ message: 'Search failed due to an internal error.' });
  }
});

// Helper to format type names, can be used in responses if needed
const formatTypeName = (typeStr) => {
    if (!typeStr) return '';
    return typeStr.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
};

module.exports = router;
