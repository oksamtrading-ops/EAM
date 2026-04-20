-- AlterTable
ALTER TABLE "knowledge_drafts" ADD COLUMN "similarKnowledgeId" TEXT;

-- CreateIndex
CREATE INDEX "knowledge_drafts_similarKnowledgeId_idx" ON "knowledge_drafts"("similarKnowledgeId");

-- AddForeignKey
ALTER TABLE "knowledge_drafts" ADD CONSTRAINT "knowledge_drafts_similarKnowledgeId_fkey" FOREIGN KEY ("similarKnowledgeId") REFERENCES "workspace_knowledge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
