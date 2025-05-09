// routes/mediaitems.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router(); // Create an Express router instance
const prisma = new PrismaClient(); // Initialize Prisma Client

// --- Helper Function for ID Validation ---
const validateItemId = (req, res, next) => {
    const idString = req.params.id;
    const idInt = parseInt(idString, 10);

    if (isNaN(idInt)) {
        console.error(`Invalid MediaItem ID format received: ${idString}`);
        return res.status(400).json({ message: 'Invalid ID format. ID must be an integer.' });
    }
    // Attach the validated integer ID to the request object
    req.itemId = idInt;
    next(); // Proceed
};


// --- Define routes for /api/mediaitems ---

// GET /api/mediaitems (Fetches all media items)
router.get('/', async (req, res) => {
  console.log('Request received for GET /api/mediaitems');
  try {
    const allMediaItems = await prisma.mediaItem.findMany({
       // Optional ordering
       // orderBy: { releaseDate: 'desc' }
    });
    console.log(`Found ${allMediaItems.length} media items.`);
    res.json(allMediaItems);
  } catch (error) {
    console.error('Error fetching media items:', error);
    res.status(500).json({ message: 'Failed to fetch media items', error: error.message });
  }
});

// GET /api/mediaitems/:id (Fetches a SINGLE media item by ID - CORE DATA + PARENT WORK ONLY)
router.get('/:id', validateItemId, async (req, res) => {
  const itemId = req.itemId; // Use validated ID from middleware
  console.log(`Request received for GET /api/mediaitems/${itemId} (Core Data + Work)`);

  try {
    const mediaItem = await prisma.mediaItem.findUnique({
      where: { id: itemId },
      include: {
          work: true // Include parent MediaWork for breadcrumbs/context
      }
      // No other includes here - fetch related lists via specific sub-routes
    });

    if (mediaItem) {
      console.log(`Found media item with ID: ${itemId}.`);
      res.json(mediaItem);
    } else {
      console.log(`Media item with ID: ${itemId} not found.`);
      res.status(404).json({ message: `Media item with ID ${itemId} not found` });
    }
  } catch (error) {
    console.error(`Error fetching media item ${itemId}:`, error);
    res.status(500).json({ message: 'Failed to fetch media item data', error: 'Internal server error' });
  }
});

// --- Sub-Routes for Related Data ---

// GET /api/mediaitems/:id/individuals (Fetches related WC individuals)
router.get('/:id/individuals', validateItemId, async (req, res) => {
    const itemId = req.itemId;
    console.log(`Request received for GET /api/mediaitems/${itemId}/individuals`);
    try {
        const itemWithData = await prisma.mediaItem.findUnique({
            where: { id: itemId },
            select: { individualsFeatured: true } // Select only the related Individuals
        });
        if (itemWithData) {
            res.json(itemWithData.individualsFeatured || []); // Return array or empty array
        } else {
            res.status(404).json({ message: `MediaItem with ID ${itemId} not found` });
        }
    } catch (error) {
        console.error(`Error fetching individuals for media item ${itemId}:`, error);
        res.status(500).json({ message: 'Failed to fetch related individuals', error: 'Internal server error' });
    }
});

// GET /api/mediaitems/:id/involvedpersons (Fetches related OIPs)
router.get('/:id/involvedpersons', validateItemId, async (req, res) => {
    const itemId = req.itemId;
    console.log(`Request received for GET /api/mediaitems/${itemId}/involvedpersons`);
    try {
        const itemWithData = await prisma.mediaItem.findUnique({
            where: { id: itemId },
            select: { involvedPersonsMentioned: true } // Select only the related InvolvedPersons
        });
        if (itemWithData) {
            res.json(itemWithData.involvedPersonsMentioned || []);
        } else {
            res.status(404).json({ message: `MediaItem with ID ${itemId} not found` });
        }
    } catch (error) {
        console.error(`Error fetching involved persons for media item ${itemId}:`, error);
        res.status(500).json({ message: 'Failed to fetch related involved persons', error: 'Internal server error' });
    }
});

