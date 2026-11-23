-- CreateEnum
CREATE TYPE "NewsCategory" AS ENUM ('EXONERATION', 'CASE_UPDATE', 'CASE_SETBACK', 'CALL_FOR_ACTION', 'NEW_MEDIA', 'POLICY', 'GENERAL');

-- CreateEnum
CREATE TYPE "NewsStatus" AS ENUM ('PUBLISHED', 'DRAFT', 'ARCHIVED');

-- CreateTable
CREATE TABLE "news_sources" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "feedUrl" TEXT,
    "websiteUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastCheckedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_articles" (
    "id" SERIAL NOT NULL,
    "headline" TEXT NOT NULL,
    "url" TEXT,
    "summary" TEXT,
    "publishedAt" TIMESTAMP(3),
    "category" "NewsCategory" NOT NULL DEFAULT 'GENERAL',
    "status" "NewsStatus" NOT NULL DEFAULT 'PUBLISHED',
    "showOnHomepage" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "actionUrl" TEXT,
    "actionLabel" TEXT,
    "sourceName" TEXT,
    "sourceId" INTEGER,
    "mediaWorkId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_NewsArticleIndividuals" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_NewsArticleIndividuals_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "news_sources_name_key" ON "news_sources"("name");

-- CreateIndex
CREATE UNIQUE INDEX "news_sources_feedUrl_key" ON "news_sources"("feedUrl");

-- CreateIndex
CREATE UNIQUE INDEX "news_articles_url_key" ON "news_articles"("url");

-- CreateIndex
CREATE INDEX "news_articles_category_idx" ON "news_articles"("category");

-- CreateIndex
CREATE INDEX "news_articles_status_idx" ON "news_articles"("status");

-- CreateIndex
CREATE INDEX "news_articles_showOnHomepage_idx" ON "news_articles"("showOnHomepage");

-- CreateIndex
CREATE INDEX "news_articles_publishedAt_idx" ON "news_articles"("publishedAt");

-- CreateIndex
CREATE INDEX "_NewsArticleIndividuals_B_index" ON "_NewsArticleIndividuals"("B");

-- AddForeignKey
ALTER TABLE "news_articles" ADD CONSTRAINT "news_articles_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "news_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_articles" ADD CONSTRAINT "news_articles_mediaWorkId_fkey" FOREIGN KEY ("mediaWorkId") REFERENCES "media_works"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_NewsArticleIndividuals" ADD CONSTRAINT "_NewsArticleIndividuals_A_fkey" FOREIGN KEY ("A") REFERENCES "individuals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_NewsArticleIndividuals" ADD CONSTRAINT "_NewsArticleIndividuals_B_fkey" FOREIGN KEY ("B") REFERENCES "news_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

