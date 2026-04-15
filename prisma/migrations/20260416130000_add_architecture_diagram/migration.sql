-- ============================================================
-- MODULE 7 — AS-IS / TO-BE ARCHITECTURE DIAGRAM
-- ============================================================
-- This migration is idempotent (uses IF NOT EXISTS / IF EXISTS)
-- so it can be safely reapplied if an earlier attempt partially
-- completed.

-- ── New enums ────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "InterfaceReviewStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DataFlowDirection" AS ENUM ('SOURCE_TO_TARGET', 'TARGET_TO_SOURCE', 'BIDIRECTIONAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Application: 3 metadata fields for AI inference ─────────
ALTER TABLE "applications"
  ADD COLUMN IF NOT EXISTS "systemLandscapeRole"        TEXT,
  ADD COLUMN IF NOT EXISTS "businessCapabilityKeywords" TEXT,
  ADD COLUMN IF NOT EXISTS "technicalStackKeywords"     TEXT;

-- ── ApplicationInterface: add diagram fields ────────────────
ALTER TABLE "application_interfaces"
  ADD COLUMN IF NOT EXISTS "scenario"        "ArchStateType"         NOT NULL DEFAULT 'AS_IS',
  ADD COLUMN IF NOT EXISTS "source"          "MappingSource"         NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS "reviewStatus"    "InterfaceReviewStatus" NOT NULL DEFAULT 'ACCEPTED',
  ADD COLUMN IF NOT EXISTS "aiConfidence"    INTEGER,
  ADD COLUMN IF NOT EXISTS "aiRationale"     TEXT,
  ADD COLUMN IF NOT EXISTS "aiModel"         TEXT,
  ADD COLUMN IF NOT EXISTS "aiPromptVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "createdById"     TEXT;

-- Replace the (truncated) old unique index with one that includes
-- scenario so AS-IS and TO-BE can share source/target/name.
DROP INDEX IF EXISTS "application_interfaces_workspaceId_sourceAppId_targetAppId__key";
CREATE UNIQUE INDEX IF NOT EXISTS "application_interfaces_ws_src_tgt_name_scenario_key"
  ON "application_interfaces"("workspaceId", "sourceAppId", "targetAppId", "name", "scenario");

CREATE INDEX IF NOT EXISTS "application_interfaces_workspaceId_scenario_reviewStatus_idx"
  ON "application_interfaces"("workspaceId", "scenario", "reviewStatus");

-- ── InterfaceDataFlow ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS "interface_data_flows" (
    "id"           TEXT NOT NULL,
    "workspaceId"  TEXT NOT NULL,
    "interfaceId"  TEXT NOT NULL,
    "dataEntityId" TEXT NOT NULL,
    "direction"    "DataFlowDirection" NOT NULL DEFAULT 'SOURCE_TO_TARGET',
    "frequency"    TEXT,
    "notes"        TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interface_data_flows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "interface_data_flows_interfaceId_dataEntityId_key"
  ON "interface_data_flows"("interfaceId", "dataEntityId");
CREATE INDEX IF NOT EXISTS "interface_data_flows_workspaceId_idx"
  ON "interface_data_flows"("workspaceId");
CREATE INDEX IF NOT EXISTS "interface_data_flows_workspaceId_interfaceId_idx"
  ON "interface_data_flows"("workspaceId", "interfaceId");
CREATE INDEX IF NOT EXISTS "interface_data_flows_workspaceId_dataEntityId_idx"
  ON "interface_data_flows"("workspaceId", "dataEntityId");

DO $$ BEGIN
  ALTER TABLE "interface_data_flows"
    ADD CONSTRAINT "interface_data_flows_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "interface_data_flows"
    ADD CONSTRAINT "interface_data_flows_interfaceId_fkey"
    FOREIGN KEY ("interfaceId") REFERENCES "application_interfaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "interface_data_flows"
    ADD CONSTRAINT "interface_data_flows_dataEntityId_fkey"
    FOREIGN KEY ("dataEntityId") REFERENCES "data_entities"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── DiagramLayout ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "diagram_layouts" (
    "id"            TEXT NOT NULL,
    "workspaceId"   TEXT NOT NULL,
    "scenario"      "ArchStateType" NOT NULL DEFAULT 'AS_IS',
    "nodePositions" JSONB NOT NULL DEFAULT '{}',
    "viewport"      JSONB,
    "updatedById"   TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagram_layouts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "diagram_layouts_workspaceId_scenario_key"
  ON "diagram_layouts"("workspaceId", "scenario");

DO $$ BEGIN
  ALTER TABLE "diagram_layouts"
    ADD CONSTRAINT "diagram_layouts_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── AIArchitectureRun ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ai_architecture_runs" (
    "id"                   TEXT NOT NULL,
    "workspaceId"          TEXT NOT NULL,
    "mode"                 TEXT NOT NULL,
    "scopeAppId"           TEXT,
    "appsProcessed"        INTEGER NOT NULL DEFAULT 0,
    "suggestionsGenerated" INTEGER NOT NULL DEFAULT 0,
    "tokensUsed"           INTEGER NOT NULL DEFAULT 0,
    "durationMs"           INTEGER NOT NULL DEFAULT 0,
    "model"                TEXT NOT NULL,
    "promptVersion"        TEXT NOT NULL,
    "status"               TEXT NOT NULL DEFAULT 'completed',
    "errorMessage"         TEXT,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById"          TEXT,

    CONSTRAINT "ai_architecture_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ai_architecture_runs_workspaceId_createdAt_idx"
  ON "ai_architecture_runs"("workspaceId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "ai_architecture_runs"
    ADD CONSTRAINT "ai_architecture_runs_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
