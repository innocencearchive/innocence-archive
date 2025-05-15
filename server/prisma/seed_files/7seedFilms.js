// Example path: scripts/seedFilms.js

const fs = require('fs').promises; // Use promises version of fs
const path = require('path');
// Import necessary Enums along with PrismaClient
const {
    PrismaClient,
    MediaWorkType,
    MediaItemType,
    IndividualStatus,
    InvolvedPersonRole
    // Add other enums like OrganizationType if needed for mapping later
} = require('@prisma/client');
const human = require('humanparser'); // Ensure installed: npm install humanparser
const glob = require('glob'); // Ensure installed: npm install glob

// --- Configuration ---

// !!! --- SET DRY_RUN TO true FOR SIMULATION, false FOR ACTUAL SEEDING --- !!!
const DRY_RUN = true; // <<<<< Set to false for actual database changes >>>>>
// !!! ----------------------------------------------------------------- !!!

// Define the input directory containing the REFINED FILM JSON files
// *** ADJUST THIS PATH ***
const inputJsonDir = './films'; // <--- CHANGE THIS

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
        const cleanedName = fullName.trim().replace(/^"|"$/g, '');
        const parsedName = human.parseName(cleanedName);
        const firstName = parsedName.firstName || null;
        const middleName = parsedName.middleName ? parsedName.middleName.trim() : null;
        const lastName = parsedName.lastName || null;
        const suffix = parsedName.suffix || null;

        if (!firstName) {
             console.warn(`${FG_YELLOW}Warning: Could not reliably parse '${fullName}' - missing first name.${RESET}`);
             return defaultResult;
        }
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
    // Reuse the function from seedBooks.js - it seems robust enough
    if (!statusInput) return IndividualStatus.UNKNOWN;
    const statusString = Array.isArray(statusInput) ? statusInput[0] : statusInput;
    if (!statusString || typeof statusString !== 'string') return IndividualStatus.UNKNOWN;
    const lowerStatus = statusString.toLowerCase().trim();

    if (lowerStatus.includes('fully exonerated')) return IndividualStatus.EXONERATED;
    if (lowerStatus.includes('exonerated')) return IndividualStatus.EXONERATED;
    if (lowerStatus.includes('alford plea')) return IndividualStatus.RELEASED_ALFORD_PLEA;
    if (lowerStatus.includes('granted absolute pardon')) return IndividualStatus.RELEASED_CLEMENCY;
    if (lowerStatus.includes('pardoned based on innocence')) return IndividualStatus.RELEASED_CLEMENCY;
    if (lowerStatus.includes('pardon')) return IndividualStatus.RELEASED_CLEMENCY;
    if (lowerStatus.includes('clemency')) return IndividualStatus.RELEASED_CLEMENCY;
    if (lowerStatus.includes('conviction vacated')) return IndividualStatus.CONVICTION_OVERTURNED;
    if (lowerStatus.includes('conviction overturned')) return IndividualStatus.CONVICTION_OVERTURNED;
    if (lowerStatus.includes('charges dismissed')) return IndividualStatus.CONVICTION_OVERTURNED;
    if (lowerStatus.includes('new trial ordered')) return IndividualStatus.CONVICTION_OVERTURNED;
    if (lowerStatus.includes('executed')) return IndividualStatus.EXECUTED;
    if (lowerStatus.includes('released') && (lowerStatus.includes('time served') || lowerStatus.includes('parole'))) return IndividualStatus.RELEASED_TIME_SERVED;
    if (lowerStatus.includes('released')) return IndividualStatus.RELEASED_TIME_SERVED; // Generic release if not specified otherwise
    if (lowerStatus.includes('convicted') || lowerStatus.includes('incarcerated') || lowerStatus.includes('serving sentence')) return IndividualStatus.CONVICTED;

    console.warn(`${FG_YELLOW}Warning: Unmapped status string: '${statusString}'. Defaulting to UNKNOWN.${RESET}`);
    return IndividualStatus.UNKNOWN;
}

/**
 * Maps role strings to Prisma InvolvedPersonRole enum.
 * @param {string} roleString - The role string (e.g., "DIRECTOR", "Lawyer").
 * @returns {InvolvedPersonRole} The corresponding Prisma enum value.
 */
