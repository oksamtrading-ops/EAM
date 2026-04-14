/* eslint-disable no-console */
// Runs DDL via Neon's HTTP serverless driver (bypasses blocked TCP 5432).
// Idempotent.
import { neon } from "@neondatabase/serverless";

const STATEMENTS: { label: string; sql: string }[] = [
  { label: "enum IndustryType += INSURANCE",
    sql: `ALTER TYPE "IndustryType" ADD VALUE IF NOT EXISTS 'INSURANCE';` },
  { label: "enum IndustryType += TELECOM",
    sql: `ALTER TYPE "IndustryType" ADD VALUE IF NOT EXISTS 'TELECOM';` },
  { label: "enum IndustryType += ENERGY_UTILITIES",
    sql: `ALTER TYPE "IndustryType" ADD VALUE IF NOT EXISTS 'ENERGY_UTILITIES';` },
  { label: "enum IndustryType += PUBLIC_SECTOR",
    sql: `ALTER TYPE "IndustryType" ADD VALUE IF NOT EXISTS 'PUBLIC_SECTOR';` },
  { label: "enum IndustryType += PHARMA_LIFESCIENCES",
    sql: `ALTER TYPE "IndustryType" ADD VALUE IF NOT EXISTS 'PHARMA_LIFESCIENCES';` },
  { label: "enum ComplianceFramework += DORA",
    sql: `ALTER TYPE "ComplianceFramework" ADD VALUE IF NOT EXISTS 'DORA';` },
  { label: "enum ComplianceFramework += NIS2",
    sql: `ALTER TYPE "ComplianceFramework" ADD VALUE IF NOT EXISTS 'NIS2';` },
  { label: "enum ComplianceFramework += ISO_27701",
    sql: `ALTER TYPE "ComplianceFramework" ADD VALUE IF NOT EXISTS 'ISO_27701';` },
  { label: "enum ComplianceFramework += FEDRAMP_MODERATE",
    sql: `ALTER TYPE "ComplianceFramework" ADD VALUE IF NOT EXISTS 'FEDRAMP_MODERATE';` },
  { label: "table saved_palette_queries",
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
    );` },
  { label: "index saved_palette_queries",
    sql: `CREATE INDEX IF NOT EXISTS "saved_palette_queries_ws_user_idx" ON "saved_palette_queries"("workspaceId","userId");` },
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
