// prisma/seedNRE.js

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const humanparser = require('humanparser');

const prisma = new PrismaClient();

// --- Configuration ---
const csvFilePath = 'C:/GitHub/innocencearchive/scripts/seed_files/exoneration_list_detailed.csv';
const sourceName = 'National Registry of Exonerations';
// --- End Configuration ---

// --- Dry Run Check ---
const isDryRun = process.argv.includes('--dry-run');
// --- End Dry Run Check ---


// --- Helper function to find or handle Crime Category ---
async function getCrimeCategoryId(crimeName) {
    if (!crimeName) {
        return null;
    }
    try {
        const category = await prisma.crimeCategory.findFirst({
            where: { crime_name: { equals: crimeName, mode: 'insensitive' } },
        });
        if (category) {
            return category.id;
        } else {
            console.warn(`  -> Crime Category not found in DB for: "${crimeName}". Setting crimeCategoryId to null.`);
            return null;
        }
    } catch (error) {
        console.error(`  -> Error looking up Crime Category "${crimeName}":`, error);
        return null;
    }
}
// --- End Helper Function ---


async function main() {
    if (isDryRun) {
        console.log("--- RUNNING IN DRY RUN MODE ---");
        console.log("--- No changes will be made to the database. ---");
    }
    console.log(`Starting seeding process from ${csvFilePath}...`);

    // 1. Find or create the InformationSource
    let informationSource = await prisma.informationSource.findUnique({ where: { name: sourceName } });
    if (!informationSource) {
        console.log(`InformationSource '${sourceName}' not found.`);
        if (!isDryRun) {
            console.log(`Creating InformationSource '${sourceName}'...`);
            informationSource = await prisma.informationSource.create({ data: { name: sourceName } });
            console.log(`Created InformationSource with ID: ${informationSource.id}`);
        } else {
            console.log(`[Dry Run] Would create InformationSource '${sourceName}'.`);
            informationSource = { id: -1, name: sourceName };
        }
    } else {
        console.log(`Found InformationSource '${sourceName}' with ID: ${informationSource.id}`);
    }
     if (!informationSource || (informationSource.id === -1 && !isDryRun)) {
         console.error("Could not find or create the InformationSource. Exiting.");
         process.exit(1);
     }

    // 2. Read and parse the CSV file
    let records;
    try {
        const fileContent = fs.readFileSync(csvFilePath, { encoding: 'utf-8' });
        records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        });
        console.log(`Read ${records.length} records from CSV.`);
    } catch (error) {
        console.error(`Error reading or parsing CSV file at ${csvFilePath}:`, error);
        process.exit(1);
    }

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let linkAddedCount = 0;

    // 3. Process each record from the CSV
    for (const [index, record] of records.entries()) { // Added index for easier log tracking
        const fullNameString = record['Name'];
        const specificUrl = record['Link'];
        const stateFromCsv = record['State']?.trim() || null;
        const convictedYearFromCsv = record['ConvictedYear']?.trim() || null;
        const exoneratedYearFromCsv = record['ExoneratedYear']?.trim() || null;
        const crimeFromCsv = record['Crime']?.trim() || null;
        const disambiguationTagFromCsv = record['Disambigulation']?.trim() || null;

        console.log(`\n--- Processing Record #${index + 1}: ${fullNameString} ---`); // Log start of record processing

        if (!fullNameString || !specificUrl) {
            console.warn(`Skipping record due to missing Name or Link: ${JSON.stringify(record)}`);
            skippedCount++;
            continue;
        }

        let parsedName, firstName, middleName, lastName, suffix, disambiguationTag;

        try {
            // Parse name
            parsedName = humanparser.parseName(fullNameString);
            firstName = parsedName.firstName || 'Unknown';
            middleName = parsedName.middleName || null;
            lastName = parsedName.lastName || 'Unknown';
            suffix = parsedName.suffix || null;
            disambiguationTag = disambiguationTagFromCsv;

            if (firstName === 'Unknown' || lastName === 'Unknown') {
                 console.warn(`Could not reliably parse name: '${fullNameString}'. Skipping.`);
                 skippedCount++;
                 continue;
            }

            // *** ADDED DEBUG LOGGING ***
            const findCriteria = {
                firstName: firstName,
                middleName: middleName,
                lastName: lastName,
                suffix: suffix,
                disambiguationTag: disambiguationTag
            };
            console.log(`DEBUG: Attempting findFirst with criteria:`, JSON.stringify(findCriteria));

            // 4. Check if Individual already exists using findFirst
            let individual;
             try {
                 individual = await prisma.individual.findFirst({
                     where: findCriteria, // Use the criteria object
                     include: {
                         sourceLinks: { where: { informationSourceId: informationSource.id } }
                     }
                 });

                 // *** ADDED DEBUG LOGGING ***
                 if (individual) {
                    console.log(`DEBUG: findFirst RESULT: Found Individual ID: ${individual.id}`);
                 } else {
                    console.log(`DEBUG: findFirst RESULT: No matching individual found.`);
                 }

             } catch (findError) {
                 console.error(`Error during findFirst for: ${fullNameString} (Tag: ${disambiguationTag})`, findError);
                 skippedCount++;
                 continue;
             }

            // --- LOGIC BRANCH: Create New vs. Update Existing ---

            if (!individual) {
                // 5a. Individual doesn't exist: Create NEW record with details + link
                console.log(`Individual not found in DB: ${firstName} ${middleName || ''} ${lastName} ${suffix || ''} (Tag: ${disambiguationTag || 'None'})`);

                const convictionYearInt = convictedYearFromCsv ? parseInt(convictedYearFromCsv) : null;
                const exonerationYearInt = exoneratedYearFromCsv ? parseInt(exoneratedYearFromCsv) : null;

                let crimeCatId = null;
                 if (!isDryRun) {
                    crimeCatId = await getCrimeCategoryId(crimeFromCsv);
                 } else {
                     console.log(`  -> [Dry Run] Would look up Crime Category for: "${crimeFromCsv || 'None'}"`);
                 }


                if (!isDryRun) {
                    console.log(` -> Creating new individual with details and source link...`);
                    try {
                         individual = await prisma.individual.create({
                            data: {
                                firstName: firstName,
                                middleName: middleName,
                                lastName: lastName,
                                suffix: suffix,
                                nickname: null,
                                disambiguationTag: disambiguationTag,
                                caseLocationState: stateFromCsv,
                                convictionYear: !isNaN(convictionYearInt) ? convictionYearInt : null,
                                exonerationOrReleaseYear: !isNaN(exonerationYearInt) ? exonerationYearInt : null,
                                crimeCategoryId: crimeCatId,
                                sourceLinks: {
                                    create: {
                                        specificUrl: specificUrl,
                                        informationSourceId: informationSource.id,
                                    },
                                },
                            },
                             include: { sourceLinks: true }
                        });
                        console.log(` -> Created Individual ID: ${individual.id}`);
                        createdCount++;
                        linkAddedCount++;
                    } catch (createError) {
                         if (createError.code === 'P2002' || (createError.meta && createError.meta.target)) {
                             const targetFields = createError.meta?.target || 'unknown';
                             // More specific message for unique constraint violation on create
                             console.warn(` -> SKIPPED: Attempted to create duplicate individual (Constraint Violation on Target: ${targetFields}) for: ${fullNameString} (Tag: ${disambiguationTag})`);
                         } else {
                            console.error(` -> Error creating individual: ${fullNameString} (Tag: ${disambiguationTag})`, createError);
                         }
                         skippedCount++;
                         individual = null;
                    }
                } else {
                    console.log(` -> [Dry Run] Would create new individual with details and add source link: ${specificUrl}`);
                     createdCount++;
                     linkAddedCount++;
                     individual = { id: -createdCount, sourceLinks: [] }; // Keep dummy for dry run link logic below
                }
            } else {
                 // 5b. Individual EXISTS: ONLY add the link if it's new for this person.
                console.log(`Found existing individual in DB: ID ${individual.id} - ${firstName} ${middleName || ''} ${lastName} ${suffix || ''} (Tag: ${individual.disambiguationTag || 'None'})`);

                const existingLink = individual.sourceLinks.find(link => link.specificUrl === specificUrl);

                if (!existingLink) {
                     console.log(` -> Source link ${specificUrl} not found for this individual.`);
                     if (!isDryRun) {
                         console.log(` -> Adding new source link ONLY...`);
                         try {
                            await prisma.individualSourceLink.create({
                                data: {
                                     individualId: individual.id,
                                     informationSourceId: informationSource.id,
                                     specificUrl: specificUrl
                                 }
                            });
                            console.log(` -> Added link.`);
                            linkAddedCount++;
                            updatedCount++;
                         } catch (linkError) {
                            // Specific error for link creation failure (e.g., if corrected unique constraint on link table fails)
                             console.error(` -> Error adding source link for Individual ID ${individual.id} (URL: ${specificUrl}):`, linkError);
                             skippedCount++;
                         }
                    } else {
                        console.log(` -> [Dry Run] Would add new source link: ${specificUrl}`);
                        linkAddedCount++;
                        updatedCount++;
                    }
                } else {
                    console.log(` -> Source link ${specificUrl} already exists for this individual. Skipping link addition.`);
                }
            }

        } catch (error) {
             console.error(`General error processing record #${index + 1} (Name='${fullNameString}', URL='${specificUrl}')`, error);
             skippedCount++;
        }
    } // End loop

    console.log('\n--- Seeding Summary ---'); // Added newline for clarity
    console.log(`Processed ${records.length} records from CSV.`);
    console.log(`${isDryRun ? '[Dry Run] Would create' : 'Created'} ${createdCount} new individuals.`);
    console.log(`${isDryRun ? '[Dry Run] Would add links to' : 'Added links to'} ${updatedCount} existing individuals.`);
    console.log(`${isDryRun ? '[Dry Run] Would add' : 'Total links added'} ${linkAddedCount} new source links.`);
    console.log(`Skipped ${skippedCount} records (due to errors, missing data, constraint violations, or link failures).`); // Clarified skip reasons
    if (isDryRun) console.log("--- Reminder: DRY RUN mode was active. No database changes were made. ---");
    console.log('-----------------------------');
}

main()
    .catch((e) => {
        console.error('An unhandled error occurred during the seeding process:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        console.log('Prisma client disconnected.');
    });