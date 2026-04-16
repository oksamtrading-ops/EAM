-- ============================================================
-- MODULE 7 v2 — DIAGRAM DOCUMENTS, SCENARIOS, VIEWPOINTS, VALIDATION
-- ============================================================
-- Idempotent (IF NOT EXISTS / DO $$ ... $$).

-- ── New enums ────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "DiagramType" AS ENUM (
    'APPLICATION_LANDSCAPE', 'DATA_FLOW', 'TECHNOLOGY_STACK', 'FREE_FORM'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ValidationSeverity" AS ENUM ('VS_ERROR', 'VS_WARNING', 'VS_INFO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add DIAMOND to AnnotationType if not already present
DO $$ BEGIN
  ALTER TYPE "AnnotationType" ADD VALUE IF NOT EXISTS 'DIAMOND';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── DiagramDocument ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "diagram_documents" (
    "id"                 TEXT NOT NULL,
    "workspaceId"        TEXT NOT NULL,
    "name"               TEXT NOT NULL DEFAULT 'Untitled Diagram',
    "description"        TEXT,
    "diagramType"        "DiagramType" NOT NULL DEFAULT 'APPLICATION_LANDSCAPE',
    "scenario"           "ArchStateType" NOT NULL DEFAULT 'AS_IS',
    "content"            JSONB NOT NULL DEFAULT '{}',
    "query"              JSONB,
    "activeViewpointIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "timelineDate"       TIMESTAMP(3),
    "createdById"        TEXT,
    "updatedById"        TEXT,
    "isActive"           BOOLEAN NOT NULL DEFAULT true,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagram_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "diagram_documents_ws_name_scenario_key"
  ON "diagram_documents"("workspaceId", "name", "scenario");
CREATE INDEX IF NOT EXISTS "diagram_documents_ws_type_idx"
  ON "diagram_documents"("workspaceId", "diagramType");
CREATE INDEX IF NOT EXISTS "diagram_documents_ws_scenario_idx"
  ON "diagram_documents"("workspaceId", "scenario");

DO $$ BEGIN
  ALTER TABLE "diagram_documents"
    ADD CONSTRAINT "diagram_documents_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "diagram_documents"
    ADD CONSTRAINT "diagram_documents_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "diagram_documents"
    ADD CONSTRAINT "diagram_documents_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── DiagramVersion ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "diagram_versions" (
    "id"          TEXT NOT NULL,
    "documentId"  TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "label"       TEXT NOT NULL,
    "description" TEXT,
    "snapshot"    JSONB NOT NULL,
    "isAutomatic" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagram_versions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "diagram_versions_doc_created_idx"
  ON "diagram_versions"("documentId", "createdAt");
CREATE INDEX IF NOT EXISTS "diagram_versions_ws_idx"
  ON "diagram_versions"("workspaceId");

DO $$ BEGIN
  ALTER TABLE "diagram_versions"
    ADD CONSTRAINT "diagram_versions_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "diagram_documents"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "diagram_versions"
    ADD CONSTRAINT "diagram_versions_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "diagram_versions"
    ADD CONSTRAINT "diagram_versions_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── DiagramScenario ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "diagram_scenarios" (
    "id"              TEXT NOT NULL,
    "documentId"      TEXT NOT NULL,
    "workspaceId"     TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "description"     TEXT,
    "effectiveDate"   TIMESTAMP(3),
    "changes"         JSONB NOT NULL DEFAULT '[]',
    "contentOverride" JSONB,
    "sortOrder"       INTEGER NOT NULL DEFAULT 0,
    "isPromoted"      BOOLEAN NOT NULL DEFAULT false,
    "createdById"     TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagram_scenarios_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "diagram_scenarios_doc_name_key"
  ON "diagram_scenarios"("documentId", "name");
CREATE INDEX IF NOT EXISTS "diagram_scenarios_ws_idx"
  ON "diagram_scenarios"("workspaceId");

DO $$ BEGIN
  ALTER TABLE "diagram_scenarios"
    ADD CONSTRAINT "diagram_scenarios_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "diagram_documents"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "diagram_scenarios"
    ADD CONSTRAINT "diagram_scenarios_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "diagram_scenarios"
    ADD CONSTRAINT "diagram_scenarios_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── ViewpointConfig ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "viewpoint_configs" (
    "id"          TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "config"      JSONB NOT NULL DEFAULT '{}',
    "isBuiltIn"   BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "viewpoint_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "viewpoint_configs_ws_name_key"
  ON "viewpoint_configs"("workspaceId", "name");
CREATE INDEX IF NOT EXISTS "viewpoint_configs_ws_idx"
  ON "viewpoint_configs"("workspaceId");

DO $$ BEGIN
  ALTER TABLE "viewpoint_configs"
    ADD CONSTRAINT "viewpoint_configs_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "viewpoint_configs"
    ADD CONSTRAINT "viewpoint_configs_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── DiagramValidation ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS "diagram_validations" (
    "id"          TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "documentId"  TEXT,
    "ruleId"      TEXT NOT NULL,
    "severity"    "ValidationSeverity" NOT NULL,
    "entityType"  TEXT NOT NULL,
    "entityId"    TEXT NOT NULL,
    "message"     TEXT NOT NULL,
    "metadata"    JSONB,
    "isResolved"  BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt"  TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagram_validations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "diagram_validations_ws_doc_idx"
  ON "diagram_validations"("workspaceId", "documentId");
CREATE INDEX IF NOT EXISTS "diagram_validations_ws_rule_resolved_idx"
  ON "diagram_validations"("workspaceId", "ruleId", "isResolved");

DO $$ BEGIN
  ALTER TABLE "diagram_validations"
    ADD CONSTRAINT "diagram_validations_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
