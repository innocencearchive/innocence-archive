// prisma/seedWikipedia.js

const { PrismaClient, IndividualStatus } = require('@prisma/client');
const fs = require('fs');
const { parse } = require('csv-parse/sync');

const prisma = new PrismaClient();

// --- Configuration ---
// Updated CSV file path
const csvFilePath = 'wrongful_convictions_summarized.csv'; // <-- UPDATED PATH
const informationSourceName = 'Wikipedia';
// Use this specific URL for all entries from this seed
const specificSourceUrl = 'https://en.wikipedia.org/wiki/List_of_wrongful_convictions_in_the_United_States';

// --- Dry Run Flag ---
// Set to true to log actions without writing to the database.
// Set to false to perform actual database operations.
const DRY_RUN = false; // Set to false for actual run
// --- End Configuration ---

// --- Helper Functions ---

/**
 * Parses a full name string into its components: firstName, middleName, lastName, suffix, nickname.
 * Handles common suffixes and nicknames enclosed in double quotes.
 * Assumes a single individual's name per call.
 * @param {string} fullName - The full name string to parse.
 * @returns {object} An object containing firstName, middleName, lastName, suffix, nickname. Defaults to 'Unknown' or null.
 */
function parseName(fullName) {
    const defaultResult = { firstName: 'Unknown', lastName: 'Unknown', middleName: null, suffix: null, nickname: null };
    if (!fullName || typeof fullName !== 'string') return defaultResult;

    let nameToParse = fullName.trim();
    let nickname = null;

    // 1. Extract nickname (if present in quotes)
    const nicknameMatch = nameToParse.match(/"([^"]+)"/);
    if (nicknameMatch) {
        nickname = nicknameMatch[1];
        // Remove the nickname part for further processing
        nameToParse = nameToParse.replace(/"[^"]+"/, '').replace(/\s+/, ' ').trim();
    }

    // 2. Split remaining parts
    const parts = nameToParse.split(/\s+/);
    if (parts.length === 0 || (parts.length === 1 && parts[0] === '')) {
        return defaultResult; // Return default if only whitespace or empty after nickname removal
    }

    // 3. Handle based on number of parts
    let firstName = 'Unknown';
    let middleName = null;
    let lastName = 'Unknown';
    let suffix = null;
    const commonSuffixes = ['Jr.', 'Sr.', 'II', 'III', 'IV', 'V']; // Add more if needed

    if (parts.length === 1) {
        lastName = parts[0]; // Assume single part is last name
    } else {
        firstName = parts[0];
        const lastPart = parts[parts.length - 1];

        // Check if the last part is a suffix
        if (commonSuffixes.includes(lastPart) && parts.length > 2) {
            suffix = lastPart;
            lastName = parts[parts.length - 2];
            if (parts.length > 3) {
                middleName = parts.slice(1, -2).join(' '); // Join middle parts
            }
        } else {
            // Last part is not a suffix (or only 2 parts total)
            lastName = lastPart;
            if (parts.length > 2) {
                middleName = parts.slice(1, -1).join(' '); // Join middle parts
            }
        }
    }

    // Ensure nulls are explicitly null for Prisma's unique constraint matching
    return {
        firstName: firstName || 'Unknown',
        lastName: lastName || 'Unknown',
        middleName: middleName || null,
        suffix: suffix || null,
        nickname: nickname || null
    };
}


/**
 * Safely parses a date string into a Date object.
 * @param {string} dateString - The date string to parse.
 * @returns {Date | null} A Date object or null if parsing fails or input is empty.
 */
function parseDateSafe(dateString) {
    if (!dateString) return null;
    try {
        // Attempt to handle various common date formats, prioritizing YYYY-MM-DD or MM/DD/YYYY
        // Basic check for common separators, adjust regex if needed for specific formats
        if (!/^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}$/.test(dateString) && !/^\w+ \d{1,2}, \d{4}$/.test(dateString)) {
             // If it doesn't look like a standard date, try a more lenient parse but warn
             console.warn(`Attempting lenient parse for potentially non-standard date: ${dateString}`);
        }

        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            console.warn(`Could not parse date: ${dateString}`);
            return null;
        }
        // Optional: Check if the parsed date seems reasonable (e.g., not year 0 or 5000)
        const year = date.getFullYear();
        if (year < 1800 || year > new Date().getFullYear() + 5) {
             console.warn(`Parsed date resulted in an unlikely year (${year}) for: ${dateString}. Returning null.`);
             return null;
        }
        return date;
    } catch (error) {
        console.warn(`Error parsing date "${dateString}": ${error.message}`);
        return null;
    }
}


