// Example path: scripts/seedBooks.js

const fs = require('fs').promises; // Use promises version of fs
const path = require('path');
// Import necessary Enums along with PrismaClient
const { PrismaClient, MediaWorkType, MediaItemType, IndividualStatus, InvolvedPersonRole } = require('@prisma/client');
const human = require('humanparser'); // Ensure installed: npm install humanparser
const glob = require('glob'); // Ensure installed: npm install glob

// --- Configuration ---

// !!! --- SET DRY_RUN TO true FOR SIMULATION, false FOR ACTUAL SEEDING --- !!!
const DRY_RUN = false; // <<<<< Set to false for actual database changes >>>>>
// !!! ----------------------------------------------------------------- !!!

// Define the input directory containing the ENHANCED BOOK JSON files
// *** ADJUST THIS PATH ***
const inputJsonDir = './books'; // <--- CHANGE THIS

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
function parseNameForUpsert(fullName) {
    const defaultResult = { firstName: null, middleName: null, lastName: null, suffix: null };
    if (!fullName || typeof fullName !== 'string') {
        console.warn(`${FG_YELLOW}Warning: Invalid input to parseNameForUpsert: ${fullName}${RESET}`);
        return defaultResult;
    }
    try {
        // Trim whitespace and potentially remove quotes around nicknames like "JJ"
        const cleanedName = fullName.trim().replace(/^"|"$/g, '');
        const parsedName = human.parseName(cleanedName);

        // Extract parts, ensuring null if not present
        const firstName = parsedName.firstName || null;
        // Combine middle name if humanparser splits it weirdly sometimes
        const middleName = parsedName.middleName ? parsedName.middleName.trim() : null;
        const lastName = parsedName.lastName || null;
        const suffix = parsedName.suffix || null; // humanparser might capture suffixes

        // Basic validation: At least first and last name should be present for most cases
        // Allow just first name if last name is missing (e.g., single names)
        if (!firstName) {
             console.warn(`${FG_YELLOW}Warning: Could not reliably parse '${fullName}' - missing first name. Parsed: First='${firstName}', Middle='${middleName}', Last='${lastName}', Suffix='${suffix}'${RESET}`);
             return defaultResult;
        }
        if (!lastName && middleName) { // Handle cases like "First 'Middle'" parsed as F:First, M: 'Middle', L: null
            console.warn(`${FG_YELLOW}Warning: Possible parsing issue for '${fullName}'. Last name missing, middle name present. Using middle as last? Review needed.${RESET}`);
             // Decide on a strategy - maybe combine middle and first? Or assign middle to last?
             // For now, returning as parsed, but flagging it.
        }
        // If only first name exists, humanparser puts it in firstName, lastName is null. This is acceptable.

        return { firstName, middleName, lastName, suffix };

    } catch (error) {
        console.error(`${FG_RED}Error parsing name '${fullName}' with humanparser: ${error}${RESET}`);
        return defaultResult;
    }
}

/**
 * Maps status strings from JSON ('status_raw') to Prisma IndividualStatus enum.
 * @param {string | string[]} statusInput - The raw status string or array from JSON.
 * @returns {IndividualStatus | null} The corresponding Prisma enum value or null.
 */
function mapIndividualStatus(statusInput) {
    if (!statusInput) return IndividualStatus.UNKNOWN;

    // Handle both string and array input (take the first element if array)
    const statusString = Array.isArray(statusInput) ? statusInput[0] : statusInput;
    if (!statusString || typeof statusString !== 'string') return IndividualStatus.UNKNOWN;

    const lowerStatus = statusString.toLowerCase().trim();

    // Specific phrases first
    if (lowerStatus.includes('fully exonerated')) return IndividualStatus.EXONERATED;
    if (lowerStatus.includes('exonerated')) return IndividualStatus.EXONERATED;
    if (lowerStatus.includes('alford plea')) return IndividualStatus.RELEASED_ALFORD_PLEA;
    if (lowerStatus.includes('granted absolute pardon')) return IndividualStatus.RELEASED_CLEMENCY; // Pardon = Clemency
    if (lowerStatus.includes('clemency')) return IndividualStatus.RELEASED_CLEMENCY;
    if (lowerStatus.includes('conviction vacated')) return IndividualStatus.CONVICTION_OVERTURNED; // Vacated = Overturned
    if (lowerStatus.includes('new trial ordered') && lowerStatus.includes('declined to proceed')) return IndividualStatus.CONVICTION_OVERTURNED; // Effectively overturned/dismissed
    if (lowerStatus.includes('charges dismissed')) return IndividualStatus.CONVICTION_OVERTURNED; // Dismissed = Overturned
    if (lowerStatus.includes('new trial ordered')) return IndividualStatus.CONVICTION_OVERTURNED; // If appeal pending, still overturned for now
    if (lowerStatus.includes('executed')) return IndividualStatus.EXECUTED;
    if (lowerStatus.includes('paroled') && lowerStatus.includes('conviction remains intact')) return IndividualStatus.RELEASED_TIME_SERVED; // Paroled but not exonerated
    if (lowerStatus.includes('paroled')) return IndividualStatus.RELEASED_TIME_SERVED; // Generic parole
    if (lowerStatus.includes('released')) return IndividualStatus.RELEASED_TIME_SERVED; // Generic release

    // Broader terms last
    if (lowerStatus.includes('convicted') || lowerStatus.includes('incarcerated')) return IndividualStatus.CONVICTED;


    console.warn(`${FG_YELLOW}Warning: Unmapped status string: '${statusString}'. Defaulting to UNKNOWN.${RESET}`);
    return IndividualStatus.UNKNOWN; // Default if no match
}

