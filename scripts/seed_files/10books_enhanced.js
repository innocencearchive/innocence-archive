// seedBooks.js
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Configure dotenv
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') }); // Assumes .env is in the same directory as the script

const prisma = new PrismaClient();
const csvFilePath = path.resolve(__dirname, 'bookdata_enhanced.csv');

async function main() {
  console.log(`Starting to process CSV file: ${csvFilePath}`);
  const records = [];

  fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on('data', (row) => {
      records.push(row);
    })
    .on('end', async () => {
      console.log(`CSV file successfully processed. Found ${records.length} records. Seeding to database...`);

      for (const row of records) {
        try {
          const mediaWorkId = parseInt(row.id, 10);
          if (isNaN(mediaWorkId)) {
            console.warn(`Skipping row with invalid ID: ${row.id}`);
            continue;
          }

          const publicationYear = row.publicationOrReleaseYear ? parseInt(row.publicationOrReleaseYear, 10) : null;
          const isbn13 = row.isbn_13_api || null;

          const mediaWorkData = {
            id: mediaWorkId, // Assuming CSV 'id' is the primary key for MediaWork
            title: row.title || 'Unknown Title',
            workType: 'BOOK',
            externalId: isbn13, // [cite: 1]
            creatorName: row.authors_api || row.creatorName, // [cite: 2]
            publicationOrReleaseYear: !isNaN(publicationYear) ? publicationYear : null,
            publisherOrNetwork: row.publisher_api || row.publisherOrNetwork, // [cite: 3]
            summaryNotes: row.description_api || row.summaryNotes, // [cite: 4]
            imagePath: row.enlargedThumbnailLink_api || row.imagePath, // [cite: 5]
            aiGenerated: false, // [cite: 6]
            SourcingCredit: "Data from Google Books", // [cite: 7]
            focusOrTheme: row.focusOrTheme || null,
            sourceUrl: row.sourceUrl || null,
            availabilityNotes: row.availabilityNotes || null,
            lastExternalFetch: new Date(),
            // createdAt will be set on creation, updatedAt will be updated
          };

          const categories = row.categories_api ? row.categories_api.split(',').map(cat => cat.trim()).filter(cat => cat) : [];

          const bookPurchaseDetailsData = {
            subtitle: row.subtitle_api || null,
            pageCount: row.pageCount_api ? parseInt(row.pageCount_api, 10) : null,
            googleBooksPreviewLink: row.googleBooksPreviewLink_api || null,
            googleBooksWebReaderLink: row.googleBooksWebReaderLink_api || null,
            googleBooksBuyLink: row.googleBooksBuyLink_api || null,
            googleBooksCategories: categories,
            amazonPurchaseUrl: isbn13 ? `https://www.amazon.com/dp/${isbn13}` : null, // [cite: 9]
            listPriceAmount: row.listPriceAmount_api ? parseFloat(row.listPriceAmount_api) : null,
            listPriceCurrency: row.listPriceCurrency_api || null,
            retailPriceAmount: row.retailPriceAmount_api ? parseFloat(row.retailPriceAmount_api) : null,
            retailPriceCurrency: row.retailPriceCurrency_api || null,
            isEbookGoogle: row.isEbookGoogle_api === 'TRUE',
            saleabilityGoogle: row.saleabilityGoogle_api || null,
            viewabilityGoogle: row.viewabilityGoogle_api || null,
            lastApiCheck: new Date(), // [cite: 10]
            // createdAt and updatedAt will be handled by Prisma
          };

          // Validate pageCount
          if (bookPurchaseDetailsData.pageCount !== null && isNaN(bookPurchaseDetailsData.pageCount)) {
            console.warn(`Invalid pageCount for MediaWork ID ${mediaWorkId}: ${row.pageCount_api}. Setting to null.`);
            bookPurchaseDetailsData.pageCount = null;
          }
           // Validate listPriceAmount
           if (bookPurchaseDetailsData.listPriceAmount !== null && isNaN(bookPurchaseDetailsData.listPriceAmount)) {
            console.warn(`Invalid listPriceAmount for MediaWork ID ${mediaWorkId}: ${row.listPriceAmount_api}. Setting to null.`);
            bookPurchaseDetailsData.listPriceAmount = null;
          }
          // Validate retailPriceAmount
          if (bookPurchaseDetailsData.retailPriceAmount !== null && isNaN(bookPurchaseDetailsData.retailPriceAmount)) {
            console.warn(`Invalid retailPriceAmount for MediaWork ID ${mediaWorkId}: ${row.retailPriceAmount_api}. Setting to null.`);
            bookPurchaseDetailsData.retailPriceAmount = null;
          }


          await prisma.mediaWork.upsert({
            where: { id: mediaWorkId },
            update: {
              ...mediaWorkData,
              bookPurchaseDetails: {
                upsert: { // If BookPurchaseDetails exists, update it; otherwise, create it.
                  create: bookPurchaseDetailsData,
                  update: bookPurchaseDetailsData,
                },
              },
            },
            create: {
              ...mediaWorkData,
              bookPurchaseDetails: {
                create: bookPurchaseDetailsData,
              },
            },
          });
          console.log(`Upserted MediaWork ID: ${mediaWorkId} - ${mediaWorkData.title}`);

        } catch (e) {
          console.error(`Error processing row with ID ${row.id} (Title: ${row.title || 'N/A'}):`, e.message);
          if (e.code === 'P2002' && e.meta && e.meta.target.includes('externalId')) {
            console.error(`  -> This might be a duplicate externalId (ISBN13): ${row.isbn_13_api}`);
          }
          // You might want to log more details from e.meta if available
        }
      }
      console.log('Database seeding finished.');
    });
}

main()
  .catch((e) => {
    console.error('An error occurred during the seeding process:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });