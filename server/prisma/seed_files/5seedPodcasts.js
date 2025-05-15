// Example path: scripts/seedPodcasts.js

const fs = require('fs').promises; // Use promises version of fs
const path = require('path');
// Import necessary Enums along with PrismaClient
const { PrismaClient, MediaWorkType, MediaItemType, IndividualStatus, InvolvedPersonRole } = require('@prisma/client');
const human = require('humanparser'); // Ensure installed: npm install humanparser
const glob = require('glob'); // Ensure installed: npm install glob

// --- Configuration ---

// !!! --- SET DRY_RUN TO true FOR SIMULATION, false FOR ACTUAL SEEDING --- !!!
const DRY_RUN = false; // Set to true to enable dry run and conflict checks
// !!! ----------------------------------------------------------------- !!!

// Define the input directory containing the ENHANCED JSON files (from Phase 2)
const inputJsonDir = 'C:/GitHub/innocencearchive/scripts/podcast_project/enhance'; // Adjust path as needed

// --- ANSI Color Codes ---
const RESET = "\x1b[0m";
const FG_RED = "\x1b[31m";
const FG_YELLOW = "\x1b[33m";
const FG_GREEN = "\x1b[32m";
const FG_CYAN = "\x1b[36m";
const FG_MAGENTA = "\x1b[35m";

// --- Initialize Prisma Client ---
const prisma = new PrismaClient();

// --- Global variables for storing dry run warnings/errors ---
let potentialDisambiguationConflicts = []; // Stores disambiguation warnings
let fileProcessingErrors = []; // Stores general file processing errors

// --- Helper Functions ---

