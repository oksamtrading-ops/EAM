import { db } from "@/server/db";

export const maxDuration = 60;

// One-shot migration endpoint for the AI Auto-Mapping schema.
// Protected by MIGRATE_SECRET env var. Idempotent.
//
// Usage:
//   curl -X POST https://eam-platform-pi.vercel.app/api/admin/migrate \
//        -H "x-migrate-secret: $MIGRATE_SECRET"

const STATEMENTS: { label: string; sql: string }[] = [
  {
    label: "enum MappingSource",
    sql: `DO $$ BEGIN
      CREATE TYPE "MappingSource" AS ENUM ('MANUAL','AI_SUGGESTED','AI_ACCEPTED','AI_MODIFIED','IMPORTED');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  },
  {
    label: "enum RelationshipType",
    sql: `DO $$ BEGIN
      CREATE TYPE "RelationshipType" AS ENUM ('PRIMARY','SUPPORTING','ENABLING');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  },
  {
    label: "enum Region",
    sql: `DO $$ BEGIN
      CREATE TYPE "Region" AS ENUM ('NA','EMEA','APAC','LATAM','GLOBAL');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  },
  {
    label: "enum FeedbackAction",
    sql: `DO $$ BEGIN
      CREATE TYPE "FeedbackAction" AS ENUM ('ACCEPTED','REJECTED','MODIFIED');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  },
  {
    label: "workspaces columns",
    sql: `ALTER TABLE "workspaces"
      ADD COLUMN IF NOT EXISTS "subIndustry"       TEXT,
      ADD COLUMN IF NOT EXISTS "region"            "Region",
      ADD COLUMN IF NOT EXISTS "regulatoryRegime"  TEXT,
      ADD COLUMN IF NOT EXISTS "businessModelHint" TEXT;`,
  },
  {
    label: "application_capability_maps columns",
    sql: `ALTER TABLE "application_capability_maps"
      ADD COLUMN IF NOT EXISTS "source"           "MappingSource"    NOT NULL DEFAULT 'MANUAL',
      ADD COLUMN IF NOT EXISTS "relationshipType" "RelationshipType" NOT NULL DEFAULT 'PRIMARY',
      ADD COLUMN IF NOT EXISTS "aiConfidence"     INTEGER,
      ADD COLUMN IF NOT EXISTS "aiRationale"      TEXT,
      ADD COLUMN IF NOT EXISTS "aiModel"          TEXT,
      ADD COLUMN IF NOT EXISTS "aiPromptVersion"  TEXT,
      ADD COLUMN IF NOT EXISTS "createdById"      TEXT;`,
  },
  {
    label: "table ai_mapping_feedback",
    sql: `CREATE TABLE IF NOT EXISTS "ai_mapping_feedback" (
      "id"                   TEXT PRIMARY KEY,
      "workspaceId"          TEXT NOT NULL,
      "applicationId"        TEXT NOT NULL,
      "capabilityId"         TEXT NOT NULL,
      "aiConfidence"         INTEGER NOT NULL,
      "aiRationale"          TEXT,
      "aiRelationshipType"   "RelationshipType" NOT NULL,
      "userAction"           "FeedbackAction"   NOT NULL,
      "userRelationshipType" "RelationshipType",
      "userCapabilityId"     TEXT,
      "userNote"             TEXT,
      "promptVersion"        TEXT NOT NULL,
      "model"                TEXT NOT NULL,
      "tier"                 TEXT NOT NULL,
      "createdById"          TEXT,
      "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ai_mapping_feedback_workspace_fk"
        FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE
    );`,
  },
  {
    label: "indexes ai_mapping_feedback",
    sql: `CREATE INDEX IF NOT EXISTS "ai_mapping_feedback_ws_created_idx" ON "ai_mapping_feedback"("workspaceId","createdAt");
          CREATE INDEX IF NOT EXISTS "ai_mapping_feedback_app_idx"        ON "ai_mapping_feedback"("applicationId");
          CREATE INDEX IF NOT EXISTS "ai_mapping_feedback_cap_idx"        ON "ai_mapping_feedback"("capabilityId");`,
  },
  {
    label: "table ai_mapping_runs",
    sql: `CREATE TABLE IF NOT EXISTS "ai_mapping_runs" (
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
    );`,
  },
  {
    label: "index ai_mapping_runs",
    sql: `CREATE INDEX IF NOT EXISTS "ai_mapping_runs_ws_created_idx" ON "ai_mapping_runs"("workspaceId","createdAt");`,
  },

  // ── Quick Win #3: +5 industries ─────────────────────────
  {
    label: "enum IndustryType += INSURANCE",
    sql: `ALTER TYPE "IndustryType" ADD VALUE IF NOT EXISTS 'INSURANCE';`,
  },
  {
    label: "enum IndustryType += TELECOM",
    sql: `ALTER TYPE "IndustryType" ADD VALUE IF NOT EXISTS 'TELECOM';`,
  },
  {
    label: "enum IndustryType += ENERGY_UTILITIES",
    sql: `ALTER TYPE "IndustryType" ADD VALUE IF NOT EXISTS 'ENERGY_UTILITIES';`,
  },
  {
    label: "enum IndustryType += PUBLIC_SECTOR",
    sql: `ALTER TYPE "IndustryType" ADD VALUE IF NOT EXISTS 'PUBLIC_SECTOR';`,
  },
  {
    label: "enum IndustryType += PHARMA_LIFESCIENCES",
    sql: `ALTER TYPE "IndustryType" ADD VALUE IF NOT EXISTS 'PHARMA_LIFESCIENCES';`,
  },

  // ── Quick Win #3: +4 compliance frameworks ──────────────
  {
    label: "enum ComplianceFramework += DORA",
    sql: `ALTER TYPE "ComplianceFramework" ADD VALUE IF NOT EXISTS 'DORA';`,
  },
  {
    label: "enum ComplianceFramework += NIS2",
    sql: `ALTER TYPE "ComplianceFramework" ADD VALUE IF NOT EXISTS 'NIS2';`,
  },
  {
    label: "enum ComplianceFramework += ISO_27701",
    sql: `ALTER TYPE "ComplianceFramework" ADD VALUE IF NOT EXISTS 'ISO_27701';`,
  },
  {
    label: "enum ComplianceFramework += FEDRAMP_MODERATE",
    sql: `ALTER TYPE "ComplianceFramework" ADD VALUE IF NOT EXISTS 'FEDRAMP_MODERATE';`,
  },

  // ── Quick Win #3: Saved palette queries ────────────────
  {
    label: "table saved_palette_queries",
    sql: `CREATE TABLE IF NOT EXISTS "saved_palette_queries" (
      "id"          TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "userId"      TEXT NOT NULL,
      "label"       TEXT NOT NULL,
      "queryText"   TEXT NOT NULL,
      "useCount"    INTEGER NOT NULL DEFAULT 0,
      "lastUsedAt"  TIMESTAMP(3),
      "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "saved_palette_queries_workspace_fk"
        FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE
    );`,
  },
  {
    label: "index saved_palette_queries",
    sql: `CREATE INDEX IF NOT EXISTS "saved_palette_queries_ws_user_idx" ON "saved_palette_queries"("workspaceId","userId");`,
  },
];

export async function POST(req: Request) {
  const secret = process.env.MIGRATE_SECRET;
  if (!secret) {
    return Response.json(
      { error: "MIGRATE_SECRET env var is not configured on the server" },
      { status: 500 }
    );
  }

  const provided = req.headers.get("x-migrate-secret");
  if (provided !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: { label: string; ok: boolean; error?: string }[] = [];
  for (const stmt of STATEMENTS) {
    try {
      await db.$executeRawUnsafe(stmt.sql);
      results.push({ label: stmt.label, ok: true });
    } catch (err: any) {
      results.push({
        label: stmt.label,
        ok: false,
        error: err?.message ?? String(err),
      });
    }
  }

  const failed = results.filter((r) => !r.ok);
  return Response.json(
    {
      ok: failed.length === 0,
      total: results.length,
      failed: failed.length,
      results,
    },
    { status: failed.length ? 500 : 200 }
  );
}

export async function GET() {
  return Response.json({
    hint: "POST to this endpoint with header x-migrate-secret: <MIGRATE_SECRET> to run the AI mapping schema migration.",
  });
}
