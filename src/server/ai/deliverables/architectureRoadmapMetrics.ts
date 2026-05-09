import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Compute deterministic Architecture Roadmap metrics for a
 * workspace. Shared between the route handler for
 * `type=architecture-roadmap` and the upcoming
 * `initiative.getRoadmapMetrics` tRPC procedure. Single source of
 * truth for the deliverable's analytical layer.
 *
 * v1 deliberately drops investment-cost claims, mirroring the
 * Capability Maturity Assessment v1 discipline. Per-initiative
 * `budgetUsd` exists in schema but is typically rough or absent
 * on first run; citing it would invite the same credibility-kill
 * as the maturity v1 cost claim. Currency for v1 is initiative
 * count × wave × dependency coverage. Methodology callout makes
 * the trade-off explicit.
 */

// ─── Source enums (mirror prisma/schema.prisma) ────────────────

export const ROADMAP_HORIZONS = ["H1_NOW", "H2_NEXT", "H3_LATER", "BEYOND"] as const;
export type RoadmapHorizon = (typeof ROADMAP_HORIZONS)[number];

export const INITIATIVE_STATUSES = [
  "DRAFT",
  "PLANNED",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETE",
  "CANCELLED",
] as const;
export type InitiativeStatus = (typeof INITIATIVE_STATUSES)[number];

export const INITIATIVE_PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
export type InitiativePriority = (typeof INITIATIVE_PRIORITIES)[number];

export const INITIATIVE_CATEGORIES = [
  "MODERNISATION",
  "CONSOLIDATION",
  "DIGITALISATION",
  "COMPLIANCE",
  "OPTIMISATION",
  "INNOVATION",
  "DECOMMISSION",
] as const;
export type InitiativeCategory = (typeof INITIATIVE_CATEGORIES)[number];

export const RAG_STATUSES = ["GREEN", "AMBER", "RED"] as const;
export type RagStatus = (typeof RAG_STATUSES)[number];

/** Wave label for prose + charts. Maps RoadmapHorizon →
 *  human-readable bucket; H1_NOW → NOW, H2_NEXT → NEXT,
 *  H3_LATER → LATER. BEYOND collapses to LATER for v1
 *  (the deliverable horizon caps at 36 months). */
export type WaveLabel = "NOW" | "NEXT" | "LATER";

const HORIZON_TO_WAVE: Record<RoadmapHorizon, WaveLabel> = {
  H1_NOW: "NOW",
  H2_NEXT: "NEXT",
  H3_LATER: "LATER",
  BEYOND: "LATER",
};

// ─── Output types ──────────────────────────────────────────────

export type LinkedApplication = {
  id: string;
  name: string;
  rationalizationStatus: string | null;
  lifecycle: string;
};

export type LinkedCapability = {
  id: string;
  name: string;
  l1Name: string;
  strategicImportance: string;
  currentMaturity: string;
  targetMaturity: string;
};

export type DependencyEdge = {
  initiativeId: string;
  initiativeName: string;
  edgeType: "depends-on" | "blocked-by";
};

export type InitiativeSummary = {
  id: string;
  name: string;
  description: string | null;
  category: InitiativeCategory;
  status: InitiativeStatus;
  priority: InitiativePriority;
  horizon: RoadmapHorizon;
  wave: WaveLabel;
  ragStatus: RagStatus;
  progressPct: number;
  startDate: Date | null;
  endDate: Date | null;
  hasOwner: boolean;
  hasSponsor: boolean;
  /** Number of linked applications (cross-deliverable bridge). */
  appsLinkedCount: number;
  /** Linked applications with TIME disposition + lifecycle. */
  appsLinked: LinkedApplication[];
  /** Number of linked capabilities (cross-deliverable bridge). */
  capabilitiesLinkedCount: number;
  /** Linked capabilities with maturity progression. */
  capabilitiesLinked: LinkedCapability[];
  /** Initiatives this one depends on. */
  dependsOn: DependencyEdge[];
  /** Initiatives that depend on this one. */
  blocking: DependencyEdge[];
  /** Number of milestones; first/last dates. */
  milestoneCount: number;
};

