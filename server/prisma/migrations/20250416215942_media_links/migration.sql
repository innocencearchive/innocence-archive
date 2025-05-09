-- CreateTable
CREATE TABLE "media_item_source_links" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "mediaItemId" INTEGER NOT NULL,

    CONSTRAINT "media_item_source_links_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "media_item_source_links" ADD CONSTRAINT "media_item_source_links_mediaItemId_fkey" FOREIGN KEY ("mediaItemId") REFERENCES "media_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
