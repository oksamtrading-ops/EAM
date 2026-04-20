/**
 * Pure helpers for knowledge freshness. Safe to import from client and
 * server — no DB or server-only imports.
 *
 * A fact is "stale" when its most-recent-touch timestamp
 * (`lastReviewedAt` when set, else `updatedAt`) is older than
 * `staleKnowledgeDays` days ago. This is used to:
 *   - Flag rows in the knowledge UI with a Stale badge.
 *   - Decay the retrieval rank in `retrieveKnowledge` so older facts
 *     still surface but lose ground to fresher ones.
 */

export function knowledgeAgeDays(row: {
  updatedAt: Date | string;
  lastReviewedAt: Date | string | null;
}): number {
  const anchor = row.lastReviewedAt ?? row.updatedAt;
  const anchorMs =
    typeof anchor === "string" ? new Date(anchor).getTime() : anchor.getTime();
  return (Date.now() - anchorMs) / (1000 * 60 * 60 * 24);
}

export function isKnowledgeStale(
  row: { updatedAt: Date | string; lastReviewedAt: Date | string | null },
  staleKnowledgeDays: number
): boolean {
  return knowledgeAgeDays(row) > staleKnowledgeDays;
}

/**
 * Age-decay factor for retrieval ranking. Returns 1 for a freshly
 * reviewed fact, approaches 0 for very old ones. Half-life = one full
 * stale window (so a fact exactly at the threshold still ranks at
 * ~0.5x weight, not 0 — avoids hard cliffs).
 */
export function freshnessWeight(
  ageDays: number,
  staleKnowledgeDays: number
): number {
  if (!Number.isFinite(ageDays) || ageDays <= 0) return 1;
  if (staleKnowledgeDays <= 0) return 1;
  return Math.exp(-ageDays / staleKnowledgeDays);
}
