import "server-only";
import { db } from "@/server/db";
import { embedOne, pgvectorLiteral } from "@/server/ai/embeddings/openai";

/**
 * Cosine-distance threshold below which two facts are considered
 * near-duplicates. Tuned empirically — 0.15 rejects obvious paraphrases
 * (same subject + statement restated) but allows semantically related
 * but distinct facts through.
 */
const SIMILARITY_THRESHOLD = 0.15;

/**
 * Given a subject + statement from a new draft, return the id of the
 * closest existing WorkspaceKnowledge row in the workspace if any are
 * within SIMILARITY_THRESHOLD. Fail-open: returns null when embedding
 * isn't available (no API key, API error, etc.).
 */
export async function findSimilarKnowledge(opts: {
  workspaceId: string;
  subject: string;
  statement: string;
}): Promise<string | null> {
  const vec = await embedOne(`${opts.subject}\n${opts.statement}`).catch(
    () => null
  );
  if (!vec) return null;

  const literal = pgvectorLiteral(vec);
  const rows = await db.$queryRaw<{ id: string; distance: number }[]>`
    SELECT id, (embedding <=> ${literal}::vector) AS distance
    FROM workspace_knowledge
    WHERE "workspaceId" = ${opts.workspaceId}
      AND "isActive" = true
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${literal}::vector
    LIMIT 1
  `;
  const top = rows[0];
  if (!top) return null;
  return top.distance < SIMILARITY_THRESHOLD ? top.id : null;
}
