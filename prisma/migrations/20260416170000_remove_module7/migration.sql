-- ============================================================
-- REMOVE MODULE 7 — Architecture Diagram + Drawing Tools
-- ============================================================
-- Drops all M7-exclusive tables, enums, and fields.
-- Keeps InterfaceDataFlow (shared with M6) and ArchStateType (shared with M3).

-- ── 1. Delete TO_BE interfaces to avoid unique constraint conflict ──
DELETE FROM "application_interfaces" WHERE "scenario" = 'TO_BE';

-- ── 2. Drop M7 v2 tables (cascade-safe, newest first) ──
DROP TABLE IF EXISTS "diagram_validations" CASCADE;
DROP TABLE IF EXISTS "viewpoint_configs" CASCADE;
DROP TABLE IF EXISTS "diagram_scenarios" CASCADE;
DROP TABLE IF EXISTS "diagram_versions" CASCADE;
DROP TABLE IF EXISTS "diagram_documents" CASCADE;

-- ── 3. Drop M7 v1 tables ──
DROP TABLE IF EXISTS "diagram_annotations" CASCADE;
DROP TABLE IF EXISTS "diagram_layouts" CASCADE;
DROP TABLE IF EXISTS "ai_architecture_runs" CASCADE;

-- ── 4. Remove M7 fields from application_interfaces ──
-- Drop the old unique index first
DROP INDEX IF EXISTS "application_interfaces_ws_src_tgt_name_scenario_key";
DROP INDEX IF EXISTS "application_interfaces_scenario_review_idx";

ALTER TABLE "application_interfaces"
  DROP COLUMN IF EXISTS "scenario",
  DROP COLUMN IF EXISTS "source",
  DROP COLUMN IF EXISTS "reviewStatus",
  DROP COLUMN IF EXISTS "aiConfidence",
  DROP COLUMN IF EXISTS "aiRationale",
  DROP COLUMN IF EXISTS "aiModel",
  DROP COLUMN IF EXISTS "aiPromptVersion",
  DROP COLUMN IF EXISTS "createdById";

-- Create the new unique index without scenario
CREATE UNIQUE INDEX IF NOT EXISTS "application_interfaces_ws_src_tgt_name_key"
  ON "application_interfaces"("workspaceId", "sourceAppId", "targetAppId", "name");

-- ── 5. Remove AI inference fields from applications ──
ALTER TABLE "applications"
  DROP COLUMN IF EXISTS "systemLandscapeRole",
  DROP COLUMN IF EXISTS "businessCapabilityKeywords",
  DROP COLUMN IF EXISTS "technicalStackKeywords";

-- ── 6. Drop M7-exclusive enums ──
DROP TYPE IF EXISTS "ValidationSeverity" CASCADE;
DROP TYPE IF EXISTS "DiagramType" CASCADE;
DROP TYPE IF EXISTS "AnnotationType" CASCADE;
DROP TYPE IF EXISTS "AnchorKind" CASCADE;
DROP TYPE IF EXISTS "InterfaceReviewStatus" CASCADE;

-- Keep: DataFlowDirection (used by InterfaceDataFlow / M6)
-- Keep: ArchStateType (used by ArchitectureState / M3)
-- Keep: MappingSource (used by ApplicationCapabilityMap / M2)
