// server/prisma/seed_files/0seedCore.js
// Step 0: Idempotently seeds core reference/lookup tables required before any entity seeding:
//   1. ContributingFactor (16 canonical ContributingFactorCode enum rows)
//   2. CrimeCategory (45 standardized NRE crime categories with severity_order)
//   3. InformationSource (core provenance sources)
//
// Usage:
//   node server/prisma/seed_files/0seedCore.js --dry-run
//   node server/prisma/seed_files/0seedCore.js

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { PrismaClient } = require('@prisma/client');
const {
  CONTRIBUTING_FACTOR_CATALOG,
  CANONICAL_CRIME_CATEGORIES,
  CORE_INFORMATION_SOURCES,
} = require('../../utils/canonicalCatalog');

const isDryRun = process.argv.includes('--dry-run');

async function main() {
  console.log('=== Step 0: Core Reference Table Seeder ===');
  if (isDryRun) {
    console.log('[DRY RUN] No database writes will be performed.\n');
    console.log(`Would upsert ${CONTRIBUTING_FACTOR_CATALOG.length} ContributingFactor rows:`);
    CONTRIBUTING_FACTOR_CATALOG.forEach((f) => console.log(`  - ${f.code}: ${f.name}`));
    console.log(`\nWould upsert ${CANONICAL_CRIME_CATEGORIES.length} CrimeCategory rows:`);
    CANONICAL_CRIME_CATEGORIES.forEach((c) => console.log(`  - [${c.severity_order}] ${c.crime_name}`));
    console.log(`\nWould upsert ${CORE_INFORMATION_SOURCES.length} InformationSource rows:`);
    CORE_INFORMATION_SOURCES.forEach((s) => console.log(`  - ${s.name} (${s.baseUrl})`));
    return;
  }

  const prisma = new PrismaClient();
  try {
    // 1. Seed 16 canonical ContributingFactors
    let factorsUpserted = 0;
    for (const factor of CONTRIBUTING_FACTOR_CATALOG) {
      await prisma.contributingFactor.upsert({
        where: { code: factor.code },
        update: {
          name: factor.name,
          description: factor.description,
          aiGenerated: false,
          verificationStatus: 'VERIFIED',
        },
        create: {
          code: factor.code,
          name: factor.name,
          description: factor.description,
          aiGenerated: false,
          verificationStatus: 'VERIFIED',
          ingestionSource: '0seedCore',
        },
      });
      factorsUpserted++;
    }
    console.log(`Upserted ${factorsUpserted} ContributingFactor rows.`);

    // 2. Seed 45 canonical CrimeCategories
    let crimesUpserted = 0;
    for (const crime of CANONICAL_CRIME_CATEGORIES) {
      await prisma.crimeCategory.upsert({
        where: { crime_name: crime.crime_name },
        update: { severity_order: crime.severity_order },
        create: {
          crime_name: crime.crime_name,
          severity_order: crime.severity_order,
        },
      });
      crimesUpserted++;
    }
    console.log(`Upserted ${crimesUpserted} CrimeCategory rows.`);

    // 3. Seed core InformationSources
    let sourcesUpserted = 0;
    for (const source of CORE_INFORMATION_SOURCES) {
      await prisma.informationSource.upsert({
        where: { name: source.name },
        update: { baseUrl: source.baseUrl },
        create: {
          name: source.name,
          baseUrl: source.baseUrl,
        },
      });
      sourcesUpserted++;
    }
    console.log(`Upserted ${sourcesUpserted} InformationSource rows.`);

    console.log('\nStep 0 complete!');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Step 0 seeding failed:', err);
  process.exit(1);
});
