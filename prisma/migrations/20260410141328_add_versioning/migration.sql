-- CreateTable
CREATE TABLE "capability_map_versions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "snapshot" JSONB NOT NULL,
    "createdById" TEXT,
    "isAutomatic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capability_map_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "capability_map_versions_workspaceId_createdAt_idx" ON "capability_map_versions"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "capability_map_versions" ADD CONSTRAINT "capability_map_versions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capability_map_versions" ADD CONSTRAINT "capability_map_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
