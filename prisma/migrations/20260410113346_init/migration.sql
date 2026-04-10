-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "IndustryType" AS ENUM ('BANKING', 'RETAIL', 'LOGISTICS', 'MANUFACTURING', 'HEALTHCARE', 'GENERIC');

-- CreateEnum
CREATE TYPE "CapabilityLevel" AS ENUM ('L1', 'L2', 'L3');

-- CreateEnum
CREATE TYPE "StrategicImportance" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NOT_ASSESSED');

-- CreateEnum
CREATE TYPE "MaturityLevel" AS ENUM ('INITIAL', 'DEVELOPING', 'DEFINED', 'MANAGED', 'OPTIMIZING', 'NOT_ASSESSED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'IMPORT', 'ASSESS');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientName" TEXT,
    "description" TEXT,
    "industry" "IndustryType" NOT NULL DEFAULT 'GENERIC',
    "logoUrl" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_capabilities" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "parentId" TEXT,
    "level" "CapabilityLevel" NOT NULL DEFAULT 'L1',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT,
    "organizationId" TEXT,
    "strategicImportance" "StrategicImportance" NOT NULL DEFAULT 'NOT_ASSESSED',
    "currentMaturity" "MaturityLevel" NOT NULL DEFAULT 'NOT_ASSESSED',
    "targetMaturity" "MaturityLevel" NOT NULL DEFAULT 'NOT_ASSESSED',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "externalId" TEXT,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_capabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capability_tags" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "description" TEXT,

    CONSTRAINT "capability_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capability_tag_maps" (
    "capabilityId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capability_tag_maps_pkey" PRIMARY KEY ("capabilityId","tagId")
);

-- CreateTable
CREATE TABLE "capability_assessments" (
    "id" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,
    "assessedById" TEXT,
    "currentMaturity" "MaturityLevel" NOT NULL,
    "targetMaturity" "MaturityLevel" NOT NULL,
    "strategicImportance" "StrategicImportance" NOT NULL,
    "notes" TEXT,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capability_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capability_templates" (
    "id" TEXT NOT NULL,
    "industry" "IndustryType" NOT NULL,
    "level" "CapabilityLevel" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentCode" TEXT,
    "code" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "capability_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_clerkId_key" ON "users"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE INDEX "business_capabilities_workspaceId_idx" ON "business_capabilities"("workspaceId");

-- CreateIndex
CREATE INDEX "business_capabilities_workspaceId_parentId_idx" ON "business_capabilities"("workspaceId", "parentId");

-- CreateIndex
CREATE INDEX "business_capabilities_workspaceId_level_idx" ON "business_capabilities"("workspaceId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "capability_tags_workspaceId_name_key" ON "capability_tags"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "capability_assessments_capabilityId_idx" ON "capability_assessments"("capabilityId");

-- CreateIndex
CREATE UNIQUE INDEX "capability_templates_code_key" ON "capability_templates"("code");

-- CreateIndex
CREATE INDEX "capability_templates_industry_level_idx" ON "capability_templates"("industry", "level");

-- CreateIndex
CREATE INDEX "audit_logs_workspaceId_entityType_idx" ON "audit_logs"("workspaceId", "entityType");

-- CreateIndex
CREATE INDEX "audit_logs_workspaceId_createdAt_idx" ON "audit_logs"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_capabilities" ADD CONSTRAINT "business_capabilities_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_capabilities" ADD CONSTRAINT "business_capabilities_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "business_capabilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_capabilities" ADD CONSTRAINT "business_capabilities_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_capabilities" ADD CONSTRAINT "business_capabilities_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capability_tags" ADD CONSTRAINT "capability_tags_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capability_tag_maps" ADD CONSTRAINT "capability_tag_maps_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "business_capabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capability_tag_maps" ADD CONSTRAINT "capability_tag_maps_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "capability_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capability_assessments" ADD CONSTRAINT "capability_assessments_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "business_capabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
