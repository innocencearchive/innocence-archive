// server/routes/admin.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, authorizeRole } = require('../middleware/authenticateToken');

const router = express.Router();
const prisma = new PrismaClient();

// All /api/admin/* routes require authenticated ADMIN or EDITOR
router.use(authenticateToken, authorizeRole(['ADMIN', 'EDITOR']));

// --- Shared Helpers ---

function parseId(raw) {
  const id = parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseIntOrNull(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? null : n;
}

function parseDateOrNull(val) {
  if (!val) return null;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
}

function relationSet(ids) {
  if (!Array.isArray(ids)) return undefined;
  const clean = ids.map((id) => parseInt(id, 10)).filter((n) => Number.isInteger(n) && n > 0);
  return { set: clean.map((id) => ({ id })) };
}

function relationConnect(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return undefined;
  const clean = ids.map((id) => parseInt(id, 10)).filter((n) => Number.isInteger(n) && n > 0);
  return clean.length > 0 ? { connect: clean.map((id) => ({ id })) } : undefined;
}

function handlePrismaError(res, error, label) {
  console.error(`Admin API error (${label}):`, error);
  if (error.code === 'P2002') {
    return res.status(409).json({
      message: `${label} already exists with conflicting unique field(s).`,
      meta: error.meta,
    });
  }
  if (error.code === 'P2025') {
    return res.status(404).json({ message: `${label} not found.` });
  }
  if (error.code === 'P2003') {
    return res.status(400).json({ message: `Invalid related record reference for ${label}.` });
  }
  return res.status(500).json({ message: `Failed to process ${label}.`, error: error.message });
}

// --- GET /api/admin/stats ---
// Summary counts (total & unverified/aiGenerated) for the Admin Dashboard
router.get('/stats', async (req, res) => {
  try {
    const [
      individualsTotal,
      individualsUnverified,
      mediaWorksTotal,
      mediaWorksUnverified,
      mediaItemsTotal,
      mediaItemsUnverified,
      organizationsTotal,
      organizationsUnverified,
      factorsTotal,
      factorsUnverified,
      personsTotal,
      personsUnverified,
      crimeCategoriesTotal,
      groupsTotal,
    ] = await Promise.all([
      prisma.individual.count(),
      prisma.individual.count({ where: { aiGenerated: true } }),
      prisma.mediaWork.count(),
      prisma.mediaWork.count({ where: { aiGenerated: true } }),
      prisma.mediaItem.count(),
      prisma.mediaItem.count({ where: { aiGenerated: true } }),
      prisma.organization.count(),
      prisma.organization.count({ where: { aiGenerated: true } }),
      prisma.contributingFactor.count(),
      prisma.contributingFactor.count({ where: { aiGenerated: true } }),
      prisma.involvedPerson.count(),
      prisma.involvedPerson.count({ where: { aiGenerated: true } }),
      prisma.crimeCategory.count(),
      prisma.individualGroup.count(),
    ]);

    res.json({
      individuals: { total: individualsTotal, unverified: individualsUnverified },
      mediaWorks: { total: mediaWorksTotal, unverified: mediaWorksUnverified },
      mediaItems: { total: mediaItemsTotal, unverified: mediaItemsUnverified },
      organizations: { total: organizationsTotal, unverified: organizationsUnverified },
      contributingFactors: { total: factorsTotal, unverified: factorsUnverified },
      involvedPersons: { total: personsTotal, unverified: personsUnverified },
      crimeCategories: { total: crimeCategoriesTotal },
      individualGroups: { total: groupsTotal },
    });
  } catch (error) {
    handlePrismaError(res, error, 'stats');
  }
});

// --- PATCH /api/admin/verify/:resource/:id ---
// Marks a record as verified (aiGenerated: false) or unverified (aiGenerated: true)
const VERIFIABLE_MODELS = {
  individuals: prisma.individual,
  mediaworks: prisma.mediaWork,
  mediaitems: prisma.mediaItem,
  organizations: prisma.organization,
  contributingfactors: prisma.contributingFactor,
  involvedpersons: prisma.involvedPerson,
};

router.patch('/verify/:resource/:id', async (req, res) => {
  const model = VERIFIABLE_MODELS[req.params.resource];
  if (!model) {
    return res.status(400).json({ message: `Unsupported resource '${req.params.resource}'.` });
  }
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid ID.' });

  const verified = req.body.verified !== undefined ? Boolean(req.body.verified) : true;
  try {
    const updated = await model.update({
      where: { id },
      data: { aiGenerated: !verified },
    });
    res.json(updated);
  } catch (error) {
    handlePrismaError(res, error, req.params.resource);
  }
});

// --- Individuals ---

router.get('/individuals', async (req, res) => {
  const { search, unverifiedOnly } = req.query;
  const where = {};
  if (unverifiedOnly === 'true') where.aiGenerated = true;
  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
      { nickname: { contains: q, mode: 'insensitive' } },
      { caseLocationState: { contains: q, mode: 'insensitive' } },
    ];
  }
  try {
    const rows = await prisma.individual.findMany({
      where,
      include: { crimeCategory: true },
      orderBy: [{ updatedAt: 'desc' }],
    });
    res.json(rows);
  } catch (error) {
    handlePrismaError(res, error, 'Individual');
  }
});

