/*
  Warnings:

  - A unique constraint covering the columns `[firstName,lastName]` on the table `individuals` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[firstName,lastName]` on the table `involved_persons` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[workId,itemNumber]` on the table `media_items` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "individuals_firstName_lastName_key" ON "individuals"("firstName", "lastName");

-- CreateIndex
CREATE UNIQUE INDEX "involved_persons_firstName_lastName_key" ON "involved_persons"("firstName", "lastName");

-- CreateIndex
CREATE UNIQUE INDEX "media_items_workId_itemNumber_key" ON "media_items"("workId", "itemNumber");