// *** ADDED mapPersonRole function ***
/**
 * Maps role strings to Prisma InvolvedPersonRole enum.
 * @param {string} roleString - The role string (e.g., "AUTHOR", "Lawyer").
 * @returns {InvolvedPersonRole} The corresponding Prisma enum value.
 */
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

    console.warn(`${FG_YELLOW}Warning: Unmapped role string: '${roleString}'. Defaulting to OTHER.${RESET}`);
    return InvolvedPersonRole.OTHER; // Use OTHER if no match
}


// --- Upsert/Find Helpers ---

/**
 * Upserts a MediaWork record for a book.
 * Uses findFirst + create/update strategy based on title.
 * @param {object} workData - The media_work object from the JSON file.
 * @returns {Promise<object | null>} The upserted MediaWork object or null on failure.
 */
async function upsertMediaWork(workData) {
    const title = workData?.title?.trim();
    if (!title) {
        console.log(`${FG_YELLOW}Skipping MediaWork: Missing title.${RESET}`);
        return null;
    }

    // Prepare data payload for create/update
    const workDataPayload = {
        workType: MediaWorkType.BOOK, // Specific to books
        creatorName: workData?.creator_name ?? null, // Use creator_name
        publicationOrReleaseYear: workData?.publication_or_release_year ? parseInt(workData.publication_or_release_year, 10) : null,
        publisherOrNetwork: workData?.publisher_or_network ?? null, // Use publisher_or_network
        focusOrTheme: workData?.focus_or_theme ?? null,
        summaryNotes: workData?.summary_notes ?? null, // Maybe add summary here too? Check schema/use case
        availabilityNotes: workData?.format ?? null, // Store format in availabilityNotes? Or create new field?
        // Add other relevant fields from workData if needed (e.g., key_statistics, recognition_notes)
        // Consider adding key_statistics or recognition_notes to availabilityNotes or summaryNotes if no dedicated field exists
    };

    // Clean payload data (remove undefined, null, NaN)
    Object.keys(workDataPayload).forEach(key => (
        workDataPayload[key] === undefined ||
        workDataPayload[key] === null ||
        (typeof workDataPayload[key] === 'number' && isNaN(workDataPayload[key]))
     ) ? delete workDataPayload[key] : {});

    // Define find criteria (using title, which might not be strictly unique)
    const findMediaWorkWhere = { title: title };

    if (DRY_RUN) {
        console.log(`DRY RUN: Would check for MediaWork (BOOK) using findFirst with WHERE: ${JSON.stringify(findMediaWorkWhere)}`);
        // Simulate finding
        const existing = await prisma.mediaWork.findFirst({ where: findMediaWorkWhere, select: { id: true, title: true } });

        if (existing) {
            const simulatedId = existing.id;
            console.log(`DRY RUN:   (Simulating found) MediaWork ID: ${simulatedId}`);
            console.log(`DRY RUN:   Would update with data: ${JSON.stringify(workDataPayload)}`);
            return { id: simulatedId, title: title, ...workDataPayload }; // Return simulated record
        } else {
            const simulatedId = `simulated_mw_${title.replace(/\s+/g, '_').substring(0, 20)}`; // Shortened ID
            console.log(`DRY RUN:   (Simulating not found) Would create new MediaWork.`);
            const createData = { title: title, ...workDataPayload }; // Add title for create
            console.log(`DRY RUN:     Create Data: ${JSON.stringify(createData)}`);
            return { id: simulatedId, ...createData }; // Return simulated record
        }
    } else {
        // ---- LIVE RUN ----
        const existingMediaWork = await prisma.mediaWork.findFirst({ where: findMediaWorkWhere });

        if (existingMediaWork) {
            console.log(`Found existing MediaWork '${title}' (ID: ${existingMediaWork.id}). Updating...`);
            try {
                return await prisma.mediaWork.update({
                    where: { id: existingMediaWork.id },
                    data: workDataPayload,
                });
            } catch (updateError) {
                 console.error(`${FG_RED}Error updating MediaWork ID ${existingMediaWork.id}: ${updateError.message}${RESET}`);
                 return null;
            }
        } else {
            console.log(`No existing MediaWork found for '${title}'. Creating...`);
            const createData = { title: title, ...workDataPayload };
            try {
                return await prisma.mediaWork.create({ data: createData });
            } catch (createError) {
                 console.error(`${FG_RED}Error creating MediaWork '${title}': ${createError.message}${RESET}`);
                 if (createError.code === 'P2002') {
                      console.error(`${FG_RED}  -> Unique constraint violation on create. Check schema and data.${RESET}`);
                 }
                 return null;
            }
        }
    }
}