function buildIndividualData(body, isCreate) {
  const relWrap = isCreate ? relationConnect : relationSet;
  const data = {
    firstName: body.firstName?.trim(),
    middleName: body.middleName?.trim() || null,
    lastName: body.lastName?.trim(),
    suffix: body.suffix?.trim() || null,
    nickname: body.nickname?.trim() || null,
    disambiguationTag: body.disambiguationTag?.trim() || null,
    status: body.status || null,
    crimeDate: parseDateOrNull(body.crimeDate),
    convictionYear: parseIntOrNull(body.convictionYear),
    exonerationOrReleaseYear: parseIntOrNull(body.exonerationOrReleaseYear),
    timeServed: body.timeServed?.trim() || null,
    sentence: body.sentence?.trim() || null,
    caseLocationCity: body.caseLocationCity?.trim() || null,
    caseLocationCounty: body.caseLocationCounty?.trim() || null,
    caseLocationState: body.caseLocationState?.trim() || null,
    caseLocationCountry: body.caseLocationCountry?.trim() || 'USA',
    narrativeSummary: body.narrativeSummary || null,
    aiGenerated: body.aiGenerated !== undefined ? Boolean(body.aiGenerated) : false,
    crimeCategoryId: parseIntOrNull(body.crimeCategoryId),
  };

  const factorsRel = relWrap(body.contributingFactorIds);
  if (factorsRel) data.contributingFactors = factorsRel;

  const orgsRel = relWrap(body.organizationIds);
  if (orgsRel) data.organizationsInvolved = orgsRel;

  const personsRel = relWrap(body.involvedPersonIds);
  if (personsRel) data.involvedPersons = personsRel;

  const groupsRel = relWrap(body.groupIds);
  if (groupsRel) data.groups = groupsRel;

  const mediaRel = relWrap(body.mediaItemIds);
  if (mediaRel) data.mediaItemAppearances = mediaRel;

  return data;
}

router.post('/individuals', async (req, res) => {
  if (!req.body.firstName?.trim() || !req.body.lastName?.trim()) {
    return res.status(400).json({ message: 'firstName and lastName are required.' });
  }
  try {
    const created = await prisma.individual.create({
      data: buildIndividualData(req.body, true),
      include: {
        crimeCategory: true,
        contributingFactors: true,
        organizationsInvolved: true,
        involvedPersons: true,
        groups: true,
      },
    });
    res.status(201).json(created);
  } catch (error) {
    handlePrismaError(res, error, 'Individual');
  }
});

