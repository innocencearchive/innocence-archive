// routes/search.js
const express = require('express');
const { PrismaClient, MediaWorkType } = require('@prisma/client'); // Import Enum if needed for validation

const router = express.Router(); // Create an Express router instance
const prisma = new PrismaClient(); // Initialize Prisma Client

// Helper function to determine the correct path for media results
const getMediaPath = (mediaObject, type) => {
  const workType = type === 'mediaWork' ? mediaObject.workType : mediaObject.work?.workType;
  const itemType = type === 'mediaItem' ? mediaObject.itemMediaType : null;
  const workId = type === 'mediaWork' ? mediaObject.id : mediaObject.work?.id;
  const itemId = type === 'mediaItem' ? mediaObject.id : null;

  // --- UPDATED LOGIC ---
  // Prioritize Film Page for FILM or DOCUMENTARY MediaWorks
  if (type === 'mediaWork' && (workType === MediaWorkType.FILM || workType === MediaWorkType.DOCUMENTARY)) {
    if (workId) { return `/film/${workId}`; }
    // Fallback if workId is somehow missing (should not happen for a work)
    console.warn(`Search API: Missing workId for FILM/DOCUMENTARY type (${workType}) ID ${mediaObject.id}`);
    return '#'; 
  }

  // Combined Page Logic for Books (MediaWork type)
  // Or for specific _CONTENT item types if they are meant to go to a combined view (less likely for films now)
  if (type === 'mediaWork' && workType === MediaWorkType.BOOK) {
    if (workId) { return `/combined/${workId}`; }
    console.warn(`Search API: Missing workId for BOOK type (${workType}) ID ${mediaObject.id}`);
    return '#';
  }
  
  // If it's an item of type FILM_CONTENT or DOCUMENTARY_CONTENT, and it has a parent workId,
  // it should probably still link to the parent film's page.
  // This assumes search results might show items, but you want to navigate to the main film page.
  if (type === 'mediaItem' && (itemType === 'FILM_CONTENT' || itemType === 'DOCUMENTARY_CONTENT')) {
    if (workId) { return `/film/${workId}`; } // Link to parent film page
    console.warn(`Search API: Missing parent workId for ${itemType} ID ${itemId}`);
    return itemId ? `/item/${itemId}` : '#'; // Fallback to item page if no parent workId
  }
  
  // Item Page Logic for other item types (e.g., PODCAST_EPISODE, TV_EPISODE)
  if (type === 'mediaItem' && itemId && itemType && itemType !== 'BOOK_CONTENT' && itemType !== 'FILM_CONTENT' && itemType !== 'DOCUMENTARY_CONTENT') {
    return `/item/${itemId}`;
  }

  // Work Page Logic for series (e.g., PODCAST_SERIES, DOCUSERIES, TV_SERIES)
  if (type === 'mediaWork' && workId && workType && 
      workType !== MediaWorkType.BOOK && 
      workType !== MediaWorkType.FILM && 
      workType !== MediaWorkType.DOCUMENTARY) {
    return `/media/${workId}`;
  }
  
  // Fallbacks (should ideally be covered by specific logic above)
  if (type === 'mediaItem' && itemId) { 
    console.warn(`Search API: Fallback to /item/${itemId} for item:`, mediaObject);
    return `/item/${itemId}`; 
  }
  if (type === 'mediaWork' && workId) { 
    // This might catch other MediaWork types not explicitly handled, sending them to /media (series page)
    console.warn(`Search API: Fallback to /media/${workId} for work:`, mediaObject);
    return `/media/${workId}`; 
  }

  console.error("Search API: Could not determine path for media object:", mediaObject);
  return "#"; // Default fallback
};


