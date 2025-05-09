// routes/homepage.js
const express = require('express');
const { PrismaClient, MediaWorkType } = require('@prisma/client'); // Import Enum if needed for clarity

const router = express.Router(); // Create an Express router instance
const prisma = new PrismaClient(); // Initialize Prisma Client

// --- Define routes for /api/homepage ---

// GET /api/homepage/featured-media (Fetches latest Book, Podcast, Film/Doc/TV item)
router.get('/featured-media', async (req, res) => {
  console.log('Request received for GET /api/homepage/featured-media');

  try {
    // Use Promise.all to fetch different types concurrently
    const [latestBookItem, latestPodcastItem, latestFilmItem] = await Promise.all([
      // Latest Book Item
      prisma.mediaItem.findFirst({
        where: { work: { workType: MediaWorkType.BOOK } }, // Filter by parent work type
        orderBy: { id: 'desc' }, // Get highest ID (latest)
        include: { work: true }  // Include parent work details
      }),
      // Latest Podcast Item
      prisma.mediaItem.findFirst({
        where: { work: { workType: MediaWorkType.PODCAST_SERIES } },
        orderBy: { id: 'desc' },
        include: { work: true }
      }),
      // Latest Film/Doc/TV Item (combine types)
      prisma.mediaItem.findFirst({
        where: {
          work: {
            workType: {
              in: [
                MediaWorkType.FILM,
                MediaWorkType.DOCUMENTARY,
                MediaWorkType.DOCUSERIES,
                MediaWorkType.TV_SERIES
              ]
            }
          }
        },
        orderBy: { id: 'desc' },
        include: { work: true }
      })
    ]);

    // Construct the response object
    const featuredMedia = {
      book: latestBookItem,     // Will be null if no book item found
      podcast: latestPodcastItem, // Will be null if no podcast item found
      film: latestFilmItem      // Will be null if no film/doc/tv item found
    };

    console.log('Returning featured media data for homepage.');
    res.json(featuredMedia); // Send the combined object back

  } catch (error) {
    console.error('Error fetching homepage featured media:', error);
    res.status(500).json({ message: 'Failed to fetch featured media', error: error.message });
  }
});

// --- TODO: Add other homepage-specific routes if needed ---
// Example: Could create a GET /api/homepage/all that fetches everything (story, media, org, updates, factors)

module.exports = router; // Export the router so server.js can use it