/**
 * Parses a location string (e.g., "City, County, State" or "City, State") into components.
 * @param {string} locationString - The location string.
 * @returns {object} An object with city, county, state properties (null if not found).
 */
function parseLocation(locationString) {
    if (!locationString) return { city: null, county: null, state: null };
    const parts = locationString.split(',').map(part => part.trim());
    let city = null;
    let county = null;
    let state = null;
    // Handle based on number of parts, assuming common US formats
    if (parts.length === 3) { // City, County, State
        city = parts[0]; county = parts[1]; state = parts[2];
    } else if (parts.length === 2) { // City, State
        city = parts[0]; state = parts[1];
    } else if (parts.length === 1) { // State only (less likely useful)
        state = parts[0];
    }
    return { city, county, state };
}

// Mapping from CSV status text to Prisma Enum status
const statusMap = {
    'Yes': IndividualStatus.EXONERATED,
    'No': IndividualStatus.UNKNOWN, // Or perhaps CONVICTED? Decide based on meaning.
    'Revoked': IndividualStatus.OTHER, // Or maybe CONVICTION_OVERTURNED?
    'Partially': IndividualStatus.OTHER,
    // Add more explicit mappings if needed
};

/**
 * Maps a status string from the CSV to the corresponding IndividualStatus enum value.
 * @param {string} statusString - The status string from the CSV.
 * @returns {IndividualStatus} The mapped enum value, defaulting to UNKNOWN.
 */
function mapStatus(statusString) {
    if (!statusString) return IndividualStatus.UNKNOWN;
    const trimmedStatus = statusString.trim();
    const mapped = statusMap[trimmedStatus];
    if (mapped) return mapped;

    // Add case-insensitive checks for common values if needed
    const lowerStatus = trimmedStatus.toLowerCase();
    if (lowerStatus === 'yes') return IndividualStatus.EXONERATED;
    if (lowerStatus === 'no') return IndividualStatus.UNKNOWN; // Re-evaluate if 'No' means something else

    console.warn(`Unknown status encountered: "${statusString}". Mapping to UNKNOWN.`);
    return IndividualStatus.UNKNOWN;
}

