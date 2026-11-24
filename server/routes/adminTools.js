// server/routes/adminTools.js
// Unified Admin Workflow Tools API:
//   - GET  /api/admin/tools/validation-queue
//   - GET  /api/admin/tools/batches
//   - POST /api/admin/tools/batches/:batchId/verify
//   - DELETE /api/admin/tools/batches/:batchId
//   - GET  /api/admin/tools/audit
//   - POST /api/admin/tools/merge-individuals
//   - GET  /api/admin/tools/podcasts

const express = require('express');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, authorizeRole } = require('../middleware/authenticateToken');

const router = express.Router();
const prisma = new PrismaClient();

// Require ADMIN or EDITOR JWT for all tools routes
router.use((req, res, next) =>
  authenticateToken(req, res, () => authorizeRole(['ADMIN', 'EDITOR'])(req, res, next))
);

function normStr(v) {
  return (v || '').toString().trim().toLowerCase();
}

// --- 1. Unified Validation Queue ---

router.get('/validation-queue', async (req, res) => {
  const { status = 'PENDING', type = 'ALL', q = '' } = req.query;
  const search = String(q || '').trim();
  const searchParts = search.split(/\s+/).filter(Boolean);
  const numericId = /^\d+$/.test(search) ? parseInt(search, 10) : null;

  let statusFilter;
  if (status === 'PENDING') {
    statusFilter = { in: ['UNVERIFIED', 'IN_REVIEW'] };
  } else if (['UNVERIFIED', 'IN_REVIEW', 'DISPUTED'].includes(status)) {
    statusFilter = status;
  } else {
    statusFilter = { not: 'VERIFIED' };
  }

  const baseWhere = { verificationStatus: statusFilter };

  // Build per-entity search filters so server-side search finds records beyond the 100-row cap
  const indWhere = { ...baseWhere };
  if (search) {
    const orClauses = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { nickname: { contains: search, mode: 'insensitive' } },
      { caseLocationState: { contains: search, mode: 'insensitive' } },
      { narrativeSummary: { contains: search, mode: 'insensitive' } },
      { ingestionSource: { contains: search, mode: 'insensitive' } },
      { importBatchId: { contains: search, mode: 'insensitive' } },
    ];
    if (numericId) orClauses.push({ id: numericId });
    if (searchParts.length >= 2) {
      orClauses.push({
        AND: [
          {
            OR: [
              { firstName: { contains: searchParts[0], mode: 'insensitive' } },
              { nickname: { contains: searchParts[0], mode: 'insensitive' } },
            ],
          },
          { lastName: { contains: searchParts[searchParts.length - 1], mode: 'insensitive' } },
        ],
      });
    }
    indWhere.OR = orClauses;
  }

  const mediaItemWhere = { ...baseWhere };
  if (search) {
    const orClauses = [
      { itemTitle: { contains: search, mode: 'insensitive' } },
      { summaryNotes: { contains: search, mode: 'insensitive' } },
      { hostOrNarrator: { contains: search, mode: 'insensitive' } },
      { ingestionSource: { contains: search, mode: 'insensitive' } },
      { importBatchId: { contains: search, mode: 'insensitive' } },
      { work: { title: { contains: search, mode: 'insensitive' } } },
      {
        individualsFeatured: {
          some: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      },
    ];
    if (numericId) orClauses.push({ id: numericId });
    mediaItemWhere.OR = orClauses;
  }

  const mediaWorkWhere = { ...baseWhere };
  if (search) {
    const orClauses = [
      { title: { contains: search, mode: 'insensitive' } },
      { creatorName: { contains: search, mode: 'insensitive' } },
      { publisherOrNetwork: { contains: search, mode: 'insensitive' } },
      { summaryNotes: { contains: search, mode: 'insensitive' } },
      { ingestionSource: { contains: search, mode: 'insensitive' } },
      { importBatchId: { contains: search, mode: 'insensitive' } },
    ];
    if (numericId) orClauses.push({ id: numericId });
    mediaWorkWhere.OR = orClauses;
  }

  const orgWhere = { ...baseWhere };
  if (search) {
    const orClauses = [
      { name: { contains: search, mode: 'insensitive' } },
      { locationState: { contains: search, mode: 'insensitive' } },
      { notes: { contains: search, mode: 'insensitive' } },
      { ingestionSource: { contains: search, mode: 'insensitive' } },
    ];
    if (numericId) orClauses.push({ id: numericId });
    orgWhere.OR = orClauses;
  }

  const personWhere = { ...baseWhere };
  if (search) {
    const orClauses = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { notes: { contains: search, mode: 'insensitive' } },
      { ingestionSource: { contains: search, mode: 'insensitive' } },
    ];
    if (numericId) orClauses.push({ id: numericId });
    if (searchParts.length >= 2) {
      orClauses.push({
        AND: [
          { firstName: { contains: searchParts[0], mode: 'insensitive' } },
          { lastName: { contains: searchParts[searchParts.length - 1], mode: 'insensitive' } },
        ],
      });
    }
    personWhere.OR = orClauses;
  }

  try {
    const [
      indCount,
      mediaItemCount,
      mediaWorkCount,
      orgCount,
      personCount,
      individuals,
      mediaItems,
      mediaWorks,
      organizations,
      involvedPersons,
    ] = await Promise.all([
      prisma.individual.count({ where: indWhere }),
      prisma.mediaItem.count({ where: mediaItemWhere }),
      prisma.mediaWork.count({ where: mediaWorkWhere }),
      prisma.organization.count({ where: orgWhere }),
      prisma.involvedPerson.count({ where: personWhere }),
      type === 'ALL' || type === 'individuals'
        ? prisma.individual.findMany({
            where: indWhere,
            take: 100,
            orderBy: { updatedAt: 'desc' },
            include: {
              crimeCategory: { select: { crime_name: true } },
              sourceLinks: { include: { informationSource: { select: { name: true } } } },
              contributingFactors: { select: { id: true, code: true, name: true } },
            },
          })
        : [],
      type === 'ALL' || type === 'mediaitems'
        ? prisma.mediaItem.findMany({
            where: mediaItemWhere,
            take: 100,
            orderBy: { updatedAt: 'desc' },
            include: {
              work: { select: { id: true, title: true, workType: true } },
              individualsFeatured: { select: { id: true, firstName: true, lastName: true } },
              contributingFactorsMentioned: { select: { id: true, code: true, name: true } },
            },
          })
        : [],
      type === 'ALL' || type === 'mediaworks'
        ? prisma.mediaWork.findMany({
            where: mediaWorkWhere,
            take: 100,
            orderBy: { updatedAt: 'desc' },
          })
        : [],
      type === 'ALL' || type === 'organizations'
        ? prisma.organization.findMany({
            where: orgWhere,
            take: 100,
            orderBy: { updatedAt: 'desc' },
          })
        : [],
      type === 'ALL' || type === 'involvedpersons'
        ? prisma.involvedPerson.findMany({
            where: personWhere,
            take: 100,
            orderBy: { updatedAt: 'desc' },
          })
        : [],
    ]);

    const items = [
      ...individuals.map((r) => ({
        resource: 'individuals',
        entityLabel: 'Individual',
        id: r.id,
        title: [r.firstName, r.middleName, r.lastName, r.suffix].filter(Boolean).join(' '),
        subtitle: [
          r.status,
          r.caseLocationState,
          r.convictionYear ? `Convicted ${r.convictionYear}` : null,
          r.crimeCategory?.crime_name,
        ]
          .filter(Boolean)
          .join(' · '),
        summary: r.narrativeSummary || null,
        verificationStatus: r.verificationStatus,
        verificationNotes: r.verificationNotes || '',
        aiGenerated: r.aiGenerated,
        ingestionSource: r.ingestionSource,
        importBatchId: r.importBatchId,
        updatedAt: r.updatedAt,
        sources: (r.sourceLinks || []).map((l) => ({
          label: l.informationSource?.name || 'Source',
          url: l.specificUrl,
          headline: l.headline,
        })),
        tags: (r.contributingFactors || []).map((f) => f.name),
      })),
      ...mediaItems.map((r) => ({
        resource: 'mediaitems',
        entityLabel: 'Media Item',
        id: r.id,
        title: r.itemTitle || `Item #${r.itemNumber || r.id}`,
        subtitle: [r.work?.title, r.itemMediaType, r.hostOrNarrator].filter(Boolean).join(' · '),
        summary: r.summaryNotes || null,
        verificationStatus: r.verificationStatus,
        verificationNotes: r.verificationNotes || '',
        aiGenerated: r.aiGenerated,
        ingestionSource: r.ingestionSource,
        importBatchId: r.importBatchId,
        updatedAt: r.updatedAt,
        sources: r.sourceUrl ? [{ label: 'Source URL', url: r.sourceUrl }] : [],
        tags: [
          ...(r.individualsFeatured || []).map((i) => `${i.firstName} ${i.lastName}`),
          ...(r.contributingFactorsMentioned || []).map((f) => f.name),
        ],
      })),
      ...mediaWorks.map((r) => ({
        resource: 'mediaworks',
        entityLabel: 'Media Work',
        id: r.id,
        title: r.title,
        subtitle: [r.workType, r.creatorName, r.publicationOrReleaseYear].filter(Boolean).join(' · '),
        summary: r.summaryNotes || null,
        verificationStatus: r.verificationStatus,
        verificationNotes: r.verificationNotes || '',
        aiGenerated: r.aiGenerated,
        ingestionSource: r.ingestionSource,
        importBatchId: r.importBatchId,
        updatedAt: r.updatedAt,
        sources: r.sourceUrl ? [{ label: 'Source URL', url: r.sourceUrl }] : [],
        tags: [],
      })),
      ...organizations.map((r) => ({
        resource: 'organizations',
        entityLabel: 'Organization',
        id: r.id,
        title: r.name,
        subtitle: [r.type, r.locationCity, r.locationState].filter(Boolean).join(' · '),
        summary: r.notes || null,
        verificationStatus: r.verificationStatus,
        verificationNotes: r.verificationNotes || '',
        aiGenerated: r.aiGenerated,
        ingestionSource: r.ingestionSource,
        importBatchId: r.importBatchId,
        updatedAt: r.updatedAt,
        sources: r.website ? [{ label: 'Website', url: r.website }] : [],
        tags: [],
      })),
      ...involvedPersons.map((r) => ({
        resource: 'involvedpersons',
        entityLabel: 'Involved Person',
        id: r.id,
        title: [r.firstName, r.middleName, r.lastName, r.suffix].filter(Boolean).join(' '),
        subtitle: r.role || 'Role unset',
        summary: r.notes || null,
        verificationStatus: r.verificationStatus,
        verificationNotes: r.verificationNotes || '',
        aiGenerated: r.aiGenerated,
        ingestionSource: r.ingestionSource,
        importBatchId: r.importBatchId,
        updatedAt: r.updatedAt,
        sources: [],
        tags: [],
      })),
    ].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.json({
      counts: {
        all: indCount + mediaItemCount + mediaWorkCount + orgCount + personCount,
        individuals: indCount,
        mediaitems: mediaItemCount,
        mediaworks: mediaWorkCount,
        organizations: orgCount,
        involvedpersons: personCount,
      },
      items,
    });
  } catch (error) {
    console.error('Validation queue error:', error);
    res.status(500).json({ message: 'Failed to load validation queue.', error: error.message });
  }
});