function mapPersonRole(roleString) {
    // Reuse the function from seedBooks.js, ensuring DIRECTOR is handled
    if (!roleString) return InvolvedPersonRole.UNKNOWN;
    const lowerRole = roleString.toLowerCase().trim();

    if (lowerRole.includes('director')) return InvolvedPersonRole.DIRECTOR; // Added Director
    if (lowerRole.includes('prosecutor')) return InvolvedPersonRole.LAWYER_PROSECUTION;
    if (lowerRole.includes('defense') || lowerRole.includes('attorney')) return InvolvedPersonRole.LAWYER_DEFENSE;
    if (lowerRole.includes('judge')) return InvolvedPersonRole.JUDGE;
    if (lowerRole.includes('detective')) return InvolvedPersonRole.POLICE_DETECTIVE;
    if (lowerRole.includes('officer')) return InvolvedPersonRole.POLICE_OFFICER;
    if (lowerRole.includes('expert')) return InvolvedPersonRole.WITNESS_EXPERT;
    if (lowerRole.includes('informant')) return InvolvedPersonRole.WITNESS_INFORMANT;
    if (lowerRole.includes('alibi')) return InvolvedPersonRole.WITNESS_ALIBI;
    if (lowerRole.includes('eyewitness')) return InvolvedPersonRole.WITNESS_EYEWITNESS;
    if (lowerRole.includes('witness')) return InvolvedPersonRole.WITNESS_EYEWITNESS;
    if (lowerRole.includes('victim')) return InvolvedPersonRole.VICTIM;
    if (lowerRole.includes('family')) return InvolvedPersonRole.FAMILY_MEMBER;
    if (lowerRole.includes('journalist')) return InvolvedPersonRole.JOURNALIST;
    if (lowerRole.includes('author')) return InvolvedPersonRole.AUTHOR;
    if (lowerRole.includes('host') || lowerRole.includes('narrator')) return InvolvedPersonRole.HOST; // Added Host/Narrator
    if (lowerRole.includes('activist')) return InvolvedPersonRole.ACTIVIST;
    if (lowerRole.includes('accuser')) return InvolvedPersonRole.ACCUSER;
    if (lowerRole.includes('perpetrator')) return InvolvedPersonRole.ACTUAL_PERPETRATOR;
    if (lowerRole.includes('co-defendant') || lowerRole.includes('codefendant')) return InvolvedPersonRole.CO_DEFENDANT;
    if (lowerRole.includes('lawyer')) return InvolvedPersonRole.LAWYER_DEFENSE;
    if (lowerRole.includes('police')) return InvolvedPersonRole.POLICE_OFFICER;

    console.warn(`${FG_YELLOW}Warning: Unmapped role string: '${roleString}'. Defaulting to OTHER.${RESET}`);
    return InvolvedPersonRole.OTHER;
}

/**
 * Maps work type string from JSON to Prisma MediaWorkType enum.
 * @param {string} workTypeString - The work_type string from JSON.
 * @returns {MediaWorkType} The corresponding Prisma enum value.
 */
function mapMediaWorkType(workTypeString) {
    if (!workTypeString || typeof workTypeString !== 'string') return MediaWorkType.UNKNOWN;
    const upperType = workTypeString.toUpperCase().trim();
    if (MediaWorkType[upperType]) {
        return MediaWorkType[upperType];
    }
    // Handle specific variations found in previous steps
    if (upperType === 'TV_NEWS_SPECIAL' || upperType === 'TV_SPECIAL' || upperType === 'TV_NEWS_MAGAZINE_SEGMENT') {
        console.warn(`${FG_YELLOW}Mapping MediaWorkType '${workTypeString}' to TV_SERIES.${RESET}`);
        return MediaWorkType.TV_SERIES;
    }
    console.warn(`${FG_YELLOW}Warning: Unmapped MediaWorkType string: '${workTypeString}'. Defaulting to UNKNOWN.${RESET}`);
    return MediaWorkType.UNKNOWN;
}

/**
 * Maps item type string from JSON to Prisma MediaItemType enum.
 * @param {string} itemTypeString - The item_media_type string from JSON.
 * @returns {MediaItemType} The corresponding Prisma enum value.
 */
function mapMediaItemType(itemTypeString) {
    if (!itemTypeString || typeof itemTypeString !== 'string') return MediaItemType.UNKNOWN;
    const upperType = itemTypeString.toUpperCase().trim();
    if (MediaItemType[upperType]) {
        return MediaItemType[upperType];
    }
     // Handle specific variations found in previous steps
     if (upperType === 'TV_NEWS_SPECIAL_CONTENT' || upperType === 'TV_SPECIAL_CONTENT' || upperType === 'TV_SEGMENT' || upperType === 'TV_NEWS_MAGAZINE_SEGMENT_CONTENT') {
        console.warn(`${FG_YELLOW}Mapping MediaItemType '${itemTypeString}' to TV_EPISODE.${RESET}`);
        return MediaItemType.TV_EPISODE;
    }
    console.warn(`${FG_YELLOW}Warning: Unmapped MediaItemType string: '${itemTypeString}'. Defaulting to UNKNOWN.${RESET}`);
    return MediaItemType.UNKNOWN;
}


// --- Upsert/Find Helpers ---

/**
 * Upserts a MediaWork record for a film/doc/series.
 * Uses findFirst + create/update strategy based on title and workType.
 * @param {object} workData - The media_work object from the JSON file.
 * @returns {Promise<object | null>} The upserted MediaWork object or null on failure.
 */
