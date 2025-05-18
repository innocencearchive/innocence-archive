const { PrismaClient, MediaWorkType, MediaItemType } = require('@prisma/client');
const fs = require('fs');
const { parse } = require('csv-parse');

const prisma = new PrismaClient();

async function main() {
  console.log(`Start seeding ...`);

  const filePath = './tmdb_data.csv'; // Adjust path if necessary
  const fileContent = fs.readFileSync(filePath, { encoding: 'utf-8' });

  parse(fileContent, {
    columns: true, // Use the first row as column headers
    skip_empty_lines: true,
    trim: true,
    bom: true, // Handles potential BOM characters at the start of the file
  }, async (err, records) => {
    if (err) {
      console.error('Failed to parse CSV:', err);
      return;
    }

    for (const record of records) {
      try {
        const title = record['Title'];
        const externalId = record['externalId'] || null;
        const type = record['Type']; // "Movie" or "TV Show"
        const releaseYearStr = record['Release Year'];
        const creatorName = record['Creator Name(s)'] || null;
        const publisherNetwork = record['Publisher/Network(s)'] || null;
        const summaryNotes = record['Summary Notes (TMDB)'] || null;
        const imagePath = record['Image Path'] || null;
        const sourcingCredit = record['SourcingCredit'] || "Information sourced from TMDB, but not endorsed or certified by TMDB."; // Default if empty

        let workType;
        if (type === 'Movie') {
          // We'll default 'Movie' to FILM. You might need more sophisticated logic
          // if some "Movie" entries are actually DOCUMENTARY.
          workType = MediaWorkType.FILM;
        } else if (type === 'TV Show') {
          workType = MediaWorkType.TV_SERIES;
        } else {
          console.warn(`Unknown work type "${type}" for title "${title}". Skipping.`);
          continue;
        }

        const releaseYear = releaseYearStr ? parseInt(releaseYearStr, 10) : null;
        if (releaseYearStr && isNaN(releaseYear)) {
            console.warn(`Invalid Release Year "${releaseYearStr}" for title "${title}". Setting to null.`);
        }

        console.log(`Processing: ${title} (Type: ${workType})`);

        const mediaWorkData = {
          title: title,
          workType: workType,
          externalId: externalId,
          publicationOrReleaseYear: !isNaN(releaseYear) ? releaseYear : null,
          creatorName: creatorName,
          publisherOrNetwork: publisherNetwork,
          summaryNotes: summaryNotes,
          imagePath: imagePath,
          SourcingCredit: sourcingCredit, // Added field
          // aiGenerated can be true by default as per your schema
        };

        const createdMediaWork = await prisma.mediaWork.upsert({
          where: { externalId: externalId || `MANUAL-${title.replace(/\s+/g, '-')}` }, // Ensure externalId is unique or provide a fallback
          update: mediaWorkData,
          create: mediaWorkData,
        });

        console.log(`Created/Updated MediaWork: ${createdMediaWork.title} (ID: ${createdMediaWork.id})`);

        // If it's a Film or Documentary, create a corresponding MediaItem
        // Based on the CSV, "Movie" could be FILM or DOCUMENTARY.
        // We've defaulted to FILM. If a distinction is needed, the CSV or logic needs an update.
        if (workType === MediaWorkType.FILM || workType === MediaWorkType.DOCUMENTARY) {
          let itemMediaType;
          if (workType === MediaWorkType.FILM) {
            itemMediaType = MediaItemType.FILM_CONTENT;
          } else { // DOCUMENTARY
            itemMediaType = MediaItemType.DOCUMENTARY_CONTENT;
          }

          // Check if a MediaItem for this film/documentary content already exists
          const existingMediaItem = await prisma.mediaItem.findFirst({
            where: {
              workId: createdMediaWork.id,
              itemMediaType: itemMediaType,
            }
          });

          if (!existingMediaItem) {
            const mediaItemData = {
              workId: createdMediaWork.id,
              itemTitle: `${createdMediaWork.title} (Content)`, // Or just title, or null
              itemMediaType: itemMediaType,
              summaryNotes: createdMediaWork.summaryNotes, // Can inherit summary from work
              // releaseDate, hostOrNarrator, keyQuotes could be null or derived if available
              // aiGenerated can be true by default
            };
            const createdMediaItem = await prisma.mediaItem.create({
              data: mediaItemData,
            });
            console.log(`Created MediaItem: ${createdMediaItem.itemTitle} (ID: ${createdMediaItem.id}) for MediaWork ID: ${createdMediaWork.id}`);
          } else {
            console.log(`MediaItem for ${createdMediaWork.title} (Type: ${itemMediaType}) already exists. Skipping creation.`);
          }
        }

      } catch (e) {
        console.error(`Error processing record "${record.Title}":`, e);
      }
    }
    console.log(`Seeding finished.`);
  });
}

main()
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });