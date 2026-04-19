-- CreateEnum
CREATE TYPE "IntakeStatus" AS ENUM ('PENDING', 'PROCESSING', 'EXTRACTED', 'FAILED');

-- CreateEnum
CREATE TYPE "IntakeEntityType" AS ENUM ('CAPABILITY', 'APPLICATION', 'RISK', 'VENDOR', 'TECH_COMPONENT');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'MODIFIED');

-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "reference_architecture_components" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "reference_architectures" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "technology_standards" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "intake_documents" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" "IntakeStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intake_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_chunks" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "page" INTEGER,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intake_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_drafts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "documentId" TEXT,
    "entityType" "IntakeEntityType" NOT NULL,
    "payload" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "status" "DraftStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "committedEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intake_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'RUNNING',
    "inputHash" TEXT NOT NULL,
    "promptVersion" TEXT,
    "model" TEXT,
    "totalTokensIn" INTEGER NOT NULL DEFAULT 0,
    "totalTokensOut" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_run_steps" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "toolName" TEXT,
    "payload" JSONB NOT NULL,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_run_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "intake_documents_workspaceId_status_idx" ON "intake_documents"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "intake_chunks_documentId_idx" ON "intake_chunks"("documentId");

-- CreateIndex
CREATE INDEX "intake_drafts_workspaceId_status_entityType_idx" ON "intake_drafts"("workspaceId", "status", "entityType");

-- CreateIndex
CREATE INDEX "intake_drafts_documentId_idx" ON "intake_drafts"("documentId");

-- CreateIndex
CREATE INDEX "agent_runs_workspaceId_kind_startedAt_idx" ON "agent_runs"("workspaceId", "kind", "startedAt");

-- CreateIndex
CREATE INDEX "agent_run_steps_runId_ordinal_idx" ON "agent_run_steps"("runId", "ordinal");

-- AddForeignKey
ALTER TABLE "intake_documents" ADD CONSTRAINT "intake_documents_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_chunks" ADD CONSTRAINT "intake_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "intake_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_drafts" ADD CONSTRAINT "intake_drafts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_drafts" ADD CONSTRAINT "intake_drafts_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "intake_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_run_steps" ADD CONSTRAINT "agent_run_steps_runId_fkey" FOREIGN KEY ("runId") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "technology_dependencies_source_target_type_key" RENAME TO "technology_dependencies_sourceProductId_targetProductId_dep_key";