router.put('/individuals/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid Individual ID.' });
  if (!req.body.firstName?.trim() || !req.body.lastName?.trim()) {
    return res.status(400).json({ message: 'firstName and lastName are required.' });
  }
  try {
    const updated = await prisma.individual.update({
      where: { id },
      data: buildIndividualData(req.body, false),
      include: {
        crimeCategory: true,
        contributingFactors: true,
        organizationsInvolved: true,
        involvedPersons: true,
        groups: true,
      },
    });
    res.json(updated);
  } catch (error) {
    handlePrismaError(res, error, 'Individual');
  }
});

router.delete('/individuals/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid Individual ID.' });
  try {
    await prisma.individual.delete({ where: { id } });
    res.json({ message: 'Individual deleted.', id });
  } catch (error) {
    handlePrismaError(res, error, 'Individual');
  }
});

// --- MediaWorks ---

router.get('/mediaworks', async (req, res) => {
  const { search, workType, unverifiedOnly } = req.query;
  const where = {};
  if (workType) where.workType = workType;
  if (unverifiedOnly === 'true') where.aiGenerated = true;
  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { creatorName: { contains: q, mode: 'insensitive' } },
      { publisherOrNetwork: { contains: q, mode: 'insensitive' } },
    ];
  }
  try {
    const rows = await prisma.mediaWork.findMany({
      where,
      include: { _count: { select: { items: true } } },
      orderBy: [{ updatedAt: 'desc' }],
    });
    res.json(rows);
  } catch (error) {
    handlePrismaError(res, error, 'MediaWork');
  }
});

function buildMediaWorkData(body) {
  return {
    title: body.title?.trim(),
    workType: body.workType || 'OTHER',
    creatorName: body.creatorName?.trim() || null,
    publicationOrReleaseYear: parseIntOrNull(body.publicationOrReleaseYear),
    publisherOrNetwork: body.publisherOrNetwork?.trim() || null,
    focusOrTheme: body.focusOrTheme || null,
    summaryNotes: body.summaryNotes || null,
    availabilityNotes: body.availabilityNotes || null,
    sourceUrl: body.sourceUrl?.trim() || null,
    externalId: body.externalId?.trim() || null,
    imagePath: body.imagePath?.trim() || null,
    SourcingCredit: body.SourcingCredit?.trim() || null,
    aiGenerated: body.aiGenerated !== undefined ? Boolean(body.aiGenerated) : false,
  };
}

router.post('/mediaworks', async (req, res) => {
  if (!req.body.title?.trim() || !req.body.workType) {
    return res.status(400).json({ message: 'title and workType are required.' });
  }
  try {
    const created = await prisma.mediaWork.create({
      data: buildMediaWorkData(req.body),
    });
    res.status(201).json(created);
  } catch (error) {
    handlePrismaError(res, error, 'MediaWork');
  }
});

router.put('/mediaworks/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid MediaWork ID.' });
  if (!req.body.title?.trim() || !req.body.workType) {
    return res.status(400).json({ message: 'title and workType are required.' });
  }
  try {
    const updated = await prisma.mediaWork.update({
      where: { id },
      data: buildMediaWorkData(req.body),
    });
    res.json(updated);
  } catch (error) {
    handlePrismaError(res, error, 'MediaWork');
  }
});

router.delete('/mediaworks/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid MediaWork ID.' });
  try {
    await prisma.mediaWork.delete({ where: { id } });
    res.json({ message: 'MediaWork deleted.', id });
  } catch (error) {
    handlePrismaError(res, error, 'MediaWork');
  }
});

// --- MediaItems ---

router.get('/mediaitems', async (req, res) => {
  const { search, workId, unverifiedOnly } = req.query;
  const where = {};
  if (workId) {
    const wId = parseId(workId);
    if (wId) where.workId = wId;
  }
  if (unverifiedOnly === 'true') where.aiGenerated = true;
  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { itemTitle: { contains: q, mode: 'insensitive' } },
      { hostOrNarrator: { contains: q, mode: 'insensitive' } },
    ];
  }
  try {
    const rows = await prisma.mediaItem.findMany({
      where,
      include: { work: { select: { id: true, title: true, workType: true } } },
      orderBy: [{ updatedAt: 'desc' }],
    });
    res.json(rows);
  } catch (error) {
    handlePrismaError(res, error, 'MediaItem');
  }
});

