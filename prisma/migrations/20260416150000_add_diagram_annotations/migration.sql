-- ============================================================
-- MODULE 7 — DIAGRAM ANNOTATIONS (containers / shapes / notes / lines / arrows)
-- ============================================================
-- Idempotent (IF NOT EXISTS / DO $$ ... $$).

-- ── New enums ────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "AnnotationType" AS ENUM (
    'CONTAINER', 'NOTE', 'RECTANGLE', 'CIRCLE', 'CYLINDER', 'CLOUD', 'LINE', 'ARROW'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AnchorKind" AS ENUM ('APP', 'ANNOTATION', 'FREE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── DiagramLayout: per-node size overrides ──────────────────
-- { [nodeId]: { w: number, h: number } }
ALTER TABLE "diagram_layouts"
  ADD COLUMN IF NOT EXISTS "nodeSizes"    JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "defaultNodeW" INTEGER,
  ADD COLUMN IF NOT EXISTS "defaultNodeH" INTEGER;

-- ── DiagramAnnotation ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS "diagram_annotations" (
    "id"           TEXT NOT NULL,
    "workspaceId"  TEXT NOT NULL,
    "scenario"     "ArchStateType"   NOT NULL DEFAULT 'AS_IS',
    "type"         "AnnotationType"  NOT NULL,

    -- Geometry
    "x"            DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y"            DOUBLE PRECISION NOT NULL DEFAULT 0,
    "width"        DOUBLE PRECISION,
    "height"       DOUBLE PRECISION,
    "z"            INTEGER NOT NULL DEFAULT 0,
    "rotation"     DOUBLE PRECISION NOT NULL DEFAULT 0,

    -- Content
    "text"         TEXT,
    "strokeColor"  TEXT,
    "fillColor"    TEXT,
    "strokeWidth"  INTEGER,
    "strokeStyle"  TEXT,

    -- LINE/ARROW endpoints + waypoints
    -- Endpoints: { kind: 'APP'|'ANNOTATION'|'FREE', refId?: string, x?: number, y?: number, handle?: 't'|'l'|'r'|'b' }
    "sourceAnchor" JSONB,
    "targetAnchor" JSONB,
    -- waypoints: [{ x, y }, ...] — optional user-edited bend points
    "waypoints"    JSONB NOT NULL DEFAULT '[]',
    -- routing: 'orthogonal' | 'straight'
    "routing"      TEXT NOT NULL DEFAULT 'orthogonal',
    -- arrow head toggles (only relevant when type = ARROW/LINE)
    "headSource"   BOOLEAN NOT NULL DEFAULT false,
    "headTarget"   BOOLEAN NOT NULL DEFAULT true,

    "createdById"  TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagram_annotations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "diagram_annotations_ws_scenario_idx"
  ON "diagram_annotations"("workspaceId", "scenario");
CREATE INDEX IF NOT EXISTS "diagram_annotations_ws_scenario_type_idx"
  ON "diagram_annotations"("workspaceId", "scenario", "type");

DO $$ BEGIN
  ALTER TABLE "diagram_annotations"
    ADD CONSTRAINT "diagram_annotations_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
