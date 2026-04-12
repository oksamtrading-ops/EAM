-- CreateTable
CREATE TABLE "dashboard_pins" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "dashboard_pins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dashboard_pins_workspaceId_idx" ON "dashboard_pins"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_pins_workspaceId_entityType_entityId_key" ON "dashboard_pins"("workspaceId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "dashboard_pins" ADD CONSTRAINT "dashboard_pins_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_pins" ADD CONSTRAINT "dashboard_pins_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
