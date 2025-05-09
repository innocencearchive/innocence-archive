-- AlterTable
ALTER TABLE "contributing_factors" ADD COLUMN     "aiGenerated" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "individuals" ADD COLUMN     "aiGenerated" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "involved_persons" ADD COLUMN     "aiGenerated" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "media_items" ADD COLUMN     "aiGenerated" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "media_works" ADD COLUMN     "aiGenerated" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "aiGenerated" BOOLEAN NOT NULL DEFAULT true;
