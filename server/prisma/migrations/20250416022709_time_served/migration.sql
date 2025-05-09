/*
  Warnings:

  - You are about to drop the column `timeServedYears` on the `individuals` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "individuals" DROP COLUMN "timeServedYears",
ADD COLUMN     "timeServed" TEXT;
