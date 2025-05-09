// routes/search.js
const express = require('express');
const { PrismaClient, MediaWorkType } = require('@prisma/client'); // Import Enum if needed for validation

const router = express.Router(); // Create an Express router instance
const prisma = new PrismaClient(); // Initialize Prisma Client

// Helper function to determine the correct path for media results (remains the same)
const getMediaPath = (mediaObject, type) => {
  const workType = type === 'mediaWork' ? mediaObject.workType : mediaObject.work?.workType;
  const itemType = type === 'mediaItem' ? mediaObject.itemMediaType : null;
  const workId = type === 'mediaWork' ? mediaObject.id : mediaObject.work?.id;
  const itemId = type === 'mediaItem' ? mediaObject.id : null;

  // Combined Page Logic
  if (workType === 'BOOK' || workType === 'FILM' || workType === 'DOCUMENTARY' || itemType === 'BOOK_CONTENT' || itemType === 'FILM_CONTENT' || itemType === 'DOCUMENTARY_CONTENT') {
    if (workId) { return `/combined/${workId}`; }
    else { console.warn(`Search API: Missing workId for combined type (${workType || itemType}) ID ${itemId || mediaObject.id}`); return itemId ? `/item/${itemId}` : '#'; }
  }
  // Item Page Logic
  if (type === 'mediaItem' && itemId && itemType && itemType !== 'BOOK_CONTENT' && itemType !== 'FILM_CONTENT' && itemType !== 'DOCUMENTARY_CONTENT') {
    return `/item/${itemId}`;
  }
  // Work Page Logic
  if (type === 'mediaWork' && workId && workType && workType !== 'BOOK' && workType !== 'FILM' && workType !== 'DOCUMENTARY') {
    return `/media/${workId}`;
  }
  // Fallbacks
  if (type === 'mediaItem' && itemId) { return `/item/${itemId}`; }
  if (type === 'mediaWork' && workId) { return `/media/${workId}`; }

  console.warn("Search API: Could not determine path for media object:", mediaObject);
  return "#";
};


