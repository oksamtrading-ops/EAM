import "server-only";
import { db } from "@/server/db";

export type KnowledgeItem = {
  id: string;
  kind: string;
  subject: string;
  statement: string;
  confidence: number;
};

/**
 * Keyword retrieval over WorkspaceKnowledge, workspace-scoped.
 * Returns the top-N active items ranked by hit count across subject +
 * statement. Used to inject relevant facts into the agent prompt so
 * the agent doesn't re-derive them every turn.
 */
export async function retrieveKnowledge(opts: {
  workspaceId: string;
  query: string;
  limit?: number;
}): Promise<KnowledgeItem[]> {
  const { workspaceId, query, limit = 5 } = opts;
  const tokens = tokenize(query);
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
    },
  });

  const scored = candidates
    .map((item) => {
      const lower = `${item.subject} ${item.statement}`.toLowerCase();
      const hits = tokens.reduce(
        (n, t) => (lower.includes(t.toLowerCase()) ? n + 1 : n),
        0
      );
      return { item, hits };
    })
    .filter((s) => s.hits > 0)
    .sort((a, b) => b.hits - a.hits || b.item.confidence - a.item.confidence)
    .slice(0, limit);

  return scored.map((s) => s.item);
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