async function upsertMediaWork(workData) {
    const title = workData?.title?.trim();
    const workType = mapMediaWorkType(workData?.work_type); // Map type

    if (!title) {
        console.log(`${FG_YELLOW}Skipping MediaWork: Missing title.${RESET}`);
        return null;
    }
    if (workType === MediaWorkType.UNKNOWN) {
        console.log(`${FG_YELLOW}Skipping MediaWork: Unknown workType for title '${title}'.${RESET}`);
        return null;
    }

    const workDataPayload = {
        creatorName: workData?.creator_name ?? null,
        publicationOrReleaseYear: workData?.publication_or_release_year ? parseInt(workData.publication_or_release_year, 10) : null,
        publisherOrNetwork: workData?.publisher_or_network ?? null,
        focusOrTheme: workData?.focus_or_theme ?? null,
        summaryNotes: workData?.summaryNotes ?? null,
        availabilityNotes: workData?.availabilityNotes ?? null,
        sourceUrl: workData?.sourceUrl ?? null,
        aiGenerated: true
    };
    Object.keys(workDataPayload).forEach(key => ( workDataPayload[key] === undefined || workDataPayload[key] === null || (typeof workDataPayload[key] === 'number' && isNaN(workDataPayload[key])) ) ? delete workDataPayload[key] : {});

    const findMediaWorkWhere = { title: title, workType: workType };

    if (DRY_RUN) {
        console.log(`DRY RUN: Would check for MediaWork (${workType}) using findFirst with WHERE: ${JSON.stringify(findMediaWorkWhere)}`);
        const existing = await prisma.mediaWork.findFirst({ where: findMediaWorkWhere, select: { id: true, title: true } });
        if (existing) {
            const simulatedId = existing.id;
            console.log(`DRY RUN:   (Simulating found) MediaWork ID: ${simulatedId}`);
            console.log(`DRY RUN:   Would update with data: ${JSON.stringify(workDataPayload)}`);
            return { id: simulatedId, title: title, workType: workType, ...workDataPayload };
        } else {
            const simulatedId = `simulated_mw_${title.replace(/\W+/g, '_').substring(0, 20)}`;
            console.log(`DRY RUN:   (Simulating not found) Would create new MediaWork.`);
            const createData = { title: title, workType: workType, ...workDataPayload };
            console.log(`DRY RUN:     Create Data: ${JSON.stringify(createData)}`);
            return { id: simulatedId, ...createData };
        }
    } else {
        // ---- LIVE RUN ----
        const existingMediaWork = await prisma.mediaWork.findFirst({ where: findMediaWorkWhere });
        if (existingMediaWork) {
            console.log(`Found existing MediaWork '${title}' (${workType}, ID: ${existingMediaWork.id}). Updating...`);
            try { return await prisma.mediaWork.update({ where: { id: existingMediaWork.id }, data: workDataPayload }); }
            catch (updateError) { console.error(`${FG_RED}Error updating MediaWork ID ${existingMediaWork.id}: ${updateError.message}${RESET}`); return null; }
        } else {
            console.log(`No existing MediaWork found for '${title}' (${workType}). Creating...`);
            const createData = { title: title, workType: workType, ...workDataPayload };
            try { return await prisma.mediaWork.create({ data: createData }); }
            catch (createError) {
                 console.error(`${FG_RED}Error creating MediaWork '${title}' (${workType}): ${createError.message}${RESET}`);
                 if (createError.code === 'P2002') console.error(`${FG_RED}  -> Unique constraint violation?${RESET}`);
                 return null;
            }
        }
    }
}

/**
 * Upserts an Individual record.
 * Uses findFirst + create/update strategy based on name components + null disambiguationTag.
 * Includes check for existing individuals with the same first/last name during DRY_RUN.
 * @param {object} individualData - The individual object from the JSON's featured_individuals array.
 * @param {string} filename - The name of the source JSON file for context in warnings.
 * @returns {Promise<object | null>} The upserted Individual object or null on failure.
 */
