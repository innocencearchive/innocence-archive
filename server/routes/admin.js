// server/routes/admin.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, authorizeRole } = require('../middleware/authenticateToken');

const router = express.Router();
const prisma = new PrismaClient();

// Allow automated ingest key on /podcast-ingest*, or require JWT ADMIN/EDITOR for all /api/admin/* routes
router.use((req, res, next) => {
  const ingestKey = process.env.PODCAST_INGEST_KEY;
  if (
    (req.path === '/podcast-ingest' || req.path === '/podcast-ingest/processed') &&
    ingestKey &&
    req.headers['x-ingest-key'] === ingestKey
  ) {
    req.user = { role: 'ADMIN', email: 'podcast-pipeline' };
    return next();
  }
  return authenticateToken(req, res, () => authorizeRole(['ADMIN', 'EDITOR'])(req, res, next));
});

// --- Standard 16-item ContributingFactorCode Enum Map ---
const CONTRIBUTING_FACTOR_LABELS = {
  FALSE_CONFESSION: 'False Confession',
  OFFICIAL_MISCONDUCT: 'Official Misconduct',
  POLICE_MISCONDUCT: 'Police Misconduct',
  PROSECUTORIAL_MISCONDUCT: 'Prosecutorial Misconduct',
  WITHHELD_EXCULPATORY_EVIDENCE: 'Withheld Exculpatory Evidence (Brady Violation)',
  MISTAKEN_EYEWITNESS_IDENTIFICATION: 'Mistaken Eyewitness Identification',
  PERJURY_OR_FALSE_ACCUSATION: 'Perjury or False Accusation',
  FALSE_OR_MISLEADING_FORENSIC_EVIDENCE: 'False or Misleading Forensic Evidence',
  INADEQUATE_LEGAL_DEFENSE: 'Inadequate Legal Defense',
  JAILHOUSE_INFORMANT: 'Jailhouse Informant',
  TUNNEL_VISION_RUSH_TO_JUDGMENT: 'Tunnel Vision / Rush to Judgment',
  RACIAL_BIAS: 'Racial Bias',
  PREJUDICIAL_JOINDER_JOINT_TRIAL: 'Prejudicial Joinder / Joint Trial',
  MEDIA_SENSATIONALISM: 'Media Sensationalism',
  COERCED_PLEA: 'Coerced Plea',
  UNRELIABLE_WITNESS: 'Unreliable Witness',
};

const CONTRIBUTING_FACTOR_NAME_TO_CODE = Object.fromEntries(
  Object.entries(CONTRIBUTING_FACTOR_LABELS).map(([code, label]) => [label.toLowerCase(), code])
);

function resolveContributingFactorCode(raw) {
  if (!raw) return null;
  const val = (typeof raw === 'string' ? raw : raw?.code || raw?.name || '').trim();
  if (!val) return null;
  const upper = val.toUpperCase();
  if (CONTRIBUTING_FACTOR_LABELS[upper]) return upper;
  return CONTRIBUTING_FACTOR_NAME_TO_CODE[val.toLowerCase()] || null;
}

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

function buildVerificationFields(body, userId) {
  const status = body.verificationStatus || (body.aiGenerated === false ? 'VERIFIED' : 'UNVERIFIED');
  const fields = {
    aiGenerated: body.aiGenerated !== undefined ? Boolean(body.aiGenerated) : false,
    verificationStatus: status,
    verificationNotes: body.verificationNotes?.trim() || null,
    ingestionSource: body.ingestionSource?.trim() || null,
    importBatchId: body.importBatchId?.trim() || null,
  };
  if (status === 'VERIFIED') {
    fields.verifiedAt = new Date();
    if (userId) fields.verifiedById = userId;
  } else {
    fields.verifiedAt = null;
    fields.verifiedById = null;
  }
  return fields;
}

