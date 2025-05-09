/*
  Warnings:

  - A unique constraint covering the columns `[firstName,middleName,lastName,suffix,nickname,disambiguationTag]` on the table `individuals` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "individuals_firstName_middleName_lastName_suffix_nickname_key";

-- AlterTable
ALTER TABLE "individuals" ADD COLUMN     "disambiguationTag" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "individuals_firstName_middleName_lastName_suffix_nickname_d_key" ON "individuals"("firstName", "middleName", "lastName", "suffix", "nickname", "disambiguationTag");