async function upsertIndividual(individualData, filename) { // Added filename parameter
    const fullName = individualData?.full_name;
    if (!fullName) { console.log(`${FG_YELLOW}Skipping Individual upsert: Missing full_name.${RESET}`); return null; }
    const { firstName, middleName, lastName, suffix } = parseNameForUpsert(fullName);
    const finalFirstName = individualData.first_name || firstName;
    const finalMiddleName = individualData.middle_name !== undefined ? individualData.middle_name : middleName;
    const finalLastName = individualData.last_name || lastName;
    const finalSuffix = individualData.suffix !== undefined ? individualData.suffix : suffix;

    if (!finalFirstName) { console.log(`${FG_YELLOW}Skipping Individual upsert: Invalid/missing first name for '${fullName}'.${RESET}`); return null; }

    const findIndividualWhere = { firstName: finalFirstName, middleName: finalMiddleName, lastName: finalLastName, suffix: finalSuffix, disambiguationTag: null };

    const individualDataPayload = {
        nickname: individualData.nickname ?? null,
        status: mapIndividualStatus(individualData.status_raw),
        convictionYear: individualData.conviction_year ? parseInt(individualData.conviction_year, 10) : null,
        exonerationOrReleaseYear: individualData.exoneration_or_release_year ? parseInt(individualData.exoneration_or_release_year, 10) : null,
        timeServed: individualData.time_served ?? null,
        sentence: individualData.sentence ?? null,
        caseLocationCity: individualData.case_location_city ?? null,
        caseLocationState: individualData.case_location_state ?? null,
        narrativeSummary: individualData.narrative_summary ?? null,
        aiGenerated: true
    };
    Object.keys(individualDataPayload).forEach(key => ( individualDataPayload[key] === undefined || individualDataPayload[key] === null || individualDataPayload[key] === '' || (typeof individualDataPayload[key] === 'number' && isNaN(individualDataPayload[key])) ) ? delete individualDataPayload[key] : {});

    if (DRY_RUN) {
        console.log(`DRY RUN: Would check for Individual to upsert using WHERE: ${JSON.stringify(findIndividualWhere)}`);

        // --- MODIFIED: CHECK FOR POTENTIAL DISAMBIGUATION CONFLICTS (First/Last Name Match) ---
        try {
            const conflictCheckWhere = { firstName: finalFirstName, lastName: finalLastName };
            const conflictSelect = { id: true, firstName: true, middleName: true, lastName: true, suffix: true, disambiguationTag: true };

            const potentialConflicts = await prisma.individual.findMany({ where: conflictCheckWhere, select: conflictSelect });

            const actualConflicts = potentialConflicts.filter(p =>
                !(p.firstName === finalFirstName && p.middleName === finalMiddleName && p.lastName === finalLastName && p.suffix === finalSuffix && p.disambiguationTag === null)
            );

            if (actualConflicts.length > 0) {
                // --- UPDATED Conflict Message Formatting ---
                const incomingNameParsed = `F:'${finalFirstName}', M:'${finalMiddleName}', L:'${finalLastName}', S:'${finalSuffix}', Tag:null`;
                let conflictMessage = `${FG_YELLOW}    [Conflict Check] File: ${filename} | Incoming: '${fullName}' (${incomingNameParsed}) | Found ${actualConflicts.length} existing record(s) with matching First/Last names:${RESET}\n`;
                actualConflicts.forEach(p => {
                    const existingNameParsed = `F:'${p.firstName || ''}', M:'${p.middleName || ''}', L:'${p.lastName || ''}', S:'${p.suffix || ''}'`;
                    conflictMessage += `${FG_YELLOW}      - Existing ID: ${p.id} | Name: '${p.firstName || ''} ${p.middleName || ''} ${p.lastName || ''} ${p.suffix || ''}' (${existingNameParsed}) | Tag: '${p.disambiguationTag}'${RESET}\n`;
                });
                conflictMessage += `${FG_YELLOW}    -> Review needed. This script would upsert the incoming record with disambiguationTag: null.${RESET}`;
                potentialDisambiguationConflicts.push(conflictMessage); // Store warning
            }
        } catch (checkError) {
             console.error(`${FG_RED}    [DRY RUN ERROR] Failed conflict check for '${fullName}' in file ${filename}: ${checkError.message}${RESET}`);
             potentialDisambiguationConflicts.push(`${FG_RED}    [Error] Failed conflict check for '${fullName}' in file ${filename}.${RESET}`);
        }
        // --- END OF CONFLICT CHECK ---

        const existingTarget = await prisma.individual.findFirst({ where: findIndividualWhere, select: { id: true } });
        if (existingTarget) {
            const simulatedId = existingTarget.id;
            console.log(`DRY RUN:   (Simulating found target to update) Individual ID: ${simulatedId}`);
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
            try { return await prisma.individual.update({ where: { id: existingIndividual.id }, data: individualDataPayload }); }
            catch (updateError) { console.error(`${FG_RED}Error updating Individual ID ${existingIndividual.id}: ${updateError.message}${RESET}`); return null; }
        } else {
            console.log(`No existing Individual found for '${fullName}'. Creating...`);
            const createData = { ...findIndividualWhere, ...individualDataPayload };
            try { return await prisma.individual.create({ data: createData }); }
            catch (createError) {
                 console.error(`${FG_RED}Error creating Individual '${fullName}': ${createError.message}${RESET}`);
                 if (createError.code === 'P2002') console.error(`${FG_RED}  -> Unique constraint violation?${RESET}`);
                 return null;
            }
        }
    }
}

/**
 * Upserts an InvolvedPerson record (e.g., director).
 * Uses findFirst + create/update strategy based on name components.
 * @param {object} personData - The person object from the JSON's involved_persons array.
 * @returns {Promise<object | null>} The upserted InvolvedPerson object or null on failure.
 */
