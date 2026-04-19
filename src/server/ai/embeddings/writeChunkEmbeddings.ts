import "server-only";
import { db } from "@/server/db";
import { embedBatch, pgvectorLiteral } from "./openai";

/**
 * Embed the text of every IntakeChunk under this document and UPDATE
 * their `embedding` pgvector column. Silent no-op when OPENAI_API_KEY
 * is not configured — keyword retrieval still works unaffected.
 *
 * Called after chunks are inserted. Runs in a single batch, graceful
 * on partial failure (individual nulls are skipped).
 */
export async function embedIntakeChunks(documentId: string): Promise<{
  embedded: number;
  skipped: number;
}> {
  // Only rows that don't already have an embedding. Idempotent across
  // repeated distill / re-extract calls.
  const chunks = await db.$queryRaw<
    { id: string; text: string }[]
  >`
    SELECT id, text
    FROM intake_chunks
    WHERE "documentId" = ${documentId}
      AND embedding IS NULL
    ORDER BY ordinal ASC
  `;
  if (chunks.length === 0) return { embedded: 0, skipped: 0 };

  const vectors = await embedBatch(chunks.map((c) => c.text));

  let embedded = 0;
  let skipped = 0;
  for (let i = 0; i < chunks.length; i++) {
    const v = vectors[i];
    if (!v) {
      skipped++;
      continue;
    }
    const literal = pgvectorLiteral(v);
    await db.$executeRaw`
      UPDATE intake_chunks
      SET embedding = ${literal}::vector
      WHERE id = ${chunks[i]!.id}
    `;
    embedded++;
  }
  return { embedded, skipped };
}