/**
 * Upserts an Individual record.
 * Uses findFirst + create/update strategy based on name components + null disambiguationTag.
 * @param {object} individualData - The individual object from the JSON's featured_individuals array.
 * @returns {Promise<object | null>} The upserted Individual object or null on failure.
 */
async function upsertIndividual(individualData) {
    const fullName = individualData?.full_name;
    if (!fullName) {
        console.log(`${FG_YELLOW}Skipping Individual upsert: Missing full_name.${RESET}`);
        return null;
    }
    // Use the parsing function
    const { firstName, middleName, lastName, suffix } = parseNameForUpsert(fullName);

    // Use pre-parsed names from JSON if available (might be more accurate than humanparser sometimes)
    const finalFirstName = individualData.first_name || firstName;
    const finalMiddleName = individualData.middle_name !== undefined ? individualData.middle_name : middleName; // Prefer JSON null over parsed null
    const finalLastName = individualData.last_name || lastName;
    const finalSuffix = individualData.suffix !== undefined ? individualData.suffix : suffix; // Prefer JSON null over parsed null


    if (!finalFirstName) { // Require at least a first name
        console.log(`${FG_YELLOW}Skipping Individual upsert: Invalid/missing first name for '${fullName}'.${RESET}`);
        return null;
    }

     // Define the WHERE clause for finding the individual (with null disambiguationTag)
    // Using final parsed/extracted names
    const findIndividualWhere = {
        firstName: finalFirstName,
        middleName: finalMiddleName, // Pass actual value (string or null)
        lastName: finalLastName,     // Pass actual value (string or null)
        suffix: finalSuffix,         // Pass actual value (string or null)
        disambiguationTag: null      // Explicitly null for this seed
    };

    // Prepare data payload for create/update
    const individualDataPayload = {
        nickname: individualData.nickname ?? null, // Add if nickname exists in JSON
        status: mapIndividualStatus(individualData.status_raw), // Use mapping function
        convictionYear: individualData.conviction_year ? parseInt(individualData.conviction_year, 10) : null,
        exonerationOrReleaseYear: individualData.exoneration_or_release_year ? parseInt(individualData.exoneration_or_release_year, 10) : null,
        timeServed: individualData.time_served ?? null,
        sentence: individualData.sentence ?? null,
        // Basic state extraction from case_location
        caseLocationState: individualData.case_location?.split(',').pop()?.trim() ?? null,
        caseLocationCity: individualData.case_location?.split(',')[0]?.trim() ?? null, // Basic city extraction
        narrativeSummary: individualData.individual_notes ?? null, // Use individual_notes for summary?
        crimeCategory: undefined, // TODO: Link to CrimeCategory if needed/possible
        // Add other fields from 'individualData' if needed
    };
    // Clean payload data: remove undefined, null, NaN, empty strings
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
                    firstName: finalFirstName,
                    middleName: finalMiddleName,
                    lastName: finalLastName,
                    suffix: finalSuffix,
                    disambiguationTag: { not: null }
                },
                select: { id: true, disambiguationTag: true }
            });

            if (potentialConflicts.length > 0) {
                let conflictMessage = `${FG_YELLOW}    [Potential Conflict] For '${fullName}': Found ${potentialConflicts.length} existing individual(s) with same name but different tags:${RESET}\n`;
                potentialConflicts.forEach(p => {
                    conflictMessage += `${FG_YELLOW}      - Existing ID: ${p.id}, Existing Tag: '${p.disambiguationTag}'${RESET}\n`;
                });
                conflictMessage += `${FG_YELLOW}    -> This script would upsert/create with disambiguationTag: null.${RESET}`;
                potentialDisambiguationConflicts.push(conflictMessage);
            }
        } catch (checkError) {
             console.error(`${FG_RED}    [DRY RUN ERROR] Failed to check for potential disambiguation conflicts for '${fullName}': ${checkError.message}${RESET}`);
             potentialDisambiguationConflicts.push(`${FG_RED}    [Error] Failed conflict check for '${fullName}'.${RESET}`);
        }
        // --- END OF CONFLICT CHECK ---

        // Simulate finding the target record (with null tag)
        const existingTarget = await prisma.individual.findFirst({ where: findIndividualWhere, select: { id: true } });

        if (existingTarget) {
            const simulatedId = existingTarget.id;
            console.log(`DRY RUN:   (Simulating found target) Individual ID: ${simulatedId}`);
            console.log(`DRY RUN:   Would update with data: ${JSON.stringify(individualDataPayload)}`);
            return { id: simulatedId, ...findIndividualWhere, ...individualDataPayload };
        } else {
            const simulatedId = `simulated_ind_${finalFirstName}_${finalLastName || 'NOLAST'}`;
            console.log(`DRY RUN:   (Simulating target not found) Would create new Individual.`);
            const createData = { ...findIndividualWhere, ...individualDataPayload };
            console.log(`DRY RUN:     Create Data: ${JSON.stringify(createData)}`);
            return { id: simulatedId, ...createData };
        }
    } else {
        // ---- LIVE RUN ----
        const existingIndividual = await prisma.individual.findFirst({ where: findIndividualWhere });

        if (existingIndividual) {
            console.log(`Found existing Individual '${fullName}' (ID: ${existingIndividual.id}). Updating...`);
            try {
                return await prisma.individual.update({
                    where: { id: existingIndividual.id },
                    data: individualDataPayload,
                });
            } catch (updateError) {
                 console.error(`${FG_RED}Error updating Individual ID ${existingIndividual.id}: ${updateError.message}${RESET}`);
                 return null;
            }
        } else {
            console.log(`No existing Individual found for '${fullName}'. Creating...`);
            const createData = { ...findIndividualWhere, ...individualDataPayload };
            try {
                return await prisma.individual.create({ data: createData });
            } catch (createError) {
                 console.error(`${FG_RED}Error creating Individual '${fullName}': ${createError.message}${RESET}`);
                 if (createError.code === 'P2002') {
                      console.error(`${FG_RED}  -> Unique constraint violation on create. Record might have been created concurrently.${RESET}`);
                 }
                 return null;
            }
        }
    }
}