export type InitiativeWithWeight = InitiativeSummary & {
  /** Composite priority weight for deep-dive ranking:
   *  priorityScore × dependencyDegree × log(1 + capabilityImpact + appImpact).
   *  Used to pick the top-N for per-initiative deep dives. */
  priorityWeight: number;
};

export type WaveBlock = {
  wave: WaveLabel;
  count: number;
  initiatives: InitiativeWithWeight[];
  /** RAG mix across the wave. */
  ragMix: Record<RagStatus, number>;
  /** Total dependency edges originating from this wave's
   *  initiatives. Higher = more sequencing risk in this wave. */
  dependencyEdges: number;
  /** Top 3 initiatives by composite priority weight (for
   *  prose anchoring). */
  topInitiatives: string[];
};

export type WorkspaceSpecificRoadmapRisks = {
  /** Wave 1 initiatives without an owner. */
  wave1WithoutOwner: { count: number; initiatives: string[] };
  /** Initiatives at RED ragStatus across the entire roadmap. */
  redRagInitiatives: { count: number; initiatives: string[] };
  /** Initiatives with no linked apps AND no linked capabilities —
   *  orphaned: their place on the roadmap can't be cross-referenced
   *  to either prior deliverable. */
  orphanedInitiatives: { count: number; initiatives: string[] };
  /** Initiatives blocked by ≥1 other initiative not yet COMPLETE. */
  blockedByIncomplete: { count: number; initiatives: string[] };
};

export type ArchitectureRoadmapMetrics = {
  totalInitiatives: number;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byRagStatus: Record<string, number>;

  /** Wave breakdown (NOW / NEXT / LATER). The deliverable's
   *  primary structural axis. */
  waves: {
    NOW: WaveBlock;
    NEXT: WaveBlock;
    LATER: WaveBlock;
  };

  /** Top-N by composite priority weight for per-initiative deep
   *  dives. Top 7 default; caller decides how many to render. */
  topInitiativesByImpact: InitiativeWithWeight[];

  /** Dependency network summary. */
  dependencyNetwork: {
    /** Total edges across all initiatives. */
    edgeCount: number;
    /** Initiatives with ≥1 incoming or outgoing edge. */
    connectedCount: number;
    /** Initiatives with 0 edges. */
    isolatedCount: number;
    /** Initiatives with the highest in-degree (most things
     *  depend on them) — sequencing-critical. */
    keystoneInitiatives: Array<{ id: string; name: string; inDegree: number }>;
  };

  /** Cross-deliverable coverage signals (for bridge sections). */
  crossDeliverableCoverage: {
    /** % of initiatives with ≥1 linked application. */
    appLinkedShare: number;
    /** % of initiatives with ≥1 linked capability. */
    capabilityLinkedShare: number;
    /** % of initiatives with BOTH app + capability links —
     *  full cross-deliverable bridge. */
    fullBridgeShare: number;
  };

  /** Workspace-specific risks (top-4 surfaced above the
   *  canonical 5 in the deliverable's risks table). */
  workspaceSpecificRisks: WorkspaceSpecificRoadmapRisks;

  /** All initiatives (for Appendix A listing). */
  allInitiatives: InitiativeWithWeight[];
};

// ─── Compute ──────────────────────────────────────────────────

const PRIORITY_WEIGHT: Record<InitiativePriority, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

const MATURITY_NUMERIC: Record<string, number | null> = {
  INITIAL: 1,
  DEVELOPING: 2,
  DEFINED: 3,
  MANAGED: 4,
  OPTIMIZING: 5,
  NOT_ASSESSED: null,
};

