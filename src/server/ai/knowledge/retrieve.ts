import "server-only";
import { db } from "@/server/db";
import { embedOne, pgvectorLiteral } from "@/server/ai/embeddings/openai";
import { loadAgentSettings } from "@/server/ai/settings";
import {
  knowledgeAgeDays,
  freshnessWeight,
} from "@/lib/utils/knowledgeFreshness";

export type KnowledgeItem = {
  id: string;
  kind: string;
  subject: string;
  statement: string;
  confidence: number;
};

// Internal rank carrier. Keeps the freshness anchor alongside the item
// without leaking it to callers of retrieveKnowledge.
type Ranked = {
  item: KnowledgeItem;
  rank: number;
  freshness?: { updatedAt: Date | string; lastReviewedAt: Date | string | null };
};

/**
 * Hybrid retrieval over WorkspaceKnowledge, workspace-scoped.
 * Keyword (token-hit) + semantic (cosine distance) with merge-by-id.
 * Graceful fallback to keyword-only when OPENAI_API_KEY isn't set.
 */
export async function retrieveKnowledge(opts: {
  workspaceId: string;
  query: string;
  limit?: number;
}): Promise<KnowledgeItem[]> {
  const { workspaceId, query, limit = 5 } = opts;
  const tokens = tokenize(query);

  // Load the freshness window so we can decay older facts. Parallelize
  // with the actual search — these are independent queries.
  const [settings, keywordHits, semanticHits] = await Promise.all([
    loadAgentSettings(workspaceId),
    keywordSearch(workspaceId, tokens, limit * 2),
    semanticSearch(workspaceId, query, limit * 2),
  ]);
  const staleWindow = settings.staleKnowledgeDays;

  // Merge by id. A fact found by both ranks higher than one in either
  // alone; rank is blended sum so semantic precision lifts keyword recall.
  // Preserve whichever freshness anchor arrived first — both searches
  // fetch the same columns so they agree.
  const merged = new Map<string, Ranked>();
  for (const r of keywordHits) merged.set(r.item.id, r);
  for (const r of semanticHits) {
    const existing = merged.get(r.item.id);
    if (existing) {
      existing.rank += r.rank;
      existing.freshness ??= r.freshness;
    } else {
      merged.set(r.item.id, r);
    }
  }

  // Age decay: multiply each blended rank by a freshness factor so
  // older facts drop below fresher ones of equal lexical/semantic
  // strength. Continuous — never zeroes a fact out.
  for (const entry of merged.values()) {
    if (entry.freshness) {
      const age = knowledgeAgeDays(entry.freshness);
      entry.rank *= freshnessWeight(age, staleWindow);
    }
  }

  return Array.from(merged.values())
    .sort((a, b) => b.rank - a.rank)
    .slice(0, limit)
    .map((r) => r.item);
}

async function keywordSearch(
  workspaceId: string,
  tokens: string[],
  limit: number
): Promise<Ranked[]> {
  if (tokens.length === 0) return [];

  const firstToken = tokens[0]!;
  const candidates = await db.workspaceKnowledge.findMany({
    where: {
      workspaceId,
      isActive: true,
      OR: [
        { subject: { contains: firstToken, mode: "insensitive" } },
        { statement: { contains: firstToken, mode: "insensitive" } },
      ],
    },
    take: 100,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      kind: true,
      subject: true,
      statement: true,
      confidence: true,
      updatedAt: true,
      lastReviewedAt: true,
    },
  });

  return candidates
    .map((row): Ranked => {
      const lower = `${row.subject} ${row.statement}`.toLowerCase();
      const hits = tokens.reduce(
        (n, t) => (lower.includes(t.toLowerCase()) ? n + 1 : n),
        0
      );
      return {
        item: {
          id: row.id,
          kind: row.kind,
          subject: row.subject,
          statement: row.statement,
          confidence: row.confidence,
        },
        rank: hits,
        freshness: {
          updatedAt: row.updatedAt,
          lastReviewedAt: row.lastReviewedAt,
        },
      };
    })
    .filter((r) => r.rank > 0)
    .sort((a, b) => b.rank - a.rank || b.item.confidence - a.item.confidence)
    .slice(0, limit);
}

type SemanticRow = {
  id: string;
  kind: string;
  subject: string;
  statement: string;
  confidence: number;
  distance: number;
  updatedAt: Date;
  lastReviewedAt: Date | null;
};

async function semanticSearch(
  workspaceId: string,
  query: string,
  limit: number
): Promise<Ranked[]> {
  const vec = await embedOne(query).catch(() => null);
  if (!vec) return [];

  const literal = pgvectorLiteral(vec);
  const rows = await db.$queryRaw<SemanticRow[]>`
    SELECT
      id,
      kind::text AS kind,
      subject,
      statement,
      confidence,
      "updatedAt",
      "lastReviewedAt",
      (embedding <=> ${literal}::vector) AS distance
    FROM workspace_knowledge
    WHERE "workspaceId" = ${workspaceId}
      AND "isActive" = true
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${literal}::vector
    LIMIT ${limit}
  `;

  // cosine distance 0 = identical → rank 5; distance ≥ 1 → rank 0.
  return rows.map((r): Ranked => ({
    item: {
      id: r.id,
      kind: r.kind,
      subject: r.subject,
      statement: r.statement,
      confidence: r.confidence,
    },
    rank: Math.max(0, 5 * (1 - Math.min(1, r.distance))),
    freshness: {
      updatedAt: r.updatedAt,
      lastReviewedAt: r.lastReviewedAt,
    },
  }));
}

export function formatKnowledgeForPrompt(items: KnowledgeItem[]): string {
  if (items.length === 0) return "";
  const lines: string[] = [
    "## WORKSPACE KNOWLEDGE (curated facts; treat as high-confidence context)",
    "",
  ];
  for (const it of items) {
    lines.push(`- [${it.kind}] ${it.subject}: ${it.statement}`);
  }
  lines.push("");
  return lines.join("\n");
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

const STOP_WORDS = new Set([
  "the", "and", "for", "that", "with", "this", "are", "was", "but",
  "our", "which", "have", "has", "had", "been", "about", "from",
]);
