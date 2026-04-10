-- CreateEnum
CREATE TYPE "ApplicationLifecycle" AS ENUM ('PLANNED', 'ACTIVE', 'PHASING_OUT', 'RETIRED', 'SUNSET');

-- CreateEnum
CREATE TYPE "ApplicationType" AS ENUM ('SAAS', 'COTS', 'CUSTOM', 'PAAS', 'OPEN_SOURCE', 'LEGACY');

-- CreateEnum
CREATE TYPE "DeploymentModel" AS ENUM ('CLOUD_PUBLIC', 'CLOUD_PRIVATE', 'ON_PREMISE', 'HYBRID', 'SAAS_HOSTED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "BusinessValueScore" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'BV_UNKNOWN');

-- CreateEnum
CREATE TYPE "TechnicalHealthScore" AS ENUM ('EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'TH_CRITICAL', 'TH_UNKNOWN');

-- CreateEnum
CREATE TYPE "RationalizationStatus" AS ENUM ('KEEP', 'INVEST', 'MIGRATE', 'RETIRE', 'CONSOLIDATE', 'EVALUATE', 'RAT_NOT_ASSESSED');

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "alias" TEXT,
    "vendor" TEXT,
    "version" TEXT,
    "applicationType" "ApplicationType" NOT NULL DEFAULT 'CUSTOM',
    "deploymentModel" "DeploymentModel" NOT NULL DEFAULT 'UNKNOWN',
    "lifecycle" "ApplicationLifecycle" NOT NULL DEFAULT 'ACTIVE',
    "lifecycleStartDate" TIMESTAMP(3),
    "lifecycleEndDate" TIMESTAMP(3),
    "businessValue" "BusinessValueScore" NOT NULL DEFAULT 'BV_UNKNOWN',
    "technicalHealth" "TechnicalHealthScore" NOT NULL DEFAULT 'TH_UNKNOWN',
    "rationalizationStatus" "RationalizationStatus" NOT NULL DEFAULT 'RAT_NOT_ASSESSED',
    "rationalizationNotes" TEXT,
    "annualCostUsd" DECIMAL(14,2),
    "businessOwnerName" TEXT,
    "itOwnerName" TEXT,
    "ownerId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_capability_maps" (
    "applicationId" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "supportType" TEXT NOT NULL DEFAULT 'SUPPORTS',
    "notes" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_capability_maps_pkey" PRIMARY KEY ("applicationId","capabilityId")
);

-- CreateTable
CREATE TABLE "application_assessments" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "assessedById" TEXT,
    "businessValue" "BusinessValueScore" NOT NULL,
    "technicalHealth" "TechnicalHealthScore" NOT NULL,
    "rationalizationStatus" "RationalizationStatus" NOT NULL,
    "notes" TEXT,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "applications_workspaceId_idx" ON "applications"("workspaceId");

-- CreateIndex
CREATE INDEX "applications_workspaceId_lifecycle_idx" ON "applications"("workspaceId", "lifecycle");

-- CreateIndex
CREATE INDEX "applications_workspaceId_rationalizationStatus_idx" ON "applications"("workspaceId", "rationalizationStatus");

-- CreateIndex
CREATE INDEX "application_capability_maps_workspaceId_capabilityId_idx" ON "application_capability_maps"("workspaceId", "capabilityId");

-- CreateIndex
CREATE INDEX "application_assessments_applicationId_idx" ON "application_assessments"("applicationId");

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_capability_maps" ADD CONSTRAINT "application_capability_maps_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_capability_maps" ADD CONSTRAINT "application_capability_maps_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "business_capabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_assessments" ADD CONSTRAINT "application_assessments_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
