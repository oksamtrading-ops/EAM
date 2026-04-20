-- CreateTable
CREATE TABLE "agent_conversation_shares" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT,
    "redactToolCalls" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_conversation_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_conversation_shares_conversationId_key" ON "agent_conversation_shares"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_conversation_shares_slug_key" ON "agent_conversation_shares"("slug");

-- CreateIndex
CREATE INDEX "agent_conversation_shares_slug_idx" ON "agent_conversation_shares"("slug");

-- AddForeignKey
ALTER TABLE "agent_conversation_shares" ADD CONSTRAINT "agent_conversation_shares_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "agent_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_conversation_shares" ADD CONSTRAINT "agent_conversation_shares_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