// --- GET /api/admin/stats ---
// Summary counts (total & unverified) for the Admin Dashboard
router.get('/stats', async (req, res) => {
  const unverifiedFilter = { where: { verificationStatus: { not: 'VERIFIED' } } };
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
      informationSourcesTotal,
    ] = await Promise.all([
      prisma.individual.count(),
      prisma.individual.count(unverifiedFilter),
      prisma.mediaWork.count(),
      prisma.mediaWork.count(unverifiedFilter),
      prisma.mediaItem.count(),
      prisma.mediaItem.count(unverifiedFilter),
      prisma.organization.count(),
      prisma.organization.count(unverifiedFilter),
      prisma.contributingFactor.count(),
      prisma.contributingFactor.count(unverifiedFilter),
      prisma.involvedPerson.count(),
      prisma.involvedPerson.count(unverifiedFilter),
      prisma.crimeCategory.count(),
      prisma.individualGroup.count(),
      prisma.informationSource.count(),
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
      informationSources: { total: informationSourcesTotal },
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
  const nextStatus = req.body.verificationStatus || (verified ? 'VERIFIED' : 'UNVERIFIED');
  const isVerified = nextStatus === 'VERIFIED';

  try {
    const updated = await model.update({
      where: { id },
      data: {
        verificationStatus: nextStatus,
        verifiedAt: isVerified ? new Date() : null,
        verifiedById: isVerified ? (req.user?.userId || null) : null,
        ...(req.body.verificationNotes !== undefined ? { verificationNotes: req.body.verificationNotes } : {}),
      },
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
  if (unverifiedOnly === 'true') where.verificationStatus = { not: 'VERIFIED' };
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
      include: {
        crimeCategory: true,
        contributingFactors: { select: { id: true } },
        organizationsInvolved: { select: { id: true } },
        groups: { select: { id: true } },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });
    const shaped = rows.map((r) => ({
      ...r,
      contributingFactorIds: r.contributingFactors.map((f) => f.id),
      organizationIds: r.organizationsInvolved.map((o) => o.id),
      groupIds: r.groups.map((g) => g.id),
    }));
    res.json(shaped);
  } catch (error) {
    handlePrismaError(res, error, 'Individual');
  }
});

function buildIndividualData(body, isCreate, userId) {
  const relWrap = isCreate ? relationConnect : relationSet;
  const data = {
    firstName: body.firstName?.trim(),
    middleName: body.middleName?.trim() || null,
    lastName: body.lastName?.trim(),
    suffix: body.suffix?.trim() || null,
    nickname: body.nickname?.trim() || null,
    disambiguationTag: body.disambiguationTag?.trim() || null,
    canonicalKey: body.canonicalKey?.trim() || null,
    status: body.status || null,
    claimStrength: body.claimStrength || 'UNASSESSED',
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
    crimeCategoryId: parseIntOrNull(body.crimeCategoryId),
    ...(body.nreOnly !== undefined ? { nreOnly: Boolean(body.nreOnly) } : {}),
    ...(body.isPublished !== undefined ? { isPublished: Boolean(body.isPublished) } : {}),
    ...buildVerificationFields(body, userId),
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
      data: buildIndividualData(req.body, true, req.user?.userId),
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
      data: buildIndividualData(req.body, false, req.user?.userId),
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
  if (unverifiedOnly === 'true') where.verificationStatus = { not: 'VERIFIED' };
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

function buildMediaWorkData(body, userId) {
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
    sourcingCredit: body.sourcingCredit?.trim() || null,
    ...buildVerificationFields(body, userId),
  };
}

const VALID_STREAMING_TYPES = new Set(['SUBSCRIPTION', 'RENT', 'BUY', 'FREE', 'OTHER', 'UNKNOWN']);

function mapStreamingType(raw) {
  if (!raw) return 'UNKNOWN';
  const upper = String(raw).trim().toUpperCase();
  if (VALID_STREAMING_TYPES.has(upper)) return upper;
  if (upper === 'FLATRATE' || upper === 'SUB') return 'SUBSCRIPTION';
  if (upper === 'ADS' || upper === 'AVOD') return 'FREE';
  return 'OTHER';
}

function normalizeStreamingProviders(rawList) {
  if (!Array.isArray(rawList)) return [];
  const dedup = new Map();
  const now = new Date();
  for (const p of rawList) {
    const providerName = (p.providerName || p.provider_name || p.name || '').trim();
    if (!providerName) continue;
    const streamingType = mapStreamingType(p.streamingType || p.type);
    const presentationQuality = (p.presentationQuality || p.format || 'HD').trim();
    const key = `${providerName}|${streamingType}|${presentationQuality}`;
    if (!dedup.has(key)) {
      dedup.set(key, {
        providerName,
        watchmodeProviderId: parseIntOrNull(p.watchmodeProviderId || p.source_id),
        streamingType,
        url: (p.url || p.web_url || '').trim() || null,
        priceCurrency: (p.priceCurrency || p.currency || '').trim() || null,
        priceAmount:
          p.priceAmount !== undefined && p.priceAmount !== null && p.priceAmount !== ''
            ? parseFloat(p.priceAmount)
            : p.price !== undefined && p.price !== null && p.price !== ''
              ? parseFloat(p.price)
              : null,
        presentationQuality,
        lastChecked: now,
      });
    }
  }
  return Array.from(dedup.values());
}

router.get('/mediaworks/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid MediaWork ID.' });
  try {
    const work = await prisma.mediaWork.findUnique({
      where: { id },
      include: {
        streamingProviders: true,
        bookPurchaseDetails: true,
        _count: { select: { items: true } },
      },
    });
    if (!work) return res.status(404).json({ message: 'MediaWork not found.' });
    res.json(work);
  } catch (error) {
    handlePrismaError(res, error, 'MediaWork');
  }
});