// --- 2. Import Batch History, Bulk Verify & Rollback ---

router.get('/batches', async (req, res) => {
  try {
    const models = [
      { key: 'individuals', model: prisma.individual },
      { key: 'mediaWorks', model: prisma.mediaWork },
      { key: 'mediaItems', model: prisma.mediaItem },
      { key: 'organizations', model: prisma.organization },
      { key: 'involvedPersons', model: prisma.involvedPerson },
    ];

    const batchesMap = new Map();

    for (const { key, model } of models) {
      const rows = await model.findMany({
        where: { importBatchId: { not: null } },
        select: {
          importBatchId: true,
          ingestionSource: true,
          verificationStatus: true,
          createdAt: true,
        },
      });

      for (const r of rows) {
        const bid = r.importBatchId;
        if (!bid) continue;
        if (!batchesMap.has(bid)) {
          batchesMap.set(bid, {
            batchId: bid,
            ingestionSource: r.ingestionSource || 'unknown',
            createdAt: r.createdAt,
            total: 0,
            verified: 0,
            unverified: 0,
            breakdown: {
              individuals: 0,
              mediaWorks: 0,
              mediaItems: 0,
              organizations: 0,
              involvedPersons: 0,
            },
          });
        }
        const b = batchesMap.get(bid);
        b.total++;
        b.breakdown[key]++;
        if (r.verificationStatus === 'VERIFIED') b.verified++;
        else b.unverified++;
        if (r.createdAt > b.createdAt) b.createdAt = r.createdAt;
      }
    }

    const batches = Array.from(batchesMap.values()).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.json({ batches });
  } catch (error) {
    console.error('Batches list error:', error);
    res.status(500).json({ message: 'Failed to load import batches.', error: error.message });
  }
});