function buildMediaItemData(body, isCreate) {
  const relWrap = isCreate ? relationConnect : relationSet;
  const data = {
    workId: parseInt(body.workId, 10),
    itemTitle: body.itemTitle?.trim() || null,
    itemNumber: body.itemNumber?.trim() || null,
    itemMediaType: body.itemMediaType || 'OTHER',
    releaseDate: parseDateOrNull(body.releaseDate),
    hostOrNarrator: body.hostOrNarrator?.trim() || null,
    focusOrTheme: body.focusOrTheme || null,
    summaryNotes: body.summaryNotes || null,
    keyQuotes: body.keyQuotes || null,
    sourceUrl: body.sourceUrl?.trim() || null,
    aiGenerated: body.aiGenerated !== undefined ? Boolean(body.aiGenerated) : false,
  };

  const indRel = relWrap(body.individualIds);
  if (indRel) data.individualsFeatured = indRel;

  const personRel = relWrap(body.involvedPersonIds);
  if (personRel) data.involvedPersonsMentioned = personRel;

  const orgRel = relWrap(body.organizationIds);
  if (orgRel) data.organizationsMentioned = orgRel;

  const factorRel = relWrap(body.contributingFactorIds);
  if (factorRel) data.contributingFactorsMentioned = factorRel;

  return data;
}

router.post('/mediaitems', async (req, res) => {
  if (!parseId(req.body.workId) || !req.body.itemMediaType) {
    return res.status(400).json({ message: 'Valid workId and itemMediaType are required.' });
  }
  try {
    const created = await prisma.mediaItem.create({
      data: buildMediaItemData(req.body, true),
      include: { work: true },
    });
    res.status(201).json(created);
  } catch (error) {
    handlePrismaError(res, error, 'MediaItem');
  }
});

router.put('/mediaitems/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid MediaItem ID.' });
  if (!parseId(req.body.workId) || !req.body.itemMediaType) {
    return res.status(400).json({ message: 'Valid workId and itemMediaType are required.' });
  }
  try {
    const updated = await prisma.mediaItem.update({
      where: { id },
      data: buildMediaItemData(req.body, false),
      include: { work: true },
    });
    res.json(updated);
  } catch (error) {
    handlePrismaError(res, error, 'MediaItem');
  }
});

router.delete('/mediaitems/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid MediaItem ID.' });
  try {
    await prisma.mediaItem.delete({ where: { id } });
    res.json({ message: 'MediaItem deleted.', id });
  } catch (error) {
    handlePrismaError(res, error, 'MediaItem');
  }
});

// --- Organizations ---

router.get('/organizations', async (req, res) => {
  const { search, unverifiedOnly } = req.query;
  const where = {};
  if (unverifiedOnly === 'true') where.aiGenerated = true;
  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { locationState: { contains: q, mode: 'insensitive' } },
    ];
  }
  try {
    const rows = await prisma.organization.findMany({
      where,
      orderBy: [{ name: 'asc' }],
    });
    res.json(rows);
  } catch (error) {
    handlePrismaError(res, error, 'Organization');
  }
});

function buildOrganizationData(body) {
  return {
    name: body.name?.trim(),
    type: body.type || null,
    locationCity: body.locationCity?.trim() || null,
    locationState: body.locationState?.trim() || null,
    locationCountry: body.locationCountry?.trim() || 'USA',
    website: body.website?.trim() || null,
    notes: body.notes || null,
    aiGenerated: body.aiGenerated !== undefined ? Boolean(body.aiGenerated) : false,
  };
}

router.post('/organizations', async (req, res) => {
  if (!req.body.name?.trim()) {
    return res.status(400).json({ message: 'Organization name is required.' });
  }
  try {
    const created = await prisma.organization.create({
      data: buildOrganizationData(req.body),
    });
    res.status(201).json(created);
  } catch (error) {
    handlePrismaError(res, error, 'Organization');
  }
});

