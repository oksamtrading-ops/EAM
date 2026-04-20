/**
 * Backfill pgvector embeddings for rows uploaded before semantic
 * retrieval landed. Idempotent — only processes rows where
 * `embedding IS NULL`. Safe to re-run.
 *
 * Usage:
 *   npm run backfill:embeddings                # all targets
 *   npm run backfill:embeddings -- --target=intake
 *   npm run backfill:embeddings -- --target=knowledge
 *
 * Costs: text-embedding-3-small ≈ $0.02 per 1M tokens.
 * Typical chunk ≈ 400 tokens → 50,000 chunks ≈ $0.40.
 */
import "dotenv/config";
import { db } from "@/server/db";
import { embedBatch, pgvectorLiteral } from "./openai";

const BATCH_SIZE = 96;

type Target = "intake" | "knowledge";

async function backfillIntakeChunks(): Promise<{
  embedded: number;
  skipped: number;
}> {
  console.log("\n=== Backfilling intake_chunks ===");
  let embedded = 0;
  let skipped = 0;
  let cursor: string | undefined = undefined;

  while (true) {
    const rows: { id: string; text: string }[] = await db.$queryRawUnsafe(
      `
      SELECT id, text
      FROM intake_chunks
      WHERE embedding IS NULL
        ${cursor ? `AND id > '${cursor}'` : ""}
      ORDER BY id ASC
      LIMIT ${BATCH_SIZE}
      `
    );
    if (rows.length === 0) break;

    const vectors = await embedBatch(rows.map((r) => r.text));
    for (let i = 0; i < rows.length; i++) {
      const v = vectors[i];
      if (!v) {
        skipped++;
        continue;
      }
      const literal = pgvectorLiteral(v);
      await db.$executeRaw`
        UPDATE intake_chunks
        SET embedding = ${literal}::vector
        WHERE id = ${rows[i]!.id}
      `;
      embedded++;
    }
    cursor = rows[rows.length - 1]!.id;
    console.log(
      `  batch done — total embedded: ${embedded}, skipped: ${skipped}`
    );
  }

  return { embedded, skipped };
}

async function backfillKnowledge(): Promise<{
  embedded: number;
  skipped: number;
}> {
  console.log("\n=== Backfilling workspace_knowledge ===");
  let embedded = 0;
  let skipped = 0;
  let cursor: string | undefined = undefined;

  while (true) {
    const rows: { id: string; subject: string; statement: string }[] =
      await db.$queryRawUnsafe(
        `
        SELECT id, subject, statement
        FROM workspace_knowledge
        WHERE embedding IS NULL
          AND "isActive" = true
          ${cursor ? `AND id > '${cursor}'` : ""}
        ORDER BY id ASC
        LIMIT ${BATCH_SIZE}
        `
      );
    if (rows.length === 0) break;

    const vectors = await embedBatch(
      rows.map((r) => `${r.subject}\n${r.statement}`)
    );
    for (let i = 0; i < rows.length; i++) {
      const v = vectors[i];
      if (!v) {
        skipped++;
        continue;
      }
      const literal = pgvectorLiteral(v);
      await db.$executeRaw`
        UPDATE workspace_knowledge
        SET embedding = ${literal}::vector
        WHERE id = ${rows[i]!.id}
      `;
      embedded++;
    }
    cursor = rows[rows.length - 1]!.id;
    console.log(
      `  batch done — total embedded: ${embedded}, skipped: ${skipped}`
    );
  }

  return { embedded, skipped };
}

async function main() {
  const arg = process.argv.find((a) => a.startsWith("--target="));
  const target = (arg?.split("=")[1] ?? "all") as Target | "all";

  if (!process.env.OPENAI_API_KEY) {
    console.error(
      "ERROR: OPENAI_API_KEY is not set. Backfill would no-op on every row. Aborting."
    );
    process.exit(1);
  }

  const start = Date.now();
  const results: Record<string, { embedded: number; skipped: number }> = {};

  try {
    if (target === "all" || target === "intake") {
      results.intake = await backfillIntakeChunks();
    }
    if (target === "all" || target === "knowledge") {
      // workspace_knowledge.embedding column is added in the
      // 20260420210000_knowledge_embeddings migration. If that hasn't
      // been applied yet, the query throws — catch and warn.
      try {
        results.knowledge = await backfillKnowledge();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("column") && msg.includes("embedding")) {
          console.warn(
            "\nSkipping workspace_knowledge — embedding column not yet added (run prisma migrate deploy first)."
          );
        } else {
          throw err;
        }
      }
    }
  } finally {
    await db.$disconnect();
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nDone in ${elapsed}s.`);
  for (const [name, r] of Object.entries(results)) {
    console.log(`  ${name}: embedded=${r.embedded}, skipped=${r.skipped}`);
  }
}

void main();