router.post('/batches/:batchId/verify', async (req, res) => {
  const { batchId } = req.params;
  if (!batchId) return res.status(400).json({ message: 'batchId is required.' });

  const data = {
    verificationStatus: 'VERIFIED',
    verifiedAt: new Date(),
    verifiedById: req.user?.userId || null,
  };

  try {
    const [individuals, mediaWorks, mediaItems, organizations, involvedPersons] = await prisma.$transaction([
      prisma.individual.updateMany({ where: { importBatchId: batchId }, data }),
      prisma.mediaWork.updateMany({ where: { importBatchId: batchId }, data }),
      prisma.mediaItem.updateMany({ where: { importBatchId: batchId }, data }),
      prisma.organization.updateMany({ where: { importBatchId: batchId }, data }),
      prisma.involvedPerson.updateMany({ where: { importBatchId: batchId }, data }),
    ]);

    res.json({
      message: `Verified all records in batch "${batchId}".`,
      updated: {
        individuals: individuals.count,
        mediaWorks: mediaWorks.count,
        mediaItems: mediaItems.count,
        organizations: organizations.count,
        involvedPersons: involvedPersons.count,
      },
    });
  } catch (error) {
    console.error('Batch verify error:', error);
    res.status(500).json({ message: 'Failed to verify batch.', error: error.message });
  }
});