router.put('/organizations/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid Organization ID.' });
  if (!req.body.name?.trim()) {
    return res.status(400).json({ message: 'Organization name is required.' });
  }
  try {
    const updated = await prisma.organization.update({
      where: { id },
      data: buildOrganizationData(req.body),
    });
    res.json(updated);
  } catch (error) {
    handlePrismaError(res, error, 'Organization');
  }
});

router.delete('/organizations/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid Organization ID.' });
  try {
    await prisma.organization.delete({ where: { id } });
    res.json({ message: 'Organization deleted.', id });
  } catch (error) {
    handlePrismaError(res, error, 'Organization');
  }
});

// --- InvolvedPersons (OIPs) ---

router.get('/involvedpersons', async (req, res) => {
  const { search, unverifiedOnly } = req.query;
  const where = {};
  if (unverifiedOnly === 'true') where.aiGenerated = true;
  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
      { nickname: { contains: q, mode: 'insensitive' } },
    ];
  }
  try {
    const rows = await prisma.involvedPerson.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    res.json(rows);
  } catch (error) {
    handlePrismaError(res, error, 'InvolvedPerson');
  }
});

function buildInvolvedPersonData(body) {
  return {
    firstName: body.firstName?.trim(),
    middleName: body.middleName?.trim() || null,
    lastName: body.lastName?.trim(),
    suffix: body.suffix?.trim() || null,
    nickname: body.nickname?.trim() || null,
    role: body.role || null,
    notes: body.notes || null,
    aiGenerated: body.aiGenerated !== undefined ? Boolean(body.aiGenerated) : false,
  };
}

router.post('/involvedpersons', async (req, res) => {
  if (!req.body.firstName?.trim() || !req.body.lastName?.trim()) {
    return res.status(400).json({ message: 'firstName and lastName are required.' });
  }
  try {
    const created = await prisma.involvedPerson.create({
      data: buildInvolvedPersonData(req.body),
    });
    res.status(201).json(created);
  } catch (error) {
    handlePrismaError(res, error, 'InvolvedPerson');
  }
});

router.put('/involvedpersons/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid InvolvedPerson ID.' });
  if (!req.body.firstName?.trim() || !req.body.lastName?.trim()) {
    return res.status(400).json({ message: 'firstName and lastName are required.' });
  }
  try {
    const updated = await prisma.involvedPerson.update({
      where: { id },
      data: buildInvolvedPersonData(req.body),
    });
    res.json(updated);
  } catch (error) {
    handlePrismaError(res, error, 'InvolvedPerson');
  }
});

router.delete('/involvedpersons/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid InvolvedPerson ID.' });
  try {
    await prisma.involvedPerson.delete({ where: { id } });
    res.json({ message: 'InvolvedPerson deleted.', id });
  } catch (error) {
    handlePrismaError(res, error, 'InvolvedPerson');
  }
});

// --- ContributingFactors ---

router.get('/contributingfactors', async (req, res) => {
  const { unverifiedOnly } = req.query;
  const where = unverifiedOnly === 'true' ? { aiGenerated: true } : {};
  try {
    const rows = await prisma.contributingFactor.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    res.json(rows);
  } catch (error) {
    handlePrismaError(res, error, 'ContributingFactor');
  }
});

router.post('/contributingfactors', async (req, res) => {
  if (!req.body.name?.trim()) {
    return res.status(400).json({ message: 'name is required.' });
  }
  try {
    const created = await prisma.contributingFactor.create({
      data: {
        name: req.body.name.trim(),
        description: req.body.description || null,
        aiGenerated: req.body.aiGenerated !== undefined ? Boolean(req.body.aiGenerated) : false,
      },
    });
    res.status(201).json(created);
  } catch (error) {
    handlePrismaError(res, error, 'ContributingFactor');
  }
});

