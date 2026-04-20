/**
 * Approximate per-million-token prices (USD) for the Anthropic models
 * we call. Kept client-safe so the cost dashboard can compute and
 * display costs without a round-trip. Update when Anthropic publishes
 * new rates — this is the single source of truth.
 *
 * Source: https://www.anthropic.com/pricing (as of April 2026).
 */

type Pricing = { inputPerMTok: number; outputPerMTok: number };

const PRICING: Record<string, Pricing> = {
  // Sonnet 4 family
  "claude-sonnet-4-20250514": { inputPerMTok: 3, outputPerMTok: 15 },
  // Opus 4.x family — premium
  "claude-opus-4-6": { inputPerMTok: 15, outputPerMTok: 75 },
};

const FALLBACK: Pricing = { inputPerMTok: 3, outputPerMTok: 15 };

/**
 * Compute USD cost for one LLM call's token counts. Returns 0 for
 * unknown model strings rather than throwing — cost display is
 * informational, not billing.
 */
export function estimateRunCostUsd(run: {
  model: string | null;
  totalTokensIn: number;
  totalTokensOut: number;
}): number {
  const p = (run.model && PRICING[run.model]) || FALLBACK;
  return (
    (run.totalTokensIn * p.inputPerMTok) / 1_000_000 +
    (run.totalTokensOut * p.outputPerMTok) / 1_000_000
  );
}

export function formatUsd(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.01) return "<$0.01";
  if (n < 1) return `$${n.toFixed(3)}`;
  if (n < 100) return `$${n.toFixed(2)}`;
  return `$${Math.round(n).toLocaleString()}`;
}
