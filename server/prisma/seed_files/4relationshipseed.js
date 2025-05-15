// Example path: prisma/seedConnections.js or scripts/seedConnections.js

const fs = require('fs');
const { parse } = require('csv-parse');
const { PrismaClient } = require('@prisma/client');
const human = require('humanparser'); // Ensure this is installed: npm install humanparser

// --- Configuration ---

// !!! --- SET DRY_RUN TO true FOR SIMULATION, false FOR ACTUAL SEEDING --- !!!
const DRY_RUN = false; // Set to false for actual run
// !!! ----------------------------------------------------------------- !!!

// Define the path to your LONG-format CSV file for connections
// Adjust the path as needed relative to where you run the script from
const inputCsvPath = 'connected_convictions_long_format.csv';

// Define the column names expected in your long-format connection CSV
const relationshipColumnCsv = 'Relationship'; // Identifies the group of connected people
const individualColumnCsv = 'IndividualName'; // Name of the person in the relationship

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
    console.log("Starting Related Individuals connection seeding script...");

    // Counters
    let totalCsvRows = 0;
    let processedRelationships = 0;
    let individualsFound = 0;
    let individualsCreated = 0; // Renamed
    let connectionsAttempted = 0; // Renamed
    let actualConnectionsMade = 0;
    let skippedParsingCount = 0;
    let errorCount = 0;

    // Store individuals grouped by relationship identifier
    const relationships = {};

    // 1. Read and Parse the CSV file, Grouping by Relationship
    console.log(`Reading CSV file from: ${inputCsvPath}`);
    const parser = fs.createReadStream(inputCsvPath)
        .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }));

    try {
        for await (const record of parser) {
            totalCsvRows++;
            const relationshipId = record[relationshipColumnCsv]?.trim();
            const individualFullName = record[individualColumnCsv]?.trim();

            if (!relationshipId || !individualFullName) {
                console.log(`${FG_YELLOW}Skipping row ${totalCsvRows}: Missing Relationship ('${relationshipId || ''}') or IndividualName ('${individualFullName || ''}').${RESET}`);
                errorCount++;
                continue;
            }

            // Add individual to the relationship group
            if (!relationships[relationshipId]) {
                relationships[relationshipId] = [];
            }
            relationships[relationshipId].push(individualFullName);
        }
        console.log(`Finished reading CSV. Found ${Object.keys(relationships).length} unique relationship identifiers.`);

        // 2. Process each relationship group
        console.log("Processing relationship groups...");
        for (const relationshipId in relationships) {
            const members = relationships[relationshipId];
            if (members.length < 2) {
                console.log(`${FG_YELLOW}Skipping relationship '${relationshipId}': Needs at least 2 members to form a connection.${RESET}`);
                continue; // Need at least two people for a connection
            }

            processedRelationships++;
            const memberDbIds = []; // Store database IDs for members of this group
            const memberNames = {}; // Store names associated with IDs for logging

            // 3. Find or Create Individuals for this group
            console.log(`Processing relationship: '${relationshipId}' with ${members.length} members...`);
            for (const individualFullName of members) {
                let individualId = null; // Reset for each member
                let individualAction = 'found'; // Default status

                try {
                    // Parse name using the correct helper
                    const { firstName, middleName, lastName, suffix } = parseNameForIndividual(individualFullName);

                    // Validate parsed name
                    if (!firstName || !lastName) {
                        console.log(`${FG_RED}Skipping individual '${individualFullName}' in relationship '${relationshipId}': Failed to parse name.${RESET}`);
                        skippedParsingCount++;
                        continue; // Skip this individual if parsing failed
                    }

                    // Define the WHERE clause for finding the individual
                    const findIndividualWhere = {
                        firstName: firstName,
                        middleName: middleName, // Pass actual value (string or null)
                        lastName: lastName,
                        suffix: suffix,         // Pass actual value (string or null)
                        disambiguationTag: null // Explicitly null
                    };

                    let processedIndividual = null; // To store found or created individual

                    if (DRY_RUN) {
                        console.log(`DRY RUN: [Rel: ${relationshipId}] Would check for Individual using findFirst with WHERE: ${JSON.stringify(findIndividualWhere)}`);
                        // Simulate finding (assume not found for simplicity)
                        const simulateFound = false;
                        if (simulateFound) {
                            individualAction = 'found';
                            individualId = `simulated_id_${firstName}_${lastName}`;
                            console.log(`DRY RUN: [Rel: ${relationshipId}]   (Simulating found) Individual ID: ${individualId}`);
                            individualsFound++;
                        } else {
                            individualAction = 'create';
                            individualId = `simulated_id_${firstName}_${lastName}`;
                            console.log(`DRY RUN: [Rel: ${relationshipId}]   (Simulating not found) Would create new Individual.`);
                            const createData = { ...findIndividualWhere, nickname: null, status: null /* Add other defaults */ };
                            console.log(`DRY RUN: [Rel: ${relationshipId}]     Create Data: ${JSON.stringify(createData)}`);
                            individualsCreated++; // Increment simulated create count here
                        }
                    } else {
                        // Attempt to find the individual using findFirst
                        const existingIndividual = await prisma.individual.findFirst({
                            where: findIndividualWhere,
                        });

                        if (existingIndividual) {
                            individualAction = 'found';
                            individualsFound++;
                            individualId = existingIndividual.id;
                            processedIndividual = existingIndividual;
                            console.log(`[Rel: ${relationshipId}] Found existing Individual '${firstName} ${lastName}' (ID: ${individualId}).`);
                        } else {
                            individualAction = 'create';
                            // Create the individual if not found
                            console.log(`[Rel: ${relationshipId}] No existing Individual found for '${firstName} ${lastName}'. Creating...`);
                            const createData = {
                                firstName, middleName, lastName, suffix,
                                disambiguationTag: null,
                                // Add default values for other required fields if necessary
                                // status: IndividualStatus.UNKNOWN, // Example
                            };
                            processedIndividual = await prisma.individual.create({
                                data: createData,
                            });
                            individualId = processedIndividual.id;
                            individualsCreated++;
                            console.log(`[Rel: ${relationshipId}] Successfully created Individual (ID: ${individualId}).`);
                        }
                    }

                    // Store valid ID and name for connection phase
                    if (individualId) {
                         memberDbIds.push(individualId);
                         memberNames[individualId] = `${firstName} ${lastName}`; // Store name for logging
                    }

                } catch (e) {
                    console.error(`${FG_RED}Error processing individual '${individualFullName}' in relationship '${relationshipId}':${RESET}`, e);
                    errorCount++;
                }
            } // End loop through members of a group

            // 4. Create connections between members of the group
            if (memberDbIds.length >= 2) {
                console.log(`Attempting to connect ${memberDbIds.length} individuals for relationship '${relationshipId}'...`);
                // Iterate through all unique pairs within the group
                for (let i = 0; i < memberDbIds.length; i++) {
                    for (let j = i + 1; j < memberDbIds.length; j++) {
                        const id1 = memberDbIds[i];
                        const id2 = memberDbIds[j];
                        const name1 = memberNames[id1] || `ID ${id1}`; // Get names for logging
                        const name2 = memberNames[id2] || `ID ${id2}`;

                        connectionsAttempted++;

                        // Skip actual DB call in dry run
                        if (DRY_RUN) {
                             console.log(`DRY RUN: Would connect '${name1}' (ID: ${id1}) with '${name2}' (ID: ${id2}) for relationship '${relationshipId}'`);
                             continue;
                        }

                        // Connect id1 to id2 (Prisma handles the symmetric relation)
                        try {
                            // Optional: Check if connection already exists (adds query but safer)
                            const checkConnection = await prisma.individual.findFirst({
                                where: {
                                    id: id1,
                                    relatedIndividuals: { some: { id: id2 } }
                                }
                            });

                            if (!checkConnection) {
                                await prisma.individual.update({
                                    where: { id: id1 },
                                    data: {
                                        relatedIndividuals: { connect: { id: id2 } },
                                    },
                                });
                                actualConnectionsMade++;
                                console.log(`LIVE RUN: Connected '${name1}' (ID: ${id1}) to '${name2}' (ID: ${id2}).`);
                            } else {
                                console.log(`LIVE RUN: Connection already exists between '${name1}' (ID: ${id1}) and '${name2}' (ID: ${id2}). Skipping.`);
                            }
                        } catch (connectError) {
                             console.error(`${FG_RED}Error connecting '${name1}' (ID: ${id1}) to '${name2}' (ID: ${id2}):${RESET}`, connectError);
                             errorCount++;
                        }
                    }
                }
            } else {
                 console.log(`${FG_YELLOW}Could not establish connections for relationship '${relationshipId}': Fewer than 2 valid individuals found/created.${RESET}`);
            }

        } // End loop through relationships

        // --- Summary ---
        console.log("\n--- Connection Seeding Summary ---");
        console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE RUN'}`);
        console.log(`Total rows in CSV: ${totalCsvRows}`);
        console.log(`Unique relationship identifiers found: ${Object.keys(relationships).length}`);
        console.log(`Relationships processed (>=2 members): ${processedRelationships}`);
        console.log("-" * 20);
        console.log(`Individuals found existing: ${individualsFound}`);
        console.log(`Individuals ${DRY_RUN ? 'would be' : 'were'} created: ${individualsCreated}`);
        console.log(`Connections attempted: ${connectionsAttempted}`);
        console.log(`Connections ${DRY_RUN ? 'simulated' : 'successfully made'}: ${DRY_RUN ? connectionsAttempted : actualConnectionsMade}`);
        console.log("-" * 20);
        console.log(`Rows skipped due to missing data: ${errorCount > 0 ? FG_YELLOW : ''}${errorCount}${RESET}`); // This counter might be less relevant now
        console.log(`Individuals skipped due to name parsing issues: ${skippedParsingCount > 0 ? FG_RED : ''}${skippedParsingCount}${RESET}`);
        console.log(`Processing/Connection Errors: ${errorCount > 0 ? FG_RED : ''}${errorCount}${RESET}`);
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
        console.log("Connection seeding script finished.");
    })
    .catch(async (e) => {
        console.error(`${FG_RED}An error occurred during connection seeding:${RESET}`, e);
        await prisma.$disconnect();
        console.log("Prisma Client disconnected after error.");
        process.exit(1);
    });
