const { PrismaClient, MediaWorkType, MediaItemType } = require('@prisma/client');
const fs = require('fs');
const { parse } = require('csv-parse'); // npm install csv-parse

const prisma = new PrismaClient();

async function main() {
  console.log(`Start seeding with updated logic (match by title, overwrite existing, preserve original workType for updates)...`);

  const filePath = './tmdb_data.csv'; // Adjust path if necessary
  const fileContent = fs.readFileSync(filePath, { encoding: 'utf-8' });

  // Wrap the parser in a Promise to handle its asynchronous nature within the async main function
  await new Promise((resolve, reject) => {
    parse(fileContent, {
      columns: true, // Use the first row as column headers
      skip_empty_lines: true,
      trim: true,
      bom: true, // Handles potential BOM characters at the start of the file
    }, async (err, records) => {
      if (err) {
        console.error('Failed to parse CSV:', err);
        reject(err); // Reject the promise on parsing error
        return;
      }

      for (const record of records) {
        try {
          const csvTitle = record['Title'];
          const csvExternalId = record['externalId'] || null;
          const csvType = record['Type']; // "Movie" or "TV Show"
          const csvReleaseYearStr = record['Release Year'];
          const csvCreatorName = record['Creator Name(s)'] || null;
          const csvPublisherNetwork = record['Publisher/Network(s)'] || null;
          const csvSummaryNotes = record['Summary Notes (TMDB)'] || null;
          const csvImagePath = record['Image Path'] || null;
          const csvSourcingCredit = record['SourcingCredit'] || "Information sourced from TMDB, but not endorsed or certified by TMDB.";

          if (!csvTitle) {
            console.warn(`Skipping record due to missing title:`, record);
            continue;
          }
          if (!csvExternalId) {
            console.warn(`Skipping record "${csvTitle}" due to missing externalId in CSV. This ID is needed for upserting new TMDB entries.`);
            continue;
          }

          // Determine workType from CSV - this will be used for new records
          // or when upserting by externalId (where the CSV is the source of truth for workType).
          let workTypeFromCSV;
          if (csvType === 'Movie') {
            workTypeFromCSV = MediaWorkType.FILM;
          } else if (csvType === 'TV Show') {
            workTypeFromCSV = MediaWorkType.TV_SERIES;
          } else {
            console.warn(`Unknown work type "${csvType}" for title "${csvTitle}". Skipping.`);
            continue;
          }

          const releaseYear = csvReleaseYearStr ? parseInt(csvReleaseYearStr, 10) : null;
          if (csvReleaseYearStr && isNaN(releaseYear)) {
              console.warn(`Invalid Release Year "${csvReleaseYearStr}" for title "${csvTitle}". Setting to null.`);
          }

          console.log(`Processing: ${csvTitle} (CSV Type: ${csvType}, ExternalID from CSV: ${csvExternalId})`);

          // Base payload from CSV data. WorkType will be decided based on context (update vs create).
          const basePayloadFromCSV = {
            title: csvTitle,
            externalId: csvExternalId,
            publicationOrReleaseYear: !isNaN(releaseYear) ? releaseYear : null,
            creatorName: csvCreatorName,
            publisherOrNetwork: csvPublisherNetwork,
            summaryNotes: csvSummaryNotes,
            imagePath: csvImagePath,
            SourcingCredit: csvSourcingCredit,
            aiGenerated: false, // Data from TMDB is human-curated
            lastExternalFetch: new Date(), // Record when this TMDB data was processed
          };

          // Step 1: Try to find an existing record by title only, that DOES NOT have an externalId yet.
          const existingMediaWorkToUpdate = await prisma.mediaWork.findFirst({
            where: {
              title: csvTitle, // Match only on title
              externalId: null, // Crucial: only match if externalId is not yet set
            },
          });

          let savedMediaWork;

          if (existingMediaWorkToUpdate) {
            // Step 2a: If found, update this existing record.
            // Preserve its original workType, but overwrite all other fields with CSV data.
            console.log(`Found existing record for "${csvTitle}" (ID: ${existingMediaWorkToUpdate.id}, Original WorkType: ${existingMediaWorkToUpdate.workType}) with null externalId. Overwriting with new data, preserving original workType...`);

            const updateData = {
              ...basePayloadFromCSV, // Spread all data from CSV
              workType: existingMediaWorkToUpdate.workType, // IMPORTANT: Preserve the existing workType
            };

            savedMediaWork = await prisma.mediaWork.update({
              where: { id: existingMediaWorkToUpdate.id }, // Update using the unique ID of the found record
              data: updateData,
            });
            console.log(`Updated MediaWork ID: ${savedMediaWork.id}. Title: ${savedMediaWork.title}, New ExternalID: ${savedMediaWork.externalId}, Preserved WorkType: ${savedMediaWork.workType}`);
          } else {
            // Step 2b: If no existing record (matching title with null externalId) is found,
            // then upsert based on the TMDB externalId.
            // For these cases (new record or update of a record already having an externalId),
            // the workType from the CSV is authoritative.
            console.log(`No existing record found for "${csvTitle}" with null externalId. Upserting by CSV externalId: ${csvExternalId} using CSV workType: ${workTypeFromCSV}...`);

            const createOrUpsertData = {
              ...basePayloadFromCSV,
              workType: workTypeFromCSV, // Use workType derived from CSV
            };

            savedMediaWork = await prisma.mediaWork.upsert({
              where: { externalId: csvExternalId }, // externalId from TMDB *should* be unique
              create: createOrUpsertData,
              update: createOrUpsertData, // If updating via externalId match, also use CSV data (including CSV workType)
            });
            console.log(`Upserted MediaWork ID: ${savedMediaWork.id} by externalId ${csvExternalId}. Title: ${savedMediaWork.title}, WorkType: ${savedMediaWork.workType}`);
          }

          // Step 3: Create/Update corresponding MediaItem for FILM or DOCUMENTARY types
          // This logic uses savedMediaWork, which will have the correct workType.
          if (savedMediaWork.workType === MediaWorkType.FILM || savedMediaWork.workType === MediaWorkType.DOCUMENTARY) {
            let itemMediaType;
            if (savedMediaWork.workType === MediaWorkType.FILM) {
              itemMediaType = MediaItemType.FILM_CONTENT;
            } else { // DOCUMENTARY
              itemMediaType = MediaItemType.DOCUMENTARY_CONTENT;
            }

            const mediaItemPayload = {
                workId: savedMediaWork.id,
                itemTitle: `${savedMediaWork.title} (Content)`,
                itemMediaType: itemMediaType,
                summaryNotes: savedMediaWork.summaryNotes,
                aiGenerated: false,
                releaseDate: savedMediaWork.publicationOrReleaseYear ? new Date(savedMediaWork.publicationOrReleaseYear, 0, 1) : null,
            };

            const existingMediaItem = await prisma.mediaItem.findFirst({
                 where: { workId: savedMediaWork.id, itemMediaType: itemMediaType }
            });

            if (!existingMediaItem) {
                const createdItem = await prisma.mediaItem.create({ data: mediaItemPayload });
                console.log(`Created MediaItem for ${savedMediaWork.title} (Work ID: ${savedMediaWork.id}, Item ID: ${createdItem.id})`);
            } else {
                const updatedItem = await prisma.mediaItem.update({
                    where: { id: existingMediaItem.id },
                    data: { // Only update fields that might change from TMDB or are derived
                        summaryNotes: mediaItemPayload.summaryNotes,
                        releaseDate: mediaItemPayload.releaseDate,
                        itemTitle: mediaItemPayload.itemTitle, // In case the work title changed
                    }
                });
                console.log(`Updated existing MediaItem for ${savedMediaWork.title} (Item ID: ${updatedItem.id})`);
            }
          }

        } catch (e) {
          console.error(`Error processing CSV record (Title: "${record.Title}", ExternalID: "${record.externalId}"):`, e);
        }
      }
      console.log(`Seeding finished.`);
      resolve();
    });
  });
}

main()
  .catch(async (e) => {
    console.error('Critical error in main execution:', e);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

