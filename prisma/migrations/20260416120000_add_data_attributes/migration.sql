-- CreateTable
CREATE TABLE "data_attributes" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "isNullable" BOOLEAN NOT NULL DEFAULT true,
    "isPrimaryKey" BOOLEAN NOT NULL DEFAULT false,
    "isForeignKey" BOOLEAN NOT NULL DEFAULT false,
    "fkTargetEntityId" TEXT,
    "classification" "DataClassification" NOT NULL DEFAULT 'DC_UNKNOWN',
    "regulatoryTags" "RegulatoryTag"[] DEFAULT ARRAY[]::"RegulatoryTag"[],
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "data_attributes_workspaceId_entityId_idx" ON "data_attributes"("workspaceId", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "data_attributes_entityId_name_key" ON "data_attributes"("entityId", "name");

-- AddForeignKey
ALTER TABLE "data_attributes"
  ADD CONSTRAINT "data_attributes_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_attributes"
  ADD CONSTRAINT "data_attributes_entityId_fkey"
  FOREIGN KEY ("entityId") REFERENCES "data_entities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
