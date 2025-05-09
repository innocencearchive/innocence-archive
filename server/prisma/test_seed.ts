import {
    PrismaClient,
    Prisma,
    MediaWorkType,
    MediaItemType,
    IndividualStatus,
    OrganizationType,
    InvolvedPersonRole,
    ContributingFactor,
    Organization,
    InvolvedPerson,
    CrimeCategory,
    MediaWork,
    MediaItem // Ensure MediaItem is imported if used as a type
} from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// --- Interfaces for JSON structure ---
// Define interfaces matching the structure of your JSON files
// This provides type safety when reading the JSON data

interface JsonCrimeCategory {
    crime_name: string;
    severity_order?: number; // Optional in JSON, provide default if needed
}

interface JsonContributingFactor {
    name: string;
    description?: string;
}

interface JsonOrganization {
    name: string;
    type?: OrganizationType | string; // Allow string initially for flexibility
    locationCity?: string;
    locationState?: string;
    locationCountry?: string;
    website?: string;
    notes?: string;
}

interface JsonInvolvedPersonIdentifier {
    firstName: string;
    lastName: string;
}

interface JsonInvolvedPerson extends JsonInvolvedPersonIdentifier {
    role?: InvolvedPersonRole | string; // Allow string initially
    notes?: string;
}

interface JsonIndividual {
    firstName: string;
    lastName: string;
    status?: IndividualStatus | string; // Allow string initially
    convictionYear?: number;
    exonerationOrReleaseYear?: number;
    timeServedYears?: number;
    sentence?: string;
    caseLocationCity?: string;
    caseLocationCounty?: string; // Added based on schema
    caseLocationState?: string;
    caseLocationCountry?: string;
    narrativeSummary?: string;
    // References by name/identifier
    crimeCategoryName?: string;
    contributingFactorNames?: string[];
    organizationsInvolvedNames?: string[];
    involvedPersonsNames?: JsonInvolvedPersonIdentifier[];
}

interface JsonMediaItem {
    itemTitle?: string; // Made optional based on schema
    itemMediaType: MediaItemType | string; // Allow string initially
    itemNumber?: string; // Added based on schema
    hostOrNarrator?: string;
    focusOrTheme?: string;
    summaryNotes?: string;
    keyQuotes?: string;
    releaseDate?: string; // Assuming ISO string if present
    sourceUrl?: string;
    // References by name/identifier
    individualFeaturedNames?: string[]; // Assuming full names "First Last"
    contributingFactorsMentionedNames?: string[];
    organizationsMentionedNames?: string[];
    involvedPersonsMentionedNames?: JsonInvolvedPersonIdentifier[];
}

interface JsonMediaWork {
    title: string;
    workType: MediaWorkType | string; // Allow string initially
    creatorName?: string;
    publicationOrReleaseYear?: number;
    publisherOrNetwork?: string;
    focusOrTheme?: string;
    summaryNotes?: string;
    availabilityNotes?: string;
    sourceUrl?: string;
}

interface JsonInputData {
    sourceFileName: string;
    mediaWork: JsonMediaWork;
    mediaItem: JsonMediaItem;
    individuals: JsonIndividual[];
    // Top-level lists for upserting
    contributingFactors?: JsonContributingFactor[];
    organizations?: JsonOrganization[];
    involvedPersons?: JsonInvolvedPerson[];
    crimeCategories?: JsonCrimeCategory[];
}

// --- Helper Functions ---

// Helper to safely convert string enum values
function safeEnum<T>(enumType: T, value: string | undefined | null, defaultValue: T[keyof T]): T[keyof T] {
    if (!value) return defaultValue;
    // Check if the value is already a valid enum key
    if (Object.values(enumType as any).includes(value)) {
        return value as T[keyof T];
    }
    // Basic fallback logic - might need refinement based on actual string values
    console.warn(`Unknown enum value "${value}" for ${JSON.stringify(enumType)}. Using default: ${defaultValue}`);
    return defaultValue;
}

// Helper to create a unique key for persons (adjust if needed)
function getPersonKey(person: JsonInvolvedPersonIdentifier): string {
    // Ensure names are trimmed and lowercased for consistent key generation
    const firstName = person.firstName?.trim()?.toLowerCase() ?? '';
    const lastName = person.lastName?.trim()?.toLowerCase() ?? '';
    return `${firstName}-${lastName}`;
}


// --- Main Seeding Function ---
async function main() {
    // --- Configuration ---
    // *** ADJUST THIS PATH to your JSON output folder ***
    const jsonInputFolder = path.join(__dirname, '../../../seed_files/seeds/done'); // Example path: Assumes json_output is in project root

    console.log(`Starting seeding from JSON files in: ${jsonInputFolder}`);

    if (!fs.existsSync(jsonInputFolder)) {
        console.error(`Error: Input folder not found: ${jsonInputFolder}`);
        process.exit(1);
    }

    const jsonFiles = fs.readdirSync(jsonInputFolder).filter(file => file.endsWith('.json'));

    if (jsonFiles.length === 0) {
        console.log("No JSON files found in the input folder. Exiting.");
        return;
    }

    console.log(`Found ${jsonFiles.length} JSON files to process.`);

    // --- Processing Loop ---
    for (const jsonFile of jsonFiles) {
        const filePath = path.join(jsonInputFolder, jsonFile);
        console.log(`\n--- Processing: ${jsonFile} ---`);

        try {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const jsonData = JSON.parse(fileContent) as JsonInputData;

             // Validate essential data presence
             if (!jsonData.mediaWork || !jsonData.mediaWork.title) {
                console.warn(`Skipping ${jsonFile}: Missing mediaWork or mediaWork.title.`);
                continue;
            }
             if (!jsonData.mediaItem) {
                 console.warn(`Skipping ${jsonFile}: Missing mediaItem.`);
                 continue;
             }


            // --- Step 1: Upsert Related Lookup Entities ---
            // Store results in maps for easy ID lookup later { name -> ID }
            const factorMap = new Map<string, number>();
            const orgMap = new Map<string, number>();
            const personMap = new Map<string, number>(); // { uniqueKey -> ID }
            const crimeCatMap = new Map<string, number>();

            // Contributing Factors (Uses upsert based on unique name)
            if (jsonData.contributingFactors) {
                for (const factor of jsonData.contributingFactors) {
                    if (!factor.name) continue; // Skip factors without names
                    try {
                        const upsertedFactor = await prisma.contributingFactor.upsert({
                            where: { name: factor.name },
                            update: { description: factor.description },
                            create: { name: factor.name, description: factor.description },
                        });
                        factorMap.set(upsertedFactor.name, upsertedFactor.id);
                    } catch (e) {
                         console.error(`Error upserting factor "${factor.name}":`, e);
                    }
                }
                console.log(`Upserted/Processed ${factorMap.size} contributing factors.`);
            }

            // Organizations (Uses upsert based on unique name)
            if (jsonData.organizations) {
                for (const org of jsonData.organizations) {
                     if (!org.name) continue;
                     const orgTypeEnum = safeEnum(OrganizationType, org.type, OrganizationType.UNKNOWN);
                     try {
                         const upsertedOrg = await prisma.organization.upsert({
                             where: { name: org.name },
                             update: { /* update fields */ type: orgTypeEnum, locationCity: org.locationCity, locationState: org.locationState, locationCountry: org.locationCountry ?? 'USA', website: org.website, notes: org.notes },
                             create: { /* create fields */ name: org.name, type: orgTypeEnum, locationCity: org.locationCity, locationState: org.locationState, locationCountry: org.locationCountry ?? 'USA', website: org.website, notes: org.notes },
                         });
                         orgMap.set(upsertedOrg.name, upsertedOrg.id);
                     } catch (e) {
                          console.error(`Error upserting organization "${org.name}":`, e);
                     }
                }
                 console.log(`Upserted/Processed ${orgMap.size} organizations.`);
            }

             // Crime Categories (Uses upsert based on unique crime_name)
             if (jsonData.crimeCategories) {
                 for (const cat of jsonData.crimeCategories) {
                     if (!cat.crime_name) continue;
                     try {
                         const upsertedCat = await prisma.crimeCategory.upsert({
                             where: { crime_name: cat.crime_name },
                             update: { severity_order: cat.severity_order ?? 99 }, // Default severity
                             create: { crime_name: cat.crime_name, severity_order: cat.severity_order ?? 99 },
                         });
                         crimeCatMap.set(upsertedCat.crime_name, upsertedCat.id);
                     } catch (e) {
                          console.error(`Error upserting crime category "${cat.crime_name}":`, e);
                     }
                 }
                 console.log(`Upserted/Processed ${crimeCatMap.size} crime categories.`);
             }

            // Involved Persons (Uses findFirst + create)
            if (jsonData.involvedPersons) {
                for (const person of jsonData.involvedPersons) {
                    if (!person.firstName || !person.lastName) continue; // Need names
                    const personKey = getPersonKey(person);
                    const personRoleEnum = safeEnum(InvolvedPersonRole, person.role, InvolvedPersonRole.UNKNOWN);

                    // Use findFirst + create to avoid relying on upsert with potentially non-unique names
                    let existingPerson = await prisma.involvedPerson.findFirst({
                         where: { firstName: person.firstName, lastName: person.lastName }
                    });

                    if (!existingPerson) {
                        try {
                             existingPerson = await prisma.involvedPerson.create({
                                 data: {
                                     firstName: person.firstName,
                                     lastName: person.lastName,
                                     role: personRoleEnum,
                                     notes: person.notes,
                                 },
                             });
                             console.log(`Created person: ${person.firstName} ${person.lastName}`);
                         } catch (e: any) {
                             // Catch potential race condition if another process created it between findFirst and create
                             if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                                 console.warn(`Race condition likely for ${person.firstName} ${person.lastName}. Finding again.`);
                                 existingPerson = await prisma.involvedPerson.findFirst({
                                     where: { firstName: person.firstName, lastName: person.lastName }
                                 });
                                 if (!existingPerson) {
                                      console.error(`Could not create or find person ${person.firstName} ${person.lastName} after race condition check. Skipping.`);
                                      continue; // Skip this person if still not found
                                 }
                             } else {
                                 console.error(`Error creating person ${person.firstName} ${person.lastName}:`, e);
                                 continue; // Skip this person on other errors
                             }
                         }
                    }
                    // If existingPerson is found (either initially or after creation/race condition check)
                     if(existingPerson) {
                        personMap.set(personKey, existingPerson.id);
                    }
                }
                 console.log(`Processed ${personMap.size} involved persons.`);
            }


            // --- Step 2: Find or Create MediaWork ---
            const workDataInput = { /* ... work data from JSON ... */
                title: jsonData.mediaWork.title,
                workType: safeEnum(MediaWorkType, jsonData.mediaWork.workType, MediaWorkType.UNKNOWN),
                creatorName: jsonData.mediaWork.creatorName,
                publicationOrReleaseYear: jsonData.mediaWork.publicationOrReleaseYear,
                publisherOrNetwork: jsonData.mediaWork.publisherOrNetwork,
                focusOrTheme: jsonData.mediaWork.focusOrTheme,
                summaryNotes: jsonData.mediaWork.summaryNotes,
                availabilityNotes: jsonData.mediaWork.availabilityNotes,
                sourceUrl: jsonData.mediaWork.sourceUrl,
            };
            let mediaWork: MediaWork | null = await prisma.mediaWork.findFirst({ where: { title: workDataInput.title } });
            if (!mediaWork) {
                 try {
                     mediaWork = await prisma.mediaWork.create({ data: workDataInput });
                     console.log(`Created MediaWork: ${mediaWork.title} (ID: ${mediaWork.id})`);
                 } catch (e: any) {
                     if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                          console.warn(`Race condition likely for MediaWork title "${workDataInput.title}". Finding again.`);
                          mediaWork = await prisma.mediaWork.findFirst({ where: { title: workDataInput.title } });
                          if (!mediaWork) { console.error(`Could not create or find MediaWork "${workDataInput.title}" after race check. Skipping file.`); continue; }
                     } else { console.error(`Error creating MediaWork "${workDataInput.title}":`, e); continue; }
                 }
            } else {
                 console.log(`Found existing MediaWork: ${mediaWork.title} (ID: ${mediaWork.id})`);
            }
            if (!mediaWork) { console.error(`Failed to find or create MediaWork for title "${jsonData.mediaWork.title}". Skipping file ${jsonFile}.`); continue; }


            // --- Step 3: Create MediaItem (Original v2 logic) ---
            const itemTypeEnum = safeEnum(MediaItemType, jsonData.mediaItem.itemMediaType, MediaItemType.UNKNOWN);
            const mediaItem = await prisma.mediaItem.create({
                data: {
                    workId: mediaWork.id, // Link to MediaWork ID
                    itemTitle: jsonData.mediaItem.itemTitle,
                    itemMediaType: itemTypeEnum,
                    itemNumber: jsonData.mediaItem.itemNumber, // Added field
                    hostOrNarrator: jsonData.mediaItem.hostOrNarrator,
                    focusOrTheme: jsonData.mediaItem.focusOrTheme,
                    summaryNotes: jsonData.mediaItem.summaryNotes,
                    keyQuotes: jsonData.mediaItem.keyQuotes,
                    releaseDate: jsonData.mediaItem.releaseDate ? new Date(jsonData.mediaItem.releaseDate) : undefined,
                    sourceUrl: jsonData.mediaItem.sourceUrl,
                    // Connect item-level mentions later in Step 5
                },
            });
            console.log(`Created MediaItem: ID ${mediaItem.id} for ${mediaWork.title}`);


            // --- Step 4: Process Individuals ---
            let individualsCreatedCount = 0;
            if(jsonData.individuals){ // Check if individuals array exists
                for (const individualJson of jsonData.individuals) {
                    if (!individualJson.firstName || !individualJson.lastName) {
                        console.warn("Skipping individual record due to missing name in JSON.");
                        continue;
                    }

                    // Prepare connections
                    const factorConnect: Prisma.ContributingFactorWhereUniqueInput[] = (individualJson.contributingFactorNames ?? []).map(name => factorMap.get(name)).filter((id): id is number => id !== undefined).map(id => ({ id }));
                    const orgConnect: Prisma.OrganizationWhereUniqueInput[] = (individualJson.organizationsInvolvedNames ?? []).map(name => orgMap.get(name)).filter((id): id is number => id !== undefined).map(id => ({ id }));
                    const personConnect: Prisma.InvolvedPersonWhereUniqueInput[] = (individualJson.involvedPersonsNames ?? []).map(pId => personMap.get(getPersonKey(pId))).filter((id): id is number => id !== undefined).map(id => ({ id }));
                    const crimeCatId = individualJson.crimeCategoryName ? crimeCatMap.get(individualJson.crimeCategoryName) : undefined;
                    const statusEnum = safeEnum(IndividualStatus, individualJson.status, IndividualStatus.UNKNOWN);

                    // Create Individual
                    try {
                        await prisma.individual.create({
                            data: {
                                firstName: individualJson.firstName, lastName: individualJson.lastName, status: statusEnum,
                                convictionYear: individualJson.convictionYear, exonerationOrReleaseYear: individualJson.exonerationOrReleaseYear, timeServedYears: individualJson.timeServedYears,
                                sentence: individualJson.sentence, caseLocationCity: individualJson.caseLocationCity, caseLocationCounty: individualJson.caseLocationCounty, caseLocationState: individualJson.caseLocationState, caseLocationCountry: individualJson.caseLocationCountry ?? 'USA',
                                narrativeSummary: individualJson.narrativeSummary,
                                // Connect relationships
                                mediaItemAppearances: { connect: { id: mediaItem.id } }, // Connect to the created MediaItem
                                crimeCategory: crimeCatId ? { connect: { id: crimeCatId } } : undefined,
                                contributingFactors: factorConnect.length > 0 ? { connect: factorConnect } : undefined,
                                organizationsInvolved: orgConnect.length > 0 ? { connect: orgConnect } : undefined,
                                involvedPersons: personConnect.length > 0 ? { connect: personConnect } : undefined,
                            }
                        });
                        individualsCreatedCount++;
                    } catch (e) { console.error(`Error creating individual ${individualJson.firstName} ${individualJson.lastName}:`, e); }
                }
                 console.log(`Created ${individualsCreatedCount} individual records for this item.`);
            } else { console.log("No individuals found in this JSON file."); }


            // --- Step 5: Update MediaItem with Item-Level Connections ---
             // Find IDs for connections
             const itemFactorConnect: Prisma.ContributingFactorWhereUniqueInput[] = (jsonData.mediaItem.contributingFactorsMentionedNames ?? []).map(name => factorMap.get(name)).filter((id): id is number => id !== undefined).map(id => ({ id }));
             const itemOrgConnect: Prisma.OrganizationWhereUniqueInput[] = (jsonData.mediaItem.organizationsMentionedNames ?? []).map(name => orgMap.get(name)).filter((id): id is number => id !== undefined).map(id => ({ id }));
             const itemPersonConnect: Prisma.InvolvedPersonWhereUniqueInput[] = (jsonData.mediaItem.involvedPersonsMentionedNames ?? []).map(pId => personMap.get(getPersonKey(pId))).filter((id): id is number => id !== undefined).map(id => ({ id }));

             // Connect only if there are any connections to make
             if (itemFactorConnect.length > 0 || itemOrgConnect.length > 0 || itemPersonConnect.length > 0) {
                 try {
                     await prisma.mediaItem.update({
                         where: { id: mediaItem.id },
                         data: {
                             // Use set instead of connect to replace existing connections if the script reruns
                             // Or use connect if you only want to add connections
                             contributingFactorsMentioned: itemFactorConnect.length > 0 ? { set: itemFactorConnect } : undefined,
                             organizationsMentioned: itemOrgConnect.length > 0 ? { set: itemOrgConnect } : undefined,
                             involvedPersonsMentioned: itemPersonConnect.length > 0 ? { set: itemPersonConnect } : undefined,
                         }
                     });
                     console.log(`Updated MediaItem ID ${mediaItem.id} with item-level connections.`);
                 } catch (e) {
                      // Corrected the console.error line below
                      console.error(`Error updating MediaItem ID ${mediaItem.id} with connections:`, e);
                 }
             }


            console.log(`Successfully processed ${jsonFile}`);

        } catch (error: any) {
            // Catch errors during file reading or JSON parsing
             if (error instanceof SyntaxError) {
                console.error(`Error parsing JSON in file ${jsonFile}:`, error.message);
            } else {
                console.error(`Error processing file ${jsonFile}:`, error);
            }
        }
    }

    console.log(`\nSeeding finished.`);
}

// --- Execution ---
main()
    .catch((e) => {
        console.error("An error occurred during the seeding process:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        console.log("Prisma client disconnected.");
    });
