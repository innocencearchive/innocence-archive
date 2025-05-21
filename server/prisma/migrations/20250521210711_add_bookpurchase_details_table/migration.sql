-- CreateTable
CREATE TABLE "book_purchase_details" (
    "id" SERIAL NOT NULL,
    "mediaWorkId" INTEGER NOT NULL,
    "subtitle" TEXT,
    "pageCount" INTEGER,
    "googleBooksPreviewLink" TEXT,
    "googleBooksWebReaderLink" TEXT,
    "googleBooksBuyLink" TEXT,
    "googleBooksCategories" TEXT[],
    "amazonPurchaseUrl" TEXT,
    "amazonPriceAmount" DOUBLE PRECISION,
    "amazonPriceCurrency" TEXT,
    "listPriceAmount" DOUBLE PRECISION,
    "listPriceCurrency" TEXT,
    "retailPriceAmount" DOUBLE PRECISION,
    "retailPriceCurrency" TEXT,
    "isEbookGoogle" BOOLEAN,
    "saleabilityGoogle" TEXT,
    "viewabilityGoogle" TEXT,
    "lastApiCheck" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_purchase_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "book_purchase_details_mediaWorkId_key" ON "book_purchase_details"("mediaWorkId");

-- AddForeignKey
ALTER TABLE "book_purchase_details" ADD CONSTRAINT "book_purchase_details_mediaWorkId_fkey" FOREIGN KEY ("mediaWorkId") REFERENCES "media_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;
