// routes/mediaworks.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router(); // Create an Express router instance
const prisma = new PrismaClient(); // Initialize Prisma Client

// --- Helper Function for ID Validation ---
const validateWorkId = (req, res, next) => {
    const idString = req.params.id || req.params.workId; // Handle both :id and :workId params
    const idInt = parseInt(idString, 10);

    if (isNaN(idInt)) {
        console.error(`Invalid MediaWork ID format received: ${idString}`);
        return res.status(400).json({ message: 'Invalid MediaWork ID format. ID must be an integer.' });
    }
    // Attach the validated integer ID to the request object
    req.workIdInt = idInt;
    next(); // Proceed
};


// --- Define routes for /api/mediaworks ---

// GET /api/mediaworks  (Fetches all media works)
router.get('/', async (req, res) => {
  console.log('Request received for GET /api/mediaworks');
  try {
    const allMediaWorks = await prisma.mediaWork.findMany({
        orderBy: { title: 'asc' } // Optional: order works by title
    });
    console.log(`Found ${allMediaWorks.length} media works.`);
    res.json(allMediaWorks);
  } catch (error) {
    console.error('Error fetching media works:', error);
    res.status(500).json({ message: 'Failed to fetch media works', error: error.message });
  }
});

// GET /api/mediaworks/:id  (Fetches a single media work by its ID)
// This route is used by FilmPage.jsx, CombinedMediaPage.jsx, and MediaWorkPage.jsx (for series)
router.get('/:id', validateWorkId, async (req, res) => {
  const workIdInt = req.workIdInt; // Get validated ID from middleware
  console.log(`Request received for GET /api/mediaworks/${workIdInt}`);

  // Check for include query parameters (e.g., ?include=items,streamingProviders)
  // For simplicity, we'll explicitly include what FilmPage needs.
  // A more dynamic approach could parse req.query.include if needed for other pages.
  const includeRelations = {
    items: { // Always include items
      orderBy: { itemNumber: 'asc' }
    },
    // Conditionally include streamingProviders if the client requests it,
    // or always include it if this route is heavily used by FilmPage.
    // For FilmPage, it's requested in the URL, but we'll hardcode it here for clarity
    // as the dynamic parsing of `?include=` is not implemented.
    streamingProviders: { // MODIFIED: Explicitly include streamingProviders
        orderBy: { providerName: 'asc' } // Optional: order them
    }
  };

  try {
    const singleMediaWork = await prisma.mediaWork.findUnique({
      where: {
        id: workIdInt
      },
      include: includeRelations // Use the defined includes
    });

    if (singleMediaWork) {
      console.log(`Found media work with ID: ${workIdInt}`);
      res.json(singleMediaWork);
    } else {
      console.log(`Media work with ID: ${workIdInt} not found.`);
      res.status(404).json({ message: `Media work with ID ${workIdInt} not found` });
    }
  } catch (error) {
    console.error(`Error fetching media work ${workIdInt}:`, error);
    res.status(500).json({ message: 'Failed to fetch media work', error: 'Internal server error' });
  }
});

// --- Routes for related data (used by various pages) ---

// GET /api/mediaworks/:workId/individuals (Fetches individuals mentioned in items of a specific media work)
router.get('/:workId/individuals', validateWorkId, async (req, res) => {
  const workIdInt = req.workIdInt;
  console.log(`Request received for GET /api/mediaworks/${workIdInt}/individuals`);

  try {
    const individuals = await prisma.individual.findMany({
      where: {
        mediaItemAppearances: {
          some: {
            workId: workIdInt
          }
        }
      },
      orderBy: [ { lastName: 'asc' }, { firstName: 'asc' } ]
    });

    console.log(`Found ${individuals.length} individuals related to MediaWork ID: ${workIdInt}`);
    res.json(individuals);

  } catch (error) {
    console.error(`Error fetching individuals for MediaWork ${workIdInt}:`, error);
    res.status(500).json({ message: 'Failed to fetch related individuals', error: 'Internal server error' });
  }
});

// GET /api/mediaworks/:workId/involvedpersons (Fetches OIPs mentioned in items of a specific media work)
router.get('/:workId/involvedpersons', validateWorkId, async (req, res) => {
  const workIdInt = req.workIdInt;
  console.log(`Request received for GET /api/mediaworks/${workIdInt}/involvedpersons`);

  try {
    const involvedPersons = await prisma.involvedPerson.findMany({
      where: {
        mediaItemMentions: {
          some: {
            workId: workIdInt
          }
        }
      },
      orderBy: [ { role: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' } ]
    });

    console.log(`Found ${involvedPersons.length} involved persons related to MediaWork ID: ${workIdInt}`);
    res.json(involvedPersons);

  } catch (error) {
    console.error(`Error fetching involved persons for MediaWork ${workIdInt}:`, error);
    res.status(500).json({ message: 'Failed to fetch related involved persons', error: 'Internal server error' });
  }
});

// GET /api/mediaworks/:workId/factors (Fetches factors mentioned in items of a specific media work)
router.get('/:workId/factors', validateWorkId, async (req, res) => {
  const workIdInt = req.workIdInt;
  console.log(`Request received for GET /api/mediaworks/${workIdInt}/factors`);

  try {
    const factors = await prisma.contributingFactor.findMany({
      where: {
        mediaItemMentions: {
          some: {
            workId: workIdInt
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    console.log(`Found ${factors.length} factors related to MediaWork ID: ${workIdInt}`);
    res.json(factors);

  } catch (error) {
    console.error(`Error fetching factors for MediaWork ${workIdInt}:`, error);
    res.status(500).json({ message: 'Failed to fetch related factors', error: 'Internal server error' });
  }
});

// GET /api/mediaworks/:workId/organizations (Fetches organizations mentioned in items of a specific media work)
router.get('/:workId/organizations', validateWorkId, async (req, res) => {
    const workIdInt = req.workIdInt;
    console.log(`Request received for GET /api/mediaworks/${workIdInt}/organizations`);

    try {
        const organizations = await prisma.organization.findMany({
            where: {
                mediaItemMentions: {
                    some: {
                        workId: workIdInt
                    }
                }
            },
            orderBy: {
                name: 'asc',
            }
        });

        console.log(`Found ${organizations.length} organizations related to MediaWork ID: ${workIdInt}`);
        res.json(organizations);

    } catch (error) {
        console.error(`Error fetching organizations for MediaWork ${workIdInt}:`, error);
        res.status(500).json({ message: 'Failed to fetch related organizations', error: 'Internal server error' });
    }
});

// --- TODO: Add routes for POST (create), PUT (update), DELETE ---
// --- TODO: Add route for /api/mediaworks/:workId/othersources if needed (currently handled by mediaitems.js for item-specific sources) ---

module.exports = router;
