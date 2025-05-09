/*
  Warnings:

  - A unique constraint covering the columns `[firstName,middleName,lastName,suffix,nickname]` on the table `individuals` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[firstName,middleName,lastName,suffix]` on the table `involved_persons` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "individuals_firstName_lastName_key";

-- DropIndex
DROP INDEX "involved_persons_firstName_lastName_key";

-- AlterTable
ALTER TABLE "individuals" ADD COLUMN     "middleName" TEXT,
ADD COLUMN     "nickname" TEXT,
ADD COLUMN     "suffix" TEXT;

-- AlterTable
ALTER TABLE "involved_persons" ADD COLUMN     "middleName" TEXT,
ADD COLUMN     "nickname" TEXT,
ADD COLUMN     "suffix" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "individuals_firstName_middleName_lastName_suffix_nickname_key" ON "individuals"("firstName", "middleName", "lastName", "suffix", "nickname");

-- CreateIndex
CREATE UNIQUE INDEX "involved_persons_firstName_middleName_lastName_suffix_key" ON "involved_persons"("firstName", "middleName", "lastName", "suffix");
