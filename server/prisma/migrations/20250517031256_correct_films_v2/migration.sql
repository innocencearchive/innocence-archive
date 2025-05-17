/*
  Warnings:

  - A unique constraint covering the columns `[externalId]` on the table `media_works` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "StreamingType" AS ENUM ('SUBSCRIPTION', 'RENT', 'BUY', 'FREE', 'OTHER', 'UNKNOWN');

-- AlterTable
ALTER TABLE "media_works" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "imagePath" TEXT,
ADD COLUMN     "lastExternalFetch" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "streaming_providers" (
    "id" SERIAL NOT NULL,
    "providerName" TEXT NOT NULL,
    "watchmodeProviderId" INTEGER,
    "streamingType" "StreamingType" NOT NULL,
    "url" TEXT,
    "priceCurrency" TEXT,
    "priceAmount" DOUBLE PRECISION,
    "presentationQuality" TEXT,
    "lastChecked" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "mediaWorkId" INTEGER NOT NULL,

    CONSTRAINT "streaming_providers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "streaming_providers_mediaWorkId_providerName_streamingType__key" ON "streaming_providers"("mediaWorkId", "providerName", "streamingType", "presentationQuality");

-- CreateIndex
CREATE UNIQUE INDEX "media_works_externalId_key" ON "media_works"("externalId");

-- AddForeignKey
ALTER TABLE "streaming_providers" ADD CONSTRAINT "streaming_providers_mediaWorkId_fkey" FOREIGN KEY ("mediaWorkId") REFERENCES "media_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;
