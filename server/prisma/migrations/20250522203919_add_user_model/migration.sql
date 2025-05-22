/*
  Warnings:

  - You are about to drop the column `specificUrl` on the `information_sources` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[firstName,middleName,lastName,suffix,role]` on the table `involved_persons` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[workId,itemNumber,itemTitle]` on the table `media_items` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'EDITOR', 'ADMIN');

-- DropIndex
DROP INDEX "involved_persons_firstName_middleName_lastName_suffix_key";

-- DropIndex
DROP INDEX "media_items_workId_itemNumber_key";

-- AlterTable
ALTER TABLE "crime_categories" ALTER COLUMN "severity_order" DROP NOT NULL;

-- AlterTable
ALTER TABLE "information_sources" DROP COLUMN "specificUrl";

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "involved_persons_firstName_middleName_lastName_suffix_role_key" ON "involved_persons"("firstName", "middleName", "lastName", "suffix", "role");

-- CreateIndex
CREATE UNIQUE INDEX "media_items_workId_itemNumber_itemTitle_key" ON "media_items"("workId", "itemNumber", "itemTitle");
