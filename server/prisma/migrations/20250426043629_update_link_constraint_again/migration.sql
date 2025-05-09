/*
  Warnings:

  - A unique constraint covering the columns `[individualId,specificUrl]` on the table `individual_source_links` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "individual_source_links_individualId_informationSourceId_key";

-- CreateIndex
CREATE UNIQUE INDEX "individual_source_links_individualId_specificUrl_key" ON "individual_source_links"("individualId", "specificUrl");
