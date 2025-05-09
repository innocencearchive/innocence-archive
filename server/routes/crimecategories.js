// routes/crimecategories.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router(); // Create an Express router instance
const prisma = new PrismaClient(); // Initialize Prisma Client

// --- Define routes for /api/crime-categories ---

// GET /api/crime-categories  (Fetches all crime categories)
router.get('/', async (req, res) => {
  console.log('Request received for GET /api/crime-categories');
  try {
    // Use Prisma to find all records in your 'CrimeCategory' table
    // Prisma client uses camelCase model names: CrimeCategory -> crimeCategory
    const allCategories = await prisma.crimeCategory.findMany({
      // Optional: Order by severity or name
      orderBy: {
        severity_order: 'asc', // Using the severity_order field from your schema
        // or orderBy: { crime_name: 'asc' }
      }
    });
    console.log(`Found ${allCategories.length} crime categories.`);
    res.json(allCategories); // Send the categories back as JSON
  } catch (error) {
    console.error('Error fetching crime categories:', error);
    res.status(500).json({ message: 'Failed to fetch crime categories', error: error.message });
  }
});

// GET /api/crime-categories/:id  (Fetches a single crime category by its ID)
router.get('/:id', async (req, res) => {
  // Get the ID from the URL parameter (it's a string)
  const idString = req.params.id;
  console.log(`Request received for GET /api/crime-categories/${idString}`);

  try {
    // Convert the ID string to an integer, as 'id Int' is defined in the schema for CrimeCategory
    const idInt = parseInt(idString, 10);

    // Check if the conversion was successful
    if (isNaN(idInt)) {
      return res.status(400).json({ message: 'Invalid ID format. ID must be an integer.' });
    }

    // Use Prisma to find a unique crime category by its integer ID
    const singleCategory = await prisma.crimeCategory.findUnique({
      where: {
        id: idInt // Use the integer ID
      },
      // Optional: Include related data if needed later
      // include: {
      //   individuals: true // Individuals associated with this category
      // }
    });

    if (singleCategory) {
      console.log(`Found crime category with ID: ${idInt}`);
      res.json(singleCategory); // Send the single category back
    } else {
      console.log(`Crime category with ID: ${idInt} not found.`);
      res.status(404).json({ message: `Crime category with ID ${idInt} not found` }); // Not found status
    }
  } catch (error) {
    console.error(`Error fetching crime category ${idString}:`, error);
    res.status(500).json({ message: 'Failed to fetch crime category', error: error.message });
  }
});

// --- TODO: Add routes for POST (create), PUT (update), DELETE if needed ---

module.exports = router; // Export the router so server.js can use it
