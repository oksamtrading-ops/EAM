import "server-only";
import { db } from "@/server/db";
import { embedBatch, embedOne, pgvectorLiteral } from "./openai";

/**
 * Embed a single WorkspaceKnowledge row. Called after create / update
 * when the subject or statement changes. Fire-and-forget pattern —
 * failure just leaves the row keyword-only until a later write or
 * explicit backfill.
 */
export async function embedKnowledgeRow(id: string): Promise<boolean> {
  const row = await db.workspaceKnowledge.findUnique({
    where: { id },
    select: { id: true, subject: true, statement: true },
  });
  if (!row) return false;

  const vec = await embedOne(`${row.subject}\n${row.statement}`);
  if (!vec) return false;

  const literal = pgvectorLiteral(vec);
  await db.$executeRaw`
    UPDATE workspace_knowledge
    SET embedding = ${literal}::vector
    WHERE id = ${row.id}
  `;
  return true;
}

/**
 * Backfill every WorkspaceKnowledge row in this workspace that doesn't
 * have an embedding yet. Idempotent.
 */
export async function embedWorkspaceKnowledge(workspaceId: string): Promise<{
  embedded: number;
  skipped: number;
}> {
  const rows = await db.$queryRaw<
    { id: string; subject: string; statement: string }[]
  >`
    SELECT id, subject, statement
    FROM workspace_knowledge
    WHERE "workspaceId" = ${workspaceId}
      AND "isActive" = true
      AND embedding IS NULL
  `;
  if (rows.length === 0) return { embedded: 0, skipped: 0 };

  const vectors = await embedBatch(
    rows.map((r) => `${r.subject}\n${r.statement}`)
  );

  let embedded = 0;
  let skipped = 0;
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
  return { embedded, skipped };
}
