// routes/mediaworks.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router(); // Create an Express router instance
const prisma = new PrismaClient(); // Initialize Prisma Client

// --- Helper Function for ID Validation ---
// (Assuming you might want this for consistency, optional)
const validateWorkId = (req, res, next) => {
    const idString = req.params.id || req.params.workId; // Handle both :id and :workId params
    const idInt = parseInt(idString, 10);

    if (isNaN(idInt)) {
        console.error(`Invalid MediaWork ID format received: ${idString}`);
        return res.status(400).json({ message: 'Invalid MediaWork ID format. ID must be an integer.' });
    }
    // Attach the validated integer ID to the request object
    req.workIdInt = idInt; // Use a consistent name like workIdInt
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

// GET /api/mediaworks/:id  (Fetches a single media work by its ID, including its items)
// Using validateWorkId middleware assuming :id refers to workId
router.get('/:id', validateWorkId, async (req, res) => {
  const workIdInt = req.workIdInt; // Get validated ID from middleware
  console.log(`Request received for GET /api/mediaworks/${workIdInt}`);

  try {
    const singleMediaWork = await prisma.mediaWork.findUnique({
      where: {
        id: workIdInt
      },
       include: {
         items: { // Include related media items
             orderBy: { itemNumber: 'asc' } // Order items if possible
         }
       }
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

// --- Routes for related data ---

// GET /api/mediaworks/:workId/individuals (Fetches individuals mentioned in items of a specific media work)
// Using validateWorkId middleware
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
// Using validateWorkId middleware
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
// Using validateWorkId middleware
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

// *** NEW ROUTE ADDED ***
// GET /api/mediaworks/:workId/organizations (Fetches organizations mentioned in items of a specific media work)
// Using validateWorkId middleware
router.get('/:workId/organizations', validateWorkId, async (req, res) => {
    const workIdInt = req.workIdInt; // Get validated ID from middleware
    console.log(`Request received for GET /api/mediaworks/${workIdInt}/organizations`);

    try {
        // Find all unique Organization records linked to any MediaItem associated with the given workIdInt
        const organizations = await prisma.organization.findMany({
            where: {
                // Look at the 'mediaItemMentions' relation on the Organization model
                mediaItemMentions: {
                    // Check if 'some' (at least one) of the related MediaItems...
                    some: {
                        // ...has a workId matching the one from the URL parameter
                        workId: workIdInt
                    }
                }
            },
            // Optional: Order the results
            orderBy: {
                name: 'asc',
            }
        });

        console.log(`Found ${organizations.length} organizations related to MediaWork ID: ${workIdInt}`);
        res.json(organizations); // Send the list of organizations back

    } catch (error) {
        console.error(`Error fetching organizations for MediaWork ${workIdInt}:`, error);
        res.status(500).json({ message: 'Failed to fetch related organizations', error: 'Internal server error' });
    }
});

// --- TODO: Add routes for POST (create), PUT (update), DELETE ---
// --- TODO: Add route for /api/mediaworks/:workId/othersources if needed ---

module.exports = router; // Export the router so server.js can use it
