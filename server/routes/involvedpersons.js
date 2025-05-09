// routes/involvedpersons.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router(); // Create an Express router instance
const prisma = new PrismaClient(); // Initialize Prisma Client

// --- Define routes for /api/involved-persons ---

// GET /api/involved-persons  (Fetches all involved persons)
router.get('/', async (req, res) => {
  console.log('Request received for GET /api/involved-persons');
  try {
    // Use Prisma to find all records in your 'InvolvedPerson' table
    // Prisma client uses camelCase model names: InvolvedPerson -> involvedPerson
    const allInvolvedPersons = await prisma.involvedPerson.findMany({
      // Optional: Order by last name, then first name
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' },
      ]
    });
    console.log(`Found ${allInvolvedPersons.length} involved persons.`);
    res.json(allInvolvedPersons); // Send the involved persons back as JSON
  } catch (error) {
    console.error('Error fetching involved persons:', error);
    res.status(500).json({ message: 'Failed to fetch involved persons', error: error.message });
  }
});

// GET /api/involved-persons/:id  (Fetches a single involved person by their ID)
router.get('/:id', async (req, res) => {
  // Get the ID from the URL parameter (it's a string)
  const idString = req.params.id;
  console.log(`Request received for GET /api/involved-persons/${idString}`);

  try {
    // Convert the ID string to an integer, as 'id Int' is defined in the schema for InvolvedPerson
    const idInt = parseInt(idString, 10);

    // Check if the conversion was successful
    if (isNaN(idInt)) {
      return res.status(400).json({ message: 'Invalid ID format. ID must be an integer.' });
    }

    // Use Prisma to find a unique involved person by their integer ID
    const singleInvolvedPerson = await prisma.involvedPerson.findUnique({
      where: {
        id: idInt // Use the integer ID
      },
      // Optional: Include related data if needed later
      include: {
         mediaItemMentions: true,
         involvedCases: true,
         affiliatedOrgs: true
       }
    });

    if (singleInvolvedPerson) {
      console.log(`Found involved person with ID: ${idInt}`);
      res.json(singleInvolvedPerson); // Send the single involved person back
    } else {
      console.log(`Involved person with ID: ${idInt} not found.`);
      res.status(404).json({ message: `Involved person with ID ${idInt} not found` }); // Not found status
    }
  } catch (error) {
    console.error(`Error fetching involved person ${idString}:`, error);
    res.status(500).json({ message: 'Failed to fetch involved person', error: error.message });
  }
});

// --- TODO: Add routes for POST (create), PUT (update), DELETE ---

module.exports = router; // Export the router so server.js can use it
