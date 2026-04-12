-- CreateEnum
CREATE TYPE "CostModel" AS ENUM ('LICENSE_PER_USER', 'LICENSE_FLAT', 'SUBSCRIPTION', 'USAGE_BASED', 'OPEN_SOURCE', 'INTERNAL');

-- AlterTable
ALTER TABLE "applications" ADD COLUMN "costCurrency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "applications" ADD COLUMN "costModel" "CostModel";
ALTER TABLE "applications" ADD COLUMN "costNotes" TEXT;
ALTER TABLE "applications" ADD COLUMN "costRenewalDate" TIMESTAMP(3);
ALTER TABLE "applications" ADD COLUMN "licensedUsers" INTEGER;