/**
 * Upserts an InvolvedPerson record (e.g., author).
 * Uses findFirst + create/update strategy based on name components.
 * @param {object} personData - The person object from the JSON's involved_persons array.
 * @returns {Promise<object | null>} The upserted InvolvedPerson object or null on failure.
 */
async function upsertInvolvedPerson(personData) {
    const fullName = personData?.full_name;
    const roleGuess = personData?.role; // Role should be provided in JSON

    if (!fullName) {
        console.log(`${FG_YELLOW}Skipping InvolvedPerson upsert: Missing full_name.${RESET}`);
        return null;
    }
    // Use the parsing function
    const { firstName, middleName, lastName, suffix } = parseNameForUpsert(fullName);

    // Use pre-parsed names from JSON if available
    const finalFirstName = personData.first_name || firstName;
    const finalMiddleName = personData.middle_name !== undefined ? personData.middle_name : middleName;
    const finalLastName = personData.last_name || lastName;
    const finalSuffix = personData.suffix !== undefined ? personData.suffix : suffix;

    if (!finalFirstName) { // Require at least first name
        console.log(`${FG_YELLOW}Skipping InvolvedPerson upsert: Invalid/missing first name for '${fullName}'.${RESET}`);
        return null;
    }

    // Define the WHERE clause for finding the person
    const findPersonWhere = {
        firstName: finalFirstName,
        middleName: finalMiddleName,
        lastName: finalLastName,
        suffix: finalSuffix,
    };

    // Prepare data payload for create/update
    const personDataPayload = {
        role: mapPersonRole(roleGuess), // Use mapping function (THIS WAS THE MISSING CALL)
        notes: personData.notes ?? null, // Add notes if available
    };
    // Clean payload data
    Object.keys(personDataPayload).forEach(key => (
        personDataPayload[key] === undefined || personDataPayload[key] === null
    ) ? delete personDataPayload[key] : {});


    if (DRY_RUN) {
        console.log(`DRY RUN: Would check for InvolvedPerson using findFirst with WHERE: ${JSON.stringify(findPersonWhere)}`);
        const existingTarget = await prisma.involvedPerson.findFirst({ where: findPersonWhere, select: { id: true } });

        if (existingTarget) {
             const simulatedId = existingTarget.id;
             console.log(`DRY RUN:   (Simulating found) InvolvedPerson ID: ${simulatedId}`);
             console.log(`DRY RUN:   Would update with data: ${JSON.stringify(personDataPayload)}`);
             return { id: simulatedId, ...findPersonWhere, ...personDataPayload };
        } else {
             const simulatedId = `simulated_ip_${finalFirstName}_${finalLastName || 'NOLAST'}`;
             console.log(`DRY RUN:   (Simulating not found) Would create new InvolvedPerson.`);
             const createData = { ...findPersonWhere, ...personDataPayload };
             console.log(`DRY RUN:     Create Data: ${JSON.stringify(createData)}`);
             return { id: simulatedId, ...createData };
        }
    } else {
        // ---- LIVE RUN ----
        const existingPerson = await prisma.involvedPerson.findFirst({ where: findPersonWhere });

        if (existingPerson) {
            console.log(`Found existing InvolvedPerson '${fullName}' (ID: ${existingPerson.id}). Updating...`);
            try {
                return await prisma.involvedPerson.update({
                    where: { id: existingPerson.id },
                    data: personDataPayload,
                });
            } catch (updateError) {
                console.error(`${FG_RED}Error updating InvolvedPerson ID ${existingPerson.id}: ${updateError.message}${RESET}`);
                return null;
            }
        } else {
            console.log(`No existing InvolvedPerson found for '${fullName}'. Creating...`);
            const createData = { ...findPersonWhere, ...personDataPayload };
            try {
                return await prisma.involvedPerson.create({ data: createData });
            } catch (createError) {
                 console.error(`${FG_RED}Error creating InvolvedPerson '${fullName}': ${createError.message}${RESET}`);
                 if (createError.code === 'P2002') {
                      console.error(`${FG_RED}  -> Unique constraint violation on create. Record might have been created concurrently.${RESET}`);
                 }
                 return null;
            }
        }
    }
}

