/*
  Warnings:

  - You are about to drop the `_IndividualDataSource` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_IndividualDataSource" DROP CONSTRAINT "_IndividualDataSource_A_fkey";

-- DropForeignKey
ALTER TABLE "_IndividualDataSource" DROP CONSTRAINT "_IndividualDataSource_B_fkey";

-- DropTable
DROP TABLE "_IndividualDataSource";

-- CreateTable
CREATE TABLE "individual_source_links" (
    "id" SERIAL NOT NULL,
    "specificUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "individualId" INTEGER NOT NULL,
    "informationSourceId" INTEGER NOT NULL,

    CONSTRAINT "individual_source_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "individual_source_links_individualId_informationSourceId_key" ON "individual_source_links"("individualId", "informationSourceId");

-- AddForeignKey
ALTER TABLE "individual_source_links" ADD CONSTRAINT "individual_source_links_individualId_fkey" FOREIGN KEY ("individualId") REFERENCES "individuals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "individual_source_links" ADD CONSTRAINT "individual_source_links_informationSourceId_fkey" FOREIGN KEY ("informationSourceId") REFERENCES "information_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
