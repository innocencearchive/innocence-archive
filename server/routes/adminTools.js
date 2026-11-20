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
  const { status = 'PENDING', type = 'ALL' } = req.query;

  let statusFilter;
  if (status === 'PENDING') {
    statusFilter = { in: ['UNVERIFIED', 'IN_REVIEW'] };
  } else if (['UNVERIFIED', 'IN_REVIEW', 'DISPUTED'].includes(status)) {
    statusFilter = status;
  } else {
    statusFilter = { not: 'VERIFIED' };
  }

  const where = { verificationStatus: statusFilter };

  try {
    const [individuals, mediaItems, mediaWorks, organizations, involvedPersons] = await Promise.all([
      type === 'ALL' || type === 'individuals'
        ? prisma.individual.findMany({
            where,
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
            where,
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
            where,
            take: 100,
            orderBy: { updatedAt: 'desc' },
          })
        : [],
      type === 'ALL' || type === 'organizations'
        ? prisma.organization.findMany({
            where,
            take: 100,
            orderBy: { updatedAt: 'desc' },
          })
        : [],
      type === 'ALL' || type === 'involvedpersons'
        ? prisma.involvedPerson.findMany({
            where,
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
        all: items.length,
        individuals: individuals.length,
        mediaitems: mediaItems.length,
        mediaworks: mediaWorks.length,
        organizations: organizations.length,
        involvedpersons: involvedPersons.length,
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
    ] = await Promise.all([
      prisma.individual.count({ where: { sourceLinks: { none: {} } } }),
      prisma.individual.count({ where: { crimeCategoryId: null } }),
      prisma.individual.count({ where: { OR: [{ caseLocationState: null }, { caseLocationState: '' }] } }),
      prisma.individual.count({ where: { contributingFactors: { none: {} } } }),
      prisma.mediaItem.count({ where: { individualsFeatured: { none: {} } } }),
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

module.exports = router;