export async function computeArchitectureRoadmapMetrics(
  db: PrismaClient,
  workspaceId: string
): Promise<ArchitectureRoadmapMetrics> {
  const initiatives = await db.initiative.findMany({
    where: { workspaceId, isActive: true },
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      status: true,
      priority: true,
      horizon: true,
      ragStatus: true,
      progressPct: true,
      startDate: true,
      endDate: true,
      ownerId: true,
      businessSponsor: true,
      applications: { select: { applicationId: true } },
      capabilities: { select: { capabilityId: true } },
      dependsOn: { select: { blockingId: true } },
      blockedBy: { select: { dependentId: true } },
      milestones: { select: { id: true } },
    },
    orderBy: [{ horizon: "asc" }, { priority: "asc" }, { name: "asc" }],
  });

  // Side queries to materialize the linked entities. The
  // map-tables don't expose direct relations to applications /
  // capabilities, so we batch-fetch by id and join in-memory.
  const allAppIds = new Set<string>();
  const allCapIds = new Set<string>();
  for (const init of initiatives) {
    for (const a of init.applications) allAppIds.add(a.applicationId);
    for (const c of init.capabilities) allCapIds.add(c.capabilityId);
  }
  const [apps, caps] = await Promise.all([
    allAppIds.size > 0
      ? db.application.findMany({
          where: { id: { in: Array.from(allAppIds) } },
          select: {
            id: true,
            name: true,
            rationalizationStatus: true,
            lifecycle: true,
            isActive: true,
          },
        })
      : Promise.resolve([]),
    allCapIds.size > 0
      ? db.businessCapability.findMany({
          where: { id: { in: Array.from(allCapIds) } },
          select: {
            id: true,
            name: true,
            parentId: true,
            strategicImportance: true,
            currentMaturity: true,
            targetMaturity: true,
          },
        })
      : Promise.resolve([]),
  ]);
  const appById = new Map(apps.map((a) => [a.id, a]));
  const capById = new Map(caps.map((c) => [c.id, c]));

  // Initiative name + status lookup for dependency edges.
  const initLookup = new Map(
    initiatives.map((i) => [i.id, { name: i.name, status: i.status }])
  );

  // L1 ancestor resolution: fetch the workspace's full capability
  // tree once for parent-chain traversal. Cheap (≤ low hundreds
  // of rows) and avoids per-lookup queries.
  const allCapsRows = await db.businessCapability.findMany({
    where: { workspaceId },
    select: { id: true, name: true, parentId: true },
  });
  const capLookup = new Map(allCapsRows.map((c) => [c.id, c]));
  function resolveL1Name(id: string): string {
    let cursor: string | null = id;
    let last = id;
    while (cursor) {
      last = cursor;
      const node = capLookup.get(cursor);
      if (!node?.parentId) break;
      cursor = node.parentId;
    }
    return capLookup.get(last)?.name ?? "—";
  }

  // ─── Build initiative summaries ──────────────────────────────

  const byId = new Map<string, InitiativeWithWeight>();
  const summaries: InitiativeWithWeight[] = [];

  for (const init of initiatives) {
    const horizon = init.horizon as RoadmapHorizon;
    const wave: WaveLabel = HORIZON_TO_WAVE[horizon];
    const appsLinked: LinkedApplication[] = init.applications
      .map((m) => appById.get(m.applicationId))
      .filter((a): a is NonNullable<typeof a> => !!a && a.isActive)
      .map((a) => ({
        id: a.id,
        name: a.name,
        rationalizationStatus: a.rationalizationStatus,
        lifecycle: a.lifecycle,
      }));
    const capabilitiesLinked: LinkedCapability[] = init.capabilities
      .map((m) => capById.get(m.capabilityId))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .map((c) => ({
        id: c.id,
        name: c.name,
        l1Name: resolveL1Name(c.id),
        strategicImportance: c.strategicImportance,
        currentMaturity: c.currentMaturity,
        targetMaturity: c.targetMaturity,
      }));
    const dependsOn: DependencyEdge[] = init.dependsOn
      .map((d): DependencyEdge | null => {
        const ref = initLookup.get(d.blockingId);
        if (!ref) return null;
        return {
          initiativeId: d.blockingId,
          initiativeName: ref.name,
          edgeType: "depends-on",
        };
      })
      .filter((x): x is DependencyEdge => x !== null);
    const blocking: DependencyEdge[] = init.blockedBy
      .map((d): DependencyEdge | null => {
        const ref = initLookup.get(d.dependentId);
        if (!ref) return null;
        return {
          initiativeId: d.dependentId,
          initiativeName: ref.name,
          edgeType: "blocked-by",
        };
      })
      .filter((x): x is DependencyEdge => x !== null);

    const priorityScore = PRIORITY_WEIGHT[init.priority as InitiativePriority] ?? 0;
    const dependencyDegree = dependsOn.length + blocking.length;
    const capabilityImpact = capabilitiesLinked.length;
    const appImpact = appsLinked.length;
    const priorityWeight =
      priorityScore *
      (1 + dependencyDegree * 0.5) *
      Math.log(1 + capabilityImpact + appImpact);

    const summary: InitiativeWithWeight = {
      id: init.id,
      name: init.name,
      description: init.description,
      category: init.category as InitiativeCategory,
      status: init.status as InitiativeStatus,
      priority: init.priority as InitiativePriority,
      horizon,
      wave,
      ragStatus: (RAG_STATUSES.includes(init.ragStatus as RagStatus)
        ? (init.ragStatus as RagStatus)
        : "GREEN") as RagStatus,
      progressPct: init.progressPct,
      startDate: init.startDate,
      endDate: init.endDate,
      hasOwner: !!init.ownerId,
      hasSponsor: !!init.businessSponsor,
      appsLinkedCount: appsLinked.length,
      appsLinked,
      capabilitiesLinkedCount: capabilitiesLinked.length,
      capabilitiesLinked,
      dependsOn,
      blocking,
      milestoneCount: init.milestones.length,
      priorityWeight,
    };
    summaries.push(summary);
    byId.set(init.id, summary);
  }

  // ─── Aggregations ───────────────────────────────────────────

  const byCategory = countBy(summaries, (s) => s.category);
  const byStatus = countBy(summaries, (s) => s.status);
  const byPriority = countBy(summaries, (s) => s.priority);
  const byRagStatus = countBy(summaries, (s) => s.ragStatus);

  // Wave blocks
  const buildWaveBlock = (wave: WaveLabel): WaveBlock => {
    const items = summaries
      .filter((s) => s.wave === wave)
      .sort((a, b) => b.priorityWeight - a.priorityWeight);
    const ragMix: Record<RagStatus, number> = { GREEN: 0, AMBER: 0, RED: 0 };
    let edges = 0;
    for (const i of items) {
      ragMix[i.ragStatus] = (ragMix[i.ragStatus] ?? 0) + 1;
      edges += i.dependsOn.length;
    }
    return {
      wave,
      count: items.length,
      initiatives: items,
      ragMix,
      dependencyEdges: edges,
      topInitiatives: items.slice(0, 3).map((i) => i.name),
    };
  };

  const waves = {
    NOW: buildWaveBlock("NOW"),
    NEXT: buildWaveBlock("NEXT"),
    LATER: buildWaveBlock("LATER"),
  };

  // Top-N by composite weight
  const topInitiativesByImpact = summaries
    .slice()
    .sort((a, b) => b.priorityWeight - a.priorityWeight)
    .slice(0, 7);

  // Dependency network
  let edgeCount = 0;
  const inDegree = new Map<string, number>();
  for (const s of summaries) {
    edgeCount += s.dependsOn.length;
    for (const e of s.dependsOn) {
      inDegree.set(e.initiativeId, (inDegree.get(e.initiativeId) ?? 0) + 1);
    }
  }
  const connectedCount = summaries.filter(
    (s) => s.dependsOn.length + s.blocking.length > 0
  ).length;
  const isolatedCount = summaries.length - connectedCount;
  const keystoneInitiatives = Array.from(inDegree.entries())
    .map(([id, n]) => ({ id, name: byId.get(id)?.name ?? "—", inDegree: n }))
    .sort((a, b) => b.inDegree - a.inDegree)
    .slice(0, 5);

  // Cross-deliverable coverage
  const total = summaries.length;
  const appLinked = summaries.filter((s) => s.appsLinkedCount > 0).length;
  const capLinked = summaries.filter((s) => s.capabilitiesLinkedCount > 0).length;
  const bothLinked = summaries.filter(
    (s) => s.appsLinkedCount > 0 && s.capabilitiesLinkedCount > 0
  ).length;
  const crossDeliverableCoverage = {
    appLinkedShare: total > 0 ? appLinked / total : 0,
    capabilityLinkedShare: total > 0 ? capLinked / total : 0,
    fullBridgeShare: total > 0 ? bothLinked / total : 0,
  };

  // Workspace-specific risks
  const wave1WithoutOwner = waves.NOW.initiatives.filter((i) => !i.hasOwner);
  const redRag = summaries.filter((s) => s.ragStatus === "RED");
  const orphaned = summaries.filter(
    (s) => s.appsLinkedCount === 0 && s.capabilitiesLinkedCount === 0
  );
  const blockedByIncomplete = summaries.filter((s) =>
    s.dependsOn.some(
      (e) => byId.get(e.initiativeId)?.status !== "COMPLETE"
    )
  );

  const workspaceSpecificRisks: WorkspaceSpecificRoadmapRisks = {
    wave1WithoutOwner: {
      count: wave1WithoutOwner.length,
      initiatives: wave1WithoutOwner.map((i) => i.name),
    },
    redRagInitiatives: {
      count: redRag.length,
      initiatives: redRag.map((i) => i.name),
    },
    orphanedInitiatives: {
      count: orphaned.length,
      initiatives: orphaned.map((i) => i.name),
    },
    blockedByIncomplete: {
      count: blockedByIncomplete.length,
      initiatives: blockedByIncomplete.map((i) => i.name),
    },
  };

  return {
    totalInitiatives: summaries.length,
    byCategory,
    byStatus,
    byPriority,
    byRagStatus,
    waves,
    topInitiativesByImpact,
    dependencyNetwork: {
      edgeCount,
      connectedCount,
      isolatedCount,
      keystoneInitiatives,
    },
    crossDeliverableCoverage,
    workspaceSpecificRisks,
    allInitiatives: summaries,
  };
}