// GET /api/mediaitems/:id/organizations (Fetches related organizations)
router.get('/:id/organizations', validateItemId, async (req, res) => {
    const itemId = req.itemId;
    console.log(`Request received for GET /api/mediaitems/${itemId}/organizations`);
    try {
        const itemWithData = await prisma.mediaItem.findUnique({
            where: { id: itemId },
            select: { organizationsMentioned: true } // Select only the related Organizations
        });
        if (itemWithData) {
            res.json(itemWithData.organizationsMentioned || []);
        } else {
            res.status(404).json({ message: `MediaItem with ID ${itemId} not found` });
        }
    } catch (error) {
        console.error(`Error fetching organizations for media item ${itemId}:`, error);
        res.status(500).json({ message: 'Failed to fetch related organizations', error: 'Internal server error' });
    }
});

// GET /api/mediaitems/:id/factors (Fetches related contributing factors)
router.get('/:id/factors', validateItemId, async (req, res) => {
    const itemId = req.itemId;
    console.log(`Request received for GET /api/mediaitems/${itemId}/factors`);
    try {
        const itemWithData = await prisma.mediaItem.findUnique({
            where: { id: itemId },
            select: { contributingFactorsMentioned: true } // Select only the related ContributingFactors
        });
        if (itemWithData) {
            res.json(itemWithData.contributingFactorsMentioned || []);
        } else {
            res.status(404).json({ message: `MediaItem with ID ${itemId} not found` });
        }
    } catch (error) {
        console.error(`Error fetching factors for media item ${itemId}:`, error);
        res.status(500).json({ message: 'Failed to fetch related factors', error: 'Internal server error' });
    }
});

// GET /api/mediaitems/:id/relatedmedia (Fetches related media items using schema relation)
router.get('/:id/relatedmedia', validateItemId, async (req, res) => {
    const itemId = req.itemId;
    console.log(`Request received for GET /api/mediaitems/${itemId}/relatedmedia`);
    try {
        const itemWithRelated = await prisma.mediaItem.findUnique({
            where: { id: itemId },
            select: {
                relatedMediaItems: { // Use the M2M self-relation field name
                    include: { work: true } // Include parent work for context
                }
            }
        });
        if (itemWithRelated) {
            res.json(itemWithRelated.relatedMediaItems || []);
        } else {
            res.status(404).json({ message: `MediaItem with ID ${itemId} not found` });
        }
    } catch (error) {
        console.error(`Error fetching related media for media item ${itemId}:`, error);
        res.status(500).json({ message: 'Failed to fetch related media', error: 'Internal server error' });
    }
});

// GET /api/mediaitems/:id/othersources (Fetches external links mentioned in the item)
// IMPLEMENTED using the externalLinks relation added to the schema
router.get('/:id/othersources', validateItemId, async (req, res) => {
    const itemId = req.itemId;
    console.log(`Request received for GET /api/mediaitems/${itemId}/othersources`);
    try {
        const itemWithLinks = await prisma.mediaItem.findUnique({
            where: { id: itemId },
            // Select the field defined in your schema linking to MediaItemSourceLink
            select: { externalLinks: true }
        });
        if (itemWithLinks) {
            // The result is nested, return the inner array of MediaItemSourceLink objects
            res.json(itemWithLinks.externalLinks || []);
        } else {
            res.status(404).json({ message: `MediaItem with ID ${itemId} not found` });
        }
    } catch (error) {
        console.error(`Error fetching external sources for media item ${itemId}:`, error);
        res.status(500).json({ message: 'Failed to fetch external sources', error: 'Internal server error' });
    }
});


// --- TODO: Add routes for POST (create), PUT (update), DELETE ---

module.exports = router; // Export the router so server.js can use it