// --- Main Seeding Logic ---
async function main() {
    console.log(`Starting seeding process from ${csvFilePath}...`);
    if (DRY_RUN) {
        console.log("--- DRY RUN MODE ENABLED ---");
        console.log("No changes will be made to the database.");
    }

    // 1. Ensure the InformationSource exists
    let wikiSource;
    try {
        if (DRY_RUN) {
            console.log(`[DRY RUN] Would ensure InformationSource "${informationSourceName}" exists (URL: ${specificSourceUrl}).`);
            // Simulate finding or creating for logging purposes
            wikiSource = { id: -1, name: informationSourceName, baseUrl: specificSourceUrl };
        } else {
            wikiSource = await prisma.informationSource.upsert({
                where: { name: informationSourceName },
                update: { baseUrl: specificSourceUrl }, // Ensure URL is updated if source exists
                create: { name: informationSourceName, baseUrl: specificSourceUrl },
            });
            console.log(`Ensured InformationSource "${informationSourceName}" exists with ID: ${wikiSource.id}`);
        }
    } catch (error) {
         console.error(`Error ensuring InformationSource "${informationSourceName}":`, error);
         return; // Stop if we can't get the source
    }


    // 2. Read and parse the CSV file
    let records;
    try {
        const fileContent = fs.readFileSync(csvFilePath, { encoding: 'utf8' });
        // Using trim option and skip_empty_lines
        records = parse(fileContent, { columns: true, skip_empty_lines: true, trim: true });
        console.log(`Read ${records.length} records from CSV.`);
    } catch (error) {
        console.error(`Error reading or parsing CSV file at ${csvFilePath}:`, error);
        return;
    }

    // 3. Process each record (findFirst-then-update/create)
    let individualsCreatedCount = 0;
    let individualsUpdatedCount = 0;
    let sourceLinksUpsertedCount = 0;
    let errorsEncountered = 0;

    for (const [index, record] of records.entries()) {
        console.log(`\nProcessing CSV Row ${index + 1}...`);

        // --- Extract data using the CORRECT header names ---
        const rawCrimeDate = record['Date of Crime'];
        const rawNameField = record['Name']; // <-- UPDATED HEADER NAME
        const rawCrime = record['Crime'];
        const rawLocation = record['Location'];
        const rawSentence = record['Sentence'];
        const rawTimeServed = record['Time Served'];
        const rawStatus = record['Status of Exoneration'];
        const rawSummary = record['Summary'];

        // --- Validate essential data ---
        if (!rawNameField || rawNameField.trim() === '') {
            console.warn(`[Row ${index + 1}] Skipping row due to missing or empty name field.`);
            errorsEncountered++;
            continue;
        }

        // --- Parse common data ONCE per row ---
        const crimeDate = parseDateSafe(rawCrimeDate);
        const { city, county, state } = parseLocation(rawLocation);
        const status = mapStatus(rawStatus);
        const sentence = rawSentence || null;
        const timeServed = rawTimeServed || null;
        const narrativeSummary = rawSummary || null;

        // Handle Crime Category: Find or create (once per row)
        let crimeCategoryId = null;
        if (rawCrime) {
            try {
                if (DRY_RUN) {
                    console.log(`[DRY RUN] [Row ${index + 1}] Would ensure CrimeCategory "${rawCrime}" exists.`);
                    crimeCategoryId = -1; // Use a placeholder ID for dry run
                } else {
                    const crimeCategory = await prisma.crimeCategory.upsert({
                        where: { crime_name: rawCrime },
                        update: {},
                        create: { crime_name: rawCrime, severity_order: 99 }, // Default severity
                    });
                    crimeCategoryId = crimeCategory.id;
                    console.log(`[Row ${index + 1}] Ensured CrimeCategory "${rawCrime}" (ID: ${crimeCategoryId}).`);
                }
            } catch (error) {
                console.error(`[Row ${index + 1}] Error upserting CrimeCategory "${rawCrime}":`, error);
                errorsEncountered++;
                continue; // Skip this row if crime category fails
            }
        } else {
             console.warn(`[Row ${index + 1}] No crime category specified.`);
        }

        // --- Process the single individual in the row ---
        try {
            // Use the parseName function on the single name from the row
            const { firstName, middleName, lastName, suffix, nickname } = parseName(rawNameField);

            // Prepare data payload for create/update
            const individualDataPayload = {
                // Note: We don't include the unique fields (firstName, etc.) here
                // as they are used in the 'where' clause for update.
                // For create, they are provided separately.
                nickname, // Update nickname if provided
                status, crimeDate, timeServed, sentence,
                caseLocationCity: city, caseLocationCounty: county, caseLocationState: state,
                narrativeSummary, crimeCategoryId,
                // disambiguationTag is null and part of the unique key, so not in payload
            };

            // Define the WHERE clause for finding the individual
            // This directly compares the fields, handling nulls correctly
            const findWhereClause = {
                firstName: firstName,
                middleName: middleName, // Pass the actual value (string or null)
                lastName: lastName,
                suffix: suffix,         // Pass the actual value (string or null)
                disambiguationTag: null // Explicitly null
            };

            let processedIndividual; // To hold the created or updated individual record

            if (DRY_RUN) {
                console.log(`[DRY RUN] [Row ${index + 1}] Would check for Individual using findFirst with WHERE: ${JSON.stringify(findWhereClause)}`);
                // Simulate finding (assume not found for simplicity, or add logic to simulate finding sometimes)
                const simulateFound = false; // Change to true sometimes to test update path logging
                if (simulateFound) {
                     console.log(`[DRY RUN] [Row ${index + 1}]   (Simulating found) Would update existing Individual.`);
                     console.log(`[DRY RUN] [Row ${index + 1}]     Update Data: ${JSON.stringify(individualDataPayload)}`);
                     individualsUpdatedCount++;
                     // Simulate the structure of the found record for ID access later
                     processedIndividual = { id: -(index + 1), ...findWhereClause, ...individualDataPayload };
                } else {
                     console.log(`[DRY RUN] [Row ${index + 1}]   (Simulating not found) Would create new Individual.`);
                     // Combine unique fields + payload for simulated create data
                     const createData = { ...findWhereClause, ...individualDataPayload };
                     console.log(`[DRY RUN] [Row ${index + 1}]     Create Data: ${JSON.stringify(createData)}`);
                     individualsCreatedCount++;
                     processedIndividual = { id: -(index + 1), ...createData }; // Simulate created record
                }

            } else {
                // ---- Attempt to find the individual using findFirst ----
                const existingIndividual = await prisma.individual.findFirst({
                    where: findWhereClause, // Use the direct field comparison
                });

                if (existingIndividual) {
                    // ---- Individual Found -> Update ----
                    // Use the ID of the found individual for the update's where clause
                    console.log(`[Row ${index + 1}] Found existing Individual ID: ${existingIndividual.id}. Updating...`);
                    processedIndividual = await prisma.individual.update({
                        where: { id: existingIndividual.id }, // Use the primary key 'id' for update
                        data: individualDataPayload, // Update with new data from CSV
                    });
                    console.log(`[Row ${index + 1}] Successfully updated Individual ID: ${processedIndividual.id}.`);
                    individualsUpdatedCount++;
                } else {
                    // ---- Individual Not Found -> Create ----
                    console.log(`[Row ${index + 1}] No existing Individual found. Creating...`);
                    // Combine unique fields + payload for create
                    const createData = {
                        firstName, middleName, lastName, suffix, disambiguationTag: null,
                        ...individualDataPayload // Add the rest of the data
                    };
                    processedIndividual = await prisma.individual.create({
                        data: createData,
                    });
                    console.log(`[Row ${index + 1}] Successfully created Individual ID: ${processedIndividual.id}.`);
                    individualsCreatedCount++;
                }
            }

            // ---- Ensure the IndividualSourceLink exists (using Upsert is fine here) ----
            // This runs *after* the individual is guaranteed to exist (either found or created)
            if (processedIndividual && processedIndividual.id) { // Ensure we have a valid ID
                 if (DRY_RUN) {
                     console.log(`[DRY RUN] [Row ${index + 1}] Would upsert IndividualSourceLink: Individual ID ${processedIndividual.id} -> Source ID ${wikiSource.id} (URL: ${specificSourceUrl})`);
                     sourceLinksUpsertedCount++;
                 } else {
                    await prisma.individualSourceLink.upsert({
                        where: {
                            individualId_specificUrl: {
                                individualId: processedIndividual.id,
                                specificUrl: specificSourceUrl,
                            }
                        },
                        create: {
                            individualId: processedIndividual.id,
                            informationSourceId: wikiSource.id,
                            specificUrl: specificSourceUrl,
                        },
                        update: {
                            informationSourceId: wikiSource.id, // Ensure source ID is correct if link existed
                        }
                    });
                    console.log(`[Row ${index + 1}] Ensured IndividualSourceLink exists for Individual ID ${processedIndividual.id} and Source URL.`);
                    sourceLinksUpsertedCount++; // Count links ensured/created
                 }
            } else if (!DRY_RUN) {
                // This case should ideally not happen if create/update succeeded
                console.error(`[Row ${index + 1}] Error: Could not get ID for processed individual "${rawNameField}" to create source link.`);
                errorsEncountered++;
            }


        } catch (error) {
            console.error(`[Row ${index + 1}] Error processing individual "${rawNameField}":`, error);
             // Log specific Prisma errors if helpful
             if (error.code) {
                console.error(`[Row ${index + 1}]   Prisma Error Code: ${error.code}`);
             }
             if (error.meta) {
                 console.error(`[Row ${index + 1}]   Prisma Error Meta: ${JSON.stringify(error.meta)}`);
             }
             // Check for unique constraint violation on the 'create' attempt if 'findFirst' failed unexpectedly
             if (error.code === 'P2002') {
                 console.error(`[Row ${index + 1}]   -> Unique constraint violation during create attempt. This might indicate an issue with the findFirst check or concurrent operations.`);
             }

            errorsEncountered++;
            // Continue to the next row on error
            continue;
        }

    } // End loop through CSV records

    console.log("\n--- Seeding Summary ---");
    if (DRY_RUN) {
        console.log("Mode: DRY RUN (No database changes were made)");
    } else {
        console.log("Mode: LIVE RUN (Database changes were attempted)");
    }
    console.log(`Total CSV rows processed: ${records.length}`);
    console.log(`Individuals created: ${individualsCreatedCount}`);
    console.log(`Individuals updated: ${individualsUpdatedCount}`);
    console.log(`IndividualSourceLinks upserted (created or updated): ${sourceLinksUpsertedCount}`);
    console.log(`Errors encountered: ${errorsEncountered}`);
    console.log("------------------------");

}

main()
    .catch((e) => {
        console.error('\n--- An Uncaught Error Occurred During Seeding ---');
        console.error(e);
        if (DRY_RUN) {
            console.warn("Reminder: DRY RUN mode was active. The error occurred during simulation or setup.");
        }
        process.exit(1);
    })
    .finally(async () => {
        if (prisma) {
            await prisma.$disconnect();
            console.log('\nPrisma client disconnected.');
        } else {
            console.log('\nPrisma client was not initialized or disconnected already.');
        }
    });
