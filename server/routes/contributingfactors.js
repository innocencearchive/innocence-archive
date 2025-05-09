// routes/contributingfactors.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router(); // Create an Express router instance
const prisma = new PrismaClient(); // Initialize Prisma Client

// --- Define routes for /api/contributingfactors ---

// GET /api/contributingfactors  (Fetches all factors OR the latest N factors)
router.get('/', async (req, res) => {
  // *** MODIFICATION START: Check for 'latest' query parameter ***
  const latestCount = req.query.latest ? parseInt(req.query.latest, 10) : null;
  // *** MODIFICATION END ***

  // Log based on whether 'latest' is used
  if (latestCount && !isNaN(latestCount) && latestCount > 0) {
    console.log(`Request received for GET /api/contributingfactors?latest=${latestCount}`);
  } else {
    console.log('Request received for GET /api/contributingfactors (all)');
  }

  try {
    let factors;
    // *** MODIFICATION START: Conditional Prisma query ***
    if (latestCount && !isNaN(latestCount) && latestCount > 0) {
      // Fetch the latest N factors (using ID as proxy for creation order)
      factors = await prisma.contributingFactor.findMany({
        orderBy: {
          id: 'desc' // Order by ID descending to get latest first
          // Or use: createdAt: 'desc' if you have that field reliably populated
        },
        take: latestCount // Limit the result to N items
        // Consider adding includes here if the homepage needs more than basic info
      });
      console.log(`Found ${factors.length} latest contributing factor(s).`);
    } else {
      // Fetch all factors (original logic, ordered by name)
      factors = await prisma.contributingFactor.findMany({
        orderBy: {
          name: 'asc',
        }
      });
      console.log(`Found ${factors.length} total contributing factors.`);
    }
    // *** MODIFICATION END ***

    res.json(factors); // Send the result back as JSON
  } catch (error) {
    console.error('Error fetching contributing factors:', error);
    res.status(500).json({ message: 'Failed to fetch contributing factors', error: error.message });
  }
});

// GET /api/contributingfactors/:id  (Fetches a single contributing factor by its ID with related data)
// This route remains unchanged from the previous version needed for ContributingFactorPage
router.get('/:id', async (req, res) => {
  const idString = req.params.id;
  console.log(`Request received for GET /api/contributingfactors/${idString}`);

  try {
    const idInt = parseInt(idString, 10);

    if (isNaN(idInt)) {
      return res.status(400).json({ message: 'Invalid ID format. ID must be an integer.' });
    }

    const singleFactor = await prisma.contributingFactor.findUnique({
      where: {
        id: idInt
      },
      include: {
        individualCases: true, // Individuals associated with this factor
        mediaItemMentions: true, // Media items mentioning this factor
		relatedPersons: true,       // NEW - Fetch related OIPs
        relatedOrganizations: true  // NEW - Fetch related Organizations
      }
    });

    if (singleFactor) {
      console.log(`Found contributing factor with ID: ${idInt} and included related data.`);
      res.json(singleFactor);
    } else {
      console.log(`Contributing factor with ID: ${idInt} not found.`);
      res.status(404).json({ message: `Contributing factor with ID ${idInt} not found` });
    }
  } catch (error) {
    console.error(`Error fetching contributing factor ${idString}:`, error instanceof Error ? error.message : error);
     if (error.code) {
        console.error(`Prisma Error Code: ${error.code}`);
    }
    res.status(500).json({ message: 'Failed to fetch contributing factor data', error: 'Internal server error' });
  }
});

// --- TODO: Add routes for POST (create), PUT (update), DELETE ---

module.exports = router; // Export the router so server.js can use it
