-- CreateEnum
CREATE TYPE "CostModel" AS ENUM ('LICENSE_PER_USER', 'LICENSE_FLAT', 'SUBSCRIPTION', 'USAGE_BASED', 'OPEN_SOURCE', 'INTERNAL');

-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "costCurrency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "costModel" "CostModel",
ADD COLUMN     "costNotes" TEXT,
ADD COLUMN     "costRenewalDate" TIMESTAMP(3),
ADD COLUMN     "licensedUsers" INTEGER;
