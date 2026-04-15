-- CreateEnum
CREATE TYPE "DataEntityType" AS ENUM ('MASTER', 'REFERENCE', 'TRANSACTIONAL', 'ANALYTICAL', 'METADATA');

-- CreateEnum
CREATE TYPE "RegulatoryTag" AS ENUM ('PII', 'PHI', 'PCI', 'GDPR', 'CCPA', 'SOX', 'HIPAA', 'FERPA');

-- CreateEnum
CREATE TYPE "DataQualityDimension" AS ENUM ('COMPLETENESS', 'ACCURACY', 'CONSISTENCY', 'TIMELINESS', 'UNIQUENESS', 'VALIDITY');

-- CreateTable
CREATE TABLE "data_domains" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT,
    "color" TEXT NOT NULL DEFAULT '#0B5CD6',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_entities" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "entityType" "DataEntityType" NOT NULL DEFAULT 'TRANSACTIONAL',
    "classification" "DataClassification" NOT NULL DEFAULT 'DC_UNKNOWN',
    "regulatoryTags" "RegulatoryTag"[] DEFAULT ARRAY[]::"RegulatoryTag"[],
    "goldenSourceAppId" TEXT,
    "retentionDays" INTEGER,
    "stewardId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_entity_usages" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "creates" BOOLEAN NOT NULL DEFAULT false,
    "reads" BOOLEAN NOT NULL DEFAULT false,
    "updates" BOOLEAN NOT NULL DEFAULT false,
    "deletes" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_entity_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_quality_scores" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "dimension" "DataQualityDimension" NOT NULL,
    "score" INTEGER NOT NULL,
    "note" TEXT,
    "asOf" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_quality_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "data_domains_workspaceId_idx" ON "data_domains"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "data_domains_workspaceId_name_key" ON "data_domains"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "data_entities_workspaceId_idx" ON "data_entities"("workspaceId");

-- CreateIndex
CREATE INDEX "data_entities_workspaceId_domainId_idx" ON "data_entities"("workspaceId", "domainId");

-- CreateIndex
CREATE INDEX "data_entities_workspaceId_classification_idx" ON "data_entities"("workspaceId", "classification");

-- CreateIndex
CREATE UNIQUE INDEX "data_entities_workspaceId_domainId_name_key" ON "data_entities"("workspaceId", "domainId", "name");

-- CreateIndex
CREATE INDEX "app_entity_usages_workspaceId_idx" ON "app_entity_usages"("workspaceId");

-- CreateIndex
CREATE INDEX "app_entity_usages_workspaceId_appId_idx" ON "app_entity_usages"("workspaceId", "appId");

-- CreateIndex
CREATE INDEX "app_entity_usages_workspaceId_entityId_idx" ON "app_entity_usages"("workspaceId", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "app_entity_usages_appId_entityId_key" ON "app_entity_usages"("appId", "entityId");

-- CreateIndex
CREATE INDEX "data_quality_scores_entityId_dimension_idx" ON "data_quality_scores"("entityId", "dimension");

-- AddForeignKey
ALTER TABLE "data_domains" ADD CONSTRAINT "data_domains_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_domains" ADD CONSTRAINT "data_domains_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_entities" ADD CONSTRAINT "data_entities_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_entities" ADD CONSTRAINT "data_entities_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "data_domains"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_entities" ADD CONSTRAINT "data_entities_goldenSourceAppId_fkey" FOREIGN KEY ("goldenSourceAppId") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_entities" ADD CONSTRAINT "data_entities_stewardId_fkey" FOREIGN KEY ("stewardId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_entity_usages" ADD CONSTRAINT "app_entity_usages_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_entity_usages" ADD CONSTRAINT "app_entity_usages_appId_fkey" FOREIGN KEY ("appId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_entity_usages" ADD CONSTRAINT "app_entity_usages_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "data_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_quality_scores" ADD CONSTRAINT "data_quality_scores_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "data_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
