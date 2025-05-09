// routes/organizations.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router(); // Create an Express router instance
const prisma = new PrismaClient(); // Initialize Prisma Client

// --- Helper Function for ID Validation ---
const validateOrgId = (req, res, next) => {
    const idString = req.params.id;
    const idInt = parseInt(idString, 10);

    if (isNaN(idInt)) {
        console.error(`Invalid ID format received: ${idString}`);
        return res.status(400).json({ message: 'Invalid ID format. ID must be an integer.' });
    }
    // Attach the validated integer ID to the request object for later use
    req.orgId = idInt;
    next(); // Proceed to the next middleware or route handler
};

// --- Define routes for /api/organizations ---

// GET /api/organizations (Fetches all organizations OR the latest N organizations)
// This route remains the same as your provided version
router.get('/', async (req, res) => {
  const latestCount = req.query.latest ? parseInt(req.query.latest, 10) : null;

  if (latestCount && !isNaN(latestCount) && latestCount > 0) {
    console.log(`Request received for GET /api/organizations?latest=${latestCount}`);
  } else {
    console.log('Request received for GET /api/organizations (all)');
  }

  try {
    let organizations;
    if (latestCount && !isNaN(latestCount) && latestCount > 0) {
      organizations = await prisma.organization.findMany({
        orderBy: { id: 'desc' },
        take: latestCount
      });
      console.log(`Found ${organizations.length} latest organization(s).`);
    } else {
      organizations = await prisma.organization.findMany({
        orderBy: { name: 'asc' }
      });
      console.log(`Found ${organizations.length} total organizations.`);
    }
    res.json(organizations);
  } catch (error) {
    console.error('Error fetching organizations:', error);
    res.status(500).json({ message: 'Failed to fetch organizations', error: error.message });
  }
});

// GET /api/organizations/:id (Fetches a SINGLE organization by its ID - CORE DATA ONLY)
// MODIFIED: Removed includes, only fetches the organization itself.
router.get('/:id', validateOrgId, async (req, res) => {
  // req.orgId is the validated integer ID from the middleware
  const orgId = req.orgId;
  console.log(`Request received for GET /api/organizations/${orgId} (Core Data)`);

  try {
    const organization = await prisma.organization.findUnique({
      where: { id: orgId }
      // No 'include' here - fetch related data via specific sub-routes
    });

    if (organization) {
      console.log(`Found organization with ID: ${orgId}.`);
      res.json(organization);
    } else {
      console.log(`Organization with ID: ${orgId} not found.`);
      res.status(404).json({ message: `Organization with ID ${orgId} not found` });
    }
  } catch (error) {
    console.error(`Error fetching organization ${orgId}:`, error);
    res.status(500).json({ message: 'Failed to fetch organization data', error: 'Internal server error' });
  }
});

// --- NEW Sub-Routes for Related Data ---

// GET /api/organizations/:id/individuals (Fetches related WC individuals)
router.get('/:id/individuals', validateOrgId, async (req, res) => {
    const orgId = req.orgId;
    console.log(`Request received for GET /api/organizations/${orgId}/individuals`);
    try {
        const orgWithIndividuals = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { involvedCases: true } // Select only the related Individuals (WC)
        });
        if (orgWithIndividuals) {
            res.json(orgWithIndividuals.involvedCases || []); // Return the array or empty array
        } else {
            res.status(404).json({ message: `Organization with ID ${orgId} not found` });
        }
    } catch (error) {
        console.error(`Error fetching individuals for organization ${orgId}:`, error);
        res.status(500).json({ message: 'Failed to fetch related individuals', error: 'Internal server error' });
    }
});

// GET /api/organizations/:id/media (Fetches related media mentions)
router.get('/:id/media', validateOrgId, async (req, res) => {
    const orgId = req.orgId;
    console.log(`Request received for GET /api/organizations/${orgId}/media`);
    try {
        const orgWithMedia = await prisma.organization.findUnique({
            where: { id: orgId },
            select: {
                mediaItemMentions: { // Select the related MediaItems
                    include: { work: true } // Include parent MediaWork for context (title, type) if needed by frontend
                }
            }
        });
        if (orgWithMedia) {
            res.json(orgWithMedia.mediaItemMentions || []);
        } else {
            res.status(404).json({ message: `Organization with ID ${orgId} not found` });
        }
    } catch (error) {
        console.error(`Error fetching media for organization ${orgId}:`, error);
        res.status(500).json({ message: 'Failed to fetch related media', error: 'Internal server error' });
    }
});

// GET /api/organizations/:id/involvedpersons (Fetches related OIPs)
router.get('/:id/involvedpersons', validateOrgId, async (req, res) => {
    const orgId = req.orgId;
    console.log(`Request received for GET /api/organizations/${orgId}/involvedpersons`);
    try {
        const orgWithPersons = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { affiliatedPersons: true } // Select only the related InvolvedPersons (OIPs)
        });
        if (orgWithPersons) {
            res.json(orgWithPersons.affiliatedPersons || []);
        } else {
            res.status(404).json({ message: `Organization with ID ${orgId} not found` });
        }
    } catch (error) {
        console.error(`Error fetching involved persons for organization ${orgId}:`, error);
        res.status(500).json({ message: 'Failed to fetch related involved persons', error: 'Internal server error' });
    }
});

// GET /api/organizations/:id/relatedorgs (Fetches related organizations)
router.get('/:id/relatedorgs', validateOrgId, async (req, res) => {
    const orgId = req.orgId;
    console.log(`Request received for GET /api/organizations/${orgId}/relatedorgs`);
    try {
        const orgWithRelatedOrgs = await prisma.organization.findUnique({
            where: { id: orgId },
            // Select the field defined in your schema for the M2M self-relation
            select: { relatedOrganizations: true }
        });
        if (orgWithRelatedOrgs) {
            res.json(orgWithRelatedOrgs.relatedOrganizations || []);
        } else {
            res.status(404).json({ message: `Organization with ID ${orgId} not found` });
        }
    } catch (error) {
        console.error(`Error fetching related organizations for organization ${orgId}:`, error);
        res.status(500).json({ message: 'Failed to fetch related organizations', error: 'Internal server error' });
    }
});

// GET /api/organizations/:id/externalsources (Fetches related external links)
router.get('/:id/externalsources', validateOrgId, async (req, res) => {
    const orgId = req.orgId;
    console.log(`Request received for GET /api/organizations/${orgId}/externalsources`);
    try {
        const orgWithLinks = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { externalLinks: true } // Select the related OrganizationLinks
        });
        if (orgWithLinks) {
            res.json(orgWithLinks.externalLinks || []);
        } else {
            res.status(404).json({ message: `Organization with ID ${orgId} not found` });
        }
    } catch (error) {
        console.error(`Error fetching external sources for organization ${orgId}:`, error);
        res.status(500).json({ message: 'Failed to fetch external sources', error: 'Internal server error' });
    }
});


// --- TODO: Add routes for POST (create), PUT (update), DELETE ---

module.exports = router; // Export the router so server.js can use it
