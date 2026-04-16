-- ============================================================
-- MODULE 7: TECHNOLOGY ARCHITECTURE (TOGAF Phase D)
-- Phase 1 — Vendors, Products, Versions, Components, Deps, App link
-- Idempotent: safe to re-run. No shadow DB required.
-- Additive only — does not touch existing M4 tables.
-- ============================================================

-- ── 1. Enums ──
DO $$ BEGIN
  CREATE TYPE "VendorCategory" AS ENUM ('HYPERSCALER', 'SOFTWARE', 'HARDWARE', 'SERVICES', 'OPEN_SOURCE_FOUNDATION', 'INTERNAL', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "VendorStatus" AS ENUM ('ACTIVE', 'STRATEGIC', 'UNDER_REVIEW', 'EXITING', 'DEPRECATED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TechnologyType" AS ENUM ('SOFTWARE', 'CLOUD_SERVICE', 'DATABASE', 'MIDDLEWARE', 'SERVER', 'NETWORK', 'OPERATING_SYSTEM', 'LANGUAGE', 'FRAMEWORK', 'PLATFORM', 'LIBRARY', 'CONTAINER', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "LicenseType" AS ENUM ('COMMERCIAL', 'OSS_PERMISSIVE', 'OSS_COPYLEFT', 'PROPRIETARY_INTERNAL', 'FREEMIUM', 'UNKNOWN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "LifecycleStatus" AS ENUM ('PREVIEW', 'CURRENT', 'MAINSTREAM', 'EXTENDED_SUPPORT', 'DEPRECATED', 'END_OF_LIFE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ComponentEnvironment" AS ENUM ('PRODUCTION', 'STAGING', 'TEST', 'DEVELOPMENT', 'DR', 'SHARED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "HostingModel" AS ENUM ('ON_PREMISES', 'PRIVATE_CLOUD', 'PUBLIC_IAAS', 'PUBLIC_PAAS', 'SAAS', 'HYBRID');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TechLayer" AS ENUM ('PRESENTATION', 'APPLICATION', 'DATA', 'INTEGRATION', 'INFRASTRUCTURE', 'SECURITY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TechnologyRole" AS ENUM ('PRIMARY', 'SECONDARY', 'FALLBACK', 'DEPRECATED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TechnologyCriticality" AS ENUM ('CRITICAL', 'IMPORTANT', 'STANDARD', 'OPTIONAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TechnologyDependencyType" AS ENUM ('REQUIRES', 'RUNS_ON', 'COMPATIBLE_WITH', 'CONFLICTS_WITH', 'REPLACES');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. Tables ──

CREATE TABLE IF NOT EXISTS "vendors" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "category" "VendorCategory" NOT NULL DEFAULT 'OTHER',
    "description" TEXT,
    "headquartersCountry" TEXT,
    "annualSpend" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "contractNotes" TEXT,
    "relationshipOwnerId" TEXT,
    "status" "VendorStatus" NOT NULL DEFAULT 'ACTIVE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "technology_products" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "TechnologyType" NOT NULL DEFAULT 'OTHER',
    "category" TEXT,
    "description" TEXT,
    "website" TEXT,
    "openSource" BOOLEAN NOT NULL DEFAULT false,
    "licenseType" "LicenseType" NOT NULL DEFAULT 'UNKNOWN',
    "techRadarEntryId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "technology_products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "technology_versions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "releaseDate" TIMESTAMP(3),
    "endOfSupportDate" TIMESTAMP(3),
    "endOfLifeDate" TIMESTAMP(3),
    "lifecycleStatus" "LifecycleStatus" NOT NULL DEFAULT 'CURRENT',
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "technology_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "technology_components" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "versionId" TEXT,
    "name" TEXT NOT NULL,
    "environment" "ComponentEnvironment" NOT NULL DEFAULT 'PRODUCTION',
    "hostingModel" "HostingModel" NOT NULL DEFAULT 'ON_PREMISES',
    "region" TEXT,
    "ownerId" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "technology_components_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "application_technologies" (
    "applicationId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "layer" "TechLayer" NOT NULL DEFAULT 'APPLICATION',
    "role" "TechnologyRole" NOT NULL DEFAULT 'PRIMARY',
    "criticality" "TechnologyCriticality" NOT NULL DEFAULT 'STANDARD',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "application_technologies_pkey" PRIMARY KEY ("applicationId", "componentId")
);

CREATE TABLE IF NOT EXISTS "technology_dependencies" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sourceProductId" TEXT NOT NULL,
    "targetProductId" TEXT NOT NULL,
    "dependencyType" "TechnologyDependencyType" NOT NULL DEFAULT 'REQUIRES',
    "versionConstraint" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "technology_dependencies_pkey" PRIMARY KEY ("id")
);

-- ── 3. Indexes ──

CREATE INDEX IF NOT EXISTS "vendors_workspaceId_idx" ON "vendors"("workspaceId");
CREATE INDEX IF NOT EXISTS "vendors_workspaceId_status_idx" ON "vendors"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "vendors_workspaceId_category_idx" ON "vendors"("workspaceId", "category");
CREATE UNIQUE INDEX IF NOT EXISTS "vendors_workspaceId_name_key" ON "vendors"("workspaceId", "name");

CREATE INDEX IF NOT EXISTS "technology_products_workspaceId_idx" ON "technology_products"("workspaceId");
CREATE INDEX IF NOT EXISTS "technology_products_workspaceId_type_idx" ON "technology_products"("workspaceId", "type");
CREATE INDEX IF NOT EXISTS "technology_products_workspaceId_vendorId_idx" ON "technology_products"("workspaceId", "vendorId");
CREATE INDEX IF NOT EXISTS "technology_products_workspaceId_techRadarEntryId_idx" ON "technology_products"("workspaceId", "techRadarEntryId");
CREATE UNIQUE INDEX IF NOT EXISTS "technology_products_workspaceId_slug_key" ON "technology_products"("workspaceId", "slug");

CREATE INDEX IF NOT EXISTS "technology_versions_workspaceId_idx" ON "technology_versions"("workspaceId");
CREATE INDEX IF NOT EXISTS "technology_versions_workspaceId_productId_idx" ON "technology_versions"("workspaceId", "productId");
CREATE INDEX IF NOT EXISTS "technology_versions_workspaceId_lifecycleStatus_idx" ON "technology_versions"("workspaceId", "lifecycleStatus");
CREATE INDEX IF NOT EXISTS "technology_versions_workspaceId_endOfLifeDate_idx" ON "technology_versions"("workspaceId", "endOfLifeDate");
CREATE UNIQUE INDEX IF NOT EXISTS "technology_versions_productId_version_key" ON "technology_versions"("productId", "version");

CREATE INDEX IF NOT EXISTS "technology_components_workspaceId_idx" ON "technology_components"("workspaceId");
CREATE INDEX IF NOT EXISTS "technology_components_workspaceId_productId_idx" ON "technology_components"("workspaceId", "productId");
CREATE INDEX IF NOT EXISTS "technology_components_workspaceId_environment_idx" ON "technology_components"("workspaceId", "environment");
CREATE INDEX IF NOT EXISTS "technology_components_workspaceId_hostingModel_idx" ON "technology_components"("workspaceId", "hostingModel");

CREATE INDEX IF NOT EXISTS "application_technologies_componentId_idx" ON "application_technologies"("componentId");

CREATE INDEX IF NOT EXISTS "technology_dependencies_workspaceId_idx" ON "technology_dependencies"("workspaceId");
CREATE INDEX IF NOT EXISTS "technology_dependencies_workspaceId_sourceProductId_idx" ON "technology_dependencies"("workspaceId", "sourceProductId");
CREATE INDEX IF NOT EXISTS "technology_dependencies_workspaceId_targetProductId_idx" ON "technology_dependencies"("workspaceId", "targetProductId");
CREATE UNIQUE INDEX IF NOT EXISTS "technology_dependencies_source_target_type_key" ON "technology_dependencies"("sourceProductId", "targetProductId", "dependencyType");

-- ── 4. Foreign keys ──

DO $$ BEGIN
  ALTER TABLE "vendors"
    ADD CONSTRAINT "vendors_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "vendors"
    ADD CONSTRAINT "vendors_relationshipOwnerId_fkey"
    FOREIGN KEY ("relationshipOwnerId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "technology_products"
    ADD CONSTRAINT "technology_products_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "technology_products"
    ADD CONSTRAINT "technology_products_vendorId_fkey"
    FOREIGN KEY ("vendorId") REFERENCES "vendors"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "technology_versions"
    ADD CONSTRAINT "technology_versions_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "technology_versions"
    ADD CONSTRAINT "technology_versions_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "technology_products"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "technology_components"
    ADD CONSTRAINT "technology_components_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "technology_components"
    ADD CONSTRAINT "technology_components_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "technology_products"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "technology_components"
    ADD CONSTRAINT "technology_components_versionId_fkey"
    FOREIGN KEY ("versionId") REFERENCES "technology_versions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "technology_components"
    ADD CONSTRAINT "technology_components_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "application_technologies"
    ADD CONSTRAINT "application_technologies_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "applications"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "application_technologies"
    ADD CONSTRAINT "application_technologies_componentId_fkey"
    FOREIGN KEY ("componentId") REFERENCES "technology_components"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "technology_dependencies"
    ADD CONSTRAINT "technology_dependencies_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "technology_dependencies"
    ADD CONSTRAINT "technology_dependencies_sourceProductId_fkey"
    FOREIGN KEY ("sourceProductId") REFERENCES "technology_products"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "technology_dependencies"
    ADD CONSTRAINT "technology_dependencies_targetProductId_fkey"
    FOREIGN KEY ("targetProductId") REFERENCES "technology_products"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
