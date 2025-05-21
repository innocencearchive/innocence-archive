// project/server/routes/individuals.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router(); // Create an Express router instance
const prisma = new PrismaClient(); // Initialize Prisma Client

// --- Define routes for /api/individuals ---

// GET /api/individuals  (Fetches all individuals OR the latest N individuals)
// This route remains unchanged from your provided version
router.get('/', async (req, res) => {
  const latestCount = req.query.latest ? parseInt(req.query.latest, 10) : null;

  if (latestCount && !isNaN(latestCount) && latestCount > 0) {
    console.log(`Request received for GET /api/individuals?latest=${latestCount}`);
  } else {
    console.log('Request received for GET /api/individuals (all)');
  }

  try {
    let individuals;
    if (latestCount && !isNaN(latestCount) && latestCount > 0) {
      individuals = await prisma.individual.findMany({
        orderBy: { id: 'desc' },
        take: latestCount
        // include: { crimeCategory: true } // Example if needed
      });
      console.log(`Found ${individuals.length} latest individual(s).`);
    } else {
      individuals = await prisma.individual.findMany({
         // orderBy: { lastName: 'asc' } // Uncomment if you want default sorting
      });
      console.log(`Found ${individuals.length} total individuals.`);
    }
    res.json(individuals);
  } catch (error) {
    console.error('Error fetching individuals:', error);
    res.status(500).json({ message: 'Failed to fetch individuals', error: error.message });
  }
});

// GET /api/individuals/:id  (Fetches a single individual by its ID, including related data)
router.get('/:id', async (req, res) => {
  const idString = req.params.id; 
  console.log(`Request received for GET /api/individuals/${idString}`);

  try {
    const idInt = parseInt(idString, 10);

    if (isNaN(idInt)) {
      console.warn(`Invalid ID format received: ${idString}`);
      return res.status(400).json({ message: 'Invalid ID format. ID must be an integer.' });
    }

    const singleIndividual = await prisma.individual.findUnique({
      where: {
        id: idInt 
      },
      include: {
        mediaItemAppearances: {
           select: { 
            id: true,
            itemTitle: true,
            itemMediaType: true,
            work: { 
              select: {
                id: true,
                title: true,
                workType: true,
              }
            }
          }
        },
        organizationsInvolved: {
           select: {
             id: true,
             name: true,
             type: true
          }
        },
        contributingFactors: {
           select: {
             id: true,
             name: true
           }
        },
        involvedPersons: {
           select: {
             id: true,
             firstName: true,
             lastName: true,
             role: true
           }
        },
        crimeCategory: true, 
        relatedIndividuals: {
           select: {
              id: true,
              firstName: true,
              lastName: true
           }
        },
        relatedToIndividuals: { 
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
        },
        sourceLinks: { 
          select: {
            id: true, // Good to select the ID of the link itself
            specificUrl: true,
            headline: true, // --- ADDED THIS LINE TO FETCH THE HEADLINE ---
            description: true, // Also good to fetch description if available
            informationSource: { 
              select: {
                id: true,
                name: true,
                baseUrl: true
              }
            }
          }
        },
        groups: { 
            select: { 
                id: true,
                name: true,
                description: true 
            }
        }
      }
    });

    if (singleIndividual) {
      console.log(`Found individual with ID: ${idInt} including related data (with headlines).`);
      res.json(singleIndividual);
    } else {
      console.log(`Individual with ID: ${idInt} not found.`);
      res.status(404).json({ message: `Individual with ID ${idInt} not found` });
    }
  } catch (error) {
    console.error(`Error fetching individual ${idString}:`, error instanceof Error ? error.message : error);
     if (error.code) { 
        console.error(`Prisma Error Code: ${error.code}`);
    }
    res.status(500).json({ message: 'Failed to fetch individual data', error: 'Internal server error' });
  }
});

module.exports = router;