/**
 * Upserts an Organization record.
 * Uses Prisma's upsert based on the unique 'name' field.
 * @param {string} orgName - The name of the organization.
 * @returns {Promise<object | null>} The upserted Organization object or null on failure.
 */
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
            const simulatedId = `simulated_org_${name.replace(/\W+/g, '_').substring(0, 20)}`; // Cleaned ID
            console.log(`DRY RUN: Would create Organization: '${name}'`);
            return { id: simulatedId, ...orgData };
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

/**
 * Finds a ContributingFactor record by name. Assumes factors are pre-seeded.
 * @param {string} factorName - The name of the contributing factor.
 * @returns {Promise<object | null>} The found ContributingFactor object (with id) or null.
 */
async function findContributingFactor(factorName) {
     const name = factorName?.trim();
     if (!name) return null;

     // Clean common parenthetical explanations
     const cleanedName = name.split('(')[0].trim();

     let factor = null;
     try {
        factor = await prisma.contributingFactor.findUnique({
             where: { name: cleanedName }, // Use cleaned name for lookup
             select: { id: true, name: true }
         });
     } catch (findError) {
         // Log error but don't stop the whole process
         console.error(`${FG_RED}Error finding Contributing Factor '${cleanedName}': ${findError.message}${RESET}`);
         return null;
     }

     if (!factor) {
         console.log(`${FG_YELLOW}Warning: Contributing Factor '${cleanedName}' (from '${name}') not found in database. Add it manually or refine matching.${RESET}`);
         return null;
     }
     if (DRY_RUN) {
         console.log(`DRY RUN: Found Contributing Factor: '${factor.name}' (ID: ${factor.id})`);
     }
     return factor; // Returns { id, name }
}

/**
 * Upserts a MediaItem record for book content.
 * Uses findFirst + create/update strategy based on workId and itemTitle.
 * @param {number|string} mediaWorkId - The ID (real or simulated) of the parent MediaWork.
 * @param {object} itemData - The media_item object from the JSON file.
 * @returns {Promise<object | null>} The upserted MediaItem object or null on failure.
 */
async function upsertMediaItem(mediaWorkId, itemData) {
    // Ensure mediaWorkId is valid (real number or simulated string in dry run)
    const isValidWorkId = (typeof mediaWorkId === 'number' && !isNaN(mediaWorkId)) || (DRY_RUN && typeof mediaWorkId === 'string');
    if (!isValidWorkId) {
        console.error(`${FG_RED}Skipping MediaItem upsert: Invalid mediaWorkId (${mediaWorkId}).${RESET}`);
        return null;
    }

    const itemTitle = itemData?.item_title?.trim(); // Use item_title
    if (!itemTitle) {
        console.log(`${FG_YELLOW}Skipping MediaItem upsert: Missing item_title.${RESET}`);
        return null;
    }

    const itemDataPayload = {
        itemMediaType: MediaItemType.BOOK_CONTENT, // Specific to books
        focusOrTheme: itemData?.focus_or_theme ?? null,
        summaryNotes: itemData?.summary_notes ?? itemData?.case_details_raw ?? null, // Use summary or case details
        keyQuotes: Array.isArray(itemData?.key_quotes_raw) ? itemData.key_quotes_raw.join('\n---\n') : itemData?.key_quotes_raw ?? null, // Join array if needed
        // Add other fields like systemic_issues, policy_recommendations? Maybe store in summaryNotes?
        sourceUrl: itemData?.source_url ?? null, // If available
        // releaseDate not typically applicable to book content item
    };
    // Clean payload
    Object.keys(itemDataPayload).forEach(key => (
        itemDataPayload[key] === undefined || itemDataPayload[key] === null || itemDataPayload[key] === ''
    ) ? delete itemDataPayload[key] : {});


    // Define find criteria (using workId and itemTitle)
    // Use a placeholder workId if it's simulated
    const findMediaItemWhere = {
        workId: typeof mediaWorkId === 'number' ? mediaWorkId : -999, // Use real ID or placeholder for find
        itemTitle: itemTitle // Title is required
    };

    if (DRY_RUN) {
        console.log(`DRY RUN: Would check for MediaItem (BOOK_CONTENT) using findFirst with WHERE: ${JSON.stringify(findMediaItemWhere)} (Work ID: ${mediaWorkId})`);
        let existing = null;
        if (typeof mediaWorkId === 'number') { // Only query DB if workId is real
             existing = await prisma.mediaItem.findFirst({ where: findMediaItemWhere, select: { id: true } });
        }
        if (existing) {
            const simulatedId = existing.id;
            console.log(`DRY RUN:   (Simulating found) MediaItem ID: ${simulatedId}`);
            console.log(`DRY RUN:   Would update with data: ${JSON.stringify(itemDataPayload)}`);
            return { id: simulatedId, workId: mediaWorkId, itemTitle: itemTitle, ...itemDataPayload };
        } else {
            const simulatedId = `simulated_mi_${itemTitle.replace(/\W+/g, '_').substring(0, 20)}`;
            console.log(`DRY RUN:   (Simulating not found) Would create new MediaItem.`);
            const createData = { workId: mediaWorkId, itemTitle: itemTitle, ...itemDataPayload }; // Add title for create
            console.log(`DRY RUN:     Create Data: ${JSON.stringify(createData)}`);
            return { id: simulatedId, ...createData };
        }
    } else {
         // ---- LIVE RUN ----
         if (typeof mediaWorkId !== 'number') {
             console.error(`${FG_RED}Cannot perform live MediaItem find/create: Invalid numeric mediaWorkId (${mediaWorkId}).${RESET}`);
             return null;
         }
         const liveFindWhere = { workId: mediaWorkId, itemTitle: itemTitle };
         const existingItem = await prisma.mediaItem.findFirst({ where: liveFindWhere });

         if (existingItem) {
              console.log(`Found existing MediaItem '${itemTitle}' (ID: ${existingItem.id}) for Work ID ${mediaWorkId}. Updating...`);
              try {
                  return await prisma.mediaItem.update({
                      where: { id: existingItem.id },
                      data: itemDataPayload,
                  });
              } catch (updateError) {
                   console.error(`${FG_RED}Error updating MediaItem ID ${existingItem.id}: ${updateError.message}${RESET}`);
                   return null;
              }
         } else {
              console.log(`No existing MediaItem found for '${itemTitle}' in Work ID ${mediaWorkId}. Creating...`);
              const createData = { workId: mediaWorkId, itemTitle: itemTitle, ...itemDataPayload };
              try {
                  return await prisma.mediaItem.create({ data: createData });
              } catch (createError) {
                   console.error(`${FG_RED}Error creating MediaItem '${itemTitle}': ${createError.message}${RESET}`);
                   if (createError.code === 'P2002') {
                        console.error(`${FG_RED}  -> Unique constraint violation on create. Check schema and data.${RESET}`);
                   }
                   return null;
              }
         }
    }
}

