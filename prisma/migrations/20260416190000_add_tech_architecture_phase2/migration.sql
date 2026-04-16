-- Module 7 Phase 2: Technology Standards + Reference Architectures
-- Idempotent: safe to re-apply.

-- ===== ENUMS =====

DO $$ BEGIN
  CREATE TYPE "StandardCategory" AS ENUM (
    'PRODUCT_CHOICE','VERSION_CHOICE','PROTOCOL','SECURITY',
    'ARCHITECTURE_PATTERN','HOSTING','INTEGRATION','DATA','OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "StandardLevel" AS ENUM ('MANDATORY','RECOMMENDED','DEPRECATED','PROHIBITED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "StandardStatus" AS ENUM ('DRAFT','ACTIVE','RETIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ReferenceArchStatus" AS ENUM ('DRAFT','ACTIVE','DEPRECATED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== TABLES =====

CREATE TABLE IF NOT EXISTS "technology_standards" (
  "id"             TEXT PRIMARY KEY,
  "workspaceId"    TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "description"    TEXT,
  "category"       "StandardCategory" NOT NULL DEFAULT 'OTHER',
  "level"          "StandardLevel"    NOT NULL DEFAULT 'RECOMMENDED',
  "status"         "StandardStatus"   NOT NULL DEFAULT 'ACTIVE',
  "productId"      TEXT,
  "versionId"      TEXT,
  "ownerId"        TEXT,
  "effectiveDate"  TIMESTAMP(3),
  "reviewDate"     TIMESTAMP(3),
  "rationale"      TEXT,
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "technology_standards_workspaceId_idx"             ON "technology_standards"("workspaceId");
CREATE INDEX IF NOT EXISTS "technology_standards_workspaceId_category_idx"    ON "technology_standards"("workspaceId","category");
CREATE INDEX IF NOT EXISTS "technology_standards_workspaceId_level_idx"       ON "technology_standards"("workspaceId","level");
CREATE INDEX IF NOT EXISTS "technology_standards_workspaceId_status_idx"      ON "technology_standards"("workspaceId","status");
CREATE INDEX IF NOT EXISTS "technology_standards_workspaceId_productId_idx"   ON "technology_standards"("workspaceId","productId");
CREATE INDEX IF NOT EXISTS "technology_standards_workspaceId_versionId_idx"   ON "technology_standards"("workspaceId","versionId");

DO $$ BEGIN
  ALTER TABLE "technology_standards" ADD CONSTRAINT "technology_standards_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "technology_standards" ADD CONSTRAINT "technology_standards_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "technology_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "technology_standards" ADD CONSTRAINT "technology_standards_versionId_fkey"
    FOREIGN KEY ("versionId") REFERENCES "technology_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "technology_standards" ADD CONSTRAINT "technology_standards_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS "reference_architectures" (
  "id"          TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "slug"        TEXT NOT NULL,
  "description" TEXT,
  "category"    TEXT,
  "status"      "ReferenceArchStatus" NOT NULL DEFAULT 'DRAFT',
  "ownerId"     TEXT,
  "diagramUrl"  TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "reference_architectures_workspaceId_slug_key" ON "reference_architectures"("workspaceId","slug");
CREATE INDEX IF NOT EXISTS "reference_architectures_workspaceId_idx"             ON "reference_architectures"("workspaceId");
CREATE INDEX IF NOT EXISTS "reference_architectures_workspaceId_status_idx"      ON "reference_architectures"("workspaceId","status");

DO $$ BEGIN
  ALTER TABLE "reference_architectures" ADD CONSTRAINT "reference_architectures_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "reference_architectures" ADD CONSTRAINT "reference_architectures_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS "reference_architecture_components" (
  "architectureId" TEXT NOT NULL,
  "productId"      TEXT NOT NULL,
  "layer"          "TechLayer"      NOT NULL DEFAULT 'APPLICATION',
  "role"           "TechnologyRole" NOT NULL DEFAULT 'PRIMARY',
  "versionId"      TEXT,
  "notes"          TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("architectureId","productId")
);

CREATE INDEX IF NOT EXISTS "reference_architecture_components_productId_idx" ON "reference_architecture_components"("productId");

DO $$ BEGIN
  ALTER TABLE "reference_architecture_components" ADD CONSTRAINT "reference_architecture_components_architectureId_fkey"
    FOREIGN KEY ("architectureId") REFERENCES "reference_architectures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "reference_architecture_components" ADD CONSTRAINT "reference_architecture_components_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "technology_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "reference_architecture_components" ADD CONSTRAINT "reference_architecture_components_versionId_fkey"
    FOREIGN KEY ("versionId") REFERENCES "technology_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
