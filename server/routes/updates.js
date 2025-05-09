// routes/updates.js
const express = require('express');
const { PrismaClient } = require('@prisma/client'); // Keep for consistency, even if not used yet

const router = express.Router(); // Create an Express router instance
const prisma = new PrismaClient(); // Initialize Prisma Client (placeholder for now)

// --- Define routes for /api/updates ---

// GET /api/updates (Fetches latest N updates - currently returns mock data)
router.get('/', async (req, res) => {
  // Check for 'limit' query parameter
  const limitCount = req.query.limit ? parseInt(req.query.limit, 10) : 5; // Default limit 5
  const effectiveLimit = (!isNaN(limitCount) && limitCount > 0) ? limitCount : 5; // Ensure valid positive number

  console.log(`Request received for GET /api/updates?limit=${effectiveLimit}`);

  try {
    // --- PLACEHOLDER LOGIC ---
    // TODO: Replace this with actual database query when schema/logic is defined
    // This mock data matches the structure expected by RecentUpdates.jsx
    const mockUpdates = [
      {
        id: 101,
        text: "Profile Added: Walter McMillian",
        date: "2025-04-10T10:00:00.000Z",
        updateType: "PROFILE",
        relatedId: 1, // Example ID for Walter McMillian
        externalLink: null
      },
      {
        id: 102,
        text: "Media Added: Just Mercy (Book)",
        date: "2025-04-09T15:30:00.000Z",
        updateType: "MEDIA_ITEM", // Or MEDIA_WORK if linking to the work page
        relatedId: 1, // Example ID for the Just Mercy MediaItem
        externalLink: null
      },
      {
        id: 103,
        text: "Organization Added: Equal Justice Initiative",
        date: "2025-04-08T11:00:00.000Z",
        updateType: "ORGANIZATION",
        relatedId: 1, // Example ID for EJI
        externalLink: null
      },
      {
        id: 104,
        text: "Factor Added: Official Misconduct",
        date: "2025-04-07T09:00:00.000Z",
        updateType: "FACTOR", // Need to handle this type in RecentUpdates if desired
        relatedId: 5, // Example ID for the factor
        externalLink: null
      },
       {
        id: 105,
        text: "General Update: Archive data migration complete.",
        date: "2025-04-06T18:00:00.000Z",
        updateType: "GENERAL",
        relatedId: null,
        externalLink: null
      }
    ];

    // Sort mock data by date descending (most recent first) and take the limit
    const sortedUpdates = mockUpdates.sort((a, b) => new Date(b.date) - new Date(a.date));
    const limitedUpdates = sortedUpdates.slice(0, effectiveLimit);

    console.log(`Returning ${limitedUpdates.length} mock update(s).`);
    res.json(limitedUpdates); // Send the limited mock data back

  } catch (error) {
    console.error('Error fetching updates (mock):', error);
    // Even with mock data, errors could theoretically occur (e.g., server issues)
    res.status(500).json({ message: 'Failed to fetch updates', error: error.message });
  }
});

// --- TODO: Add other routes if needed (e.g., POST for creating updates?) ---

module.exports = router; // Export the router so server.js can use it