// ─── Helpers ──────────────────────────────────────────────────

function countBy<T>(arr: T[], key: (x: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of arr) {
    const k = key(x);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

/** Numeric-token allowlist for the LLM fact-check verifier.
 *  Same EXACT-MATCH discipline as maturity. */
export function collectAllowedRoadmapCounts(
  m: ArchitectureRoadmapMetrics
): number[] {
  const counts = new Set<number>();
  counts.add(m.totalInitiatives);
  counts.add(m.waves.NOW.count);
  counts.add(m.waves.NEXT.count);
  counts.add(m.waves.LATER.count);
  counts.add(m.dependencyNetwork.edgeCount);
  counts.add(m.dependencyNetwork.connectedCount);
  counts.add(m.dependencyNetwork.isolatedCount);
  counts.add(m.workspaceSpecificRisks.wave1WithoutOwner.count);
  counts.add(m.workspaceSpecificRisks.redRagInitiatives.count);
  counts.add(m.workspaceSpecificRisks.orphanedInitiatives.count);
  counts.add(m.workspaceSpecificRisks.blockedByIncomplete.count);
  for (const v of Object.values(m.byCategory)) counts.add(v);
  for (const v of Object.values(m.byStatus)) counts.add(v);
  for (const v of Object.values(m.byPriority)) counts.add(v);
  for (const v of Object.values(m.byRagStatus)) counts.add(v);
  for (const w of [m.waves.NOW, m.waves.NEXT, m.waves.LATER]) {
    counts.add(w.dependencyEdges);
    for (const v of Object.values(w.ragMix)) counts.add(v);
  }
  for (const k of m.dependencyNetwork.keystoneInitiatives) counts.add(k.inDegree);
  // Coverage percentages (rounded)
  counts.add(Math.round(m.crossDeliverableCoverage.appLinkedShare * 100));
  counts.add(Math.round(m.crossDeliverableCoverage.capabilityLinkedShare * 100));
  counts.add(Math.round(m.crossDeliverableCoverage.fullBridgeShare * 100));
  return Array.from(counts).filter((n) => Number.isFinite(n) && n >= 0);
}

void MATURITY_NUMERIC; // reserved for future maturity-progression rendering helpers
