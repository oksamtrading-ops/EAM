import "server-only";
import { db } from "@/server/db";

export type ResolvedAgentSettings = {
  maxToolIterations: number;
  subAgentBudget: number;
  llmMaxTokens: number;
  autoAcceptConfidence: number | null;
  criticEnabled: boolean;
  staleKnowledgeDays: number;
  monthlyAnthropicBudgetUsd: number | null;
};

/**
 * Hard-coded defaults, used when a workspace has no settings row.
 * These must match the original constants in agentLoop.ts and
 * subAgents.ts so behavior is identical for untouched workspaces.
 */
export const AGENT_SETTINGS_DEFAULTS: ResolvedAgentSettings = {
  maxToolIterations: 6,
  subAgentBudget: 3,
  llmMaxTokens: 1500,
  autoAcceptConfidence: null,
  criticEnabled: true,
  staleKnowledgeDays: 90,
  monthlyAnthropicBudgetUsd: null, // unlimited by default
};

/**
 * Load effective agent settings for a workspace. Returns defaults when
 * no row exists. Single query per run — callers should cache the result
 * in their own scope rather than re-calling per iteration.
 */
export async function loadAgentSettings(
  workspaceId: string
): Promise<ResolvedAgentSettings> {
  const row = await db.workspaceAgentSettings
    .findUnique({ where: { workspaceId } })
    .catch(() => null);
  if (!row) return AGENT_SETTINGS_DEFAULTS;
  return {
    maxToolIterations: row.maxToolIterations,
    subAgentBudget: row.subAgentBudget,
    llmMaxTokens: row.llmMaxTokens,
    autoAcceptConfidence: row.autoAcceptConfidence,
    criticEnabled: row.criticEnabled,
    staleKnowledgeDays: row.staleKnowledgeDays,
    monthlyAnthropicBudgetUsd:
      row.monthlyAnthropicBudgetUsd != null
        ? Number(row.monthlyAnthropicBudgetUsd)
        : null,
  };
}