async function upsertInvolvedPerson(personData) {
    const fullName = personData?.full_name;
    const roleString = personData?.role;
    if (!fullName) { console.log(`${FG_YELLOW}Skipping InvolvedPerson upsert: Missing full_name.${RESET}`); return null; }
    const { firstName, middleName, lastName, suffix } = parseNameForUpsert(fullName);
    const finalFirstName = personData.first_name || firstName;
    const finalMiddleName = personData.middle_name !== undefined ? personData.middle_name : middleName;
    const finalLastName = personData.last_name || lastName;
    const finalSuffix = personData.suffix !== undefined ? personData.suffix : suffix;

    if (!finalFirstName) { console.log(`${FG_YELLOW}Skipping InvolvedPerson upsert: Invalid/missing first name for '${fullName}'.${RESET}`); return null; }

    const findPersonWhere = { firstName: finalFirstName, middleName: finalMiddleName, lastName: finalLastName, suffix: finalSuffix };

    const personDataPayload = { role: mapPersonRole(roleString), notes: personData.notes ?? null, aiGenerated: true };
    Object.keys(personDataPayload).forEach(key => ( personDataPayload[key] === undefined || personDataPayload[key] === null ) ? delete personDataPayload[key] : {});

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
            try { return await prisma.involvedPerson.update({ where: { id: existingPerson.id }, data: personDataPayload }); }
            catch (updateError) { console.error(`${FG_RED}Error updating InvolvedPerson ID ${existingPerson.id}: ${updateError.message}${RESET}`); return null; }
        } else {
            console.log(`No existing InvolvedPerson found for '${fullName}'. Creating...`);
            const createData = { ...findPersonWhere, ...personDataPayload };
            try { return await prisma.involvedPerson.create({ data: createData }); }
            catch (createError) {
                 console.error(`${FG_RED}Error creating InvolvedPerson '${fullName}': ${createError.message}${RESET}`);
                 if (createError.code === 'P2002') console.error(`${FG_RED}  -> Unique constraint violation?${RESET}`);
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
     if (!name) { console.log(`${FG_YELLOW}Skipping Organization upsert: Invalid name '${orgName}'.${RESET}`); return null; }
     const orgData = { name: name, aiGenerated: true };

    if (DRY_RUN) {
        const existing = await prisma.organization.findUnique({ where: { name: name }, select: { id: true, name: true } });
        if (existing) { console.log(`DRY RUN: Found Organization: '${name}' (ID: ${existing.id})`); return existing; }
        else { const simulatedId = `simulated_org_${name.replace(/\W+/g, '_').substring(0, 20)}`; console.log(`DRY RUN: Would create Organization: '${name}'`); return { id: simulatedId, ...orgData }; }
    } else {
         try { return await prisma.organization.upsert({ where: { name: name }, create: orgData, update: {} }); }
         catch (orgError) { console.error(`${FG_RED}Error upserting Organization '${name}': ${orgError.message}${RESET}`); return null; }
    }
}

/**
 * Finds a ContributingFactor record by name.
 * Assumes factors are pre-seeded.
 * @param {string} factorName - The name of the contributing factor.
 * @returns {Promise<object | null>} The found ContributingFactor object (with id) or null.
 */
async function findContributingFactor(factorName) {
     const name = factorName?.trim();
     if (!name) return null;
     const cleanedName = name.split('(')[0].trim();
     let factor = null;
     try { factor = await prisma.contributingFactor.findUnique({ where: { name: cleanedName }, select: { id: true, name: true } }); }
     catch (findError) { console.error(`${FG_RED}Error finding Contributing Factor '${cleanedName}': ${findError.message}${RESET}`); return null; }
     if (!factor) { console.log(`${FG_YELLOW}Warning: Contributing Factor '${cleanedName}' (from '${name}') not found in database. Add it manually or refine matching.${RESET}`); return null; }
     if (DRY_RUN) { console.log(`DRY RUN: Found Contributing Factor: '${factor.name}' (ID: ${factor.id})`); }
     return factor;
}

/**
 * Upserts a MediaItem record for film/episode content.
 * Uses findFirst + create/update strategy based on workId and itemTitle.
 * @param {number|string} mediaWorkId - The ID (real or simulated) of the parent MediaWork.
 * @param {object} itemData - The media_item object from the JSON file.
 * @returns {Promise<object | null>} The upserted MediaItem object or null on failure.
 */
async function upsertMediaItem(mediaWorkId, itemData) {
    const isValidWorkId = (typeof mediaWorkId === 'number' && !isNaN(mediaWorkId)) || (DRY_RUN && typeof mediaWorkId === 'string');
    if (!isValidWorkId) { console.error(`${FG_RED}Skipping MediaItem upsert: Invalid mediaWorkId (${mediaWorkId}).${RESET}`); return null; }

    const itemTitle = itemData?.item_title?.trim();
    const itemMediaType = mapMediaItemType(itemData?.item_media_type);

    if (!itemTitle) { console.log(`${FG_YELLOW}Skipping MediaItem upsert: Missing item_title.${RESET}`); return null; }
    if (itemMediaType === MediaItemType.UNKNOWN) { console.log(`${FG_YELLOW}Skipping MediaItem upsert: Unknown itemMediaType for title '${itemTitle}'.${RESET}`); return null; }

    const itemDataPayload = {
        itemNumber: itemData?.item_number ?? null,
        hostOrNarrator: itemData?.hostOrNarrator ?? null,
        focusOrTheme: itemData?.focus_or_theme ?? null,
        summaryNotes: itemData?.summary_notes ?? null,
        keyQuotes: Array.isArray(itemData?.key_quotes_raw) ? itemData.key_quotes_raw.join('\n---\n') : itemData?.key_quotes_raw ?? null,
        sourceUrl: itemData?.sourceUrl ?? null,
        aiGenerated: true
    };
    Object.keys(itemDataPayload).forEach(key => ( itemDataPayload[key] === undefined || itemDataPayload[key] === null || itemDataPayload[key] === '' ) ? delete itemDataPayload[key] : {});

    const findMediaItemWhere = { workId: typeof mediaWorkId === 'number' ? mediaWorkId : -999, itemTitle: itemTitle };
    if (!findMediaItemWhere.itemNumber) delete findMediaItemWhere.itemNumber;

    if (DRY_RUN) {
        console.log(`DRY RUN: Would check for MediaItem (${itemMediaType}) using findFirst with WHERE: ${JSON.stringify(findMediaItemWhere)} (Work ID: ${mediaWorkId})`);
        let existing = null;
        if (typeof mediaWorkId === 'number') { existing = await prisma.mediaItem.findFirst({ where: findMediaItemWhere, select: { id: true } }); }
        if (existing) {
            const simulatedId = existing.id;
            console.log(`DRY RUN:   (Simulating found) MediaItem ID: ${simulatedId}`);
            console.log(`DRY RUN:   Would update with data: ${JSON.stringify(itemDataPayload)}`);
            return { id: simulatedId, workId: mediaWorkId, itemTitle: itemTitle, itemMediaType: itemMediaType, ...itemDataPayload };
        } else {
            const simulatedId = `simulated_mi_${itemTitle.replace(/\W+/g, '_').substring(0, 20)}`;
            console.log(`DRY RUN:   (Simulating not found) Would create new MediaItem.`);
            const createData = { workId: mediaWorkId, itemTitle: itemTitle, itemMediaType: itemMediaType, ...itemDataPayload };
            console.log(`DRY RUN:     Create Data: ${JSON.stringify(createData)}`);
            return { id: simulatedId, ...createData };
        }
    } else {
         // ---- LIVE RUN ----
         if (typeof mediaWorkId !== 'number') { console.error(`${FG_RED}Cannot perform live MediaItem find/create: Invalid numeric mediaWorkId (${mediaWorkId}).${RESET}`); return null; }
         const liveFindWhereFirst = { workId: mediaWorkId, itemTitle: itemTitle };
         const existingItem = await prisma.mediaItem.findFirst({ where: liveFindWhereFirst });
         if (existingItem) {
              console.log(`Found existing MediaItem '${itemTitle}' (ID: ${existingItem.id}) for Work ID ${mediaWorkId}. Updating...`);
              try { return await prisma.mediaItem.update({ where: { id: existingItem.id }, data: itemDataPayload }); }
              catch (updateError) { console.error(`${FG_RED}Error updating MediaItem ID ${existingItem.id}: ${updateError.message}${RESET}`); return null; }
         } else {
              console.log(`No existing MediaItem found for '${itemTitle}' in Work ID ${mediaWorkId}. Creating...`);
              const createData = { workId: mediaWorkId, itemTitle: itemTitle, itemMediaType: itemMediaType, ...itemDataPayload };
              try { return await prisma.mediaItem.create({ data: createData }); }
              catch (createError) {
                   console.error(`${FG_RED}Error creating MediaItem '${itemTitle}': ${createError.message}${RESET}`);
                   if (createError.code === 'P2002') console.error(`${FG_RED}  -> Unique constraint violation?${RESET}`);
                   return null;
              }
         }
    }
}

/**
 * Upserts MediaItemSourceLink records for a given MediaItem from external_links_raw.
 * @param {number|string} mediaItemId - The ID (real or simulated) of the MediaItem.
 * @param {Array<object>} linksRaw - Array of objects from external_links_raw (expecting {url, description}).
 * @returns {Promise<number>} Count of links created/upserted.
 */
async function upsertMediaItemSourceLinks(mediaItemId, linksRaw) {
    const isValidItemId = (typeof mediaItemId === 'number' && !isNaN(mediaItemId)) || (DRY_RUN && typeof mediaItemId === 'string');
    if (!linksRaw || !Array.isArray(linksRaw) || !isValidItemId) { return 0; }

    let linksCreated = 0;
    for (const linkObj of linksRaw) {
         if (typeof linkObj !== 'object' || !linkObj || typeof linkObj.url !== 'string') { console.log(`${FG_YELLOW}Warning: Skipping invalid link object: ${JSON.stringify(linkObj)}${RESET}`); continue; }
         const url = linkObj.url.trim();
         const description = linkObj.description?.trim() || null;

         if (url && url.startsWith('http')) {
             if (DRY_RUN) { console.log(`DRY RUN: Would upsert Source Link: ${url} (Desc: ${description}) to MediaItem ID ${mediaItemId}`); linksCreated++; }
             else {
                  if (typeof mediaItemId !== 'number') { console.error(`${FG_RED}Cannot upsert source link: Invalid numeric mediaItemId (${mediaItemId}).${RESET}`); continue; }
                  try {
                      await prisma.mediaItemSourceLink.upsert({
                          where: { mediaItemId_url: { mediaItemId: mediaItemId, url: url } },
                          create: { url: url, description: description, mediaItemId: mediaItemId },
                          update: { description: description }
                      });
                      linksCreated++;
                  } catch(linkError) {
                       if (linkError.code === 'P2002') { console.warn(`${FG_YELLOW}Warning: Could not upsert source link ${url} due to potential duplicate (ensure @@unique constraint exists).${RESET}`); }
                       else if (linkError.message?.includes('Argument `where` is invalid') || linkError.message?.includes('mediaItemId_url')) { console.error(`${FG_RED}Error upserting source link ${url}: Missing '@@unique([mediaItemId, url])' constraint in schema?${RESET}`); }
                       else { console.error(`${FG_RED}Error upserting source link ${url} for MediaItem ${mediaItemId}:${RESET}`, linkError); }
                  }
             }
         } else { console.log(`${FG_YELLOW}Warning: Skipping invalid or non-HTTP(S) URL in link object: "${url}"${RESET}`); }
    }
    return linksCreated;
}


// --- Main Seeding Function ---
async function main() {
    potentialDisambiguationConflicts = [];
    fileProcessingErrors = [];

    if (DRY_RUN) { console.log(`${FG_MAGENTA}--- RUNNING IN DRY RUN MODE ---${RESET}`); }
    else { console.log(`${FG_RED}--- RUNNING IN LIVE MODE ---${RESET}`); }
    console.log("Starting Film/Documentary Seeding script...");

    let filesProcessed = 0, filesFailed = 0;
    let mediaWorksUpserted = 0, mediaItemsUpserted = 0;
    let individualsUpserted = 0, involvedPersonsUpserted = 0;
    let organizationsUpserted = 0, contributingFactorsFound = 0;
    let connectionsAttempted = 0, connectionsMade = 0;
    let sourceLinksCreated = 0;

    const pattern = path.join(inputJsonDir, '*.json').replace(/\\/g, '/');
    console.log(`Searching for JSON files using pattern: ${pattern}`);
    const jsonFiles = glob.sync(pattern);
    if (jsonFiles.length === 0) { console.log(`${FG_RED}Error: No JSON files found matching pattern '${pattern}'.${RESET}`); return; }
    console.log(`Found ${jsonFiles.length} JSON files to process.`);

    for (const filepath of jsonFiles) {
        const filename = path.basename(filepath); // Get filename for context
        console.log(`\n${FG_CYAN}Processing file: ${filename}${RESET}`);
        filesProcessed++;
        let currentFileConnectionsAttempted = 0;

        try {
            const fileContent = await fs.readFile(filepath, 'utf-8');
            const data = JSON.parse(fileContent);

            const mediaWork = await upsertMediaWork(data.media_work);
            if (!mediaWork?.id) throw new Error(`Could not upsert MediaWork`);
            if (typeof mediaWork.id === 'number') mediaWorksUpserted++;

            const mediaItem = await upsertMediaItem(mediaWork.id, data.media_item);
            if (!mediaItem?.id) throw new Error(`Could not upsert MediaItem`);
            if (typeof mediaItem.id === 'number') mediaItemsUpserted++;

            const involvedPersonIds = new Set();
            if (data.involved_persons && Array.isArray(data.involved_persons)) {
                for (const personData of data.involved_persons) {
                    const person = await upsertInvolvedPerson(personData);
                    if (person?.id) {
                        if (typeof person.id === 'number') involvedPersonsUpserted++;
                        involvedPersonIds.add(person.id);
                    }
                }
            }

            const individualConnectMap = new Map();
            individualConnectMap.set('mediaItem', { individualsFeatured: new Set() });
            individualConnectMap.set('mediaItemOrgs', new Set());
            individualConnectMap.set('mediaItemFactors', new Set());

            if (data.featured_individuals && Array.isArray(data.featured_individuals)) {
                for (const individualData of data.featured_individuals) {
                    // Pass filename to upsertIndividual for context in warnings
                    const individual = await upsertIndividual(individualData, filename);
                    if (!individual?.id) { console.log(`${FG_YELLOW}Warning: Could not upsert individual '${individualData.full_name}'. Connections may fail.${RESET}`); continue; }
                    if (typeof individual.id === 'number') individualsUpserted++;

                    individualConnectMap.set(individual.id, { organizationsInvolved: new Set(), contributingFactors: new Set() });
                    currentFileConnectionsAttempted++;
                    individualConnectMap.get('mediaItem').individualsFeatured.add(individual.id);

                    const orgsRaw = individualData.organizations_involved_raw || [];
                    for (const name of [...new Set(orgsRaw)]) {
                         const org = await upsertOrganization(name);
                         if(org?.id) {
                             if (typeof org.id === 'number') organizationsUpserted++;
                             currentFileConnectionsAttempted++;
                             individualConnectMap.get(individual.id).organizationsInvolved.add(org.id);
                             currentFileConnectionsAttempted++;
                             individualConnectMap.get('mediaItemOrgs').add(org.id);
                         }
                    }

                    const factorsRaw = individualData.contributing_factors_raw || [];
                    for (const name of [...new Set(factorsRaw)]) {
                         const factor = await findContributingFactor(name);
                         if(factor?.id) {
                             contributingFactorsFound++;
                             currentFileConnectionsAttempted++;
                             individualConnectMap.get(individual.id).contributingFactors.add(factor.id);
                             currentFileConnectionsAttempted++;
                             individualConnectMap.get('mediaItemFactors').add(factor.id);
                         }
                    }
                }
            } else { console.log(`${FG_YELLOW}Warning: No featured individuals found in ${filename}.${RESET}`); }

            const linksRaw = data.media_item?.external_links_raw || [];
            const linksCount = await upsertMediaItemSourceLinks(mediaItem.id, linksRaw);
            sourceLinksCreated += linksCount;

            currentFileConnectionsAttempted += involvedPersonIds.size;
            connectionsAttempted += currentFileConnectionsAttempted;

            if (!DRY_RUN && typeof mediaItem.id === 'number') {
                console.log(`Executing connections for MediaItem ID ${mediaItem.id}...`);
                let currentConnectionsMade = 0;
                const mediaItemUpdateData = {
                     involvedPersonsMentioned: { connect: Array.from(involvedPersonIds).filter(id => typeof id === 'number').map(id => ({ id })) },
                     individualsFeatured: { connect: Array.from(individualConnectMap.get('mediaItem')?.individualsFeatured || []).filter(id => typeof id === 'number').map(id => ({ id })) },
                     organizationsMentioned: { connect: Array.from(individualConnectMap.get('mediaItemOrgs') || []).filter(id => typeof id === 'number').map(id => ({ id })) },
                     contributingFactorsMentioned: { connect: Array.from(individualConnectMap.get('mediaItemFactors') || []).filter(id => typeof id === 'number').map(id => ({ id })) },
                };
                Object.keys(mediaItemUpdateData).forEach(key => { if (!mediaItemUpdateData[key].connect || mediaItemUpdateData[key].connect.length === 0) delete mediaItemUpdateData[key]; });

                if (Object.keys(mediaItemUpdateData).length > 0) {
                    try {
                        await prisma.mediaItem.update({ where: { id: mediaItem.id }, data: mediaItemUpdateData });
                        const count = Object.values(mediaItemUpdateData).reduce((sum, val) => sum + (val.connect?.length || 0), 0);
                        currentConnectionsMade += count;
                        console.log(`LIVE RUN: Updated MediaItem ID ${mediaItem.id} with ${count} connections.`);
                    } catch (e) { console.error(`${FG_RED}Error updating MediaItem ID ${mediaItem.id}:${RESET}`, e); }
                }

                for (const [individualId, connections] of individualConnectMap.entries()) {
                     if (typeof individualId !== 'number') continue;
                     const individualUpdateData = {
                         organizationsInvolved: { connect: Array.from(connections.organizationsInvolved).filter(id => typeof id === 'number').map(id => ({ id })) },
                         contributingFactors: { connect: Array.from(connections.contributingFactors).filter(id => typeof id === 'number').map(id => ({ id })) },
                     };
                     Object.keys(individualUpdateData).forEach(key => { if (!individualUpdateData[key].connect || individualUpdateData[key].connect.length === 0) delete individualUpdateData[key]; });

                     if (Object.keys(individualUpdateData).length > 0) {
                         try {
                             await prisma.individual.update({ where: { id: individualId }, data: individualUpdateData });
                              const count = Object.values(individualUpdateData).reduce((sum, val) => sum + (val.connect?.length || 0), 0);
                              currentConnectionsMade += count;
                             console.log(`LIVE RUN: Updated Individual ID ${individualId} with ${count} connections.`);
                         } catch (e) { console.error(`${FG_RED}Error updating Individual ID ${individualId}:${RESET}`, e); }
                     }
                }
                connectionsMade += currentConnectionsMade;
            } else if (DRY_RUN) {
                 console.log(`DRY RUN: Would attempt ${currentFileConnectionsAttempted} connect operations for this file.`);
            }

        } catch (error) {
            const errorMessage = `Failed to process file ${filename}: ${error.message}`;
            console.error(`${FG_RED}${errorMessage}${RESET}`, error.stack);
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
    // --- UPDATED: Print Disambiguation Warnings ---
    if (DRY_RUN && potentialDisambiguationConflicts.length > 0) {
        console.log(`\n${FG_MAGENTA}--- Potential Disambiguation Conflicts Found (Dry Run) ---${RESET}`);
        // Use Set to show unique warnings only (in case the same conflict is logged multiple times)
        const uniqueWarnings = [...new Set(potentialDisambiguationConflicts)];
        uniqueWarnings.forEach(warning => console.warn(warning)); // Print each unique warning
        console.log(`${FG_MAGENTA}----------------------------------------------------------${RESET}`);
        console.log(`${FG_YELLOW}Review the conflicts above. If a new entry should match an existing entry, update the source JSON or handle manually.${RESET}`);
        console.log(`${FG_YELLOW}If a new entry is genuinely a different person, consider adding a disambiguationTag in the source JSON or database.${RESET}`);
    }
    // --- END ---

    // --- Final Summary ---
    console.log("\n--- Film/Doc Seeding Summary ---");
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE RUN'}`);
    console.log(`Total JSON files processed: ${filesProcessed}`);
    console.log(`Files failed during processing: ${filesFailed > 0 ? FG_RED : ''}${filesFailed}${RESET}`);
    console.log("-" * 20);
    console.log(`MediaWorks Upserted: ${mediaWorksUpserted}`);
    console.log(`MediaItems Upserted: ${mediaItemsUpserted}`);
    console.log(`Individuals Upserted: ${individualsUpserted}`);
    console.log(`InvolvedPersons (Directors, etc.) Upserted: ${involvedPersonsUpserted}`);
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
        console.log("Film/Doc seeding script finished.");
    })
    .catch(async (e) => {
        console.error(`${FG_RED}An critical error occurred during seeding:${RESET}`, e);
        if (prisma) {
            try { await prisma.$disconnect(); console.log("Prisma Client disconnected after error."); }
            catch (disconnectError) { console.error(`${FG_RED}Error disconnecting Prisma Client after error:${RESET}`, disconnectError); }
        }
        process.exit(1);
    });
