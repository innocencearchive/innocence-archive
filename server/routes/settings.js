// routes/settings.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

const SETTINGS_ROW_ID = 1; // The fixed ID for the single row in the settings table

// --- Helper to validate incoming IDs (ensure they are numbers or null) ---
function validateId(id) {
    if (id === null || id === '' || typeof id === 'undefined') return null;
    const num = parseInt(id, 10);
    return !isNaN(num) ? num : null; // Return number or null if invalid
}

// --- GET /api/settings/featured ---
// Fetches the current featured content settings
router.get('/featured', async (req, res) => {
    console.log('Request received for GET /api/settings/featured');
    try {
        const settings = await prisma.featuredContentSetting.findUnique({
            where: { id: SETTINGS_ROW_ID },
        });

        if (settings) {
            console.log('Found featured settings:', settings);
            res.json(settings);
        } else {
            console.log('No featured settings found, returning defaults.');
            // Return default empty/null values if no settings row exists yet
            res.json({
                id: SETTINGS_ROW_ID,
                featuredStoryId: null,
                featuredBookId: null,
                featuredPodcastId: null,
                featuredFilmId: null,
                featuredOrgId: null,
                featuredFactorIds: [],
            });
        }
    } catch (error) {
        console.error('Error fetching featured settings:', error.message);
        res.status(500).json({ message: 'Failed to fetch settings', error: error.message });
    }
});

// --- PUT /api/settings/featured ---
// Updates (or creates) the featured content settings
router.put('/featured', async (req, res) => {
    console.log('Request received for PUT /api/settings/featured');
    const {
        featuredStoryId,
        featuredBookId,
        featuredPodcastId,
        featuredFilmId,
        featuredOrgId,
        featuredFactorIds // Expecting an array of IDs from the frontend
    } = req.body;

    console.log('Received settings payload:', req.body);

    try {
        // Basic validation/sanitization
        const validatedData = {
            featuredStoryId: validateId(featuredStoryId),
            featuredBookId: validateId(featuredBookId),
            featuredPodcastId: validateId(featuredPodcastId),
            featuredFilmId: validateId(featuredFilmId),
            featuredOrgId: validateId(featuredOrgId),
            // Ensure factor IDs are numbers and filter out any invalid ones
            featuredFactorIds: Array.isArray(featuredFactorIds)
                ? featuredFactorIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id))
                : [],
        };

        console.log('Validated settings data for upsert:', validatedData);

        // Use upsert: update if exists (ID=1), create if not
        const updatedSettings = await prisma.featuredContentSetting.upsert({
            where: { id: SETTINGS_ROW_ID },
            update: validatedData,
            create: {
                id: SETTINGS_ROW_ID, // Explicitly set ID on create
                ...validatedData,
            },
        });

        console.log('Successfully saved/updated featured settings:', updatedSettings);
        res.json({ message: 'Settings saved successfully!', settings: updatedSettings });

    } catch (error) {
        console.error('Error saving featured settings:', error.message);
        // Provide more detail if it's a Prisma validation error
        if (error.code) {
             console.error(`Prisma Error Code: ${error.code}`);
             res.status(400).json({ message: 'Failed to save settings due to invalid data.', error: error.message });
        } else {
             res.status(500).json({ message: 'Failed to save settings due to an internal error.', error: error.message });
        }
    }
});

module.exports = router;