// GET /api/search?q=<query>&type=<type>
router.get('/', async (req, res) => {
  const query = req.query.q;
  const typeFilter = req.query.type?.toUpperCase(); // Get type filter, convert to uppercase

  console.log(`Request received for GET /api/search${query ? `?q=${query}` : ''}${typeFilter ? `&type=${typeFilter}` : ''}`);

  if (!typeFilter && (!query || query.trim() === '')) {
    return res.status(400).json({ message: 'Search query cannot be empty when no type filter is specified.' });
  }

  let individualPromise = Promise.resolve([]);
  let mediaWorkPromise = Promise.resolve([]);
  let mediaItemPromise = Promise.resolve([]);
  let organizationPromise = Promise.resolve([]);

  try {
    if (typeFilter) {
      console.log(`Performing type-specific search for: ${typeFilter}`);
      switch (typeFilter) {
        case 'BOOK':
          mediaWorkPromise = prisma.mediaWork.findMany({
            where: { workType: MediaWorkType.BOOK },
            select: { id: true, title: true, workType: true, summaryNotes: true },
            orderBy: { title: 'asc' }
          });
          break;
        case 'FILM': // Added for type filter
          mediaWorkPromise = prisma.mediaWork.findMany({
            where: { workType: MediaWorkType.FILM },
            select: { id: true, title: true, workType: true, summaryNotes: true },
            orderBy: { title: 'asc' }
          });
          break;
        case 'DOCUMENTARY': // Added for type filter
          mediaWorkPromise = prisma.mediaWork.findMany({
            where: { workType: MediaWorkType.DOCUMENTARY },
            select: { id: true, title: true, workType: true, summaryNotes: true },
            orderBy: { title: 'asc' }
          });
          break;
        // Add other type filters as needed (e.g., PODCAST_SERIES)
        default:
          console.log(`Unsupported type filter received: ${typeFilter}`);
          break; 
      }
    } else {
      console.log(`Performing keyword search for: "${query}"`);
      individualPromise = prisma.individual.findMany({
        where: { OR: [ { firstName: { contains: query, mode: 'insensitive' } }, { lastName: { contains: query, mode: 'insensitive' } }, { narrativeSummary: { contains: query, mode: 'insensitive' } } ] },
        select: { id: true, firstName: true, lastName: true, narrativeSummary: true },
        take: 10
      });

      mediaWorkPromise = prisma.mediaWork.findMany({
        where: { OR: [ { title: { contains: query, mode: 'insensitive' } }, { creatorName: { contains: query, mode: 'insensitive' } }, { focusOrTheme: { contains: query, mode: 'insensitive' } }, { summaryNotes: { contains: query, mode: 'insensitive' } }, { publisherOrNetwork: { contains: query, mode: 'insensitive' } } ] },
        // Ensure workType is selected for getMediaPath
        select: { id: true, title: true, workType: true, summaryNotes: true }, 
        take: 10
      });

      mediaItemPromise = prisma.mediaItem.findMany({
        where: { OR: [ { itemTitle: { contains: query, mode: 'insensitive' } }, { hostOrNarrator: { contains: query, mode: 'insensitive' } }, { focusOrTheme: { contains: query, mode: 'insensitive' } }, { summaryNotes: { contains: query, mode: 'insensitive' } }, { keyQuotes: { contains: query, mode: 'insensitive' } } ] },
        // Ensure work.workType and itemMediaType are selected for getMediaPath
        select: { id: true, itemTitle: true, itemMediaType: true, summaryNotes: true, work: { select: { id: true, title: true, workType: true } } },
        take: 10
      });

      organizationPromise = prisma.organization.findMany({
        where: { OR: [ { name: { contains: query, mode: 'insensitive' } }, { notes: { contains: query, mode: 'insensitive' } } ] },
        select: { id: true, name: true, type: true, notes: true },
        take: 10
      });
    }

    const [individuals, mediaWorks, mediaItems, organizations] = await Promise.all([
      individualPromise,
      mediaWorkPromise,
      mediaItemPromise,
      organizationPromise
    ]);

    const combinedResults = [];

    individuals.forEach(ind => combinedResults.push({
      id: ind.id, type: 'individual', name: `${ind.firstName} ${ind.lastName}`,
      detail: ind.narrativeSummary ? ind.narrativeSummary.substring(0, 150) + (ind.narrativeSummary.length > 150 ? '...' : '') : 'No summary available.',
      path: `/profile/${ind.id}`
    }));

    mediaWorks.forEach(work => combinedResults.push({
      id: work.id, type: 'mediaWork', name: work.title,
      // Pass the whole work object to getMediaPath
      detail: work.summaryNotes ? work.summaryNotes.substring(0, 150) + (work.summaryNotes.length > 150 ? '...' : '') : `Type: ${work.workType}`,
      path: getMediaPath(work, 'mediaWork') 
    }));

    mediaItems.forEach(item => combinedResults.push({
      id: item.id, type: 'mediaItem', name: item.itemTitle || 'Untitled Item', parentWork: item.work?.title || 'Unknown Work',
      // Pass the whole item object to getMediaPath
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
