-- AlterEnum
ALTER TYPE "IndustryType" ADD VALUE 'INSURANCE';
ALTER TYPE "IndustryType" ADD VALUE 'TELECOM';
ALTER TYPE "IndustryType" ADD VALUE 'ENERGY_UTILITIES';
ALTER TYPE "IndustryType" ADD VALUE 'PUBLIC_SECTOR';
ALTER TYPE "IndustryType" ADD VALUE 'PHARMA_LIFESCIENCES';

-- AlterEnum
ALTER TYPE "ComplianceFramework" ADD VALUE 'DORA';
ALTER TYPE "ComplianceFramework" ADD VALUE 'NIS2';
ALTER TYPE "ComplianceFramework" ADD VALUE 'ISO_27701';
ALTER TYPE "ComplianceFramework" ADD VALUE 'FEDRAMP_MODERATE';

-- CreateEnum
CREATE TYPE "MappingSource" AS ENUM ('MANUAL', 'AI_SUGGESTED', 'AI_ACCEPTED', 'AI_MODIFIED', 'IMPORTED');

-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('PRIMARY', 'SUPPORTING', 'ENABLING');

-- CreateEnum
CREATE TYPE "Region" AS ENUM ('NA', 'EMEA', 'APAC', 'LATAM', 'GLOBAL');

-- CreateEnum
CREATE TYPE "FeedbackAction" AS ENUM ('ACCEPTED', 'REJECTED', 'MODIFIED');

-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN     "subIndustry" TEXT,
ADD COLUMN     "region" "Region",
ADD COLUMN     "regulatoryRegime" TEXT,
ADD COLUMN     "businessModelHint" TEXT;

-- AlterTable
ALTER TABLE "application_capability_maps" ADD COLUMN     "source" "MappingSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "relationshipType" "RelationshipType" NOT NULL DEFAULT 'PRIMARY',
ADD COLUMN     "aiConfidence" INTEGER,
ADD COLUMN     "aiRationale" TEXT,
ADD COLUMN     "aiModel" TEXT,
ADD COLUMN     "aiPromptVersion" TEXT,
ADD COLUMN     "createdById" TEXT;

-- CreateTable
CREATE TABLE "ai_mapping_feedback" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,
    "aiConfidence" INTEGER NOT NULL,
    "aiRationale" TEXT NOT NULL,
    "aiRelationshipType" "RelationshipType" NOT NULL,
    "userAction" "FeedbackAction" NOT NULL,
    "userRelationshipType" "RelationshipType",
    "userCapabilityId" TEXT,
    "userNote" TEXT,
    "promptVersion" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "ai_mapping_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_mapping_runs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "appsProcessed" INTEGER NOT NULL DEFAULT 0,
    "suggestionsGenerated" INTEGER NOT NULL DEFAULT 0,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "ai_mapping_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_palette_queries" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "queryText" TEXT NOT NULL,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_palette_queries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_mapping_feedback_workspaceId_createdAt_idx" ON "ai_mapping_feedback"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_mapping_feedback_applicationId_idx" ON "ai_mapping_feedback"("applicationId");

-- CreateIndex
CREATE INDEX "ai_mapping_feedback_capabilityId_idx" ON "ai_mapping_feedback"("capabilityId");

-- CreateIndex
CREATE INDEX "ai_mapping_runs_workspaceId_createdAt_idx" ON "ai_mapping_runs"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "saved_palette_queries_workspaceId_userId_idx" ON "saved_palette_queries"("workspaceId", "userId");

-- AddForeignKey
ALTER TABLE "ai_mapping_feedback" ADD CONSTRAINT "ai_mapping_feedback_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_mapping_runs" ADD CONSTRAINT "ai_mapping_runs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_palette_queries" ADD CONSTRAINT "saved_palette_queries_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
