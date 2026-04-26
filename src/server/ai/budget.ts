import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { estimateRunCostUsd } from "@/lib/utils/agentPricing";

/**
 * Per-workspace Anthropic monthly budget gate.
 *
 * Trade-off: no in-memory cache. Each iteration runs one SUM aggregate
 * — microseconds vs the multi-second Anthropic round-trip the gate is
 * protecting. Caching across serverless replicas was a footgun (each
 * replica had its own copy → racy budget enforcement).
 *
 * Race acknowledgment: concurrent runs across replicas can each pass
 * the gate before either commits its run cost, exceeding the cap by
 * roughly one iteration's spend per concurrent run (~$0.05). The cap
 * is a backstop, not a fence. Transactional reservation accounting
 * is week-2+ scope.
 *
 * Kill-switch: AGENT_BUDGET_ENFORCE=0 short-circuits the gate.
 */

export type BudgetCheck =
  | { ok: true; spentUsd: number; capUsd: number | null }
  | { ok: false; spentUsd: number; capUsd: number };

export async function checkBudget(
  db: PrismaClient,
  workspaceId: string
): Promise<BudgetCheck> {
  if (process.env.AGENT_BUDGET_ENFORCE === "0") {
    return { ok: true, spentUsd: 0, capUsd: null };
  }

  const settings = await db.workspaceAgentSettings.findUnique({
    where: { workspaceId },
    select: { monthlyAnthropicBudgetUsd: true },
  });
  const cap = settings?.monthlyAnthropicBudgetUsd
    ? Number(settings.monthlyAnthropicBudgetUsd)
    : null;
  if (cap === null) return { ok: true, spentUsd: 0, capUsd: null };

  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const runs = await db.agentRun.findMany({
    where: { workspaceId, startedAt: { gte: since } },
    select: { model: true, totalTokensIn: true, totalTokensOut: true },
  });
  const spent = runs.reduce(
    (s, r) =>
      s +
      estimateRunCostUsd({
        model: r.model,
        totalTokensIn: r.totalTokensIn,
        totalTokensOut: r.totalTokensOut,
      }),
    0
  );

  return spent >= cap
    ? { ok: false, spentUsd: spent, capUsd: cap }
    : { ok: true, spentUsd: spent, capUsd: cap };
}