router.post('/mediaworks', async (req, res) => {
  if (!req.body.title?.trim() || !req.body.workType) {
    return res.status(400).json({ message: 'title and workType are required.' });
  }
  try {
    const providers = normalizeStreamingProviders(
      req.body.streamingProviders || req.body.streaming_providers
    );
    const created = await prisma.mediaWork.create({
      data: {
        ...buildMediaWorkData(req.body, req.user?.userId),
        ...(providers.length > 0 ? { streamingProviders: { create: providers } } : {}),
      },
      include: { streamingProviders: true },
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
    const rawProviders = req.body.streamingProviders ?? req.body.streaming_providers;
    const providers = Array.isArray(rawProviders) ? normalizeStreamingProviders(rawProviders) : null;

    const updated = await prisma.mediaWork.update({
      where: { id },
      data: {
        ...buildMediaWorkData(req.body, req.user?.userId),
        ...(providers !== null
          ? {
              streamingProviders: {
                deleteMany: {},
                ...(providers.length > 0 ? { create: providers } : {}),
              },
            }
          : {}),
      },
      include: { streamingProviders: true },
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
  if (unverifiedOnly === 'true') where.verificationStatus = { not: 'VERIFIED' };
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
      include: {
        work: { select: { id: true, title: true, workType: true } },
        individualsFeatured: { select: { id: true } },
        organizationsMentioned: { select: { id: true } },
        contributingFactorsMentioned: { select: { id: true } },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });
    const shaped = rows.map((r) => ({
      ...r,
      individualIds: r.individualsFeatured.map((i) => i.id),
      organizationIds: r.organizationsMentioned.map((o) => o.id),
      contributingFactorIds: r.contributingFactorsMentioned.map((f) => f.id),
    }));
    res.json(shaped);
  } catch (error) {
    handlePrismaError(res, error, 'MediaItem');
  }
});

function buildMediaItemData(body, isCreate, userId) {
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
    transcript: body.transcript || null,
    durationSeconds: parseIntOrNull(body.durationSeconds),
    sourceUrl: body.sourceUrl?.trim() || null,
    canonicalKey: body.canonicalKey?.trim() || null,
    ...buildVerificationFields(body, userId),
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
      data: buildMediaItemData(req.body, true, req.user?.userId),
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
      data: buildMediaItemData(req.body, false, req.user?.userId),
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
  if (unverifiedOnly === 'true') where.verificationStatus = { not: 'VERIFIED' };
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

function buildOrganizationData(body, userId) {
  return {
    name: body.name?.trim(),
    type: body.type || null,
    locationCity: body.locationCity?.trim() || null,
    locationState: body.locationState?.trim() || null,
    locationCountry: body.locationCountry?.trim() || 'USA',
    website: body.website?.trim() || null,
    notes: body.notes || null,
    ...buildVerificationFields(body, userId),
  };
}

router.post('/organizations', async (req, res) => {
  if (!req.body.name?.trim()) {
    return res.status(400).json({ message: 'Organization name is required.' });
  }
  try {
    const created = await prisma.organization.create({
      data: buildOrganizationData(req.body, req.user?.userId),
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
      data: buildOrganizationData(req.body, req.user?.userId),
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
  if (unverifiedOnly === 'true') where.verificationStatus = { not: 'VERIFIED' };
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

function buildInvolvedPersonData(body, userId) {
  return {
    firstName: body.firstName?.trim(),
    middleName: body.middleName?.trim() || null,
    lastName: body.lastName?.trim(),
    suffix: body.suffix?.trim() || null,
    nickname: body.nickname?.trim() || null,
    canonicalKey: body.canonicalKey?.trim() || null,
    role: body.role || null,
    notes: body.notes || null,
    ...buildVerificationFields(body, userId),
  };
}

router.post('/involvedpersons', async (req, res) => {
  if (!req.body.firstName?.trim() || !req.body.lastName?.trim()) {
    return res.status(400).json({ message: 'firstName and lastName are required.' });
  }
  try {
    const created = await prisma.involvedPerson.create({
      data: buildInvolvedPersonData(req.body, req.user?.userId),
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
      data: buildInvolvedPersonData(req.body, req.user?.userId),
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
  const where = unverifiedOnly === 'true' ? { verificationStatus: { not: 'VERIFIED' } } : {};
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
  const code = resolveContributingFactorCode(req.body.code || req.body.name);
  if (!code) {
    return res.status(400).json({
      message: 'Valid ContributingFactorCode enum value is required.',
      allowedCodes: Object.keys(CONTRIBUTING_FACTOR_LABELS),
    });
  }
  const name = req.body.name?.trim() || CONTRIBUTING_FACTOR_LABELS[code];
  try {
    const created = await prisma.contributingFactor.create({
      data: {
        code,
        name,
        description: req.body.description || null,
        ...buildVerificationFields(req.body, req.user?.userId),
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
  const code = resolveContributingFactorCode(req.body.code || req.body.name);
  if (!code) {
    return res.status(400).json({
      message: 'Valid ContributingFactorCode enum value is required.',
      allowedCodes: Object.keys(CONTRIBUTING_FACTOR_LABELS),
    });
  }
  const name = req.body.name?.trim() || CONTRIBUTING_FACTOR_LABELS[code];
  try {
    const updated = await prisma.contributingFactor.update({
      where: { id },
      data: {
        code,
        name,
        description: req.body.description || null,
        ...buildVerificationFields(req.body, req.user?.userId),
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

// --- InformationSources (Source Provenance Catalog) ---

router.get('/informationsources', async (req, res) => {
  try {
    const rows = await prisma.informationSource.findMany({
      include: { _count: { select: { individualLinks: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(rows);
  } catch (error) {
    handlePrismaError(res, error, 'InformationSource');
  }
});

router.post('/informationsources', async (req, res) => {
  if (!req.body.name?.trim()) {
    return res.status(400).json({ message: 'name is required.' });
  }
  try {
    const created = await prisma.informationSource.create({
      data: {
        name: req.body.name.trim(),
        baseUrl: req.body.baseUrl?.trim() || null,
        retrievedAt: parseDateOrNull(req.body.retrievedAt),
      },
    });
    res.status(201).json(created);
  } catch (error) {
    handlePrismaError(res, error, 'InformationSource');
  }
});

router.put('/informationsources/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid InformationSource ID.' });
  if (!req.body.name?.trim()) {
    return res.status(400).json({ message: 'name is required.' });
  }
  try {
    const updated = await prisma.informationSource.update({
      where: { id },
      data: {
        name: req.body.name.trim(),
        baseUrl: req.body.baseUrl?.trim() || null,
        retrievedAt: parseDateOrNull(req.body.retrievedAt),
      },
    });
    res.json(updated);
  } catch (error) {
    handlePrismaError(res, error, 'InformationSource');
  }
});

router.delete('/informationsources/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid InformationSource ID.' });
  try {
    await prisma.informationSource.delete({ where: { id } });
    res.json({ message: 'InformationSource deleted.', id });
  } catch (error) {
    handlePrismaError(res, error, 'InformationSource');
  }
});

// --- Individual Source Links (Provenance per Individual) ---

router.get('/individuals/:id/sourcelinks', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid Individual ID.' });
  try {
    const links = await prisma.individualSourceLink.findMany({
      where: { individualId: id },
      include: { informationSource: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(links);
  } catch (error) {
    handlePrismaError(res, error, 'IndividualSourceLink');
  }
});

router.post('/individuals/:id/sourcelinks', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid Individual ID.' });
  const specificUrl = req.body.specificUrl?.trim();
  if (!specificUrl) {
    return res.status(400).json({ message: 'specificUrl is required.' });
  }

  try {
    let infoSourceId = parseId(req.body.informationSourceId);
    if (!infoSourceId && req.body.informationSourceName?.trim()) {
      const src = await prisma.informationSource.upsert({
        where: { name: req.body.informationSourceName.trim() },
        update: {},
        create: { name: req.body.informationSourceName.trim() },
      });
      infoSourceId = src.id;
    }
    if (!infoSourceId) {
      return res.status(400).json({ message: 'informationSourceId or informationSourceName is required.' });
    }

    const created = await prisma.individualSourceLink.create({
      data: {
        individualId: id,
        informationSourceId: infoSourceId,
        specificUrl,
        headline: req.body.headline?.trim() || null,
        description: req.body.description?.trim() || null,
      },
      include: { informationSource: true },
    });
    res.status(201).json(created);
  } catch (error) {
    handlePrismaError(res, error, 'IndividualSourceLink');
  }
});

router.delete('/individuals/:id/sourcelinks/:linkId', async (req, res) => {
  const id = parseId(req.params.id);
  const linkId = parseId(req.params.linkId);
  if (!id || !linkId) return res.status(400).json({ message: 'Invalid ID.' });
  try {
    await prisma.individualSourceLink.delete({ where: { id: linkId } });
    res.json({ message: 'Source link deleted.', id: linkId });
  } catch (error) {
    handlePrismaError(res, error, 'IndividualSourceLink');
  }
});

// --- GET /api/admin/podcast-ingest/processed ---
// Returns canonicalKeys and normalized podcast+title keys of all PODCAST_EPISODE MediaItems
// already in the live database so any machine running daily_capture.py skips them automatically.
router.get('/podcast-ingest/processed', async (req, res) => {
  try {
    const items = await prisma.mediaItem.findMany({
      where: { itemMediaType: 'PODCAST_EPISODE' },
      select: {
        canonicalKey: true,
        itemTitle: true,
        work: { select: { title: true } },
      },
    });
    const canonicalKeys = items.map((i) => i.canonicalKey).filter(Boolean);
    const titleKeys = items
      .filter((i) => i.work?.title && i.itemTitle)
      .map((i) => `${i.work.title.trim().toLowerCase()}::${i.itemTitle.trim().toLowerCase()}`);

    res.json({
      total: items.length,
      canonicalKeys,
      titleKeys,
    });
  } catch (error) {
    handlePrismaError(res, error, 'podcast-ingest/processed');
  }
});

// --- POST /api/admin/podcast-ingest ---
// Stages a newly captured podcast episode and all extracted entities as UNVERIFIED
function normalizeKey(...parts) {
  return parts
    .map((p) => (p || '').toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'))
    .filter(Boolean)
    .join(':');
}

router.post('/podcast-ingest', async (req, res) => {
  const {
    podcastTitle,
    publisherOrNetwork,
    episodeTitle,
    episodeNumber,
    releaseDate,
    durationSeconds,
    hostOrNarrator,
    focusOrTheme,
    summaryNotes,
    keyQuotes,
    transcript,
    sourceUrl,
    canonicalKey,
    importBatchId,
    refreshExisting = false,
    individuals = [],
    organizations = [],
    contributingFactors = [],
    involvedPersons = [],
    externalLinks = [],
  } = req.body;

  if (!podcastTitle?.trim() || !episodeTitle?.trim()) {
    return res.status(400).json({ message: 'podcastTitle and episodeTitle are required.' });
  }

  const batchId = importBatchId || `podcast-${new Date().toISOString().slice(0, 10)}`;
  const itemKey = canonicalKey?.trim() || normalizeKey('podcast', podcastTitle, episodeNumber || episodeTitle);

  try {
    const existing = await prisma.mediaItem.findUnique({ where: { canonicalKey: itemKey } });
    if (existing && !refreshExisting) {
      return res.json({ skipped: true, reason: 'already_exists', mediaItemId: existing.id });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Find or create parent MediaWork (PODCAST_SERIES)
      let work = await tx.mediaWork.findFirst({
        where: { title: { equals: podcastTitle.trim(), mode: 'insensitive' }, workType: 'PODCAST_SERIES' },
      });
      if (!work) {
        work = await tx.mediaWork.create({
          data: {
            title: podcastTitle.trim(),
            workType: 'PODCAST_SERIES',
            publisherOrNetwork: publisherOrNetwork?.trim() || null,
            creatorName: hostOrNarrator?.trim() || null,
            aiGenerated: true,
            verificationStatus: 'UNVERIFIED',
            ingestionSource: 'podcast_rss_gemini',
            importBatchId: batchId,
          },
        });
      }

      // 2. Upsert/match Individuals (never overwrites existing records)
      const individualIdSet = new Set();
      let newIndividualsCreated = 0;
      for (const ind of individuals) {
        if (!ind.firstName?.trim() || !ind.lastName?.trim()) continue;
        const indKey = normalizeKey('ind', ind.firstName, ind.middleName, ind.lastName, ind.suffix);
        let record = await tx.individual.findUnique({ where: { canonicalKey: indKey } });
        if (!record) {
          record = await tx.individual.findFirst({
            where: {
              firstName: { equals: ind.firstName.trim(), mode: 'insensitive' },
              lastName: { equals: ind.lastName.trim(), mode: 'insensitive' },
            },
          });
        }
        if (!record) {
          record = await tx.individual.create({
            data: {
              firstName: ind.firstName.trim(),
              middleName: ind.middleName?.trim() || null,
              lastName: ind.lastName.trim(),
              suffix: ind.suffix?.trim() || null,
              canonicalKey: indKey,
              status: ind.status || 'UNKNOWN',
              claimStrength: ind.claimStrength || 'UNASSESSED',
              convictionYear: parseIntOrNull(ind.convictionYear),
              exonerationOrReleaseYear: parseIntOrNull(ind.exonerationOrReleaseYear),
              timeServed: ind.timeServed?.trim() || null,
              sentence: ind.sentence?.trim() || null,
              caseLocationCity: ind.caseLocationCity?.trim() || null,
              caseLocationState: ind.caseLocationState?.trim() || null,
              caseLocationCountry: ind.caseLocationCountry?.trim() || 'USA',
              narrativeSummary: ind.narrativeSummary || null,
              aiGenerated: true,
              verificationStatus: 'UNVERIFIED',
              ingestionSource: 'podcast_rss_gemini',
              importBatchId: batchId,
            },
          });
          newIndividualsCreated++;
        }
        individualIdSet.add(record.id);
      }
      const individualIds = [...individualIdSet].map((id) => ({ id }));

      // 3. Upsert/match ContributingFactors strictly against the 16-item ContributingFactorCode enum
      const factorIdSet = new Set();
      for (const rawFactor of contributingFactors) {
        const code = resolveContributingFactorCode(rawFactor);
        if (!code) continue;
        const factor = await tx.contributingFactor.upsert({
          where: { code },
          update: {},
          create: {
            code,
            name: CONTRIBUTING_FACTOR_LABELS[code],
            aiGenerated: false,
            verificationStatus: 'VERIFIED',
          },
        });
        factorIdSet.add(factor.id);
      }
      const factorIds = [...factorIdSet].map((id) => ({ id }));

      // Link extracted contributing factors onto featured Individual(s) without overwriting other fields
      if (factorIds.length && individualIds.length) {
        for (const { id: indId } of individualIds) {
          await tx.individual.update({
            where: { id: indId },
            data: {
              contributingFactors: existing
                ? { set: factorIds }
                : { connect: factorIds },
            },
          });
        }
      }

      // 4. Upsert/match Organizations (case-insensitive to prevent near-duplicates)
      const orgIdSet = new Set();
      let newOrganizationsCreated = 0;
      for (const org of organizations) {
        const orgName = (typeof org === 'string' ? org : org?.name)?.trim();
        if (!orgName) continue;
        let record = await tx.organization.findFirst({
          where: { name: { equals: orgName, mode: 'insensitive' } },
        });
        if (!record) {
          record = await tx.organization.create({
            data: {
              name: orgName,
              type: org?.type || 'OTHER',
              aiGenerated: true,
              verificationStatus: 'UNVERIFIED',
              ingestionSource: 'podcast_rss_gemini',
              importBatchId: batchId,
            },
          });
          newOrganizationsCreated++;
        }
        orgIdSet.add(record.id);
      }
      const orgIds = [...orgIdSet].map((id) => ({ id }));

      // 5. Upsert/match InvolvedPersons (match canonicalKey OR case-insensitive first+last to avoid role-drift duplicates)
      const personIdSet = new Set();
      let newInvolvedPersonsCreated = 0;
      for (const person of involvedPersons) {
        if (!person.firstName?.trim() || !person.lastName?.trim()) continue;
        const pKey = normalizeKey('oip', person.firstName, person.lastName, person.role || 'OTHER');
        let record = await tx.involvedPerson.findUnique({ where: { canonicalKey: pKey } });
        if (!record) {
          record = await tx.involvedPerson.findFirst({
            where: {
              firstName: { equals: person.firstName.trim(), mode: 'insensitive' },
              lastName: { equals: person.lastName.trim(), mode: 'insensitive' },
            },
          });
        }
        if (!record) {
          record = await tx.involvedPerson.create({
            data: {
              firstName: person.firstName.trim(),
              lastName: person.lastName.trim(),
              role: person.role || 'OTHER',
              notes: person.notes || null,
              canonicalKey: pKey,
              aiGenerated: true,
              verificationStatus: 'UNVERIFIED',
              ingestionSource: 'podcast_rss_gemini',
              importBatchId: batchId,
            },
          });
          newInvolvedPersonsCreated++;
        }
        personIdSet.add(record.id);
      }
      const personIds = [...personIdSet].map((id) => ({ id }));

      // 6. Refresh existing MediaItem relations (preserving all verified text/metadata) OR create new MediaItem
      let mediaItem;
      if (existing) {
        mediaItem = await tx.mediaItem.update({
          where: { id: existing.id },
          data: {
            contributingFactorsMentioned: { set: factorIds },
            individualsFeatured: individualIds.length ? { connect: individualIds } : undefined,
            organizationsMentioned: orgIds.length ? { connect: orgIds } : undefined,
            involvedPersonsMentioned: personIds.length ? { connect: personIds } : undefined,
          },
        });
      } else {
        mediaItem = await tx.mediaItem.create({
          data: {
            workId: work.id,
            itemTitle: episodeTitle.trim(),
            itemNumber: episodeNumber?.toString().trim() || null,
            itemMediaType: 'PODCAST_EPISODE',
            releaseDate: parseDateOrNull(releaseDate),
            durationSeconds: parseIntOrNull(durationSeconds),
            hostOrNarrator: hostOrNarrator?.trim() || null,
            focusOrTheme: focusOrTheme || null,
            summaryNotes: summaryNotes || null,
            keyQuotes: keyQuotes || null,
            transcript: transcript || null,
            sourceUrl: sourceUrl?.trim() || null,
            canonicalKey: itemKey,
            aiGenerated: true,
            verificationStatus: 'UNVERIFIED',
            ingestionSource: 'podcast_rss_gemini',
            importBatchId: batchId,
            individualsFeatured: individualIds.length ? { connect: individualIds } : undefined,
            contributingFactorsMentioned: factorIds.length ? { connect: factorIds } : undefined,
            organizationsMentioned: orgIds.length ? { connect: orgIds } : undefined,
            involvedPersonsMentioned: personIds.length ? { connect: personIds } : undefined,
            externalLinks: Array.isArray(externalLinks) && externalLinks.length
              ? {
                  create: externalLinks
                    .filter((l) => l?.url?.trim())
                    .map((l) => ({ url: l.url.trim(), description: l.description || null })),
                }
              : undefined,
          },
        });
      }

      return {
        refreshed: Boolean(existing),
        mediaItemId: mediaItem.id,
        workId: work.id,
        linkedIndividuals: individualIds.length,
        newIndividualsCreated,
        linkedFactors: factorIds.length,
        linkedOrganizations: orgIds.length,
        newOrganizationsCreated,
        linkedInvolvedPersons: personIds.length,
        newInvolvedPersonsCreated,
      };
    });

    res.status(existing ? 200 : 201).json({ skipped: false, ...result });
  } catch (error) {
    handlePrismaError(res, error, 'podcast-ingest');
  }
});

module.exports = router;
