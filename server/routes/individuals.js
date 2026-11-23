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
        where: { isPublished: true },
        orderBy: { id: 'desc' },
        take: latestCount
      });
      console.log(`Found ${individuals.length} latest published individual(s).`);
    } else {
      individuals = await prisma.individual.findMany({
        where: { isPublished: true },
      });
      console.log(`Found ${individuals.length} total published individuals.`);
    }
    res.json(individuals);
  } catch (error) {
    console.error('Error fetching individuals:', error);
    res.status(500).json({ message: 'Failed to fetch individuals', error: error.message });
  }
});

// GET /api/individuals/untold-stories
// Lists minimal factual info (name, state, years, time served) for individuals in the database
// who do NOT yet appear in any documented media (books, films, podcasts) or news coverage.
// Automatically removes anyone once linked to a MediaItem or NewsArticle.
router.get('/untold-stories', async (req, res) => {
  const q = (req.query.q || '').trim();
  const state = (req.query.state || '').trim();
  const sort = (req.query.sort || 'years_desc').toLowerCase();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(10, parseInt(req.query.limit, 10) || 50));
  const skip = (page - 1) * limit;

  const where = {
    mediaItemAppearances: { none: {} },
    newsArticles: { none: {} },
  };

  if (state) {
    where.caseLocationState = { equals: state, mode: 'insensitive' };
  }
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
      { caseLocationState: { contains: q, mode: 'insensitive' } },
    ];
  }

  let orderBy = [{ lastName: 'asc' }, { firstName: 'asc' }];
  if (sort === 'convicted_asc') orderBy = [{ convictionYear: 'asc' }, { lastName: 'asc' }];
  else if (sort === 'convicted_desc') orderBy = [{ convictionYear: 'desc' }, { lastName: 'asc' }];
  else if (sort === 'exonerated_desc') orderBy = [{ exonerationOrReleaseYear: 'desc' }, { lastName: 'asc' }];
  else if (sort === 'name_asc') orderBy = [{ lastName: 'asc' }, { firstName: 'asc' }];

  try {
    const [totalCount, rows, statesRaw] = await Promise.all([
      prisma.individual.count({ where }),
      prisma.individual.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          middleName: true,
          lastName: true,
          suffix: true,
          convictionYear: true,
          exonerationOrReleaseYear: true,
          timeServed: true,
          caseLocationState: true,
          isPublished: true,
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.individual.findMany({
        where: {
          mediaItemAppearances: { none: {} },
          newsArticles: { none: {} },
          caseLocationState: { not: null },
        },
        distinct: ['caseLocationState'],
        select: { caseLocationState: true },
        orderBy: { caseLocationState: 'asc' },
      }),
    ]);

    const items = rows.map((r) => {
      const yearsCalculated =
        r.convictionYear && r.exonerationOrReleaseYear && r.exonerationOrReleaseYear >= r.convictionYear
          ? r.exonerationOrReleaseYear - r.convictionYear
          : null;
      return {
        id: r.id,
        fullName: [r.firstName, r.middleName, r.lastName, r.suffix].filter(Boolean).join(' '),
        caseLocationState: r.caseLocationState,
        convictionYear: r.convictionYear,
        exonerationOrReleaseYear: r.exonerationOrReleaseYear,
        timeServed: r.timeServed || (yearsCalculated !== null ? `${yearsCalculated} yrs` : null),
        isPublished: r.isPublished,
      };
    });

    res.json({
      totalCount,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(totalCount / limit)),
      availableStates: statesRaw.map((s) => s.caseLocationState).filter(Boolean),
      items,
    });
  } catch (error) {
    console.error('Error fetching untold stories:', error);
    res.status(500).json({ message: 'Failed to load Stories Yet to Be Told.', error: error.message });
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
        },
        newsArticles: {
            where: { status: 'PUBLISHED' },
            orderBy: [
                { publishedAt: { sort: 'desc', nulls: 'last' } },
                { createdAt: 'desc' }
            ],
            select: {
                id: true,
                headline: true,
                url: true,
                summary: true,
                publishedAt: true,
                category: true,
                actionUrl: true,
                actionLabel: true,
                sourceName: true,
                source: { select: { id: true, name: true, websiteUrl: true } }
            }
        }
      }
    });

    if (singleIndividual && singleIndividual.isPublished) {
      console.log(`Found published individual with ID: ${idInt} including related data (with headlines).`);
      res.json(singleIndividual);
    } else {
      console.log(`Individual with ID: ${idInt} not found or unpublished.`);
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