router.delete('/batches/:batchId', async (req, res) => {
  const { batchId } = req.params;
  if (!batchId) return res.status(400).json({ message: 'batchId is required.' });

  try {
    const [mediaItems, mediaWorks, individuals, organizations, involvedPersons] = await prisma.$transaction([
      prisma.mediaItem.deleteMany({ where: { importBatchId: batchId } }),
      prisma.mediaWork.deleteMany({ where: { importBatchId: batchId } }),
      prisma.individual.deleteMany({ where: { importBatchId: batchId } }),
      prisma.organization.deleteMany({ where: { importBatchId: batchId } }),
      prisma.involvedPerson.deleteMany({ where: { importBatchId: batchId } }),
    ]);

    res.json({
      message: `Rolled back batch "${batchId}".`,
      deleted: {
        individuals: individuals.count,
        mediaWorks: mediaWorks.count,
        mediaItems: mediaItems.count,
        organizations: organizations.count,
        involvedPersons: involvedPersons.count,
      },
    });
  } catch (error) {
    console.error('Batch rollback error:', error);
    res.status(500).json({ message: 'Failed to roll back batch.', error: error.message });
  }
});

// --- 3. Data Health & Audit Dashboard + Safe Duplicate Merge ---

router.get('/audit', async (req, res) => {
  try {
    const [
      totalIndividuals,
      missingSources,
      missingCrime,
      missingState,
      missingFactors,
      unlinkedMediaItems,
      allIndividuals,
    ] = await Promise.all([
      prisma.individual.count(),
      prisma.individual.findMany({
        where: { sourceLinks: { none: {} } },
        take: 50,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, firstName: true, lastName: true, caseLocationState: true, verificationStatus: true },
      }),
      prisma.individual.findMany({
        where: { crimeCategoryId: null },
        take: 50,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, firstName: true, lastName: true, caseLocationState: true, verificationStatus: true },
      }),
      prisma.individual.findMany({
        where: { OR: [{ caseLocationState: null }, { caseLocationState: '' }] },
        take: 50,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, firstName: true, lastName: true, convictionYear: true, verificationStatus: true },
      }),
      prisma.individual.findMany({
        where: { contributingFactors: { none: {} } },
        take: 50,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, firstName: true, lastName: true, caseLocationState: true, verificationStatus: true },
      }),
      prisma.mediaItem.findMany({
        where: { individualsFeatured: { none: {} } },
        take: 50,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          itemTitle: true,
          itemMediaType: true,
          work: { select: { title: true } },
          verificationStatus: true,
        },
      }),
      prisma.individual.findMany({
        select: {
          id: true,
          firstName: true,
          middleName: true,
          lastName: true,
          suffix: true,
          caseLocationState: true,
          convictionYear: true,
          exonerationOrReleaseYear: true,
          verificationStatus: true,
          _count: { select: { sourceLinks: true, mediaItemAppearances: true } },
        },
        orderBy: { id: 'asc' },
      }),
    ]);

    // Detect potential duplicate individuals (same lastName + matching first 3 chars of firstName)
    const byLast = new Map();
    for (const ind of allIndividuals) {
      const ln = normStr(ind.lastName);
      if (!ln) continue;
      if (!byLast.has(ln)) byLast.set(ln, []);
      byLast.get(ln).push(ind);
    }

    const duplicatePairs = [];
    for (const group of byLast.values()) {
      if (group.length < 2) continue;
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i];
          const b = group[j];
          const fnA = normStr(a.firstName);
          const fnB = normStr(b.firstName);
          if (fnA && fnB && (fnA === fnB || (fnA.length >= 3 && fnB.startsWith(fnA.slice(0, 3))))) {
            duplicatePairs.push({ a, b });
            if (duplicatePairs.length >= 50) break;
          }
        }
        if (duplicatePairs.length >= 50) break;
      }
      if (duplicatePairs.length >= 50) break;
    }

    const [
      missingSourcesCount,
      missingCrimeCount,
      missingStateCount,
      missingFactorsCount,
      unlinkedMediaItemsCount,
      nreOnlyCount,
      unpublishedCount,
      untoldStoriesCount,
    ] = await Promise.all([
      prisma.individual.count({ where: { sourceLinks: { none: {} } } }),
      prisma.individual.count({ where: { crimeCategoryId: null } }),
      prisma.individual.count({ where: { OR: [{ caseLocationState: null }, { caseLocationState: '' }] } }),
      prisma.individual.count({ where: { contributingFactors: { none: {} } } }),
      prisma.mediaItem.count({ where: { individualsFeatured: { none: {} } } }),
      prisma.individual.count({ where: { nreOnly: true } }),
      prisma.individual.count({ where: { isPublished: false } }),
      prisma.individual.count({
        where: { mediaItemAppearances: { none: {} }, newsArticles: { none: {} } },
      }),
    ]);

    res.json({
      totals: {
        totalIndividuals,
        missingSources: missingSourcesCount,
        missingCrime: missingCrimeCount,
        missingState: missingStateCount,
        missingFactors: missingFactorsCount,
        unlinkedMediaItems: unlinkedMediaItemsCount,
        potentialDuplicates: duplicatePairs.length,
        nreOnly: nreOnlyCount,
        unpublished: unpublishedCount,
        untoldStories: untoldStoriesCount,
      },
      samples: {
        missingSources,
        missingCrime,
        missingState,
        missingFactors,
        unlinkedMediaItems,
        duplicatePairs,
      },
    });
  } catch (error) {
    console.error('Audit error:', error);
    res.status(500).json({ message: 'Failed to run data health audit.', error: error.message });
  }
});

// Recalculate NRE-only license compliance & publishing status across all Individuals
router.post('/sync-nre-visibility', async (req, res) => {
  try {
    const all = await prisma.individual.findMany({
      select: {
        id: true,
        nreOnly: true,
        isPublished: true,
        _count: {
          select: {
            mediaItemAppearances: true,
            newsArticles: true,
          },
        },
        sourceLinks: {
          select: {
            informationSource: { select: { name: true } },
          },
        },
      },
    });

    const toUnpublishIds = [];
    const toPublishIds = [];

    for (const ind of all) {
      const hasMedia = ind._count.mediaItemAppearances > 0;
      const hasNews = ind._count.newsArticles > 0;
      const sourceNames = ind.sourceLinks
        .map((sl) => (sl.informationSource?.name || '').trim().toLowerCase())
        .filter(Boolean);
      const hasNreSource = sourceNames.includes('national registry of exonerations');
      const hasNonNreSource = sourceNames.some((n) => n !== 'national registry of exonerations');

      const isNreOnly = !hasMedia && !hasNews && hasNreSource && !hasNonNreSource;
      if (isNreOnly) {
        if (!ind.nreOnly || ind.isPublished) toUnpublishIds.push(ind.id);
      } else {
        if (ind.nreOnly || !ind.isPublished) toPublishIds.push(ind.id);
      }
    }

    if (toUnpublishIds.length > 0) {
      await prisma.individual.updateMany({
        where: { id: { in: toUnpublishIds } },
        data: { nreOnly: true, isPublished: false },
      });
    }
    if (toPublishIds.length > 0) {
      await prisma.individual.updateMany({
        where: { id: { in: toPublishIds } },
        data: { nreOnly: false, isPublished: true },
      });
    }

    const [nreOnlyTotal, publishedTotal, untoldStoriesTotal] = await Promise.all([
      prisma.individual.count({ where: { nreOnly: true } }),
      prisma.individual.count({ where: { isPublished: true } }),
      prisma.individual.count({ where: { mediaItemAppearances: { none: {} }, newsArticles: { none: {} } } }),
    ]);

    res.json({
      message: `Visibility synced: ${toUnpublishIds.length} marked NRE-only/unpublished, ${toPublishIds.length} promoted to published.`,
      newlyUnpublished: toUnpublishIds.length,
      newlyPublished: toPublishIds.length,
      totals: {
        nreOnly: nreOnlyTotal,
        published: publishedTotal,
        untoldStories: untoldStoriesTotal,
      },
    });
  } catch (error) {
    console.error('Sync NRE visibility error:', error);
    res.status(500).json({ message: 'Failed to sync NRE visibility.', error: error.message });
  }
});

router.post('/merge-individuals', async (req, res) => {
  const keepId = parseInt(req.body.keepId, 10);
  const mergeId = parseInt(req.body.mergeId, 10);

  if (!keepId || !mergeId || keepId === mergeId) {
    return res.status(400).json({ message: 'Provide two distinct Individual IDs: keepId and mergeId.' });
  }

  try {
    const [keep, merge] = await Promise.all([
      prisma.individual.findUnique({
        where: { id: keepId },
        include: {
          sourceLinks: true,
          contributingFactors: { select: { id: true } },
          organizationsInvolved: { select: { id: true } },
          involvedPersons: { select: { id: true } },
          groups: { select: { id: true } },
          mediaItemAppearances: { select: { id: true } },
        },
      }),
      prisma.individual.findUnique({
        where: { id: mergeId },
        include: {
          sourceLinks: true,
          contributingFactors: { select: { id: true } },
          organizationsInvolved: { select: { id: true } },
          involvedPersons: { select: { id: true } },
          groups: { select: { id: true } },
          mediaItemAppearances: { select: { id: true } },
        },
      }),
    ]);

    if (!keep || !merge) {
      return res.status(404).json({ message: 'One or both Individuals not found.' });
    }

    const keepUrls = new Set(keep.sourceLinks.map((l) => l.specificUrl));
    const linksToMove = merge.sourceLinks.filter((l) => !keepUrls.has(l.specificUrl));

    await prisma.$transaction(async (tx) => {
      // 1. Copy missing scalar fields & connect all M2M relations onto keep
      await tx.individual.update({
        where: { id: keepId },
        data: {
          middleName: keep.middleName || merge.middleName,
          suffix: keep.suffix || merge.suffix,
          nickname: keep.nickname || merge.nickname,
          status: keep.status || merge.status,
          claimStrength:
            keep.claimStrength && keep.claimStrength !== 'UNASSESSED'
              ? keep.claimStrength
              : merge.claimStrength,
          crimeCategoryId: keep.crimeCategoryId || merge.crimeCategoryId,
          crimeDate: keep.crimeDate || merge.crimeDate,
          convictionYear: keep.convictionYear ?? merge.convictionYear,
          exonerationOrReleaseYear: keep.exonerationOrReleaseYear ?? merge.exonerationOrReleaseYear,
          timeServed: keep.timeServed || merge.timeServed,
          sentence: keep.sentence || merge.sentence,
          caseLocationCity: keep.caseLocationCity || merge.caseLocationCity,
          caseLocationCounty: keep.caseLocationCounty || merge.caseLocationCounty,
          caseLocationState: keep.caseLocationState || merge.caseLocationState,
          narrativeSummary: keep.narrativeSummary || merge.narrativeSummary,
          contributingFactors: { connect: merge.contributingFactors.map((x) => ({ id: x.id })) },
          organizationsInvolved: { connect: merge.organizationsInvolved.map((x) => ({ id: x.id })) },
          involvedPersons: { connect: merge.involvedPersons.map((x) => ({ id: x.id })) },
          groups: { connect: merge.groups.map((x) => ({ id: x.id })) },
          mediaItemAppearances: { connect: merge.mediaItemAppearances.map((x) => ({ id: x.id })) },
        },
      });

      // 2. Move non-duplicate source links
      for (const link of linksToMove) {
        await tx.individualSourceLink.update({
          where: { id: link.id },
          data: { individualId: keepId },
        });
      }

      // 3. Delete merged duplicate (cascades any remaining duplicate source links)
      await tx.individual.delete({ where: { id: mergeId } });
    });

    res.json({
      message: `Merged Individual #${mergeId} into #${keepId} (${linksToMove.length} source link(s) transferred).`,
      keepId,
      mergedId: mergeId,
      linksTransferred: linksToMove.length,
    });
  } catch (error) {
    console.error('Merge individuals error:', error);
    res.status(500).json({ message: 'Failed to merge individuals.', error: error.message });
  }
});

