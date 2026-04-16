/* eslint-disable no-console */
// Runs DDL via Neon's HTTP serverless driver (bypasses blocked TCP 5432).
// Idempotent.
import { neon } from "@neondatabase/serverless";

const STATEMENTS: { label: string; sql: string }[] = [
  // ── Module 7 — Diagram annotations ─────────────────────────
  {
    label: "enum AnnotationType",
    sql: `DO $$ BEGIN
      CREATE TYPE "AnnotationType" AS ENUM (
        'CONTAINER','NOTE','RECTANGLE','CIRCLE','CYLINDER','CLOUD','LINE','ARROW'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  },
  {
    label: "enum AnchorKind",
    sql: `DO $$ BEGIN
      CREATE TYPE "AnchorKind" AS ENUM ('APP','ANNOTATION','FREE');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  },
  {
    label: "diagram_layouts: add nodeSizes + defaults",
    sql: `ALTER TABLE "diagram_layouts"
      ADD COLUMN IF NOT EXISTS "nodeSizes"    JSONB NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS "defaultNodeW" INTEGER,
      ADD COLUMN IF NOT EXISTS "defaultNodeH" INTEGER;`,
  },
  {
    label: "table diagram_annotations",
    sql: `CREATE TABLE IF NOT EXISTS "diagram_annotations" (
        "id"           TEXT NOT NULL,
        "workspaceId"  TEXT NOT NULL,
        "scenario"     "ArchStateType"  NOT NULL DEFAULT 'AS_IS',
        "type"         "AnnotationType" NOT NULL,
        "x"            DOUBLE PRECISION NOT NULL DEFAULT 0,
        "y"            DOUBLE PRECISION NOT NULL DEFAULT 0,
        "width"        DOUBLE PRECISION,
        "height"       DOUBLE PRECISION,
        "z"            INTEGER NOT NULL DEFAULT 0,
        "rotation"     DOUBLE PRECISION NOT NULL DEFAULT 0,
        "text"         TEXT,
        "strokeColor"  TEXT,
        "fillColor"    TEXT,
        "strokeWidth"  INTEGER,
        "strokeStyle"  TEXT,
        "sourceAnchor" JSONB,
        "targetAnchor" JSONB,
        "waypoints"    JSONB NOT NULL DEFAULT '[]',
        "routing"      TEXT NOT NULL DEFAULT 'orthogonal',
        "headSource"   BOOLEAN NOT NULL DEFAULT false,
        "headTarget"   BOOLEAN NOT NULL DEFAULT true,
        "createdById"  TEXT,
        "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"    TIMESTAMP(3) NOT NULL,
        CONSTRAINT "diagram_annotations_pkey" PRIMARY KEY ("id")
      );`,
  },
  {
    label: "index diagram_annotations ws+scenario",
    sql: `CREATE INDEX IF NOT EXISTS "diagram_annotations_ws_scenario_idx"
      ON "diagram_annotations"("workspaceId","scenario");`,
  },
  {
    label: "index diagram_annotations ws+scenario+type",
    sql: `CREATE INDEX IF NOT EXISTS "diagram_annotations_ws_scenario_type_idx"
      ON "diagram_annotations"("workspaceId","scenario","type");`,
  },
  {
    label: "fk diagram_annotations → workspaces",
    sql: `DO $$ BEGIN
      ALTER TABLE "diagram_annotations"
        ADD CONSTRAINT "diagram_annotations_workspaceId_fkey"
        FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }
  const sql = neon(url);

  let ok = 0;
  let fail = 0;
  for (const stmt of STATEMENTS) {
    try {
      await sql.query(stmt.sql);
      console.log(`  ✓ ${stmt.label}`);
      ok++;
    } catch (e: any) {
      console.error(`  ✗ ${stmt.label}: ${e?.message ?? e}`);
      fail++;
    }
  }
  console.log(`\nDone. ${ok}/${STATEMENTS.length} ok${fail ? `, ${fail} failed` : ""}.`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
