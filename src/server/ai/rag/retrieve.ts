import "server-only";
import { db } from "@/server/db";
import { embedOne, pgvectorLiteral } from "@/server/ai/embeddings/openai";

export type RetrievedChunk = {
  chunkId: string;
  documentId: string;
  filename: string;
  ordinal: number;
  page: number | null;
  excerpt: string;
  matchRank: number;
  /** Source of the match: "semantic" = cosine distance; "keyword" = token-hit; "hybrid" = both. */
  matchType?: "semantic" | "keyword" | "hybrid";
};

/**
 * Hybrid retrieval over intake document chunks, workspace-scoped.
 *
 * Strategy:
 * - Always runs keyword scoring (token-hit count, case-insensitive).
 * - If an embedding for the query is available, also runs a pgvector
 *   cosine-distance search over chunks that have embeddings, then
 *   merges the two result sets (dedup by chunkId; semantic + keyword
 *   boost each other in ranking).
 * - Graceful degradation: if OPENAI_API_KEY is missing or an embedding
 *   fails, falls back to keyword-only. Same output shape either way.
 */
export async function retrieveIntakeChunks(opts: {
  workspaceId: string;
  query: string;
  limit?: number;
}): Promise<RetrievedChunk[]> {
  const { workspaceId, query, limit = 8 } = opts;
  const tokens = tokenize(query);

  const keywordResults = await keywordSearch(workspaceId, tokens, limit * 2);
  const semanticResults = await semanticSearch(workspaceId, query, limit * 2);

  // Merge: seen chunkIds get their scores blended. A chunk in both
  // lists ranks higher than one in either alone. We cap output at limit.
  const merged = new Map<string, RetrievedChunk>();
  for (const r of keywordResults) merged.set(r.chunkId, r);
  for (const r of semanticResults) {
    const existing = merged.get(r.chunkId);
    if (existing) {
      merged.set(r.chunkId, {
        ...existing,
        matchRank: existing.matchRank + r.matchRank,
        matchType: "hybrid",
      });
    } else {
      merged.set(r.chunkId, r);
    }
  }
  return Array.from(merged.values())
    .sort((a, b) => b.matchRank - a.matchRank)
    .slice(0, limit);
}

async function keywordSearch(
  workspaceId: string,
  tokens: string[],
  limit: number
): Promise<RetrievedChunk[]> {
  if (tokens.length === 0) return [];

  const firstToken = tokens[0]!;
  const candidates = await db.intakeChunk.findMany({
    where: {
      document: { workspaceId },
      text: { contains: firstToken, mode: "insensitive" },
    },
    select: {
      id: true,
      ordinal: true,
      page: true,
      text: true,
      document: { select: { id: true, filename: true } },
    },
    take: 200,
    orderBy: { ordinal: "asc" },
  });

  const scored = candidates
    .map((c) => {
      const lower = c.text.toLowerCase();
      const hits = tokens.reduce(
        (n, t) => (lower.includes(t.toLowerCase()) ? n + 1 : n),
        0
      );
      return { chunk: c, hits };
    })
    .filter((s) => s.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, limit);

  return scored.map(({ chunk, hits }) => ({
    chunkId: chunk.id,
    documentId: chunk.document.id,
    filename: chunk.document.filename,
    ordinal: chunk.ordinal,
    page: chunk.page,
    excerpt: excerptAround(chunk.text, tokens, 240),
    matchRank: hits,
    matchType: "keyword" as const,
  }));
}

type SemanticRow = {
  id: string;
  ordinal: number;
  page: number | null;
  text: string;
  documentId: string;
  filename: string;
  distance: number;
};

async function semanticSearch(
  workspaceId: string,
  query: string,
  limit: number
): Promise<RetrievedChunk[]> {
  const embedding = await embedOne(query).catch(() => null);
  if (!embedding) return [];

  const literal = pgvectorLiteral(embedding);

  // pgvector cosine distance: smaller = more similar (range 0..2).
  // We filter by workspaceId via the JOIN on intake_documents.
  const rows = await db.$queryRaw<SemanticRow[]>`
    SELECT
      c.id,
      c.ordinal,
      c.page,
      c.text,
      d.id AS "documentId",
      d.filename,
      (c.embedding <=> ${literal}::vector) AS distance
    FROM intake_chunks c
    INNER JOIN intake_documents d ON d.id = c."documentId"
    WHERE d."workspaceId" = ${workspaceId}
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> ${literal}::vector
    LIMIT ${limit}
  `;

  // Convert distance → rank: closer distance = higher rank.
  // Scale to roughly match keyword hit-count magnitudes (0-5) so merge
  // ranking gives reasonable blends when both hit. cosine distance 0
  // → rank 5; distance 1 → rank 0.
  return rows.map((r) => ({
    chunkId: r.id,
    documentId: r.documentId,
    filename: r.filename,
    ordinal: r.ordinal,
    page: r.page,
    excerpt: (r.text ?? "").slice(0, 240),
    matchRank: Math.max(0, 5 * (1 - Math.min(1, r.distance))),
    matchType: "semantic" as const,
  }));
}

function tokenize(query: string): string[] {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9]+/i)
        .map((t) => t.trim())
        .filter((t) => t.length >= 3 && !STOP_WORDS.has(t))
    )
  );
}

function excerptAround(
  text: string,
  tokens: string[],
  width: number
): string {
  const lower = text.toLowerCase();
  let best = 0;
  for (const t of tokens) {
    const idx = lower.indexOf(t.toLowerCase());
    if (idx >= 0) {
      best = Math.max(0, idx - Math.floor(width / 4));
      break;
    }
  }
  const snippet = text.slice(best, best + width).trim();
  const prefix = best > 0 ? "…" : "";
  const suffix = best + width < text.length ? "…" : "";
  return `${prefix}${snippet}${suffix}`;
}

const STOP_WORDS = new Set([
  "the", "and", "for", "that", "with", "this", "are", "was", "but",
  "our", "which", "have", "has", "had", "been", "about", "from",
]);
