-- CreateEnum
CREATE TYPE "OrganizationLinkType" AS ENUM ('WEBSITE', 'ARTICLE', 'SOCIAL_MEDIA', 'REPORT', 'OTHER');

-- CreateTable
CREATE TABLE "organization_links" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "type" "OrganizationLinkType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" INTEGER NOT NULL,

    CONSTRAINT "organization_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RelatedOrganizations" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_RelatedOrganizations_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_RelatedOrganizations_B_index" ON "_RelatedOrganizations"("B");

-- AddForeignKey
ALTER TABLE "organization_links" ADD CONSTRAINT "organization_links_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RelatedOrganizations" ADD CONSTRAINT "_RelatedOrganizations_A_fkey" FOREIGN KEY ("A") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RelatedOrganizations" ADD CONSTRAINT "_RelatedOrganizations_B_fkey" FOREIGN KEY ("B") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
