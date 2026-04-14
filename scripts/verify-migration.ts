/* eslint-disable no-console */
import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const industries = await sql`
    SELECT enumlabel FROM pg_enum
    WHERE enumtypid = '"IndustryType"'::regtype
    ORDER BY enumsortorder
  `;
  const frameworks = await sql`
    SELECT enumlabel FROM pg_enum
    WHERE enumtypid = '"ComplianceFramework"'::regtype
    ORDER BY enumsortorder
  `;
  const tbl = await sql`
    SELECT to_regclass('public.saved_palette_queries') AS exists
  `;
  console.log("IndustryType:", industries.map((r: any) => r.enumlabel).join(", "));
  console.log("ComplianceFramework:", frameworks.map((r: any) => r.enumlabel).join(", "));
  console.log("saved_palette_queries table:", tbl[0]?.exists ?? "(missing)");
}
main();
