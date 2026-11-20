-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'IN_REVIEW', 'VERIFIED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "InnocenceClaimStrength" AS ENUM ('FORMALLY_EXONERATED', 'OFFICIAL_RELIEF_NO_EXONERATION', 'STRONG_NEW_EVIDENCE', 'CREDIBLE_CLAIM', 'UNASSESSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MediaItemType" ADD VALUE 'ARTICLE';
ALTER TYPE "MediaItemType" ADD VALUE 'ACADEMIC_PAPER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MediaWorkType" ADD VALUE 'ACADEMIC_PAPER';
ALTER TYPE "MediaWorkType" ADD VALUE 'NEWS_ARTICLE';

-- AlterTable
ALTER TABLE "contributing_factors" ADD COLUMN     "importBatchId" TEXT,
ADD COLUMN     "ingestionSource" TEXT,
ADD COLUMN     "verificationNotes" TEXT,
ADD COLUMN     "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" INTEGER;

-- AlterTable
ALTER TABLE "individuals" ADD COLUMN     "canonicalKey" TEXT,
ADD COLUMN     "claimStrength" "InnocenceClaimStrength" NOT NULL DEFAULT 'UNASSESSED',
ADD COLUMN     "importBatchId" TEXT,
ADD COLUMN     "ingestionSource" TEXT,
ADD COLUMN     "verificationNotes" TEXT,
ADD COLUMN     "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" INTEGER;

-- AlterTable
ALTER TABLE "involved_persons" ADD COLUMN     "canonicalKey" TEXT,
ADD COLUMN     "importBatchId" TEXT,
ADD COLUMN     "ingestionSource" TEXT,
ADD COLUMN     "verificationNotes" TEXT,
ADD COLUMN     "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" INTEGER;

-- AlterTable
ALTER TABLE "media_items" ADD COLUMN     "canonicalKey" TEXT,
ADD COLUMN     "durationSeconds" INTEGER,
ADD COLUMN     "importBatchId" TEXT,
ADD COLUMN     "ingestionSource" TEXT,
ADD COLUMN     "transcript" TEXT,
ADD COLUMN     "verificationNotes" TEXT,
ADD COLUMN     "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" INTEGER;

-- AlterTable
ALTER TABLE "media_works" ADD COLUMN     "importBatchId" TEXT,
ADD COLUMN     "ingestionSource" TEXT,
ADD COLUMN     "verificationNotes" TEXT,
ADD COLUMN     "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" INTEGER;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "importBatchId" TEXT,
ADD COLUMN     "ingestionSource" TEXT,
ADD COLUMN     "verificationNotes" TEXT,
ADD COLUMN     "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" INTEGER;

-- CreateIndex
CREATE INDEX "contributing_factors_verificationStatus_idx" ON "contributing_factors"("verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "individuals_canonicalKey_key" ON "individuals"("canonicalKey");

-- CreateIndex
CREATE INDEX "individuals_lastName_idx" ON "individuals"("lastName");

-- CreateIndex
CREATE INDEX "individuals_status_idx" ON "individuals"("status");

-- CreateIndex
CREATE INDEX "individuals_claimStrength_idx" ON "individuals"("claimStrength");

-- CreateIndex
CREATE INDEX "individuals_caseLocationState_idx" ON "individuals"("caseLocationState");

-- CreateIndex
CREATE INDEX "individuals_verificationStatus_idx" ON "individuals"("verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "involved_persons_canonicalKey_key" ON "involved_persons"("canonicalKey");

-- CreateIndex
CREATE INDEX "involved_persons_verificationStatus_idx" ON "involved_persons"("verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "media_items_canonicalKey_key" ON "media_items"("canonicalKey");

-- CreateIndex
CREATE INDEX "media_items_workId_idx" ON "media_items"("workId");

-- CreateIndex
CREATE INDEX "media_items_verificationStatus_idx" ON "media_items"("verificationStatus");

-- CreateIndex
CREATE INDEX "media_works_workType_idx" ON "media_works"("workType");

-- CreateIndex
CREATE INDEX "media_works_verificationStatus_idx" ON "media_works"("verificationStatus");

-- CreateIndex
CREATE INDEX "organizations_verificationStatus_idx" ON "organizations"("verificationStatus");

-- AddForeignKey
ALTER TABLE "media_works" ADD CONSTRAINT "media_works_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "individuals" ADD CONSTRAINT "individuals_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributing_factors" ADD CONSTRAINT "contributing_factors_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "involved_persons" ADD CONSTRAINT "involved_persons_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "featured_content_settings" ADD CONSTRAINT "featured_content_settings_featuredStoryId_fkey" FOREIGN KEY ("featuredStoryId") REFERENCES "individuals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "featured_content_settings" ADD CONSTRAINT "featured_content_settings_featuredBookId_fkey" FOREIGN KEY ("featuredBookId") REFERENCES "media_works"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "featured_content_settings" ADD CONSTRAINT "featured_content_settings_featuredPodcastId_fkey" FOREIGN KEY ("featuredPodcastId") REFERENCES "media_works"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "featured_content_settings" ADD CONSTRAINT "featured_content_settings_featuredFilmId_fkey" FOREIGN KEY ("featuredFilmId") REFERENCES "media_works"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "featured_content_settings" ADD CONSTRAINT "featured_content_settings_featuredOrgId_fkey" FOREIGN KEY ("featuredOrgId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

