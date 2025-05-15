const fs = require('fs');
const { parse } = require('csv-parse');
const { PrismaClient } = require('@prisma/client');
const human = require('humanparser'); // Ensure this is installed: npm install humanparser

// --- Configuration ---

// !!! --- SET DRY_RUN TO true FOR SIMULATION, false FOR ACTUAL SEEDING --- !!!
const DRY_RUN = false; // Set to false for actual run
// !!! ----------------------------------------------------------------- !!!

// Define the path to your LONG-format CSV file
// Make sure this points to the correct group CSV file
const inputCsvPath = 'longgroup.csv';

// Define the column names expected in your long-format CSV
const groupColumnCsv = 'GroupName';
const individualColumnCsv = 'IndividualName'; // Column containing the full name

// --- ANSI Color Codes ---
const RESET = "\x1b[0m";
const FG_RED = "\x1b[31m";
const FG_YELLOW = "\x1b[33m";

// --- Initialize Prisma Client ---
const prisma = new PrismaClient();

// --- Helper Function for Name Parsing (Adapted for Individual Schema) ---
/**
 * Parses a full name string into components matching the Individual schema's unique key.
 * Uses humanparser library.
 * @param {string} fullName - The full name string to parse.
 * @returns {object} An object containing firstName, middleName, lastName, suffix. Defaults values to null if parsing fails.
 */
function parseNameForIndividual(fullName) {
    const defaultResult = { firstName: null, middleName: null, lastName: null, suffix: null };
    if (!fullName || typeof fullName !== 'string') {
        console.warn(`${FG_YELLOW}Warning: Invalid input to parseNameForIndividual: ${fullName}${RESET}`);
        return defaultResult;
    }
    try {
        const parsedName = human.parseName(fullName.trim());

        // Extract parts, ensuring null if not present
        const firstName = parsedName.firstName || null;
        const middleName = parsedName.middleName || null;
        const lastName = parsedName.lastName || null;
        const suffix = parsedName.suffix || null; // humanparser might capture suffixes

        // Basic validation: At least first and last name should be present
        if (!firstName || !lastName) {
            console.warn(`${FG_YELLOW}Warning: Could not reliably parse '${fullName}' into first/last. Parsed: First='${firstName}', Middle='${middleName}', Last='${lastName}', Suffix='${suffix}'${RESET}`);
            return defaultResult; // Return default if essential parts are missing
        }

        return { firstName, middleName, lastName, suffix };

    } catch (error) {
        console.error(`${FG_RED}Error parsing name '${fullName}' with humanparser: ${error}${RESET}`);
        return defaultResult;
    }
}

