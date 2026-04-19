-- CreateTable
CREATE TABLE "knowledge_drafts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sourceDocumentId" TEXT,
    "kind" "WorkspaceKnowledgeKind" NOT NULL DEFAULT 'FACT',
    "subject" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "status" "DraftStatus" NOT NULL DEFAULT 'PENDING',
    "sourceRunId" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "committedKnowledgeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_drafts_workspaceId_status_idx" ON "knowledge_drafts"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "knowledge_drafts_sourceDocumentId_idx" ON "knowledge_drafts"("sourceDocumentId");

-- AddForeignKey
ALTER TABLE "knowledge_drafts" ADD CONSTRAINT "knowledge_drafts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_drafts" ADD CONSTRAINT "knowledge_drafts_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "intake_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_drafts" ADD CONSTRAINT "knowledge_drafts_sourceRunId_fkey" FOREIGN KEY ("sourceRunId") REFERENCES "agent_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_drafts" ADD CONSTRAINT "knowledge_drafts_committedKnowledgeId_fkey" FOREIGN KEY ("committedKnowledgeId") REFERENCES "workspace_knowledge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
