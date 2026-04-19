-- CreateEnum
CREATE TYPE "WorkspaceKnowledgeKind" AS ENUM ('FACT', 'DECISION', 'PATTERN');

-- AlterEnum
ALTER TYPE "IntakeEntityType" ADD VALUE 'INITIATIVE';

-- CreateTable
CREATE TABLE "workspace_knowledge" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" "WorkspaceKnowledgeKind" NOT NULL DEFAULT 'FACT',
    "subject" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "sourceRunId" TEXT,
    "createdBy" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_knowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_agent_tasks" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "cronExpression" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "lastRunId" TEXT,
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_agent_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workspace_knowledge_workspaceId_isActive_updatedAt_idx" ON "workspace_knowledge"("workspaceId", "isActive", "updatedAt");

-- CreateIndex
CREATE INDEX "workspace_knowledge_workspaceId_subject_idx" ON "workspace_knowledge"("workspaceId", "subject");

-- CreateIndex
CREATE INDEX "scheduled_agent_tasks_workspaceId_enabled_nextRunAt_idx" ON "scheduled_agent_tasks"("workspaceId", "enabled", "nextRunAt");

-- CreateIndex
CREATE INDEX "scheduled_agent_tasks_userId_idx" ON "scheduled_agent_tasks"("userId");

-- AddForeignKey
ALTER TABLE "workspace_knowledge" ADD CONSTRAINT "workspace_knowledge_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_knowledge" ADD CONSTRAINT "workspace_knowledge_sourceRunId_fkey" FOREIGN KEY ("sourceRunId") REFERENCES "agent_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_agent_tasks" ADD CONSTRAINT "scheduled_agent_tasks_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_agent_tasks" ADD CONSTRAINT "scheduled_agent_tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_agent_tasks" ADD CONSTRAINT "scheduled_agent_tasks_lastRunId_fkey" FOREIGN KEY ("lastRunId") REFERENCES "agent_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
