import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Compute deterministic Capability Maturity Assessment metrics
 * for a workspace. Shared between the
 * `capability.getMaturityMetrics` tRPC procedure and the
 * `/api/export/deliverable-docx` route's capability-maturity
 * branch. Single source of truth for the deliverable's
 * capability-grounded analysis.
 *
 * v1 deliberately drops investment-cost claims. The deliverable's
 * currency is gap-levels + sequencing, not money. Methodology
 * documents this trade-off explicitly.
 */

const MATURITY_LEVELS = [
  "INITIAL",
  "DEVELOPING",
  "DEFINED",
  "MANAGED",
  "OPTIMIZING",
  "NOT_ASSESSED",
] as const;
type MaturityLevel = (typeof MATURITY_LEVELS)[number];

const STRATEGIC_IMPORTANCE_LEVELS = [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
  "NOT_ASSESSED",
] as const;
type StrategicImportance = (typeof STRATEGIC_IMPORTANCE_LEVELS)[number];

/** Numeric scale used for weighted-mean calculations. NOT_ASSESSED
 *  intentionally excluded from means (capability is unknown, not
 *  a 0). */
const MATURITY_NUMERIC: Record<string, number | null> = {
  INITIAL: 1,
  DEVELOPING: 2,
  DEFINED: 3,
  MANAGED: 4,
  OPTIMIZING: 5,
  NOT_ASSESSED: null,
};

const IMPORTANCE_WEIGHT: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  NOT_ASSESSED: 0,
};

export type CapabilitySummary = {
  id: string;
  name: string;
  level: string; // L1 | L2 | L3
  parentId: string | null;
  parentName: string | null;
  l1Id: string;
  l1Name: string;
  strategicImportance: string;
  currentMaturity: string;
  targetMaturity: string;
  /** Maturity gap in numeric levels (target - current). Null when
   *  either side is NOT_ASSESSED. Negative values possible (current
   *  exceeds target — invest-beyond-target candidate). */
  gapLevels: number | null;
  appsMappedCount: number;
  appsMapped: Array<{
    name: string;
    rationalizationStatus: string | null;
    lifecycle: string;
  }>;
  hasBusinessOwner: boolean;
  hasItOwner: boolean;
};

export type CapabilityWithGap = CapabilitySummary & {
  /** Composite priority weight: gapLevels × importance × log(1 + appCount).
   *  Used to rank deep-dive candidates and Wave-1 placement. */
  priorityWeight: number;
};

export type ImportanceMaturityMatrixCell = {
  importance: string;
  maturity: string;
  count: number;
  topCapabilities: string[];
};

export type L1Rollup = {
  l1Id: string;
  l1Name: string;
  childCount: number;
  byMaturity: Record<string, number>; // count per maturity level
  /** Weighted mean current maturity (1-5 scale; excludes NOT_ASSESSED). */
  currentMean: number;
  /** Weighted mean target maturity (1-5 scale; excludes NOT_ASSESSED). */
  targetMean: number;
  /** Sum of positive gap-levels across all children (negative gaps
   *  excluded — "invest-beyond-target" handled in its own band). */
  totalGapLevels: number;
  /** Capabilities at NOT_ASSESSED on either current or target. */
  unassessedCount: number;
};

