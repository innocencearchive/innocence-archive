-- AlterTable
ALTER TABLE "individuals" ADD COLUMN     "crimeDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "information_sources" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT,
    "specificUrl" TEXT,
    "retrievedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "information_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RelatedMediaItems" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_RelatedMediaItems_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_IndividualDataSource" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_IndividualDataSource_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "information_sources_name_key" ON "information_sources"("name");

-- CreateIndex
CREATE INDEX "_RelatedMediaItems_B_index" ON "_RelatedMediaItems"("B");

-- CreateIndex
CREATE INDEX "_IndividualDataSource_B_index" ON "_IndividualDataSource"("B");

-- AddForeignKey
ALTER TABLE "_RelatedMediaItems" ADD CONSTRAINT "_RelatedMediaItems_A_fkey" FOREIGN KEY ("A") REFERENCES "media_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RelatedMediaItems" ADD CONSTRAINT "_RelatedMediaItems_B_fkey" FOREIGN KEY ("B") REFERENCES "media_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IndividualDataSource" ADD CONSTRAINT "_IndividualDataSource_A_fkey" FOREIGN KEY ("A") REFERENCES "individuals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IndividualDataSource" ADD CONSTRAINT "_IndividualDataSource_B_fkey" FOREIGN KEY ("B") REFERENCES "information_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