// --- 4. Podcast Pipeline Monitor ---

router.get('/podcasts', async (req, res) => {
  try {
    // Load configured RSS feeds from scripts/podcast_pipeline/feeds.json if accessible on disk
    let configuredFeeds = [];
    const feedsPath = path.resolve(__dirname, '../../scripts/podcast_pipeline/feeds.json');
    if (fs.existsSync(feedsPath)) {
      try {
        configuredFeeds = JSON.parse(fs.readFileSync(feedsPath, 'utf8'));
      } catch (e) {
        console.warn('Could not parse feeds.json:', e.message);
      }
    }

    const [series, recentEpisodes] = await Promise.all([
      prisma.mediaWork.findMany({
        where: { workType: 'PODCAST_SERIES' },
        include: {
          _count: { select: { items: true } },
          items: {
            where: { verificationStatus: { not: 'VERIFIED' } },
            select: { id: true },
          },
        },
        orderBy: { title: 'asc' },
      }),
      prisma.mediaItem.findMany({
        where: { itemMediaType: 'PODCAST_EPISODE' },
        take: 40,
        orderBy: { createdAt: 'desc' },
        include: {
          work: { select: { id: true, title: true } },
          individualsFeatured: { select: { id: true, firstName: true, lastName: true } },
          contributingFactorsMentioned: { select: { id: true, name: true } },
        },
      }),
    ]);

    res.json({
      configuredFeeds,
      series: series.map((s) => ({
        id: s.id,
        title: s.title,
        publisherOrNetwork: s.publisherOrNetwork,
        creatorName: s.creatorName,
        totalEpisodes: s._count.items,
        unverifiedEpisodes: s.items.length,
        verificationStatus: s.verificationStatus,
      })),
      recentEpisodes,
    });
  } catch (error) {
    console.error('Podcast monitor error:', error);
    res.status(500).json({ message: 'Failed to load podcast pipeline status.', error: error.message });
  }
});

// --- 6. Full Record Inspector (for Preview & Inline Edit in Validation Queue) ---
router.get('/record/:resource/:id', async (req, res) => {
  const { resource } = req.params;
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id <= 0) {
    return res.status(400).json({ message: 'Invalid record ID.' });
  }

  try {
    if (resource === 'individuals') {
      const record = await prisma.individual.findUnique({
        where: { id },
        include: {
          crimeCategory: true,
          contributingFactors: { select: { id: true, code: true, name: true } },
          organizationsInvolved: { select: { id: true, name: true, type: true } },
          involvedPersons: { select: { id: true, firstName: true, lastName: true, role: true } },
          groups: { select: { id: true, name: true } },
          sourceLinks: {
            include: { informationSource: { select: { id: true, name: true } } },
            orderBy: { id: 'asc' },
          },
          mediaItemAppearances: {
            select: {
              id: true,
              itemTitle: true,
              itemMediaType: true,
              work: { select: { id: true, title: true, workType: true } },
            },
            take: 25,
          },
          newsArticles: {
            select: { id: true, headline: true, url: true, publishedAt: true, sourceName: true },
            orderBy: { publishedAt: 'desc' },
            take: 15,
          },
        },
      });
      if (!record) return res.status(404).json({ message: 'Individual not found.' });
      return res.json({
        ...record,
        contributingFactorIds: (record.contributingFactors || []).map((f) => f.id),
        organizationIds: (record.organizationsInvolved || []).map((o) => o.id),
        involvedPersonIds: (record.involvedPersons || []).map((p) => p.id),
        groupIds: (record.groups || []).map((g) => g.id),
      });
    }

    if (resource === 'mediaworks') {
      const record = await prisma.mediaWork.findUnique({
        where: { id },
        include: {
          items: {
            select: { id: true, itemTitle: true, itemNumber: true, itemMediaType: true, releaseDate: true },
            orderBy: { id: 'asc' },
            take: 30,
          },
          streamingProviders: true,
          bookPurchaseDetails: true,
        },
      });
      if (!record) return res.status(404).json({ message: 'Media Work not found.' });
      return res.json(record);
    }

    if (resource === 'mediaitems') {
      const record = await prisma.mediaItem.findUnique({
        where: { id },
        include: {
          work: { select: { id: true, title: true, workType: true } },
          individualsFeatured: { select: { id: true, firstName: true, lastName: true } },
          contributingFactorsMentioned: { select: { id: true, code: true, name: true } },
          organizationsMentioned: { select: { id: true, name: true } },
          involvedPersonsMentioned: { select: { id: true, firstName: true, lastName: true, role: true } },
          externalLinks: true,
        },
      });
      if (!record) return res.status(404).json({ message: 'Media Item not found.' });
      return res.json({
        ...record,
        individualIds: (record.individualsFeatured || []).map((i) => i.id),
        contributingFactorIds: (record.contributingFactorsMentioned || []).map((f) => f.id),
        organizationIds: (record.organizationsMentioned || []).map((o) => o.id),
      });
    }

    if (resource === 'organizations') {
      const record = await prisma.organization.findUnique({
        where: { id },
        include: {
          involvedCases: {
            select: { id: true, firstName: true, lastName: true, caseLocationState: true },
            take: 25,
          },
          _count: { select: { involvedCases: true, mediaItemMentions: true } },
        },
      });
      if (!record) return res.status(404).json({ message: 'Organization not found.' });
      return res.json(record);
    }

    if (resource === 'involvedpersons') {
      const record = await prisma.involvedPerson.findUnique({
        where: { id },
        include: {
          involvedCases: {
            select: { id: true, firstName: true, lastName: true },
            take: 25,
          },
          mediaItemMentions: {
            select: { id: true, itemTitle: true, work: { select: { title: true } } },
            take: 20,
          },
        },
      });
      if (!record) return res.status(404).json({ message: 'Involved Person not found.' });
      return res.json(record);
    }

    return res.status(400).json({ message: `Unsupported resource: ${resource}` });
  } catch (error) {
    console.error(`Error fetching full record ${resource}/${id}:`, error);
    return res.status(500).json({ message: 'Failed to load full record.', error: error.message });
  }
});

module.exports = router;