export type CapabilityMaturityMetrics = {
  totalCapabilities: number;
  byLevel: Record<"L1" | "L2" | "L3", number>;
  byCurrentMaturity: Record<string, number>;
  byTargetMaturity: Record<string, number>;
  byStrategicImportance: Record<string, number>;

  /** Sparse 5×6 matrix used by the importance × maturity heatmap. */
  importanceMaturityMatrix: ImportanceMaturityMatrixCell[];

  /** L1 capability domain rollups for the L1 heatmap chart. */
  l1Rollups: L1Rollup[];

  /** Action-class bands. Each band contains capabilities matching
   *  its action criteria. Used by buildCapabilityMaturityDocx to
   *  render per-band narrative sections. */
  bands: {
    /** current < target AND importance ∈ {CRITICAL, HIGH}. The
     *  investment thesis lives here. */
    liftToTarget: CapabilityWithGap[];
    /** current == target. No action; steady-state. */
    sustainAtTarget: CapabilityWithGap[];
    /** current == target BUT target should move up given importance.
     *  Lead-the-industry candidates. v1: capabilities at
     *  CRITICAL/HIGH importance with current=target=MANAGED — the
     *  natural place to push to OPTIMIZING. */
    investBeyondTarget: CapabilityWithGap[];
    /** Over-served: current > target OR (current=target=OPTIMIZING
     *  AND importance ∈ LOW). The Reassess Strategy band. */
    reassessStrategy: CapabilityWithGap[];
    /** Coverage gap: current=NOT_ASSESSED OR target=NOT_ASSESSED. */
    notAssessed: CapabilityWithGap[];
  };

  /** Top-N by composite priority weight for per-capability deep
   *  dives. Top 5 default; caller decides how many to render. */
  topGapsByImpact: CapabilityWithGap[];

  /** % of active capabilities with assessment coverage on BOTH
   *  current and target maturity. <0.6 forks to Baseline Report. */
  assessmentCoverageRatio: number;

  /** Top L1 with the highest unassessed count + share — drives
   *  the workspace-specific risk row. */
  topUnassessedL1: { l1Id: string; l1Name: string; unassessedCount: number; unassessedShare: number } | null;

  /** Workspace-specific risk signals. Surface above the canonical
   *  7 in the deliverable's risks table. */
  workspaceSpecificRisks: {
    criticalAtInitialOrDeveloping: { count: number; capabilities: string[] };
    capabilitiesWithoutOwners: { count: number; capabilities: string[] };
    topUnassessedL1: { l1Name: string; share: number } | null;
  };
};

