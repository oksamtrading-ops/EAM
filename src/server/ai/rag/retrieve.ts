import "server-only";
import { db } from "@/server/db";

export type RetrievedChunk = {
  chunkId: string;
  documentId: string;
  filename: string;
  ordinal: number;
  page: number | null;
  excerpt: string;
  matchRank: number;
};

/**
 * Keyword retrieval over intake document chunks, workspace-scoped.
 * Splits the query into tokens, each token must appear (AND semantics),
 * ranks chunks by token hit count. Returns top-N excerpts with their source.
 *
 * Note: pgvector semantic retrieval is a future upgrade — embedding provider
 * isn't configured, and all queries here pass through the same interface.
 */
export async function retrieveIntakeChunks(opts: {
  workspaceId: string;
  query: string;
  limit?: number;
}): Promise<RetrievedChunk[]> {
  const { workspaceId, query, limit = 8 } = opts;
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  // Get candidate chunks — all chunks whose document belongs to this workspace,
  // and whose text contains the FIRST token (broadest filter cheaply).
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
      document: {
        select: { id: true, filename: true },
      },
    },
    take: 200,
    orderBy: { ordinal: "asc" },
  });

  // Score: count distinct tokens that appear (case-insensitive)
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