// GET /api/search?q=<query>&type=<type>
router.get('/', async (req, res) => {
  const query = req.query.q;
  const typeFilter = req.query.type?.toUpperCase(); // Get type filter, convert to uppercase

  // Log the request details
  console.log(`Request received for GET /api/search${query ? `?q=${query}` : ''}${typeFilter ? `&type=${typeFilter}` : ''}`);

  // Validate query if no type filter is applied
  if (!typeFilter && (!query || query.trim() === '')) {
    return res.status(400).json({ message: 'Search query cannot be empty when no type filter is specified.' });
  }

  // --- Define Prisma Promises ---
  let individualPromise = Promise.resolve([]);
  let mediaWorkPromise = Promise.resolve([]);
  let mediaItemPromise = Promise.resolve([]);
  let organizationPromise = Promise.resolve([]);

  try {
    // --- Conditional Search Logic ---

    if (typeFilter) {
      // --- Type-Specific Search ---
      console.log(`Performing type-specific search for: ${typeFilter}`);
      switch (typeFilter) {
        case 'BOOK':
          mediaWorkPromise = prisma.mediaWork.findMany({
            where: { workType: MediaWorkType.BOOK }, // Filter by specific type
            select: { id: true, title: true, workType: true, summaryNotes: true },
            // No 'take' limit - get all books
            orderBy: { title: 'asc' } // Order alphabetically
          });
          break;
        // Add cases for other types like 'FILM', 'PODCAST_SERIES' etc. if needed
        // case 'FILM':
        //   mediaWorkPromise = prisma.mediaWork.findMany({ where: { workType: MediaWorkType.FILM }, ... });
        //   break;
        // case 'INDIVIDUAL': // Example if you add a link for all individuals
        //   individualPromise = prisma.individual.findMany({ ... });
        //   break;
        default:
          console.log(`Unsupported type filter received: ${typeFilter}`);
          // Return empty results for unsupported types, or handle as an error
          // return res.status(400).json({ message: `Unsupported type filter: ${typeFilter}` });
          break; // Resolve with empty arrays defined above
      }
    } else {
      // --- Keyword Search (Original Logic) ---
      console.log(`Performing keyword search for: "${query}"`);
      individualPromise = prisma.individual.findMany({
        where: { OR: [ { firstName: { contains: query, mode: 'insensitive' } }, { lastName: { contains: query, mode: 'insensitive' } }, { narrativeSummary: { contains: query, mode: 'insensitive' } } ] },
        select: { id: true, firstName: true, lastName: true, narrativeSummary: true },
        take: 10
      });

      mediaWorkPromise = prisma.mediaWork.findMany({
        where: { OR: [ { title: { contains: query, mode: 'insensitive' } }, { creatorName: { contains: query, mode: 'insensitive' } }, { focusOrTheme: { contains: query, mode: 'insensitive' } }, { summaryNotes: { contains: query, mode: 'insensitive' } }, { publisherOrNetwork: { contains: query, mode: 'insensitive' } } ] },
        select: { id: true, title: true, workType: true, summaryNotes: true },
        take: 10
      });

      mediaItemPromise = prisma.mediaItem.findMany({
        where: { OR: [ { itemTitle: { contains: query, mode: 'insensitive' } }, { hostOrNarrator: { contains: query, mode: 'insensitive' } }, { focusOrTheme: { contains: query, mode: 'insensitive' } }, { summaryNotes: { contains: query, mode: 'insensitive' } }, { keyQuotes: { contains: query, mode: 'insensitive' } } ] },
        select: { id: true, itemTitle: true, itemMediaType: true, summaryNotes: true, work: { select: { id: true, title: true, workType: true } } },
        take: 10
      });

      organizationPromise = prisma.organization.findMany({
        where: { OR: [ { name: { contains: query, mode: 'insensitive' } }, { notes: { contains: query, mode: 'insensitive' } } ] },
        select: { id: true, name: true, type: true, notes: true },
        take: 10
      });
    }

    // --- Execute Searches ---
    const [individuals, mediaWorks, mediaItems, organizations] = await Promise.all([
      individualPromise,
      mediaWorkPromise,
      mediaItemPromise,
      organizationPromise
    ]);

    // --- Format and Combine Results (Remains the same) ---
    const combinedResults = [];

    individuals.forEach(ind => combinedResults.push({
      id: ind.id, type: 'individual', name: `${ind.firstName} ${ind.lastName}`,
      detail: ind.narrativeSummary ? ind.narrativeSummary.substring(0, 150) + (ind.narrativeSummary.length > 150 ? '...' : '') : 'No summary available.',
      path: `/profile/${ind.id}`
    }));

    mediaWorks.forEach(work => combinedResults.push({
      id: work.id, type: 'mediaWork', name: work.title,
      detail: work.summaryNotes ? work.summaryNotes.substring(0, 150) + (work.summaryNotes.length > 150 ? '...' : '') : `Type: ${work.workType}`,
      path: getMediaPath(work, 'mediaWork')
    }));

    mediaItems.forEach(item => combinedResults.push({
      id: item.id, type: 'mediaItem', name: item.itemTitle || 'Untitled Item', parentWork: item.work?.title || 'Unknown Work',
      detail: item.summaryNotes ? item.summaryNotes.substring(0, 150) + (item.summaryNotes.length > 150 ? '...' : '') : `Type: ${item.itemMediaType}`,
      path: getMediaPath(item, 'mediaItem')
    }));

    organizations.forEach(org => combinedResults.push({
      id: org.id, type: 'organization', name: org.name,
      detail: org.notes ? org.notes.substring(0, 150) + (org.notes.length > 150 ? '...' : '') : `Type: ${org.type || 'Unknown'}`,
      path: `/organization/${org.id}`
    }));

    console.log(`Found ${combinedResults.length} total results.`);
    res.json(combinedResults);

  } catch (error) {
    console.error(`Error during search:`, error instanceof Error ? error.message : error);
    if (error.code) { console.error(`Prisma Error Code: ${error.code}`); }
    res.status(500).json({ message: 'Search failed due to an internal error.' });
  }
});

module.exports = router;