export async function computeCapabilityMaturityMetrics(
  db: PrismaClient,
  workspaceId: string
): Promise<CapabilityMaturityMetrics> {
  const caps = await db.businessCapability.findMany({
    where: { workspaceId, isActive: true },
    select: {
      id: true,
      name: true,
      level: true,
      parentId: true,
      strategicImportance: true,
      currentMaturity: true,
      targetMaturity: true,
      businessOwnerId: true,
      itOwnerId: true,
      applicationMappings: {
        select: {
          application: {
            select: {
              name: true,
              rationalizationStatus: true,
              lifecycle: true,
              isActive: true,
            },
          },
        },
      },
    },
  });

  // Build name lookup + parent resolution.
  const nameMap = new Map<string, string>();
  const parentMap = new Map<string, string | null>();
  for (const c of caps) {
    nameMap.set(c.id, c.name);
    parentMap.set(c.id, c.parentId);
  }

  // Resolve L1 ancestor for each capability.
  function resolveL1(id: string): { l1Id: string; l1Name: string } {
    let cursor: string | null = id;
    let last: string = id;
    while (cursor) {
      last = cursor;
      const parent: string | null = parentMap.get(cursor) ?? null;
      if (!parent) break;
      cursor = parent;
    }
    return { l1Id: last, l1Name: nameMap.get(last) ?? "—" };
  }

  // Build CapabilitySummary[] for all active capabilities.
  const summaries: CapabilitySummary[] = caps.map((c) => {
    const { l1Id, l1Name } = resolveL1(c.id);
    const parentName = c.parentId ? nameMap.get(c.parentId) ?? null : null;
    const current = c.currentMaturity;
    const target = c.targetMaturity;
    const currentNum = MATURITY_NUMERIC[current];
    const targetNum = MATURITY_NUMERIC[target];
    const gapLevels =
      currentNum !== null && targetNum !== null
        ? targetNum - currentNum
        : null;
    const appsMapped = c.applicationMappings
      .filter((m) => m.application?.isActive)
      .map((m) => ({
        name: m.application!.name,
        rationalizationStatus: m.application!.rationalizationStatus,
        lifecycle: m.application!.lifecycle,
      }));
    return {
      id: c.id,
      name: c.name,
      level: c.level,
      parentId: c.parentId,
      parentName,
      l1Id,
      l1Name,
      strategicImportance: c.strategicImportance,
      currentMaturity: c.currentMaturity,
      targetMaturity: c.targetMaturity,
      gapLevels,
      appsMappedCount: appsMapped.length,
      appsMapped,
      hasBusinessOwner: !!c.businessOwnerId,
      hasItOwner: !!c.itOwnerId,
    };
  });

  // Counts.
  const byLevel: Record<"L1" | "L2" | "L3", number> = { L1: 0, L2: 0, L3: 0 };
  const byCurrentMaturity: Record<string, number> = {};
  const byTargetMaturity: Record<string, number> = {};
  const byStrategicImportance: Record<string, number> = {};
  for (const lvl of MATURITY_LEVELS) {
    byCurrentMaturity[lvl] = 0;
    byTargetMaturity[lvl] = 0;
  }
  for (const imp of STRATEGIC_IMPORTANCE_LEVELS) {
    byStrategicImportance[imp] = 0;
  }
  for (const s of summaries) {
    if (s.level === "L1") byLevel.L1++;
    else if (s.level === "L2") byLevel.L2++;
    else if (s.level === "L3") byLevel.L3++;
    byCurrentMaturity[s.currentMaturity] =
      (byCurrentMaturity[s.currentMaturity] ?? 0) + 1;
    byTargetMaturity[s.targetMaturity] =
      (byTargetMaturity[s.targetMaturity] ?? 0) + 1;
    byStrategicImportance[s.strategicImportance] =
      (byStrategicImportance[s.strategicImportance] ?? 0) + 1;
  }

  // Importance × maturity matrix.
  const matrixMap = new Map<string, CapabilitySummary[]>();
  for (const s of summaries) {
    const key = `${s.strategicImportance}:${s.currentMaturity}`;
    const cur = matrixMap.get(key) ?? [];
    cur.push(s);
    matrixMap.set(key, cur);
  }
  const importanceMaturityMatrix: ImportanceMaturityMatrixCell[] = [];
  for (const imp of STRATEGIC_IMPORTANCE_LEVELS) {
    for (const mat of MATURITY_LEVELS) {
      const cell = matrixMap.get(`${imp}:${mat}`) ?? [];
      if (cell.length === 0) continue;
      const topCapabilities = cell
        .slice()
        .sort((a, b) => b.appsMappedCount - a.appsMappedCount)
        .slice(0, 3)
        .map((c) => c.name);
      importanceMaturityMatrix.push({
        importance: imp,
        maturity: mat,
        count: cell.length,
        topCapabilities,
      });
    }
  }

  // L1 rollups.
  const l1Map = new Map<string, CapabilitySummary[]>();
  for (const s of summaries) {
    if (s.level === "L1") continue; // L1s are containers; rollup from children
    const cur = l1Map.get(s.l1Id) ?? [];
    cur.push(s);
    l1Map.set(s.l1Id, cur);
  }
  const l1Rollups: L1Rollup[] = [];
  for (const [l1Id, children] of l1Map.entries()) {
    const l1Name = nameMap.get(l1Id) ?? "—";
    const byMaturity: Record<string, number> = {};
    for (const lvl of MATURITY_LEVELS) byMaturity[lvl] = 0;
    let curSum = 0,
      curCount = 0,
      tgtSum = 0,
      tgtCount = 0;
    let totalGap = 0;
    let unassessed = 0;
    for (const c of children) {
      byMaturity[c.currentMaturity] = (byMaturity[c.currentMaturity] ?? 0) + 1;
      const cn = MATURITY_NUMERIC[c.currentMaturity];
      const tn = MATURITY_NUMERIC[c.targetMaturity];
      if (cn !== null) {
        curSum += cn;
        curCount++;
      }
      if (tn !== null) {
        tgtSum += tn;
        tgtCount++;
      }
      if (c.gapLevels !== null && c.gapLevels > 0) totalGap += c.gapLevels;
      if (c.currentMaturity === "NOT_ASSESSED" || c.targetMaturity === "NOT_ASSESSED")
        unassessed++;
    }
    l1Rollups.push({
      l1Id,
      l1Name,
      childCount: children.length,
      byMaturity,
      currentMean: curCount > 0 ? curSum / curCount : 0,
      targetMean: tgtCount > 0 ? tgtSum / tgtCount : 0,
      totalGapLevels: totalGap,
      unassessedCount: unassessed,
    });
  }
  l1Rollups.sort((a, b) => b.totalGapLevels - a.totalGapLevels);

  // Action-class bands.
  const liftToTarget: CapabilityWithGap[] = [];
  const sustainAtTarget: CapabilityWithGap[] = [];
  const investBeyondTarget: CapabilityWithGap[] = [];
  const reassessStrategy: CapabilityWithGap[] = [];
  const notAssessed: CapabilityWithGap[] = [];
  for (const s of summaries) {
    const importanceWeight = IMPORTANCE_WEIGHT[s.strategicImportance] ?? 0;
    const gapAbs = s.gapLevels !== null ? Math.abs(s.gapLevels) : 0;
    const priorityWeight =
      gapAbs * importanceWeight * (1 + Math.log10(1 + s.appsMappedCount));
    const withGap: CapabilityWithGap = { ...s, priorityWeight };

    // Coverage gap takes precedence
    if (s.currentMaturity === "NOT_ASSESSED" || s.targetMaturity === "NOT_ASSESSED") {
      notAssessed.push(withGap);
      continue;
    }
    if (s.gapLevels === null) continue; // shouldn't happen given the check above

    // Reassess: over-served. current > target OR (current=target=OPTIMIZING with LOW)
    if (
      s.gapLevels < 0 ||
      (s.currentMaturity === "OPTIMIZING" &&
        s.targetMaturity === "OPTIMIZING" &&
        s.strategicImportance === "LOW")
    ) {
      reassessStrategy.push(withGap);
      continue;
    }

    if (s.gapLevels === 0) {
      // current == target. Either sustain or invest-beyond-target.
      // Invest-beyond candidates: CRITICAL or HIGH importance, currently at MANAGED
      // (room to push to OPTIMIZING).
      if (
        (s.strategicImportance === "CRITICAL" ||
          s.strategicImportance === "HIGH") &&
        s.currentMaturity === "MANAGED"
      ) {
        investBeyondTarget.push(withGap);
      } else {
        sustainAtTarget.push(withGap);
      }
      continue;
    }

    // gapLevels > 0: lift candidates. Lift-to-target reserved for
    // CRITICAL/HIGH importance — the investment thesis. Lower-
    // importance lifts go to sustain (acknowledged but de-prioritized).
    if (
      s.strategicImportance === "CRITICAL" ||
      s.strategicImportance === "HIGH"
    ) {
      liftToTarget.push(withGap);
    } else {
      sustainAtTarget.push(withGap);
    }
  }
  // Sort each band by priority weight desc.
  for (const arr of [liftToTarget, sustainAtTarget, investBeyondTarget, reassessStrategy, notAssessed]) {
    arr.sort((a, b) => b.priorityWeight - a.priorityWeight);
  }

  // Top-N by impact: lift-to-target leaders + reassess outliers.
  const topGapsByImpact = [...liftToTarget, ...reassessStrategy]
    .sort((a, b) => b.priorityWeight - a.priorityWeight)
    .slice(0, 5);

  // Assessment coverage ratio.
  const fullyAssessed = summaries.filter(
    (s) =>
      s.currentMaturity !== "NOT_ASSESSED" &&
      s.targetMaturity !== "NOT_ASSESSED"
  ).length;
  const assessmentCoverageRatio =
    summaries.length > 0 ? fullyAssessed / summaries.length : 0;

  // Top unassessed L1.
  let topUnassessedL1: CapabilityMaturityMetrics["topUnassessedL1"] = null;
  let bestShare = 0;
  for (const r of l1Rollups) {
    if (r.childCount === 0) continue;
    const share = r.unassessedCount / r.childCount;
    if (share > bestShare && r.unassessedCount >= 2) {
      bestShare = share;
      topUnassessedL1 = {
        l1Id: r.l1Id,
        l1Name: r.l1Name,
        unassessedCount: r.unassessedCount,
        unassessedShare: share,
      };
    }
  }

  // Workspace-specific risks.
  const criticalAtInitialOrDeveloping = summaries.filter(
    (s) =>
      s.strategicImportance === "CRITICAL" &&
      (s.currentMaturity === "INITIAL" || s.currentMaturity === "DEVELOPING")
  );
  const capabilitiesWithoutOwners = summaries.filter(
    (s) => !s.hasBusinessOwner || !s.hasItOwner
  );

  const workspaceSpecificRisks = {
    criticalAtInitialOrDeveloping: {
      count: criticalAtInitialOrDeveloping.length,
      capabilities: criticalAtInitialOrDeveloping.slice(0, 5).map((c) => c.name),
    },
    capabilitiesWithoutOwners: {
      count: capabilitiesWithoutOwners.length,
      capabilities: capabilitiesWithoutOwners.slice(0, 5).map((c) => c.name),
    },
    topUnassessedL1: topUnassessedL1
      ? {
          l1Name: topUnassessedL1.l1Name,
          share: topUnassessedL1.unassessedShare,
        }
      : null,
  };

  return {
    totalCapabilities: summaries.length,
    byLevel,
    byCurrentMaturity,
    byTargetMaturity,
    byStrategicImportance,
    importanceMaturityMatrix,
    l1Rollups,
    bands: {
      liftToTarget,
      sustainAtTarget,
      investBeyondTarget,
      reassessStrategy,
      notAssessed,
    },
    topGapsByImpact,
    assessmentCoverageRatio,
    topUnassessedL1,
    workspaceSpecificRisks,
  };
}
