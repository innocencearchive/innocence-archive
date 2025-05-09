/*
  Warnings:

  - The primary key for the `contributing_factors` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `dna_evidence` on the `contributing_factors` table. All the data in the column will be lost.
  - You are about to drop the column `exoneree_id` on the `contributing_factors` table. All the data in the column will be lost.
  - You are about to drop the column `false_confession` on the `contributing_factors` table. All the data in the column will be lost.
  - You are about to drop the column `false_misleading_forensic_evidence` on the `contributing_factors` table. All the data in the column will be lost.
  - You are about to drop the column `inadequate_legal_defense` on the `contributing_factors` table. All the data in the column will be lost.
  - You are about to drop the column `mistaken_witness_id` on the `contributing_factors` table. All the data in the column will be lost.
  - You are about to drop the column `official_misconduct` on the `contributing_factors` table. All the data in the column will be lost.
  - You are about to drop the column `perjury_false_accusation` on the `contributing_factors` table. All the data in the column will be lost.
  - You are about to drop the `_ExonereeOmTags` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_ExonereeTags` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `exonerees` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `om_tags` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tags` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[name]` on the table `contributing_factors` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `name` to the `contributing_factors` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `contributing_factors` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MediaWorkType" AS ENUM ('BOOK', 'FILM', 'DOCUMENTARY', 'DOCUSERIES', 'PODCAST_SERIES', 'TV_SERIES', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MediaItemType" AS ENUM ('PODCAST_EPISODE', 'TV_EPISODE', 'BOOK_CONTENT', 'FILM_CONTENT', 'DOCUMENTARY_CONTENT', 'BOOK_CHAPTER', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "IndividualStatus" AS ENUM ('EXONERATED', 'RELEASED_ALFORD_PLEA', 'RELEASED_CLEMENCY', 'RELEASED_TIME_SERVED', 'CONVICTION_OVERTURNED', 'EXECUTED', 'CONVICTED', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('INNOCENCE_ORG', 'LEGAL_AID', 'LAW_FIRM', 'LAW_ENFORCEMENT', 'GOVERNMENT_AGENCY', 'SUPPORT_GROUP', 'MEDIA_ORG', 'UNIVERSITY', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "InvolvedPersonRole" AS ENUM ('LAWYER_DEFENSE', 'LAWYER_PROSECUTION', 'JUDGE', 'WITNESS_EYEWITNESS', 'WITNESS_ALIBI', 'WITNESS_EXPERT', 'WITNESS_INFORMANT', 'POLICE_DETECTIVE', 'POLICE_OFFICER', 'VICTIM', 'FAMILY_MEMBER', 'JOURNALIST', 'AUTHOR', 'DIRECTOR', 'HOST', 'ACTIVIST', 'ACCUSER', 'ACTUAL_PERPETRATOR', 'CO_DEFENDANT', 'SUBJECT_EXONEREE', 'SUBJECT_OTHER', 'OTHER', 'UNKNOWN');

-- DropForeignKey
ALTER TABLE "_ExonereeOmTags" DROP CONSTRAINT "_ExonereeOmTags_A_fkey";

-- DropForeignKey
ALTER TABLE "_ExonereeOmTags" DROP CONSTRAINT "_ExonereeOmTags_B_fkey";

-- DropForeignKey
ALTER TABLE "_ExonereeTags" DROP CONSTRAINT "_ExonereeTags_A_fkey";

-- DropForeignKey
ALTER TABLE "_ExonereeTags" DROP CONSTRAINT "_ExonereeTags_B_fkey";

-- DropForeignKey
ALTER TABLE "contributing_factors" DROP CONSTRAINT "contributing_factors_exoneree_id_fkey";

-- AlterTable
ALTER TABLE "contributing_factors" DROP CONSTRAINT "contributing_factors_pkey",
DROP COLUMN "dna_evidence",
DROP COLUMN "exoneree_id",
DROP COLUMN "false_confession",
DROP COLUMN "false_misleading_forensic_evidence",
DROP COLUMN "inadequate_legal_defense",
DROP COLUMN "mistaken_witness_id",
DROP COLUMN "official_misconduct",
DROP COLUMN "perjury_false_accusation",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "id" SERIAL NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD CONSTRAINT "contributing_factors_pkey" PRIMARY KEY ("id");

-- DropTable
DROP TABLE "_ExonereeOmTags";

-- DropTable
DROP TABLE "_ExonereeTags";

-- DropTable
DROP TABLE "exonerees";

-- DropTable
DROP TABLE "om_tags";

-- DropTable
DROP TABLE "tags";

-- CreateTable
CREATE TABLE "media_works" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "workType" "MediaWorkType" NOT NULL,
    "creatorName" TEXT,
    "publicationOrReleaseYear" INTEGER,
    "publisherOrNetwork" TEXT,
    "focusOrTheme" TEXT,
    "summaryNotes" TEXT,
    "availabilityNotes" TEXT,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_works_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_items" (
    "id" SERIAL NOT NULL,
    "itemTitle" TEXT,
    "itemNumber" TEXT,
    "itemMediaType" "MediaItemType" NOT NULL,
    "releaseDate" TIMESTAMP(3),
    "hostOrNarrator" TEXT,
    "focusOrTheme" TEXT,
    "summaryNotes" TEXT,
    "keyQuotes" TEXT,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workId" INTEGER NOT NULL,

    CONSTRAINT "media_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "individuals" (
    "id" SERIAL NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "status" "IndividualStatus",
    "convictionYear" INTEGER,
    "exonerationOrReleaseYear" INTEGER,
    "timeServedYears" DOUBLE PRECISION,
    "sentence" TEXT,
    "caseLocationCity" TEXT,
    "caseLocationCounty" TEXT,
    "caseLocationState" TEXT,
    "caseLocationCountry" TEXT NOT NULL DEFAULT 'USA',
    "narrativeSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "crimeCategoryId" INTEGER,

    CONSTRAINT "individuals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OrganizationType",
    "locationCity" TEXT,
    "locationState" TEXT,
    "locationCountry" TEXT NOT NULL DEFAULT 'USA',
    "website" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "involved_persons" (
    "id" SERIAL NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "InvolvedPersonRole",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "involved_persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ItemMentioningOrganizations" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ItemMentioningOrganizations_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ItemFeaturingIndividuals" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ItemFeaturingIndividuals_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_OrganizationsInIndividualCase" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_OrganizationsInIndividualCase_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_PersonsInIndividualCase" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_PersonsInIndividualCase_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_FactorsInIndividualCase" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_FactorsInIndividualCase_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ItemMentioningFactors" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ItemMentioningFactors_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ItemMentioningPersons" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ItemMentioningPersons_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_PersonsAffiliatedWithOrganization" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_PersonsAffiliatedWithOrganization_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_name_key" ON "organizations"("name");

-- CreateIndex
CREATE INDEX "_ItemMentioningOrganizations_B_index" ON "_ItemMentioningOrganizations"("B");

-- CreateIndex
CREATE INDEX "_ItemFeaturingIndividuals_B_index" ON "_ItemFeaturingIndividuals"("B");

-- CreateIndex
CREATE INDEX "_OrganizationsInIndividualCase_B_index" ON "_OrganizationsInIndividualCase"("B");

-- CreateIndex
CREATE INDEX "_PersonsInIndividualCase_B_index" ON "_PersonsInIndividualCase"("B");

-- CreateIndex
CREATE INDEX "_FactorsInIndividualCase_B_index" ON "_FactorsInIndividualCase"("B");

-- CreateIndex
CREATE INDEX "_ItemMentioningFactors_B_index" ON "_ItemMentioningFactors"("B");

-- CreateIndex
CREATE INDEX "_ItemMentioningPersons_B_index" ON "_ItemMentioningPersons"("B");

-- CreateIndex
CREATE INDEX "_PersonsAffiliatedWithOrganization_B_index" ON "_PersonsAffiliatedWithOrganization"("B");

-- CreateIndex
CREATE UNIQUE INDEX "contributing_factors_name_key" ON "contributing_factors"("name");

-- AddForeignKey
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_workId_fkey" FOREIGN KEY ("workId") REFERENCES "media_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "individuals" ADD CONSTRAINT "individuals_crimeCategoryId_fkey" FOREIGN KEY ("crimeCategoryId") REFERENCES "crime_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ItemMentioningOrganizations" ADD CONSTRAINT "_ItemMentioningOrganizations_A_fkey" FOREIGN KEY ("A") REFERENCES "media_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ItemMentioningOrganizations" ADD CONSTRAINT "_ItemMentioningOrganizations_B_fkey" FOREIGN KEY ("B") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ItemFeaturingIndividuals" ADD CONSTRAINT "_ItemFeaturingIndividuals_A_fkey" FOREIGN KEY ("A") REFERENCES "individuals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ItemFeaturingIndividuals" ADD CONSTRAINT "_ItemFeaturingIndividuals_B_fkey" FOREIGN KEY ("B") REFERENCES "media_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OrganizationsInIndividualCase" ADD CONSTRAINT "_OrganizationsInIndividualCase_A_fkey" FOREIGN KEY ("A") REFERENCES "individuals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OrganizationsInIndividualCase" ADD CONSTRAINT "_OrganizationsInIndividualCase_B_fkey" FOREIGN KEY ("B") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PersonsInIndividualCase" ADD CONSTRAINT "_PersonsInIndividualCase_A_fkey" FOREIGN KEY ("A") REFERENCES "individuals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PersonsInIndividualCase" ADD CONSTRAINT "_PersonsInIndividualCase_B_fkey" FOREIGN KEY ("B") REFERENCES "involved_persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FactorsInIndividualCase" ADD CONSTRAINT "_FactorsInIndividualCase_A_fkey" FOREIGN KEY ("A") REFERENCES "contributing_factors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FactorsInIndividualCase" ADD CONSTRAINT "_FactorsInIndividualCase_B_fkey" FOREIGN KEY ("B") REFERENCES "individuals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ItemMentioningFactors" ADD CONSTRAINT "_ItemMentioningFactors_A_fkey" FOREIGN KEY ("A") REFERENCES "contributing_factors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ItemMentioningFactors" ADD CONSTRAINT "_ItemMentioningFactors_B_fkey" FOREIGN KEY ("B") REFERENCES "media_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ItemMentioningPersons" ADD CONSTRAINT "_ItemMentioningPersons_A_fkey" FOREIGN KEY ("A") REFERENCES "involved_persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ItemMentioningPersons" ADD CONSTRAINT "_ItemMentioningPersons_B_fkey" FOREIGN KEY ("B") REFERENCES "media_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PersonsAffiliatedWithOrganization" ADD CONSTRAINT "_PersonsAffiliatedWithOrganization_A_fkey" FOREIGN KEY ("A") REFERENCES "involved_persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PersonsAffiliatedWithOrganization" ADD CONSTRAINT "_PersonsAffiliatedWithOrganization_B_fkey" FOREIGN KEY ("B") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