/**
 * Parses a full name string into components matching the Individual/InvolvedPerson schema's unique key.
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


// --- Upsert/Find Helpers ---

// Updated upsertMediaWork using findFirst + create/update
async function upsertMediaWork(data) {
    const title = data?.mediaWorkTitle?.trim();
    if (!title) {
        console.log(`${FG_YELLOW}Skipping MediaWork: Missing title.${RESET}`);
        return null;
    }
    // Prepare data payload for create/update
    const workDataPayload = {
        // title is used in where clause, not payload for update
        workType: MediaWorkType.PODCAST_SERIES, // Assuming all are podcast series
        creatorName: data?.mediaItem?.hosts?.split(',')[0]?.trim() ?? null,
        publicationOrReleaseYear: data?.mediaItem?.releaseYear ? parseInt(data.mediaItem.releaseYear, 10) : null,
        publisherOrNetwork: data?.mediaItem?.network ?? null,
        focusOrTheme: data?.mediaItem?.focusTheme_Work ?? null,
        summaryNotes: data?.mediaItem?.summaryNotes_Work ?? null,
        availabilityNotes: data?.mediaItem?.availabilityNotes_Work ?? null,
        sourceUrl: data?.mediaItem?.sourceUrl_Work ?? null,
    };
    // Clean payload data
    Object.keys(workDataPayload).forEach(key => (
        workDataPayload[key] === undefined ||
        workDataPayload[key] === null ||
        (typeof workDataPayload[key] === 'number' && isNaN(workDataPayload[key]))
     ) ? delete workDataPayload[key] : {});

    // Define find criteria (using title, which is not unique, so use findFirst)
    const findMediaWorkWhere = { title: title };

    if (DRY_RUN) {
        console.log(`DRY RUN: Would check for MediaWork using findFirst with WHERE: ${JSON.stringify(findMediaWorkWhere)}`);
        // Simulate finding
        const existing = await prisma.mediaWork.findFirst({ where: findMediaWorkWhere, select: { id: true, title: true } });

        if (existing) {
            const simulatedId = existing.id;
            console.log(`DRY RUN:   (Simulating found) MediaWork ID: ${simulatedId}`);
            console.log(`DRY RUN:   Would update with data: ${JSON.stringify(workDataPayload)}`);
            return { id: simulatedId, title: title, ...workDataPayload }; // Return simulated record
        } else {
            const simulatedId = `simulated_mw_${title.replace(/\s+/g, '_')}`;
            console.log(`DRY RUN:   (Simulating not found) Would create new MediaWork.`);
            const createData = { title: title, ...workDataPayload }; // Add title for create
            console.log(`DRY RUN:     Create Data: ${JSON.stringify(createData)}`);
            return { id: simulatedId, ...createData }; // Return simulated record
        }
    } else {
        // ---- LIVE RUN: Attempt to find the MediaWork using findFirst ----
        const existingMediaWork = await prisma.mediaWork.findFirst({
            where: findMediaWorkWhere,
        });

        if (existingMediaWork) {
            // ---- MediaWork Found -> Update ----
            console.log(`Found existing MediaWork '${title}' (ID: ${existingMediaWork.id}). Updating...`);
            try {
                return await prisma.mediaWork.update({
                    where: { id: existingMediaWork.id }, // Use the primary key 'id' for update
                    data: workDataPayload, // Update with new data
                });
            } catch (updateError) {
                 console.error(`${FG_RED}Error updating MediaWork ID ${existingMediaWork.id}: ${updateError.message}${RESET}`);
                 return null; // Return null on failure
            }
        } else {
            // ---- MediaWork Not Found -> Create ----
            console.log(`No existing MediaWork found for '${title}'. Creating...`);
            // Combine title + payload for create
            const createData = {
                title: title,
                ...workDataPayload
            };
            try {
                return await prisma.mediaWork.create({
                    data: createData,
                });
            } catch (createError) {
                 console.error(`${FG_RED}Error creating MediaWork '${title}': ${createError.message}${RESET}`);
                 // Check for potential unique constraint violations if any were added later
                 if (createError.code === 'P2002') {
                      console.error(`${FG_RED}  -> Unique constraint violation on create. Check schema and data.${RESET}`);
                 }
                 return null; // Return null on failure
            }
        }
    }
}


// Simplified Status Mapping (Extend as needed)
function mapIndividualStatus(statusString) {
    if (!statusString) return null; // Return null if no status provided
    const lowerStatus = statusString.toLowerCase().trim();
    if (lowerStatus.includes('exonerated')) return IndividualStatus.EXONERATED;
    if (lowerStatus.includes('alford plea')) return IndividualStatus.RELEASED_ALFORD_PLEA;
    if (lowerStatus.includes('clemency') || lowerStatus.includes('pardon') || lowerStatus.includes('commutation')) return IndividualStatus.RELEASED_CLEMENCY;
    if (lowerStatus.includes('overturned')) return IndividualStatus.CONVICTION_OVERTURNED;
    if (lowerStatus.includes('released') || lowerStatus.includes('paroled')) return IndividualStatus.RELEASED_TIME_SERVED; // More generic release
    if (lowerStatus.includes('executed')) return IndividualStatus.EXECUTED;
    if (lowerStatus.includes('convicted') || lowerStatus.includes('incarcerated')) return IndividualStatus.CONVICTED;
    // Add more mappings based on your data
    return IndividualStatus.UNKNOWN; // Default if no match
}

// Updated upsertIndividual using findFirst + create/update
async function upsertIndividual(fullName, details = {}) {
    // Use the correct parsing function
    const { firstName, middleName, lastName, suffix } = parseNameForIndividual(fullName);
    if (!firstName || !lastName) {
        console.log(`${FG_YELLOW}Skipping Individual upsert: Invalid name '${fullName}'.${RESET}`);
        return null;
    }

    // Define the WHERE clause for finding the individual (with null disambiguationTag)
    const findIndividualWhere = {
        firstName: firstName,
        middleName: middleName, // Pass actual value (string or null)
        lastName: lastName,
        suffix: suffix,         // Pass actual value (string or null)
        disambiguationTag: null // Explicitly null for this seed
    };

    // Prepare data payload for create/update (fields other than the unique key)
    const individualDataPayload = {
        // nickname: details.nickname ?? null, // Add if nickname is available in details
        status: mapIndividualStatus(details.status),
        convictionYear: details.convictionYear ? parseInt(details.convictionYear.match(/\d{4}/)?.[0], 10) : null,
        exonerationOrReleaseYear: details.exonerationYear ? parseInt(details.exonerationYear.match(/\d{4}/)?.[0], 10) : null,
        timeServed: details.timeServed ?? null,
        sentence: details.sentence ?? null,
        caseLocationState: details.caseLocation?.split(',').pop()?.trim() ?? null, // Basic state extraction
        // Add other fields from 'details' if available, e.g., narrativeSummary
        narrativeSummary: details.narrativeSummary ?? null,
    };
    // Clean payload data: remove null/undefined/NaN keys
    Object.keys(individualDataPayload).forEach(key => (
        individualDataPayload[key] === undefined ||
        individualDataPayload[key] === null ||
        individualDataPayload[key] === '' ||
        (typeof individualDataPayload[key] === 'number' && isNaN(individualDataPayload[key]))
    ) ? delete individualDataPayload[key] : {});


    if (DRY_RUN) {
        console.log(`DRY RUN: Would check for Individual using findFirst with WHERE: ${JSON.stringify(findIndividualWhere)}`);

        // --- CHECK FOR POTENTIAL DISAMBIGUATION CONFLICTS ---
        try {
            const potentialConflicts = await prisma.individual.findMany({
                where: {
                    firstName: firstName,
                    middleName: middleName,
                    lastName: lastName,
                    suffix: suffix,
                    disambiguationTag: { not: null } // Find records with the SAME name parts but a NON-NULL tag
                },
                select: { id: true, disambiguationTag: true } // Select relevant fields
            });

            if (potentialConflicts.length > 0) {
                // --- STORE WARNING INSTEAD OF LOGGING ---
                let conflictMessage = `${FG_YELLOW}    [Potential Conflict] For '${fullName}': Found ${potentialConflicts.length} existing individual(s) with same name but different tags:${RESET}\n`;
                potentialConflicts.forEach(p => {
                    conflictMessage += `${FG_YELLOW}      - Existing ID: ${p.id}, Existing Tag: '${p.disambiguationTag}'${RESET}\n`;
                });
                conflictMessage += `${FG_YELLOW}    -> This script would upsert/create with disambiguationTag: null.${RESET}`;
                potentialDisambiguationConflicts.push(conflictMessage); // Add formatted message to the array
            }
        } catch (checkError) {
             // Log error during check immediately, but store a simpler message
             console.error(`${FG_RED}    [DRY RUN ERROR] Failed to check for potential disambiguation conflicts for '${fullName}': ${checkError.message}${RESET}`);
             potentialDisambiguationConflicts.push(`${FG_RED}    [Error] Failed conflict check for '${fullName}'.${RESET}`);
        }
        // --- END OF CONFLICT CHECK MODIFICATION ---


        // Simulate finding the target record (with null tag)
        const existingTarget = await prisma.individual.findFirst({ where: findIndividualWhere, select: { id: true } });

        if (existingTarget) {
            const simulatedId = existingTarget.id; // Use real ID if found during dry run check
            console.log(`DRY RUN:   (Simulating found target) Individual ID: ${simulatedId}`);
            console.log(`DRY RUN:   Would update with data: ${JSON.stringify(individualDataPayload)}`);
            // Construct a simulated record for return (important for connection logic)
            return { id: simulatedId, firstName, middleName, lastName, suffix, disambiguationTag: null, ...individualDataPayload };
        } else {
            const simulatedId = `simulated_ind_${firstName}_${lastName}`;
            console.log(`DRY RUN:   (Simulating target not found) Would create new Individual.`);
            const createData = { ...findIndividualWhere, ...individualDataPayload };
            console.log(`DRY RUN:     Create Data: ${JSON.stringify(createData)}`);
            return { id: simulatedId, ...createData }; // Return simulated record
        }
    } else {
        // ---- LIVE RUN: Attempt to find the individual using findFirst ----
        const existingIndividual = await prisma.individual.findFirst({
            where: findIndividualWhere,
        });

        if (existingIndividual) {
            // ---- Individual Found -> Update ----
            console.log(`Found existing Individual '${firstName} ${lastName}' (ID: ${existingIndividual.id}). Updating...`);
            try {
                return await prisma.individual.update({
                    where: { id: existingIndividual.id }, // Use the primary key 'id' for update
                    data: individualDataPayload, // Update with new data from CSV/JSON
                });
            } catch (updateError) {
                 console.error(`${FG_RED}Error updating Individual ID ${existingIndividual.id}: ${updateError.message}${RESET}`);
                 return null; // Return null on failure
            }
        } else {
            // ---- Individual Not Found -> Create ----
            console.log(`No existing Individual found for '${firstName} ${lastName}'. Creating...`);
            // Combine unique fields + payload for create
            const createData = {
                ...findIndividualWhere, // Includes firstName, middleName, lastName, suffix, disambiguationTag
                ...individualDataPayload // Add the rest of the data
            };
            try {
                return await prisma.individual.create({
                    data: createData,
                });
            } catch (createError) {
                 console.error(`${FG_RED}Error creating Individual '${firstName} ${lastName}': ${createError.message}${RESET}`);
                 // Check if it was a unique constraint violation despite findFirst failing (race condition?)
                 if (createError.code === 'P2002') {
                      console.error(`${FG_RED}  -> Unique constraint violation on create. Record might have been created concurrently.${RESET}`);
                 }
                 return null; // Return null on failure
            }
        }
    }
}

// Simplified Role Mapping (Extend as needed)
function mapPersonRole(roleString) {
    if (!roleString) return InvolvedPersonRole.UNKNOWN; // Default if null/empty
    const lowerRole = roleString.toLowerCase().trim();

    // Prioritize more specific roles
    if (lowerRole.includes('prosecutor')) return InvolvedPersonRole.LAWYER_PROSECUTION;
    if (lowerRole.includes('defense') || lowerRole.includes('attorney')) return InvolvedPersonRole.LAWYER_DEFENSE; // Catch-all for defense
    if (lowerRole.includes('judge')) return InvolvedPersonRole.JUDGE;
    if (lowerRole.includes('detective')) return InvolvedPersonRole.POLICE_DETECTIVE;
    if (lowerRole.includes('officer')) return InvolvedPersonRole.POLICE_OFFICER;
    if (lowerRole.includes('expert')) return InvolvedPersonRole.WITNESS_EXPERT;
    if (lowerRole.includes('informant')) return InvolvedPersonRole.WITNESS_INFORMANT;
    if (lowerRole.includes('alibi')) return InvolvedPersonRole.WITNESS_ALIBI;
    if (lowerRole.includes('eyewitness')) return InvolvedPersonRole.WITNESS_EYEWITNESS;
    if (lowerRole.includes('witness')) return InvolvedPersonRole.WITNESS_EYEWITNESS; // Generic witness if specific type unknown
    if (lowerRole.includes('victim')) return InvolvedPersonRole.VICTIM;
    if (lowerRole.includes('family')) return InvolvedPersonRole.FAMILY_MEMBER;
    if (lowerRole.includes('journalist')) return InvolvedPersonRole.JOURNALIST;
    if (lowerRole.includes('author')) return InvolvedPersonRole.AUTHOR;
    if (lowerRole.includes('director')) return InvolvedPersonRole.DIRECTOR;
    if (lowerRole.includes('host')) return InvolvedPersonRole.HOST;
    if (lowerRole.includes('activist')) return InvolvedPersonRole.ACTIVIST;
    if (lowerRole.includes('accuser')) return InvolvedPersonRole.ACCUSER;
    if (lowerRole.includes('perpetrator')) return InvolvedPersonRole.ACTUAL_PERPETRATOR;
    if (lowerRole.includes('co-defendant') || lowerRole.includes('codefendant')) return InvolvedPersonRole.CO_DEFENDANT;

    // Less specific roles
    if (lowerRole.includes('lawyer')) return InvolvedPersonRole.LAWYER_DEFENSE; // Default lawyer to defense if side unknown
    if (lowerRole.includes('police')) return InvolvedPersonRole.POLICE_OFFICER; // Default police to officer

    return InvolvedPersonRole.OTHER; // Use OTHER if no match
}


// Updated upsertInvolvedPerson using findFirst + create/update
async function upsertInvolvedPerson(fullName, roleGuess = null) {
    // Use the correct parsing function
    const { firstName, middleName, lastName, suffix } = parseNameForIndividual(fullName);
    if (!firstName || !lastName) {
        console.log(`${FG_YELLOW}Skipping InvolvedPerson upsert: Invalid name '${fullName}'.${RESET}`);
        return null;
    }

    // Define the WHERE clause for finding the person (unique key for InvolvedPerson)
    const findPersonWhere = {
        firstName: firstName,
        middleName: middleName, // Pass actual value (string or null)
        lastName: lastName,
        suffix: suffix,         // Pass actual value (string or null)
        // Note: InvolvedPerson does NOT have disambiguationTag in its unique constraint
    };

    // Prepare data payload for create/update
    const personDataPayload = {
        role: mapPersonRole(roleGuess),
        // Add other fields like 'notes' if available
        // notes: details.notes ?? null,
    };
    // Clean payload data
    Object.keys(personDataPayload).forEach(key => (
        personDataPayload[key] === undefined || personDataPayload[key] === null
    ) ? delete personDataPayload[key] : {});


    if (DRY_RUN) {
        console.log(`DRY RUN: Would check for InvolvedPerson using findFirst with WHERE: ${JSON.stringify(findPersonWhere)}`);
        // Simulate finding
        // Use findFirst for simulation check as well
        const existingTarget = await prisma.involvedPerson.findFirst({ where: findPersonWhere, select: { id: true } });

        if (existingTarget) {
             const simulatedId = existingTarget.id;
             console.log(`DRY RUN:   (Simulating found) InvolvedPerson ID: ${simulatedId}`);
             console.log(`DRY RUN:   Would update with data: ${JSON.stringify(personDataPayload)}`);
             return { id: simulatedId, ...findPersonWhere, ...personDataPayload };
        } else {
             const simulatedId = `simulated_ip_${firstName}_${lastName}`;
             console.log(`DRY RUN:   (Simulating not found) Would create new InvolvedPerson.`);
             const createData = { ...findPersonWhere, ...personDataPayload };
             console.log(`DRY RUN:     Create Data: ${JSON.stringify(createData)}`);
             return { id: simulatedId, ...createData };
        }
    } else {
        // ---- LIVE RUN: Attempt to find the person using findFirst ----
        const existingPerson = await prisma.involvedPerson.findFirst({
            where: findPersonWhere,
        });

        if (existingPerson) {
            // ---- Person Found -> Update ----
            console.log(`Found existing InvolvedPerson '${firstName} ${lastName}' (ID: ${existingPerson.id}). Updating...`);
            try {
                return await prisma.involvedPerson.update({
                    where: { id: existingPerson.id }, // Use the primary key 'id'
                    data: personDataPayload, // Update with new role/data
                });
            } catch (updateError) {
                console.error(`${FG_RED}Error updating InvolvedPerson ID ${existingPerson.id}: ${updateError.message}${RESET}`);
                return null;
            }
        } else {
            // ---- Person Not Found -> Create ----
            console.log(`No existing InvolvedPerson found for '${firstName} ${lastName}'. Creating...`);
            // Combine unique fields + payload for create
            const createData = {
                ...findPersonWhere, // Includes firstName, middleName, lastName, suffix
                ...personDataPayload // Add role and any other data
            };
            try {
                return await prisma.involvedPerson.create({
                    data: createData,
                });
            } catch (createError) {
                 console.error(`${FG_RED}Error creating InvolvedPerson '${firstName} ${lastName}': ${createError.message}${RESET}`);
                 if (createError.code === 'P2002') {
                      console.error(`${FG_RED}  -> Unique constraint violation on create. Record might have been created concurrently.${RESET}`);
                 }
                 return null;
            }
        }
    }
}


async function upsertOrganization(orgName) {
    const name = orgName?.trim();
     if (!name) {
         console.log(`${FG_YELLOW}Skipping Organization upsert: Invalid name '${orgName}'.${RESET}`);
         return null;
     }
     // TODO: Add logic to guess OrganizationType based on name?
     const orgData = { name: name };

    if (DRY_RUN) {
        // Use findUnique for simulation check
        const existing = await prisma.organization.findUnique({ where: { name: name }, select: { id: true, name: true } });
        if (existing) {
            console.log(`DRY RUN: Found Organization: '${name}' (ID: ${existing.id})`);
            return existing;
        } else {
            console.log(`DRY RUN: Would create Organization: '${name}'`);
            return { id: `simulated_org_${name.replace(/\s+/g, '_')}`, ...orgData };
        }
    } else {
         try {
             return await prisma.organization.upsert({
                 where: { name: name },
                 create: orgData,
                 update: {}, // Nothing to update if found based on name
             });
         } catch (orgError) {
              console.error(`${FG_RED}Error upserting Organization '${name}': ${orgError.message}${RESET}`);
              return null;
         }
    }
}

// Assumes ContributingFactors are pre-seeded or managed elsewhere
async function findContributingFactor(factorName) {
     const name = factorName?.trim();
     if (!name) return null;

     // Try exact match first (case-sensitive based on DB collation)
     let factor = null;
     try {
        factor = await prisma.contributingFactor.findUnique({
             where: { name: name },
             select: { id: true, name: true }
         });
     } catch (findError) {
         console.error(`${FG_RED}Error finding Contributing Factor '${name}': ${findError.message}${RESET}`);
         return null;
     }

     if (!factor) {
         console.log(`${FG_YELLOW}Warning: Contributing Factor '${name}' not found in database. Add it manually or refine matching.${RESET}`);
         return null;
     }
     if (DRY_RUN) {
         console.log(`DRY RUN: Found Contributing Factor: '${factor.name}' (ID: ${factor.id})`);
     }
     return factor;
}

// Using findFirst + create/update for MediaItem as well, assuming title isn't strictly unique globally
async function upsertMediaItem(mediaWorkId, data) {
    // Ensure mediaWorkId is a valid number or a simulated string ID during dry run
    const isValidWorkId = (typeof mediaWorkId === 'number' && !isNaN(mediaWorkId)) || (DRY_RUN && typeof mediaWorkId === 'string');
    if (!isValidWorkId) {
        console.error(`${FG_RED}Skipping MediaItem upsert: Invalid mediaWorkId (${mediaWorkId}).${RESET}`);
        return null;
    }

    const itemDataPayload = {
        // workId is part of the key, not payload for update
        itemTitle: data?.itemTitle?.trim() ?? null,
        itemNumber: data?.itemNumber?.trim() ?? null,
        itemMediaType: MediaItemType.PODCAST_EPISODE, // Assuming
        hostOrNarrator: data?.hosts?.trim() ?? null,
        summaryNotes: data?.summaryNotes?.trim() ?? null,
        keyQuotes: data?.keyQuotesRaw?.join('\n---\n') ?? null,
        focusOrTheme: data?.focusTheme_Item ?? null, // Assuming separate field
        releaseDate: data?.releaseDate ? parseDateSafe(data.releaseDate) : null, // Parse release date
        sourceUrl: data?.sourceUrl_Item ?? null, // Assuming separate field
    };
    // Clean payload
    Object.keys(itemDataPayload).forEach(key => (
        itemDataPayload[key] === undefined || itemDataPayload[key] === null || itemDataPayload[key] === ''
    ) ? delete itemDataPayload[key] : {});


    if (!itemDataPayload.itemTitle || !mediaWorkId) { // Need title and workId
         console.log(`${FG_YELLOW}Skipping MediaItem upsert: Missing itemTitle or valid mediaWorkId.${RESET}`);
         return null;
    }

    // Define find criteria (less ideal than unique constraint, use title within work)
    // Use a placeholder workId if it's simulated
    const findMediaItemWhere = {
        workId: typeof mediaWorkId === 'number' ? mediaWorkId : -999, // Use real ID or placeholder for find
        itemTitle: itemDataPayload.itemTitle
    };

    if (DRY_RUN) {
        console.log(`DRY RUN: Would check for MediaItem using findFirst with WHERE: ${JSON.stringify(findMediaItemWhere)} (Work ID: ${mediaWorkId})`);
        // Simulate finding based on title and the original (potentially simulated) workId
        let existing = null;
        if (typeof mediaWorkId === 'number') { // Only query DB if workId is real
             existing = await prisma.mediaItem.findFirst({ where: findMediaItemWhere, select: { id: true } });
        }
        if (existing) {
            const simulatedId = existing.id;
            console.log(`DRY RUN:   (Simulating found) MediaItem ID: ${simulatedId}`);
            console.log(`DRY RUN:   Would update with data: ${JSON.stringify(itemDataPayload)}`);
            return { id: simulatedId, workId: mediaWorkId, ...itemDataPayload };
        } else {
            const simulatedId = `simulated_mi_${itemDataPayload.itemTitle?.replace(/\s+/g, '_')}`;
            console.log(`DRY RUN:   (Simulating not found) Would create new MediaItem.`);
            const createData = { workId: mediaWorkId, ...itemDataPayload };
            console.log(`DRY RUN:     Create Data: ${JSON.stringify(createData)}`);
            return { id: simulatedId, ...createData };
        }
    } else {
         // ---- LIVE RUN: Attempt to find the item using findFirst ----
         // Ensure we use the actual numeric workId here
         if (typeof mediaWorkId !== 'number') {
             console.error(`${FG_RED}Cannot perform live MediaItem find/create: Invalid numeric mediaWorkId (${mediaWorkId}).${RESET}`);
             return null;
         }
         const liveFindWhere = { workId: mediaWorkId, itemTitle: itemDataPayload.itemTitle };
         const existingItem = await prisma.mediaItem.findFirst({
             where: liveFindWhere
         });

         if (existingItem) {
              // ---- Item Found -> Update ----
              console.log(`Found existing MediaItem '${itemDataPayload.itemTitle}' (ID: ${existingItem.id}) for Work ID ${mediaWorkId}. Updating...`);
              try {
                  return await prisma.mediaItem.update({
                      where: { id: existingItem.id },
                      data: itemDataPayload, // Update with new data
                  });
              } catch (updateError) {
                   console.error(`${FG_RED}Error updating MediaItem ID ${existingItem.id}: ${updateError.message}${RESET}`);
                   return null;
              }
         } else {
              // ---- Item Not Found -> Create ----
               console.log(`No existing MediaItem found for '${itemDataPayload.itemTitle}' in Work ID ${mediaWorkId}. Creating...`);
              const createData = {
                  workId: mediaWorkId, // Include REAL workId for creation
                  ...itemDataPayload
              };
              try {
                  return await prisma.mediaItem.create({ data: createData });
              } catch (createError) {
                   console.error(`${FG_RED}Error creating MediaItem '${itemDataPayload.itemTitle}': ${createError.message}${RESET}`);
                   if (createError.code === 'P2002') { // Check for unique constraint violation (e.g., on workId+itemNumber if added)
                        console.error(`${FG_RED}  -> Unique constraint violation on create. Check schema and data.${RESET}`);
                   }
                   return null;
              }
         }
    }
}

// Helper to safely parse dates (copied from previous script)
function parseDateSafe(dateString) {
    if (!dateString) return null;
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            console.warn(`${FG_YELLOW}Could not parse date: ${dateString}${RESET}`);
            return null;
        }
        const year = date.getFullYear();
        if (year < 1800 || year > new Date().getFullYear() + 5) {
             console.warn(`${FG_YELLOW}Parsed date resulted in an unlikely year (${year}) for: ${dateString}. Returning null.${RESET}`);
             return null;
        }
        return date;
    } catch (error) {
        console.warn(`${FG_YELLOW}Error parsing date "${dateString}": ${error.message}${RESET}`);
        return null;
    }
}

// --- Main Seeding Function ---
async function main() {
    // Reset lists at the start of main run
    potentialDisambiguationConflicts = [];
    fileProcessingErrors = [];

    if (DRY_RUN) {
        console.log(`${FG_MAGENTA}--- RUNNING IN DRY RUN MODE --- (No changes will be made to the database)${RESET}`);
    } else {
        console.log(`${FG_RED}--- RUNNING IN LIVE MODE --- (Changes WILL be made to the database)${RESET}`);
    }
    console.log("Starting Phase 3 Podcast Seeding script...");

    // Counters
    let filesProcessed = 0;
    let filesFailed = 0;
    let mediaWorksUpserted = 0;
    let mediaItemsUpserted = 0;
    let individualsUpserted = 0;
    let involvedPersonsUpserted = 0;
    let organizationsUpserted = 0;
    let connectionsAttempted = 0;
    let connectionsMade = 0;
    let sourceLinksCreated = 0;


    // 1. Find JSON files
    // MODIFIED GLOB CALL
    const pattern = path.join(inputJsonDir, '*.json').replace(/\\/g, '/'); // Construct path and force forward slashes
    console.log(`Searching for JSON files using pattern: ${pattern}`); // Log the pattern

    const jsonFiles = glob.sync(pattern); // Use the modified pattern
    if (jsonFiles.length === 0) {
        console.log(`${FG_RED}Error: No JSON files found matching pattern '${pattern}'. Please check the path and ensure files exist.${RESET}`);
        // Add a check to see if the directory itself exists
        try {
            await fs.access(inputJsonDir);
            console.log(`${FG_YELLOW}Directory '${inputJsonDir}' exists, but no *.json files were matched by glob.${RESET}`);
        } catch (dirError) {
            console.error(`${FG_RED}Error accessing directory '${inputJsonDir}': ${dirError.message}${RESET}`);
        }
        return; // Exit if no files found
    }
    console.log(`Found ${jsonFiles.length} JSON files to process.`);


    // 2. Process each JSON file
    for (const filepath of jsonFiles) {
        const filename = path.basename(filepath);
        console.log(`\n${FG_CYAN}Processing file: ${filename}${RESET}`);
        filesProcessed++;

        try { // Main try block for the entire file processing
            const fileContent = await fs.readFile(filepath, 'utf-8');
            const data = JSON.parse(fileContent);

            // --- Upsert Core Entities ---

            // 3. Upsert MediaWork
            const mediaWork = await upsertMediaWork(data);
            if (!mediaWork) {
                // Throw an error to be caught by the outer catch block if this fails
                throw new Error(`Could not upsert MediaWork for file ${filename}.`);
            }
            // Only count if it's a real ID (not simulated)
            if (mediaWork.id && typeof mediaWork.id === 'number') mediaWorksUpserted++;

            // 4. Upsert Featured Individual (if present)
            let featuredIndividual = null;
            if (data.featuredIndividual?.fullName) {
                featuredIndividual = await upsertIndividual(data.featuredIndividual.fullName, data.featuredIndividual);
                if (!featuredIndividual) {
                     console.log(`${FG_YELLOW}Warning: Could not upsert featured individual '${data.featuredIndividual.fullName}' for ${filename}. Connections involving this individual might fail.${RESET}`);
                     // Continue processing, but log the warning
                } else if (featuredIndividual.id && typeof featuredIndividual.id === 'number') {
                     // Increment counter only if upsert succeeded and returned a real record
                     individualsUpserted++;
                }
            } else {
                 console.log(`${FG_YELLOW}Warning: No featured individual found in ${filename}.${RESET}`);
            }

            // 5. Upsert MediaItem
            const mediaItem = await upsertMediaItem(mediaWork.id, data.mediaItem);
            if (!mediaItem) {
                 // Throw an error to be caught by the outer catch block if this fails
                throw new Error(`Could not upsert MediaItem for file ${filename}.`);
            }
             if (mediaItem.id && typeof mediaItem.id === 'number') mediaItemsUpserted++;


            // --- Process and Connect Relationships ---
            console.log(`Processing connections for MediaItem ID: ${mediaItem.id}`);
            // Store IDs to connect for batch update at the end
            const connections = {
                mediaItem: {
                    individualsFeatured: new Set(),
                    involvedPersonsMentioned: new Set(),
                    organizationsMentioned: new Set(),
                    contributingFactorsMentioned: new Set(),
                    relatedMediaItems: new Set(), // For potential future use
                },
                individual: { // Connections for the *featured* individual
                    organizationsInvolved: new Set(),
                    contributingFactors: new Set(),
                    relatedIndividuals: new Set(),
                }
            };

            // Helper to add IDs to the correct set, avoiding duplicates and simulated IDs
            const addConnectionId = (targetModel, field, idToAdd) => {
                // Ensure ID is a valid number before adding for connection
                if (idToAdd && typeof idToAdd === 'number' && !isNaN(idToAdd)) {
                    if (connections[targetModel] && connections[targetModel][field]) {
                        if (!connections[targetModel][field].has(idToAdd)) { // Avoid double counting attempts
                             connections[targetModel][field].add(idToAdd);
                             connectionsAttempted++; // Count each potential connection attempt
                        }
                    } else {
                         console.warn(`${FG_YELLOW}Warning: Invalid target model or field for connection: ${targetModel}.${field}${RESET}`);
                    }
                } else if (DRY_RUN && idToAdd && typeof idToAdd === 'string') {
                     // In dry run, still count the attempt even if ID is simulated
                     if (connections[targetModel] && connections[targetModel][field]) {
                          connectionsAttempted++;
                     }
                }
            };

            // A. Connect MediaItem to Featured Individual
            if(featuredIndividual?.id) addConnectionId('mediaItem', 'individualsFeatured', featuredIndividual.id);

            // B. Connect Explicit Lawyers/Hosts (as InvolvedPerson) to MediaItem
            const explicitLawyers = data.featuredIndividual?.innocenceLawyersRaw || [];
            const explicitHosts = data.mediaItem?.hosts?.split(',').map(h => h.trim()).filter(h => h) || []; // Filter empty strings
            for (const name of [...new Set([...explicitLawyers, ...explicitHosts])]) { // Use Set to avoid duplicates
                 let roleHint = explicitHosts.includes(name) ? 'Host' : 'Lawyer';
                 const person = await upsertInvolvedPerson(name, roleHint);
                 if (person?.id) {
                    // Only count real upserts
                    if (typeof person.id === 'number') involvedPersonsUpserted++;
                    addConnectionId('mediaItem', 'involvedPersonsMentioned', person.id);
                 }
            }

            // C. Connect Explicit Organizations to MediaItem (and Featured Individual if exists)
            const explicitOrgs = data.featuredIndividual?.organizationsInvolvedRaw || [];
             for (const name of [...new Set(explicitOrgs)]) { // Deduplicate
                 const org = await upsertOrganization(name);
                 if(org?.id) {
                     if (typeof org.id === 'number') organizationsUpserted++;
                     addConnectionId('mediaItem', 'organizationsMentioned', org.id);
                     if(featuredIndividual?.id) addConnectionId('individual', 'organizationsInvolved', org.id);
                 }
             }

            // D. Connect Explicit Contributing Factors to MediaItem (and Featured Individual if exists)
            const explicitFactors = data.featuredIndividual?.contributingFactorsRaw || [];
            for (const name of [...new Set(explicitFactors)]) { // Deduplicate
                 const cleanedName = name.split('(')[0].trim().replace(/\.$/, '');
                 const factor = await findContributingFactor(cleanedName);
                 if(factor?.id) { // findContributingFactor only returns real factors
                     addConnectionId('mediaItem', 'contributingFactorsMentioned', factor.id);
                      if(featuredIndividual?.id) addConnectionId('individual', 'contributingFactors', factor.id);
                 }
            }

            // --- Process LLM Analysis Data ---
            const llmAnalysis = data.llm_analysis;
            if (llmAnalysis) {
                console.log("Processing LLM Analysis data...");

                // E. Connect LLM Persons (as Individual or InvolvedPerson)
                for (const personInfo of llmAnalysis.llm_extracted_persons || []) {
                     if (!personInfo.name) continue; // Skip if name is missing
                     if (personInfo.is_likely_wc_suggestion === true) {
                          // Upsert as Individual (minimal data)
                          const llmIndividual = await upsertIndividual(personInfo.name);
                          if (llmIndividual?.id) {
                              if (typeof llmIndividual.id === 'number') individualsUpserted++;
                              addConnectionId('mediaItem', 'individualsFeatured', llmIndividual.id);
                              // Connect LLM WC Individual to Featured WC Individual (if both exist)
                              if(featuredIndividual?.id) addConnectionId('individual', 'relatedIndividuals', llmIndividual.id);
                          }
                     } else {
                          // Upsert as InvolvedPerson
                          const llmPerson = await upsertInvolvedPerson(personInfo.name, personInfo.role_guess);
                          if (llmPerson?.id) {
                               if (typeof llmPerson.id === 'number') involvedPersonsUpserted++;
                               addConnectionId('mediaItem', 'involvedPersonsMentioned', llmPerson.id);
                          }
                     }
                }

                // F. Connect LLM Organizations
                for (const name of [...new Set(llmAnalysis.llm_extracted_orgs || [])]) { // Deduplicate
                     if (!name) continue;
                     const org = await upsertOrganization(name);
                     if(org?.id) {
                         if (typeof org.id === 'number') organizationsUpserted++;
                         addConnectionId('mediaItem', 'organizationsMentioned', org.id);
                         // Optionally connect to featured individual if relevant?
                         // if(featuredIndividual?.id) addConnectionId('individual', 'organizationsInvolved', org.id);
                     }
                }

                // G. Connect LLM Factors
                 for (const name of [...new Set(llmAnalysis.llm_extracted_factors || [])]) { // Deduplicate
                     if (!name) continue;
                     const factor = await findContributingFactor(name);
                     if(factor?.id) { // findContributingFactor only returns real factors
                         addConnectionId('mediaItem', 'contributingFactorsMentioned', factor.id);
                         // Optionally connect to featured individual?
                         // if(featuredIndividual?.id) addConnectionId('individual', 'contributingFactors', factor.id);
                     }
                 }

                 // H. Connect LLM Media Mentions (Basic Logging for now)
                 const mentionedMedia = llmAnalysis.llm_media_relationships?.mentions_other_media || [];
                 if (mentionedMedia.length > 0) {
                      console.log(`${FG_YELLOW}Potential MediaItem Links found (Manual connection recommended):${RESET}`);
                      for (const media of mentionedMedia) {
                           console.log(`  - Title: '${media.title}', Type Guess: ${media.type_guess}`);
                           // TODO: Implement find logic later if needed
                      }
                 }

            } else {
                 console.log("No LLM analysis data found in this JSON.");
            }

             // I. Process Additional Resources -> MediaItemSourceLink
             const resources = data.additionalResourcesRaw || [];
             for (const resource of resources) {
                 const urlMatch = resource.match(/https?:\/\/[^\s\)]+/);
                 // Ensure mediaItem.id is a valid number before proceeding
                 if (urlMatch && mediaItem?.id && typeof mediaItem.id === 'number') {
                     const url = urlMatch[0];
                     const description = resource.replace(url, '').replace(/Website:|Book:|Movie:/,'').split('(')[0].trim();
                     if (!DRY_RUN) {
                          try {
                              // Use upsert to avoid duplicates if script runs multiple times
                              // Ensure your schema has: @@unique([mediaItemId, url]) on MediaItemSourceLink
                              await prisma.mediaItemSourceLink.upsert({
                                  where: { mediaItemId_url: { mediaItemId: mediaItem.id, url: url } },
                                  create: {
                                      url: url,
                                      description: description || null,
                                      mediaItemId: mediaItem.id
                                  },
                                  update: { // Optionally update description if URL exists
                                       description: description || null,
                                  }
                              });
                              sourceLinksCreated++;
                              console.log(`LIVE RUN: Upserted Source Link: ${url}`);
                          } catch(linkError) {
                               // Handle potential error if unique constraint is missing
                               if (linkError.code === 'P2002') {
                                    console.warn(`${FG_YELLOW}Warning: Could not upsert source link ${url} due to potential duplicate (ensure @@unique constraint exists).${RESET}`);
                               } else if (linkError.message?.includes('Argument `where` is invalid') || linkError.message?.includes('mediaItemId_url')) { // Updated check
                                    console.error(`${FG_RED}Error upserting source link ${url}: Missing '@@unique([mediaItemId, url])' constraint in schema?${RESET}`);
                               } else {
                                    console.error(`${FG_RED}Error upserting source link ${url} for MediaItem ${mediaItem.id}:${RESET}`, linkError);
                               }
                          }
                     } else {
                           console.log(`DRY RUN: Would upsert Source Link: ${url} (Desc: ${description}) to MediaItem ID ${mediaItem?.id}`);
                           sourceLinksCreated++; // Count simulated creations
                     }
                 } else if (urlMatch && DRY_RUN && mediaItem?.id) {
                      // Handle dry run logging even if mediaItem.id is simulated
                      const url = urlMatch[0];
                      const description = resource.replace(url, '').replace(/Website:|Book:|Movie:/,'').split('(')[0].trim();
                      console.log(`DRY RUN: Would upsert Source Link: ${url} (Desc: ${description}) to MediaItem ID ${mediaItem?.id}`);
                      sourceLinksCreated++;
                 }
             }

            // --- Execute Batch Connect Operations ---
            if (!DRY_RUN) {
                console.log(`Executing connections...`);
                let currentConnectionsMade = 0; // Track connections for this file

                // Update MediaItem connections
                if (mediaItem?.id && typeof mediaItem.id === 'number') {
                    const mediaItemUpdateData = {};
                    Object.keys(connections.mediaItem).forEach(field => {
                        const connectIds = Array.from(connections.mediaItem[field]).filter(id => typeof id === 'number'); // Filter only real IDs
                        if (connectIds.length > 0) {
                            mediaItemUpdateData[field] = { connect: connectIds.map(id => ({ id })) };
                        }
                    });
                    if (Object.keys(mediaItemUpdateData).length > 0) {
                        try {
                            await prisma.mediaItem.update({
                                where: { id: mediaItem.id },
                                data: mediaItemUpdateData,
                            });
                            const count = Object.values(mediaItemUpdateData).reduce((sum, val) => sum + (val.connect?.length || 0), 0);
                            currentConnectionsMade += count;
                            console.log(`LIVE RUN: Updated MediaItem ID ${mediaItem.id} with ${count} connections.`);
                        } catch (e) {
                             console.error(`${FG_RED}Error executing batch update for MediaItem ID ${mediaItem.id}:${RESET}`, e);
                             console.error("Update Data:", JSON.stringify(mediaItemUpdateData, null, 2));
                        }
                    }
                }
                // Update Featured Individual connections
                if (featuredIndividual?.id && typeof featuredIndividual.id === 'number') {
                     const individualUpdateData = {};
                     Object.keys(connections.individual).forEach(field => {
                         const connectIds = Array.from(connections.individual[field]).filter(id => typeof id === 'number'); // Filter only real IDs
                         if (connectIds.length > 0) {
                             individualUpdateData[field] = { connect: connectIds.map(id => ({ id })) };
                         }
                     });
                     if (Object.keys(individualUpdateData).length > 0) {
                         try {
                             await prisma.individual.update({
                                 where: { id: featuredIndividual.id },
                                 data: individualUpdateData,
                             });
                              const count = Object.values(individualUpdateData).reduce((sum, val) => sum + (val.connect?.length || 0), 0);
                              currentConnectionsMade += count;
                             console.log(`LIVE RUN: Updated Individual ID ${featuredIndividual.id} with ${count} connections.`);
                         } catch (e) {
                              console.error(`${FG_RED}Error executing batch update for Individual ID ${featuredIndividual.id}:${RESET}`, e);
                              console.error("Update Data:", JSON.stringify(individualUpdateData, null, 2));
                         }
                     }
                }
                connectionsMade += currentConnectionsMade; // Add to total connections made
            } else { // Dry Run Summary for Connections
                 // Calculate simulated connections based on the sets (includes simulated IDs)
                 let simulatedConnections = 0;
                  Object.values(connections.mediaItem).forEach(set => simulatedConnections += set.size);
                  Object.values(connections.individual).forEach(set => simulatedConnections += set.size);
                 console.log(`DRY RUN: Would attempt ${simulatedConnections} connect operations.`);
                 // Note: connectionsAttempted counter already tracks these during addConnectionId
                 // connectionsMade = connectionsAttempted; // Use attempted count for dry run summary
            }


        } catch (error) { // Catch errors during the processing of a single file
            // --- STORE FILE PROCESSING ERROR INSTEAD OF JUST LOGGING ---
            const errorMessage = `Failed to process file ${filename}: ${error.message}`;
            if (DRY_RUN) {
                 fileProcessingErrors.push(`${FG_RED}  [File Error] ${errorMessage}${RESET}`); // Store formatted error
            } else {
                 console.error(`${FG_RED}${errorMessage}${RESET}`, error); // Log immediately in live run
            }
            filesFailed++; // Increment failure count regardless of mode
        }
    } // End loop through files

    // --- ADDED: Print collected file processing errors at the end (only in dry run) ---
    if (DRY_RUN && fileProcessingErrors.length > 0) {
        console.log(`\n${FG_MAGENTA}--- File Processing Errors Found (Dry Run) ---${RESET}`);
        fileProcessingErrors.forEach(errorMsg => console.error(errorMsg)); // Use console.error to maintain red color
        console.log(`${FG_MAGENTA}----------------------------------------------${RESET}`);
    }
    // --- END OF ADDED SECTION ---


    // --- Print collected conflict warnings at the end (only in dry run) ---
    if (DRY_RUN && potentialDisambiguationConflicts.length > 0) {
        console.log(`\n${FG_MAGENTA}--- Potential Disambiguation Conflicts Found (Dry Run) ---${RESET}`);
        potentialDisambiguationConflicts.forEach(warning => console.warn(warning)); // Use console.warn to keep yellow color
        console.log(`${FG_MAGENTA}----------------------------------------------------------${RESET}`);
    }
    // --- END OF ADDED SECTION ---

    console.log("\n--- Phase 3 Seeding Summary ---");
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE RUN'}`);
    console.log(`Total JSON files processed: ${filesProcessed}`);
    console.log(`Files failed during processing: ${filesFailed > 0 ? FG_RED : ''}${filesFailed}${RESET}`); // This count still reflects total failures
    console.log("-" * 20);
    console.log(`MediaWorks Upserted: ${mediaWorksUpserted}`);
    console.log(`MediaItems Upserted: ${mediaItemsUpserted}`);
    console.log(`Individuals Upserted: ${individualsUpserted}`);
    console.log(`InvolvedPersons Upserted: ${involvedPersonsUpserted}`);
    console.log(`Organizations Upserted: ${organizationsUpserted}`);
    console.log(`Source Links Created/Upserted: ${sourceLinksCreated}`);
    console.log(`Connections Attempted: ${connectionsAttempted}`);
    console.log(`Connections Made (Live): ${connectionsMade}`); // Only show actual connections made
    console.log("-----------------------------");
}

// --- Run main function and handle disconnection ---
main()
    .then(async () => {
        console.log("Disconnecting Prisma Client...");
        await prisma.$disconnect();
        console.log("Prisma Client disconnected.");
        console.log("Podcast seeding script finished.");
    })
    .catch(async (e) => {
        console.error(`${FG_RED}An critical error occurred during seeding:${RESET}`, e);
        if (prisma) await prisma.$disconnect(); // Ensure disconnect on error
        console.log("Prisma Client disconnected after error.");
        process.exit(1);
    });