/**
 * Creates MediaItemSourceLink records for a given MediaItem.
 * @param {number} mediaItemId - The ID of the MediaItem.
 * @param {string[]} resourcesRaw - Array of strings from additional_resources_raw.
 * @returns {Promise<number>} Count of links created/upserted.
 */
async function upsertMediaItemSourceLinks(mediaItemId, resourcesRaw) {
    if (!resourcesRaw || !Array.isArray(resourcesRaw) || typeof mediaItemId !== 'number') {
        return 0;
    }

    let linksCreated = 0;
    for (const resource of resourcesRaw) {
         if (typeof resource !== 'string') continue;
         // Try to extract URL and Description
         const urlMatch = resource.match(/https?:\/\/[^\s\)]+/);
         const url = urlMatch ? urlMatch[0] : null;
         // Basic description extraction (remove URL, prefixes, text in parentheses)
         let description = resource;
         if (url) {
             description = description.replace(url, '');
         }
         description = description.replace(/Website:|Book:|Movie:|Podcast:|Docuseries:/gi, '').split('(')[0].trim();
         description = description.replace(/^[-*]\s*/, '').trim(); // Remove leading list markers

         if (url) { // Only create link if URL is found
             if (!DRY_RUN) {
                  try {
                      await prisma.mediaItemSourceLink.upsert({
                          where: { mediaItemId_url: { mediaItemId: mediaItemId, url: url } },
                          create: {
                              url: url,
                              description: description || null,
                              mediaItemId: mediaItemId
                          },
                          update: {
                               description: description || null,
                          }
                      });
                      linksCreated++;
                      // console.log(`LIVE RUN: Upserted Source Link: ${url}`); // Reduce verbosity
                  } catch(linkError) {
                       if (linkError.code === 'P2002') {
                            console.warn(`${FG_YELLOW}Warning: Could not upsert source link ${url} due to potential duplicate (ensure @@unique constraint exists).${RESET}`);
                       } else if (linkError.message?.includes('Argument `where` is invalid') || linkError.message?.includes('mediaItemId_url')) {
                            console.error(`${FG_RED}Error upserting source link ${url}: Missing '@@unique([mediaItemId, url])' constraint in schema?${RESET}`);
                       } else {
                            console.error(`${FG_RED}Error upserting source link ${url} for MediaItem ${mediaItemId}:${RESET}`, linkError);
                       }
                  }
             } else {
                   console.log(`DRY RUN: Would upsert Source Link: ${url} (Desc: ${description}) to MediaItem ID ${mediaItemId}`);
                   linksCreated++;
             }
         } else {
              console.log(`${FG_YELLOW}Warning: Could not extract URL from resource string: "${resource}"${RESET}`);
         }
    }
    return linksCreated;
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
    console.log("Starting Book Seeding script...");

    // Counters
    let filesProcessed = 0;
    let filesFailed = 0;
    let mediaWorksUpserted = 0;
    let mediaItemsUpserted = 0;
    let individualsUpserted = 0;
    let involvedPersonsUpserted = 0;
    let organizationsUpserted = 0;
    let contributingFactorsFound = 0; // Track successful finds
    let connectionsAttempted = 0;
    let connectionsMade = 0;
    let sourceLinksCreated = 0;


    // 1. Find JSON files
    const pattern = path.join(inputJsonDir, '*.json').replace(/\\/g, '/');
    console.log(`Searching for JSON files using pattern: ${pattern}`);

    const jsonFiles = glob.sync(pattern);
    if (jsonFiles.length === 0) {
        console.log(`${FG_RED}Error: No JSON files found matching pattern '${pattern}'. Please check the path and ensure files exist.${RESET}`);
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

            // 3. Upsert MediaWork (Book)
            const mediaWork = await upsertMediaWork(data.media_work);
            if (!mediaWork) {
                throw new Error(`Could not upsert MediaWork for file ${filename}.`);
            }
            if (mediaWork.id && typeof mediaWork.id === 'number') mediaWorksUpserted++;

            // 4. Upsert MediaItem (Book Content)
            const mediaItem = await upsertMediaItem(mediaWork.id, data.media_item);
            if (!mediaItem) {
                throw new Error(`Could not upsert MediaItem for file ${filename}.`);
            }
             if (mediaItem.id && typeof mediaItem.id === 'number') mediaItemsUpserted++;

            // 5. Upsert Involved Persons (Authors)
            const authorIds = new Set();
            if (data.involved_persons && Array.isArray(data.involved_persons)) {
                for (const personData of data.involved_persons) {
                    // Ensure role is set, default to AUTHOR if missing but in this array
                    const person = await upsertInvolvedPerson({ ...personData, role: personData.role || 'AUTHOR' });
                    if (person?.id) {
                        if (typeof person.id === 'number') involvedPersonsUpserted++;
                        authorIds.add(person.id); // Store author ID
                    }
                }
            }

            // --- Process Featured Individuals and their Connections ---
            const individualConnectMap = new Map(); // Store connections per individual ID
            // Add map keys for MediaItem connections (avoids error if no individuals found)
            individualConnectMap.set('mediaItem', { individualsFeatured: new Set() });
            individualConnectMap.set('mediaItemOrgs', new Set());
            individualConnectMap.set('mediaItemFactors', new Set());


            if (data.featured_individuals && Array.isArray(data.featured_individuals)) {
                for (const individualData of data.featured_individuals) {
                    const individual = await upsertIndividual(individualData);
                    if (!individual?.id) {
                        console.log(`${FG_YELLOW}Warning: Could not upsert featured individual '${individualData.full_name}' for ${filename}. Connections involving this individual might fail.${RESET}`);
                        continue; // Skip connections for this failed individual
                    }
                    if (typeof individual.id === 'number') individualsUpserted++;

                    // Initialize connection sets for this individual
                    individualConnectMap.set(individual.id, {
                         organizationsInvolved: new Set(),
                         contributingFactors: new Set(),
                    });

                    // Store ID to connect to the main MediaItem
                    connectionsAttempted++; // Count attempt to link individual to media item
                    individualConnectMap.get('mediaItem').individualsFeatured.add(individual.id);


                    // Process Organizations Involved with this Individual
                    const orgsRaw = individualData.organizations_involved_raw || [];
                    for (const name of [...new Set(orgsRaw)]) { // Deduplicate
                         const org = await upsertOrganization(name);
                         if(org?.id) {
                             if (typeof org.id === 'number') organizationsUpserted++;
                             // Connect Org to this Individual
                             connectionsAttempted++;
                             individualConnectMap.get(individual.id).organizationsInvolved.add(org.id);
                             // Also connect Org to the MediaItem
                             connectionsAttempted++;
                             individualConnectMap.get('mediaItemOrgs').add(org.id);
                         }
                    }

                    // Process Contributing Factors for this Individual
                    const factorsRaw = individualData.contributing_factors_raw || [];
                    for (const name of [...new Set(factorsRaw)]) { // Deduplicate
                         const factor = await findContributingFactor(name);
                         if(factor?.id) { // findContributingFactor only returns real factors
                             contributingFactorsFound++; // Count successful finds
                             // Connect Factor to this Individual
                             connectionsAttempted++;
                             individualConnectMap.get(individual.id).contributingFactors.add(factor.id);
                              // Also connect Factor to the MediaItem
                             connectionsAttempted++;
                             individualConnectMap.get('mediaItemFactors').add(factor.id);
                         }
                    }
                } // End loop through individuals
            } else {
                 console.log(`${FG_YELLOW}Warning: No featured individuals found in ${filename}.${RESET}`);
            }

            // --- Process Additional Resources -> MediaItemSourceLink ---
            const resources = data.media_item?.additional_resources_raw || [];
            const linksCount = await upsertMediaItemSourceLinks(mediaItem.id, resources);
            sourceLinksCreated += linksCount;


            // --- Execute Batch Connect Operations ---
            if (!DRY_RUN) {
                console.log(`Executing connections...`);
                let currentConnectionsMade = 0;

                // Connect Authors, Individuals, Orgs, Factors to MediaItem
                if (mediaItem?.id && typeof mediaItem.id === 'number') {
                    const mediaItemUpdateData = {
                         involvedPersonsMentioned: { connect: Array.from(authorIds).filter(id => typeof id === 'number').map(id => ({ id })) },
                         individualsFeatured: { connect: Array.from(individualConnectMap.get('mediaItem')?.individualsFeatured || []).filter(id => typeof id === 'number').map(id => ({ id })) },
                         organizationsMentioned: { connect: Array.from(individualConnectMap.get('mediaItemOrgs') || []).filter(id => typeof id === 'number').map(id => ({ id })) },
                         contributingFactorsMentioned: { connect: Array.from(individualConnectMap.get('mediaItemFactors') || []).filter(id => typeof id === 'number').map(id => ({ id })) },
                    };
                    // Remove empty connect arrays
                    Object.keys(mediaItemUpdateData).forEach(key => {
                        if (!mediaItemUpdateData[key].connect || mediaItemUpdateData[key].connect.length === 0) {
                             delete mediaItemUpdateData[key];
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

                // Connect Orgs and Factors to each Individual
                for (const [individualId, connections] of individualConnectMap.entries()) {
                     if (typeof individualId !== 'number') continue; // Skip the 'mediaItem' keys etc.

                     const individualUpdateData = {
                         organizationsInvolved: { connect: Array.from(connections.organizationsInvolved).filter(id => typeof id === 'number').map(id => ({ id })) },
                         contributingFactors: { connect: Array.from(connections.contributingFactors).filter(id => typeof id === 'number').map(id => ({ id })) },
                     };
                     // Remove empty connect arrays
                     Object.keys(individualUpdateData).forEach(key => {
                         if (!individualUpdateData[key].connect || individualUpdateData[key].connect.length === 0) {
                              delete individualUpdateData[key];
                         }
                     });

                     if (Object.keys(individualUpdateData).length > 0) {
                         try {
                             await prisma.individual.update({
                                 where: { id: individualId },
                                 data: individualUpdateData,
                             });
                              const count = Object.values(individualUpdateData).reduce((sum, val) => sum + (val.connect?.length || 0), 0);
                              currentConnectionsMade += count;
                             console.log(`LIVE RUN: Updated Individual ID ${individualId} with ${count} connections.`);
                         } catch (e) {
                              console.error(`${FG_RED}Error executing batch update for Individual ID ${individualId}:${RESET}`, e);
                              console.error("Update Data:", JSON.stringify(individualUpdateData, null, 2));
                         }
                     }
                }
                connectionsMade += currentConnectionsMade; // Add to total connections made
            } else { // Dry Run Summary for Connections
                 console.log(`DRY RUN: Would attempt ${connectionsAttempted} connect operations.`);
                 // connectionsMade = connectionsAttempted; // Use attempted count for dry run summary
            }


        } catch (error) { // Catch errors during the processing of a single file
            const errorMessage = `Failed to process file ${filename}: ${error.message}`;
            console.error(`${FG_RED}${errorMessage}${RESET}`, error.stack); // Log stack trace too
            fileProcessingErrors.push(`${FG_RED}  [File Error] ${errorMessage}${RESET}`);
            filesFailed++;
        }
    } // End loop through files

    // --- Print collected errors/warnings ---
    if (fileProcessingErrors.length > 0) {
        console.log(`\n${FG_MAGENTA}--- File Processing Errors Found ---${RESET}`);
        fileProcessingErrors.forEach(errorMsg => console.error(errorMsg));
        console.log(`${FG_MAGENTA}----------------------------------${RESET}`);
    }
    if (DRY_RUN && potentialDisambiguationConflicts.length > 0) {
        console.log(`\n${FG_MAGENTA}--- Potential Disambiguation Conflicts Found (Dry Run) ---${RESET}`);
        potentialDisambiguationConflicts.forEach(warning => console.warn(warning));
        console.log(`${FG_MAGENTA}----------------------------------------------------------${RESET}`);
    }

    // --- Final Summary ---
    console.log("\n--- Book Seeding Summary ---");
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE RUN'}`);
    console.log(`Total JSON files processed: ${filesProcessed}`);
    console.log(`Files failed during processing: ${filesFailed > 0 ? FG_RED : ''}${filesFailed}${RESET}`);
    console.log("-" * 20);
    console.log(`MediaWorks Upserted: ${mediaWorksUpserted}`);
    console.log(`MediaItems Upserted: ${mediaItemsUpserted}`);
    console.log(`Individuals Upserted: ${individualsUpserted}`);
    console.log(`InvolvedPersons (Authors) Upserted: ${involvedPersonsUpserted}`);
    console.log(`Organizations Upserted: ${organizationsUpserted}`);
    console.log(`Contributing Factors Found: ${contributingFactorsFound}`);
    console.log(`Source Links Created/Upserted: ${sourceLinksCreated}`);
    console.log(`Connections Attempted: ${connectionsAttempted}`);
    console.log(`Connections Made (Live): ${connectionsMade}`);
    console.log("-----------------------------");
}

// --- Run main function and handle disconnection ---
main()
    .then(async () => {
        console.log("Disconnecting Prisma Client...");
        await prisma.$disconnect();
        console.log("Prisma Client disconnected.");
        console.log("Book seeding script finished.");
    })
    .catch(async (e) => {
        console.error(`${FG_RED}An critical error occurred during seeding:${RESET}`, e);
        if (prisma) {
            try {
                await prisma.$disconnect();
                console.log("Prisma Client disconnected after error.");
            } catch (disconnectError) {
                console.error(`${FG_RED}Error disconnecting Prisma Client after error:${RESET}`, disconnectError);
            }
        }
        process.exit(1);
    });
