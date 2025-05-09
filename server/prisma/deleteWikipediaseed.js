// prisma/deleteWikipediaSeed.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// --- Configuration ---
// The name of the source whose linked individuals you want to delete
const sourceNameToDelete = 'Wikipedia';
// --- End Configuration ---

async function main() {
  console.log(`Attempting to delete Individual records linked to source: "${sourceNameToDelete}"`);

  // 1. Find the InformationSource record
  const source = await prisma.informationSource.findUnique({
    where: { name: sourceNameToDelete },
  });

  if (!source) {
    console.log(`InformationSource "${sourceNameToDelete}" not found. No individuals to delete based on this source.`);
    return;
  }

  console.log(`Found InformationSource "${sourceNameToDelete}" with ID: ${source.id}`);

  // 2. Find Individuals linked to this source
  // We can directly use the relation in the deleteMany where clause

  // 3. Delete the linked Individuals
  try {
    // Use deleteMany with a where clause targeting the relation
    const deleteResult = await prisma.individual.deleteMany({
      where: {
        informationSources: {
          some: { // Check if 'some' of the related sources match the ID
            id: source.id,
          },
        },
      },
    });

    console.log(`Successfully deleted ${deleteResult.count} Individual records linked to "${sourceNameToDelete}".`);

  } catch (error) {
    console.error(`Error deleting individuals linked to "${sourceNameToDelete}":`, error);
  }
}

main()
  .catch((e) => {
    console.error('An error occurred during the deletion process:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('Prisma client disconnected.');
  });
