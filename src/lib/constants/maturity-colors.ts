export const MATURITY_COLORS: Record<string, string> = {
  OPTIMIZING: "#16a34a",   // green-600
  MANAGED: "#65a30d",      // lime-600
  DEFINED: "#ca8a04",      // yellow-600
  DEVELOPING: "#ea580c",   // orange-600
  INITIAL: "#dc2626",      // red-600
  NOT_ASSESSED: "#94a3b8", // slate-400
};

export const IMPORTANCE_COLORS: Record<string, string> = {
  CRITICAL: "#dc2626",     // red-600
  HIGH: "#ea580c",         // orange-600
  MEDIUM: "#ca8a04",       // yellow-600
  LOW: "#65a30d",          // lime-600
  NOT_ASSESSED: "#94a3b8", // slate-400
};

export const MATURITY_LABELS: Record<string, string> = {
  INITIAL: "1 - Initial",
  DEVELOPING: "2 - Developing",
  DEFINED: "3 - Defined",
  MANAGED: "4 - Managed",
  OPTIMIZING: "5 - Optimizing",
  NOT_ASSESSED: "Not Assessed",
};

export const MATURITY_NUMERIC: Record<string, number> = {
  INITIAL: 1,
  DEVELOPING: 2,
  DEFINED: 3,
  MANAGED: 4,
  OPTIMIZING: 5,
  NOT_ASSESSED: 0,
};

export const IMPORTANCE_LABELS: Record<string, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
  NOT_ASSESSED: "Not Assessed",
};

// ── Maturity Gap (target − current) ──────────────────────────────────────────
export const GAP_COLORS: Record<string, string> = {
  AHEAD:        "#16a34a",  // on target or ahead
  GAP_1:        "#ca8a04",  // 1 level behind
  GAP_2:        "#ea580c",  // 2 levels behind
  GAP_3:        "#dc2626",  // 3+ levels behind
  NOT_ASSESSED: "#94a3b8",
};

export const GAP_LABELS: Record<string, string> = {
  AHEAD:        "On / Ahead of target",
  GAP_1:        "1 level behind",
  GAP_2:        "2 levels behind",
  GAP_3:        "3+ levels behind",
  NOT_ASSESSED: "Not Assessed",
};

export function getGapColor(node: { currentMaturity: string; targetMaturity: string }): string {
  if (node.currentMaturity === "NOT_ASSESSED" || node.targetMaturity === "NOT_ASSESSED") {
    return GAP_COLORS.NOT_ASSESSED;
  }
  const gap =
    (MATURITY_NUMERIC[node.targetMaturity] ?? 0) -
    (MATURITY_NUMERIC[node.currentMaturity] ?? 0);
  if (gap <= 0) return GAP_COLORS.AHEAD;
  if (gap === 1) return GAP_COLORS.GAP_1;
  if (gap === 2) return GAP_COLORS.GAP_2;
  return GAP_COLORS.GAP_3;
}

// ── Owner (deterministic colour from ownerId) ─────────────────────────────────
const OWNER_PALETTE = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#0ea5e9", "#f97316", "#14b8a6",
];

export function getOwnerColor(ownerId: string | null | undefined): string {
  if (!ownerId) return "#94a3b8";
  let h = 0;
  for (let i = 0; i < ownerId.length; i++) {
    h = (h * 31 + ownerId.charCodeAt(i)) & 0xffff;
  }
  return OWNER_PALETTE[h % OWNER_PALETTE.length];
}
