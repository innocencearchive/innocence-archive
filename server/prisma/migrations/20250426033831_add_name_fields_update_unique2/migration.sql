/*
  Warnings:

  - A unique constraint covering the columns `[firstName,middleName,lastName,suffix,disambiguationTag]` on the table `individuals` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "individuals_firstName_middleName_lastName_suffix_nickname_d_key";

-- CreateIndex
CREATE UNIQUE INDEX "individuals_firstName_middleName_lastName_suffix_disambigua_key" ON "individuals"("firstName", "middleName", "lastName", "suffix", "disambiguationTag");