router.put('/contributingfactors/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid ContributingFactor ID.' });
  if (!req.body.name?.trim()) {
    return res.status(400).json({ message: 'name is required.' });
  }
  try {
    const updated = await prisma.contributingFactor.update({
      where: { id },
      data: {
        name: req.body.name.trim(),
        description: req.body.description || null,
        aiGenerated: req.body.aiGenerated !== undefined ? Boolean(req.body.aiGenerated) : false,
      },
    });
    res.json(updated);
  } catch (error) {
    handlePrismaError(res, error, 'ContributingFactor');
  }
});

router.delete('/contributingfactors/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid ContributingFactor ID.' });
  try {
    await prisma.contributingFactor.delete({ where: { id } });
    res.json({ message: 'ContributingFactor deleted.', id });
  } catch (error) {
    handlePrismaError(res, error, 'ContributingFactor');
  }
});

// --- CrimeCategories ---

router.get('/crimecategories', async (req, res) => {
  try {
    const rows = await prisma.crimeCategory.findMany({ orderBy: { crime_name: 'asc' } });
    res.json(rows);
  } catch (error) {
    handlePrismaError(res, error, 'CrimeCategory');
  }
});

router.post('/crimecategories', async (req, res) => {
  if (!req.body.crime_name?.trim()) {
    return res.status(400).json({ message: 'crime_name is required.' });
  }
  try {
    const created = await prisma.crimeCategory.create({
      data: {
        crime_name: req.body.crime_name.trim(),
        severity_order: parseIntOrNull(req.body.severity_order),
      },
    });
    res.status(201).json(created);
  } catch (error) {
    handlePrismaError(res, error, 'CrimeCategory');
  }
});

router.put('/crimecategories/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid CrimeCategory ID.' });
  if (!req.body.crime_name?.trim()) {
    return res.status(400).json({ message: 'crime_name is required.' });
  }
  try {
    const updated = await prisma.crimeCategory.update({
      where: { id },
      data: {
        crime_name: req.body.crime_name.trim(),
        severity_order: parseIntOrNull(req.body.severity_order),
      },
    });
    res.json(updated);
  } catch (error) {
    handlePrismaError(res, error, 'CrimeCategory');
  }
});

router.delete('/crimecategories/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid CrimeCategory ID.' });
  try {
    await prisma.crimeCategory.delete({ where: { id } });
    res.json({ message: 'CrimeCategory deleted.', id });
  } catch (error) {
    handlePrismaError(res, error, 'CrimeCategory');
  }
});

// --- IndividualGroups ---

router.get('/individualgroups', async (req, res) => {
  try {
    const rows = await prisma.individualGroup.findMany({
      include: { _count: { select: { members: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(rows);
  } catch (error) {
    handlePrismaError(res, error, 'IndividualGroup');
  }
});

router.post('/individualgroups', async (req, res) => {
  if (!req.body.name?.trim()) {
    return res.status(400).json({ message: 'name is required.' });
  }
  try {
    const created = await prisma.individualGroup.create({
      data: {
        name: req.body.name.trim(),
        description: req.body.description || null,
        members: relationConnect(req.body.memberIds),
      },
    });
    res.status(201).json(created);
  } catch (error) {
    handlePrismaError(res, error, 'IndividualGroup');
  }
});

router.put('/individualgroups/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid IndividualGroup ID.' });
  if (!req.body.name?.trim()) {
    return res.status(400).json({ message: 'name is required.' });
  }
  try {
    const updated = await prisma.individualGroup.update({
      where: { id },
      data: {
        name: req.body.name.trim(),
        description: req.body.description || null,
        members: relationSet(req.body.memberIds),
      },
    });
    res.json(updated);
  } catch (error) {
    handlePrismaError(res, error, 'IndividualGroup');
  }
});

router.delete('/individualgroups/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid IndividualGroup ID.' });
  try {
    await prisma.individualGroup.delete({ where: { id } });
    res.json({ message: 'IndividualGroup deleted.', id });
  } catch (error) {
    handlePrismaError(res, error, 'IndividualGroup');
  }
});

module.exports = router;
