-- CreateTable
CREATE TABLE "featured_content_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "featuredStoryId" INTEGER,
    "featuredBookId" INTEGER,
    "featuredPodcastId" INTEGER,
    "featuredFilmId" INTEGER,
    "featuredOrgId" INTEGER,
    "featuredFactorIds" INTEGER[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "featured_content_settings_pkey" PRIMARY KEY ("id")
);