// --- Main Seeding Function ---
async function main() {
    if (DRY_RUN) {
        console.log("--- RUNNING IN DRY RUN MODE --- (No changes will be made to the database)");
    } else {
        console.log("--- RUNNING IN LIVE MODE --- (Changes WILL be made to the database)");
    }
    console.log("Starting Group/Individual Connection seeding script...");

    // Counters
    let totalCsvRows = 0;
    let processedCount = 0;
    let connectionCount = 0;
    let errorCount = 0;
    let skippedParsingCount = 0;
    let groupsFound = 0;
    let groupsCreated = 0; // Renamed from groupsWouldCreate
    let individualsFound = 0;
    let individualsCreated = 0; // Renamed from individualsWouldCreate
    let connectionsAttempted = 0; // Renamed from connectionsWouldMake

    // 1. Read and Parse the CSV file
    console.log(`Reading CSV file from: ${inputCsvPath}`);

    const parser = fs.createReadStream(inputCsvPath)
        .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }));

    try {
        // 2. Iterate through each row (record) from the parser
        for await (const record of parser) {
            totalCsvRows++;
            const groupName = record[groupColumnCsv]?.trim();
            const individualFullName = record[individualColumnCsv]?.trim();

            // Basic validation
            if (!groupName || !individualFullName) {
                console.log(`${FG_YELLOW}Skipping row ${totalCsvRows}: Missing GroupName ('${groupName || ''}') or IndividualName ('${individualFullName || ''}').${RESET}`);
                errorCount++;
                continue;
            }

            try {
                processedCount++; // Count row as processed attempt

                // 3. Parse Individual Name using the updated helper
                const { firstName, middleName, lastName, suffix } = parseNameForIndividual(individualFullName);

                // Validate parsed name components needed for lookup/create
                if (!firstName || !lastName) { // Check essential components
                    console.log(`${FG_RED}Skipping row ${totalCsvRows}: Failed to parse essential name parts from '${individualFullName}'.${RESET}`);
                    skippedParsingCount++;
                    continue; // Skip this row if basic parsing failed
                }

                let groupId = null;
                let individualId = null;
                let groupAction = 'found'; // Track group status
                let individualAction = 'found'; // Track individual status

                // --- Group Handling (Find or Create) ---
                const existingGroup = await prisma.individualGroup.findUnique({ where: { name: groupName } });
                if (existingGroup) {
                    groupsFound++;
                    groupId = existingGroup.id;
                } else {
                    groupAction = 'create';
                    if (!DRY_RUN) {
                        const createdGroup = await prisma.individualGroup.create({ data: { name: groupName } });
                        groupId = createdGroup.id;
                        groupsCreated++;
                        console.log(`LIVE RUN: Created group '${groupName}' (ID: ${groupId})`);
                    } else {
                        groupId = `simulated_group_id_for_${groupName.replace(/\s+/g, '_')}`;
                        console.log(`DRY RUN: Would create group '${groupName}'`);
                    }
                }

                // --- Individual Handling (Find or Create using findFirst) ---
                // Define the WHERE clause for finding the individual based on the unique constraint
                const findIndividualWhere = {
                    firstName: firstName,
                    middleName: middleName, // Pass actual value (string or null)
                    lastName: lastName,
                    suffix: suffix,         // Pass actual value (string or null)
                    disambiguationTag: null // Explicitly null
                };

                let processedIndividual = null; // To store found or created individual data

                if (DRY_RUN) {
                    console.log(`DRY RUN: [Row ${totalCsvRows}] Would check for Individual using findFirst with WHERE: ${JSON.stringify(findIndividualWhere)}`);
                    // Simulate finding (assume not found for simplicity)
                    const simulateFound = false;
                    if (simulateFound) {
                        individualAction = 'found';
                        individualId = `simulated_individual_id_for_${firstName}_${lastName}`;
                        console.log(`DRY RUN: [Row ${totalCsvRows}]   (Simulating found) Individual ID: ${individualId}`);
                        individualsFound++; // Increment simulated found count
                    } else {
                        individualAction = 'create';
                        individualId = `simulated_individual_id_for_${firstName}_${lastName}`;
                        console.log(`DRY RUN: [Row ${totalCsvRows}]   (Simulating not found) Would create new Individual.`);
                        const createData = { ...findIndividualWhere, nickname: null, status: null /* Add other defaults if needed */ };
                        console.log(`DRY RUN: [Row ${totalCsvRows}]     Create Data: ${JSON.stringify(createData)}`);
                        // individualsCreated++; // Increment simulated create count below
                    }
                } else {
                    // Attempt to find the individual using findFirst
                    existingIndividual = await prisma.individual.findFirst({
                        where: findIndividualWhere,
                    });

                    if (existingIndividual) {
                        individualAction = 'found';
                        individualsFound++;
                        individualId = existingIndividual.id;
                        processedIndividual = existingIndividual; // Store for logging/use
                        console.log(`[Row ${totalCsvRows}] Found existing Individual '${firstName} ${lastName}' (ID: ${individualId}).`);
                    } else {
                        individualAction = 'create';
                        // Create the individual if not found
                        console.log(`[Row ${totalCsvRows}] No existing Individual found for '${firstName} ${lastName}'. Creating...`);
                        const createData = {
                            firstName, middleName, lastName, suffix,
                            disambiguationTag: null,
                            // Add default values for other required fields if necessary, e.g. status: 'UNKNOWN'
                            // status: IndividualStatus.UNKNOWN, // Example if status is required
                        };
                        processedIndividual = await prisma.individual.create({
                            data: createData,
                        });
                        individualId = processedIndividual.id;
                        individualsCreated++;
                        console.log(`[Row ${totalCsvRows}] Successfully created Individual (ID: ${individualId}).`);
                    }
                }


                // --- Connection Handling ---
                // Only proceed if we have valid IDs for both group and individual
                if (groupId && individualId) {
                    connectionsAttempted++;
                    if (!DRY_RUN) {
                        try {
                            // Check if connection already exists to avoid unnecessary updates
                            // Note: This adds an extra DB query but prevents errors if connection exists
                            const checkConnection = await prisma.individual.findFirst({
                                where: {
                                    id: individualId,
                                    groups: { some: { id: groupId } }
                                }
                            });

                            if (!checkConnection) {
                                await prisma.individual.update({
                                    where: { id: individualId },
                                    data: { groups: { connect: { id: groupId } } },
                                });
                                connectionCount++;
                                console.log(`LIVE RUN: Connected individual ID ${individualId} to group ID ${groupId}.`);
                            } else {
                                console.log(`LIVE RUN: Connection already exists between individual ID ${individualId} and group ID ${groupId}. Skipping update.`);
                            }
                        } catch (connectionError) {
                             console.error(`${FG_RED}[Row ${totalCsvRows}] Error connecting individual ID ${individualId} to group ID ${groupId}:${RESET}`, connectionError);
                             errorCount++; // Count connection errors
                        }
                    } else {
                        // Increment simulated counts based on action
                        if (groupAction === 'create') groupsCreated++; // Increment simulated group create count
                        if (individualAction === 'create') individualsCreated++; // Increment simulated individual create count

                        console.log(`DRY RUN: Would connect individual '${firstName} ${lastName}' (ID: ${individualId}) to group '${groupName}' (ID: ${groupId})`);
                    }
                } else {
                    console.warn(`${FG_YELLOW}[Row ${totalCsvRows}] Skipping connection: Missing valid Group ID (${groupId}) or Individual ID (${individualId}).${RESET}`);
                    // Don't increment errorCount here unless failure to get ID was unexpected
                }

            } catch (e) {
                console.error(`${FG_RED}Error processing record ${totalCsvRows} (Group: '${groupName}', Individual: '${individualFullName}'):${RESET}`, e);
                errorCount++; // Count general processing errors for the row
            }
        } // End of for await loop

        // --- Summary ---
        console.log("\n--- Seeding Summary ---");
        console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE RUN'}`);
        console.log(`Total rows in CSV: ${totalCsvRows}`);
        console.log(`Rows processed/attempted: ${processedCount}`);
        console.log("-" * 20);
        console.log(`Groups found existing: ${groupsFound}`);
        console.log(`Groups ${DRY_RUN ? 'would be' : 'were'} created: ${groupsCreated}`);
        console.log(`Individuals found existing: ${individualsFound}`);
        console.log(`Individuals ${DRY_RUN ? 'would be' : 'were'} created: ${individualsCreated}`);
        console.log(`Connections attempted: ${connectionsAttempted}`);
        console.log(`Connections ${DRY_RUN ? 'simulated' : 'successfully made'}: ${DRY_RUN ? connectionsAttempted : connectionCount}`); // Adjust dry run summary slightly
        console.log("-" * 20);
        console.log(`Rows skipped due to missing data: ${errorCount > 0 ? FG_YELLOW : ''}${errorCount}${RESET}`);
        console.log(`Rows skipped due to name parsing issues: ${skippedParsingCount > 0 ? FG_RED : ''}${skippedParsingCount}${RESET}`);
        console.log(`Processing/Connection Errors: ${errorCount > 0 ? FG_RED : ''}${errorCount}${RESET}`); // Combined error count
        console.log("-----------------------");

    } catch (error) {
        console.error(`${FG_RED}Error during CSV parsing or processing stream:${RESET}`, error);
    }
}

// --- Run main function and handle disconnection ---
main()
    .then(async () => {
        console.log("Disconnecting Prisma Client...");
        await prisma.$disconnect();
        console.log("Prisma Client disconnected.");
        console.log("Seeding script finished.");
    })
    .catch(async (e) => {
        console.error(`${FG_RED}An error occurred during seeding:${RESET}`, e);
        await prisma.$disconnect();
        console.log("Prisma Client disconnected after error.");
        process.exit(1);
    });
