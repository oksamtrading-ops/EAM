-- ============================================================
-- AI Auto-Mapping schema migration
-- Run this in Neon SQL Editor (https://console.neon.tech)
-- Safe to re-run: uses IF NOT EXISTS where possible.
-- ============================================================

-- ── 1. New enum types ──────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "MappingSource" AS ENUM ('MANUAL','AI_SUGGESTED','AI_ACCEPTED','AI_MODIFIED','IMPORTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "RelationshipType" AS ENUM ('PRIMARY','SUPPORTING','ENABLING');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "Region" AS ENUM ('NA','EMEA','APAC','LATAM','GLOBAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "FeedbackAction" AS ENUM ('ACCEPTED','REJECTED','MODIFIED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── 2. Workspace profile fields (fixes the 500s) ──────────
ALTER TABLE "workspaces"
  ADD COLUMN IF NOT EXISTS "subIndustry"       TEXT,
  ADD COLUMN IF NOT EXISTS "region"            "Region",
  ADD COLUMN IF NOT EXISTS "regulatoryRegime"  TEXT,
  ADD COLUMN IF NOT EXISTS "businessModelHint" TEXT;

-- ── 3. Extend application_capability_maps ─────────────────
ALTER TABLE "application_capability_maps"
  ADD COLUMN IF NOT EXISTS "source"           "MappingSource"    NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS "relationshipType" "RelationshipType" NOT NULL DEFAULT 'PRIMARY',
  ADD COLUMN IF NOT EXISTS "aiConfidence"     INTEGER,
  ADD COLUMN IF NOT EXISTS "aiRationale"      TEXT,
  ADD COLUMN IF NOT EXISTS "aiModel"          TEXT,
  ADD COLUMN IF NOT EXISTS "aiPromptVersion"  TEXT,
  ADD COLUMN IF NOT EXISTS "createdById"      TEXT;

-- ── 4. AIMappingFeedback table ────────────────────────────
CREATE TABLE IF NOT EXISTS "ai_mapping_feedback" (
  "id"                  TEXT PRIMARY KEY,
  "workspaceId"         TEXT NOT NULL,
  "applicationId"       TEXT NOT NULL,
  "capabilityId"        TEXT NOT NULL,
  "aiConfidence"        INTEGER NOT NULL,
  "aiRationale"         TEXT,
  "aiRelationshipType"  "RelationshipType" NOT NULL,
  "userAction"          "FeedbackAction"   NOT NULL,
  "userRelationshipType" "RelationshipType",
  "userCapabilityId"    TEXT,
  "userNote"            TEXT,
  "promptVersion"       TEXT NOT NULL,
  "model"               TEXT NOT NULL,
  "tier"                TEXT NOT NULL,
  "createdById"         TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_mapping_feedback_workspace_fk"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ai_mapping_feedback_ws_created_idx"
  ON "ai_mapping_feedback"("workspaceId","createdAt");
CREATE INDEX IF NOT EXISTS "ai_mapping_feedback_app_idx"
  ON "ai_mapping_feedback"("applicationId");
CREATE INDEX IF NOT EXISTS "ai_mapping_feedback_cap_idx"
  ON "ai_mapping_feedback"("capabilityId");

-- ── 5. AIMappingRun table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS "ai_mapping_runs" (
  "id"                    TEXT PRIMARY KEY,
  "workspaceId"           TEXT NOT NULL,
  "mode"                  TEXT NOT NULL,
  "tier"                  TEXT NOT NULL,
  "appsProcessed"         INTEGER NOT NULL DEFAULT 0,
  "suggestionsGenerated"  INTEGER NOT NULL DEFAULT 0,
  "tokensUsed"            INTEGER NOT NULL DEFAULT 0,
  "durationMs"            INTEGER NOT NULL DEFAULT 0,
  "model"                 TEXT NOT NULL,
  "promptVersion"         TEXT NOT NULL,
  "status"                TEXT NOT NULL,
  "errorMessage"          TEXT,
  "createdById"           TEXT NOT NULL,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_mapping_runs_workspace_fk"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ai_mapping_runs_ws_created_idx"
  ON "ai_mapping_runs"("workspaceId","createdAt");

-- ── Done ──────────────────────────────────────────────────
-- After running this, the Vercel app should recover automatically
-- (no redeploy needed). Try loading the dashboard again.
