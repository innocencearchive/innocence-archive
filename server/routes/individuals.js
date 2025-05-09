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
  const idString = req.params.id; // Use the param directly as a string for logging
  console.log(`Request received for GET /api/individuals/${idString}`);

  try {
    // Parse the ID to an integer for the database query
    const idInt = parseInt(idString, 10);

    // Validate if the parsed ID is a valid number
    if (isNaN(idInt)) {
      console.warn(`Invalid ID format received: ${idString}`);
      return res.status(400).json({ message: 'Invalid ID format. ID must be an integer.' });
    }

    const singleIndividual = await prisma.individual.findUnique({
      where: {
        id: idInt // Use the parsed integer ID
      },
      // --- UPDATED INCLUDE BLOCK ---
      // Includes relations from your file AND adds groups, sourceLinks, relatedToIndividuals
      include: {
        // Needed for RelatedMediaList
        mediaItemAppearances: {
           select: { // Select only necessary fields if needed, or true for all
            id: true,
            itemTitle: true,
            itemMediaType: true,
            work: { // Include parent work details if useful
              select: {
                id: true,
                title: true,
                workType: true,
              }
            }
          }
        },
        // Needed for OrganizationsInvolved component
        organizationsInvolved: {
           select: {
             id: true,
             name: true,
             type: true
          }
        },
        // Needed for ContributingFactorsList component
        contributingFactors: {
           select: {
             id: true,
             name: true
           }
        },
        // Needed for OtherInvolvedPersonsList component (assuming this maps to involvedPersons)
        involvedPersons: {
           select: {
             id: true,
             firstName: true,
             lastName: true,
             role: true
           }
        },
        // Needed for KeyInfo component (potentially)
        crimeCategory: true, // Include the full crime category object
        // Needed for RelatedWrongfullyConvictedList component (assuming this maps to relatedIndividuals)
        relatedIndividuals: {
           select: {
              id: true,
              firstName: true,
              lastName: true
           }
        },
        // --- ADDED/REINSTATED from previous version ---
        relatedToIndividuals: { // The other side of the M2M relation
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
        },
        // --- ADDED/REINSTATED from previous version ---
        sourceLinks: { // Include the join table records for sources
          select: {
            specificUrl: true,
            informationSource: { // Include details from the linked InformationSource
              select: {
                id: true,
                name: true,
                baseUrl: true
              }
            }
          }
        },
        // --- NEWLY ADDED: Include the groups relationship ---
        groups: { // Tells Prisma to fetch related IndividualGroup records
            select: { // Select specific fields from the group
                id: true,
                name: true,
                description: true // Include description if available/needed
            }
        }
      }
      // --- END UPDATED INCLUDE BLOCK ---
    });

    if (singleIndividual) {
      console.log(`Found individual with ID: ${idInt} including related data.`);
      res.json(singleIndividual);
    } else {
      console.log(`Individual with ID: ${idInt} not found.`);
      res.status(404).json({ message: `Individual with ID ${idInt} not found` });
    }
  } catch (error) {
    // Log the error on the server side
    console.error(`Error fetching individual ${idString}:`, error instanceof Error ? error.message : error);
     if (error.code) { // Log Prisma specific error codes if available
        console.error(`Prisma Error Code: ${error.code}`);
    }
    // Send a generic error message to the client
    res.status(500).json({ message: 'Failed to fetch individual data', error: 'Internal server error' });
  }
});

// --- TODO: Add routes for POST (create), PUT (update), DELETE ---

module.exports = router; // Export the router so server.js can use it
