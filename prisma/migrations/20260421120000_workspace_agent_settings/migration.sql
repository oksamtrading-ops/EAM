-- CreateTable
CREATE TABLE "workspace_agent_settings" (
    "workspaceId" TEXT NOT NULL,
    "maxToolIterations" INTEGER NOT NULL DEFAULT 6,
    "subAgentBudget" INTEGER NOT NULL DEFAULT 3,
    "llmMaxTokens" INTEGER NOT NULL DEFAULT 1500,
    "autoAcceptConfidence" DOUBLE PRECISION,
    "criticEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_agent_settings_pkey" PRIMARY KEY ("workspaceId")
);

-- AddForeignKey
ALTER TABLE "workspace_agent_settings" ADD CONSTRAINT "workspace_agent_settings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
