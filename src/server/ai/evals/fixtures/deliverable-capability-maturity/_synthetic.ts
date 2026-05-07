import "server-only";
import type {
  CapabilityMaturityMetrics,
  CapabilityWithGap,
  CapabilitySummary,
  L1Rollup,
} from "@/server/ai/deliverables/capabilityMaturityMetrics";

/**
 * Synthetic H Motors-equivalent capability metrics for the
 * maturity deliverable eval suite. In-memory only — no DB seeding.
 * The four LLM calls (`generateExecSummary`, `generateKeyFindings`,
 * `generateBandNarratives`, `generateDeepDives`) consume facts
 * derived from this metrics shape, so eval fidelity is preserved
 * without a workspace round-trip.
 *
 * Mirrors the H Motors test data the user verified at the
 * BCG/$500k bar (470d3d5 Halloran regen). Compact 12-capability
 * portfolio across 5 L1 domains with mixed importance + maturity,
 * application mappings with TIME dispositions (so the cross-
 * deliverable bridge is exercised), and a Connected Vehicle
 * Services concentration on the priority lift band.
 */

export const SYNTHETIC_CLIENT_NAME = "H Motors";

const IMPORTANCE_WEIGHT: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  NOT_ASSESSED: 0,
};
const MATURITY_NUMERIC: Record<string, number | null> = {
  INITIAL: 1,
  DEVELOPING: 2,
  DEFINED: 3,
  MANAGED: 4,
  OPTIMIZING: 5,
  NOT_ASSESSED: null,
};

function cap(
  id: string,
  name: string,
  l1Name: string,
  importance: string,
  current: string,
  target: string,
  apps: Array<{ name: string; rationalizationStatus: string | null; lifecycle: string }> = [],
  hasOwners = false
): CapabilityWithGap {
  const c = MATURITY_NUMERIC[current] ?? null;
  const t = MATURITY_NUMERIC[target] ?? null;
  const gapLevels = c != null && t != null ? t - c : null;
  const gapAbs = gapLevels != null ? Math.abs(gapLevels) : 0;
  const priorityWeight =
    gapAbs * (IMPORTANCE_WEIGHT[importance] ?? 0) * Math.log(1 + apps.length);
  const summary: CapabilitySummary = {
    id,
    name,
    level: "L2",
    parentId: null,
    parentName: null,
    l1Id: l1Name.toLowerCase().replace(/\s+/g, "-"),
    l1Name,
    strategicImportance: importance,
    currentMaturity: current,
    targetMaturity: target,
    gapLevels,
    appsMappedCount: apps.length,
    appsMapped: apps,
    hasBusinessOwner: hasOwners,
    hasItOwner: hasOwners,
  };
  return { ...summary, priorityWeight };
}

// ─── 12 synthetic capabilities mirroring Halloran's profile ────

const ota = cap(
  "ota",
  "OTA Update Management",
  "Connected Vehicle Services",
  "CRITICAL",
  "INITIAL",
  "OPTIMIZING",
  [{ name: "Halloran SDV Platform", rationalizationStatus: "INVEST", lifecycle: "PLANNED" }]
);
const swEng = cap(
  "sweng",
  "Software & Electronics Engineering",
  "Vehicle Engineering & Design",
  "CRITICAL",
  "DEVELOPING",
  "OPTIMIZING",
  [
    { name: "CATIA V5", rationalizationStatus: "INVEST", lifecycle: "ACTIVE" },
    { name: "Halloran SDV Platform", rationalizationStatus: "INVEST", lifecycle: "PLANNED" },
  ]
);
const bom = cap(
  "bom",
  "BOM & Part Master",
  "Product Lifecycle Management",
  "CRITICAL",
  "INITIAL",
  "MANAGED",
  [{ name: "Aftersales Parts Catalog (AS/400)", rationalizationStatus: "ELIMINATE", lifecycle: "PHASING_OUT" }]
);
const cyber = cap(
  "cyber",
  "Vehicle Cybersecurity (R155/R156)",
  "Cyber & Vehicle Security",
  "CRITICAL",
  "DEVELOPING",
  "OPTIMIZING",
  [{ name: "Halloran SDV Platform", rationalizationStatus: "INVEST", lifecycle: "PLANNED" }]
);
const cvsRoot = cap(
  "cvs",
  "Connected Vehicle Services",
  "Connected Vehicle Services",
  "CRITICAL",
  "DEVELOPING",
  "OPTIMIZING",
  []
);
const mes = cap(
  "mes",
  "Plant-Floor Execution (MES)",
  "Manufacturing Operations",
  "CRITICAL",
  "DEVELOPING",
  "MANAGED",
  [
    { name: "Apriso MES (Halewood plant)", rationalizationStatus: "INVEST", lifecycle: "ACTIVE" },
    { name: "Solihull MES (bespoke)", rationalizationStatus: "MIGRATE", lifecycle: "PHASING_OUT" },
  ]
);
const cust360 = cap(
  "c360",
  "Customer 360 & Loyalty",
  "Customer Experience & CRM",
  "HIGH",
  "DEVELOPING",
  "MANAGED",
  [
    { name: "Salesforce Sales Cloud (US)", rationalizationStatus: "TOLERATE", lifecycle: "ACTIVE" },
    { name: "Salesforce Automotive Cloud (UK & EU)", rationalizationStatus: "INVEST", lifecycle: "ACTIVE" },
  ]
);
const ecm = cap(
  "ecm",
  "Engineering Change Management",
  "Product Lifecycle Management",
  "HIGH",
  "DEVELOPING",
  "MANAGED",
  [
    { name: "Teamcenter PLM", rationalizationStatus: "MIGRATE", lifecycle: "PHASING_OUT" },
    { name: "NX", rationalizationStatus: "TOLERATE", lifecycle: "ACTIVE" },
  ]
);
// Sustain band
const paint = cap(
  "paint",
  "Paint Shop",
  "Manufacturing Operations",
  "HIGH",
  "DEFINED",
  "DEFINED",
  [{ name: "Apriso MES (Halewood plant)", rationalizationStatus: "INVEST", lifecycle: "ACTIVE" }]
);
const dealerOnboarding = cap(
  "dealer-onboarding",
  "Dealer Onboarding",
  "Customer Experience & CRM",
  "MEDIUM",
  "DEFINED",
  "DEFINED",
  []
);
// Invest beyond
const finance = cap(
  "finance",
  "Finance & Treasury",
  "Finance & Treasury",
  "CRITICAL",
  "MANAGED",
  "MANAGED",
  [{ name: "SAP ECC 6.0", rationalizationStatus: "MIGRATE", lifecycle: "PHASING_OUT" }]
);
// Monitor tail (MEDIUM/LOW with positive gap)
const sparePartsDistribution = cap(
  "spare-parts",
  "Spare Parts Distribution",
  "Supply Chain & Logistics",
  "MEDIUM",
  "DEVELOPING",
  "DEFINED",
  []
);

const ALL = [
  ota,
  swEng,
  bom,
  cyber,
  cvsRoot,
  mes,
  cust360,
  ecm,
  paint,
  dealerOnboarding,
  finance,
  sparePartsDistribution,
];

// ─── Aggregations ──────────────────────────────────────────────

function countBy<K extends string>(arr: CapabilityWithGap[], key: K): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of arr) {
    const v = String((c as unknown as Record<string, unknown>)[key]);
    out[v] = (out[v] ?? 0) + 1;
  }
  return out;
}

function buildL1Rollups(arr: CapabilityWithGap[]): L1Rollup[] {
  const groups = new Map<string, CapabilityWithGap[]>();
  for (const c of arr) {
    const list = groups.get(c.l1Name) ?? [];
    list.push(c);
    groups.set(c.l1Name, list);
  }
  const rollups: L1Rollup[] = [];
  for (const [name, list] of groups) {
    const cur = list.map((c) => MATURITY_NUMERIC[c.currentMaturity]).filter((x): x is number => x != null);
    const tgt = list.map((c) => MATURITY_NUMERIC[c.targetMaturity]).filter((x): x is number => x != null);
    const byMaturity: Record<string, number> = {};
    for (const c of list) byMaturity[c.currentMaturity] = (byMaturity[c.currentMaturity] ?? 0) + 1;
    rollups.push({
      l1Id: name.toLowerCase().replace(/\s+/g, "-"),
      l1Name: name,
      childCount: list.length,
      byMaturity,
      currentMean: cur.length ? cur.reduce((a, b) => a + b, 0) / cur.length : 0,
      targetMean: tgt.length ? tgt.reduce((a, b) => a + b, 0) / tgt.length : 0,
      totalGapLevels: list.reduce((s, c) => s + Math.max(0, c.gapLevels ?? 0), 0),
      unassessedCount: list.filter(
        (c) => c.currentMaturity === "NOT_ASSESSED" || c.targetMaturity === "NOT_ASSESSED"
      ).length,
    });
  }
  rollups.sort((a, b) => b.totalGapLevels - a.totalGapLevels);
  return rollups;
}

function buildMatrix(arr: CapabilityWithGap[]) {
  const cells: Record<string, { count: number; topCapabilities: string[] }> = {};
  for (const c of arr) {
    const k = `${c.strategicImportance}|${c.currentMaturity}`;
    const e = cells[k] ?? { count: 0, topCapabilities: [] };
    e.count++;
    if (e.topCapabilities.length < 3) e.topCapabilities.push(c.name);
    cells[k] = e;
  }
  return Object.entries(cells).map(([k, v]) => {
    const [importance, maturity] = k.split("|");
    return { importance, maturity, count: v.count, topCapabilities: v.topCapabilities };
  });
}

const lift = [ota, swEng, bom, cyber, cvsRoot, mes, cust360, ecm];
const sustain = [paint, dealerOnboarding];
const investBeyond = [finance];
const reassess: CapabilityWithGap[] = [];
const monitorTail = [sparePartsDistribution];

export const SYNTHETIC_H_MOTORS_MATURITY_METRICS: CapabilityMaturityMetrics = {
  totalCapabilities: ALL.length,
  byLevel: { L1: 0, L2: ALL.length, L3: 0 },
  byCurrentMaturity: countBy(ALL, "currentMaturity"),
  byTargetMaturity: countBy(ALL, "targetMaturity"),
  byStrategicImportance: countBy(ALL, "strategicImportance"),
  importanceMaturityMatrix: buildMatrix(ALL),
  l1Rollups: buildL1Rollups(ALL),
  bands: {
    liftToTarget: lift.slice().sort((a, b) => b.priorityWeight - a.priorityWeight),
    sustainAtTarget: sustain,
    investBeyondTarget: investBeyond,
    reassessStrategy: reassess,
    monitorTail,
    notAssessed: [],
  },
  topGapsByImpact: lift.slice().sort((a, b) => b.priorityWeight - a.priorityWeight).slice(0, 5),
  assessmentCoverageRatio: 1.0,
  topUnassessedL1: null,
  workspaceSpecificRisks: {
    criticalAtInitialOrDeveloping: {
      count: lift.filter(
        (c) =>
          c.strategicImportance === "CRITICAL" &&
          (c.currentMaturity === "INITIAL" || c.currentMaturity === "DEVELOPING")
      ).length,
      capabilities: lift
        .filter(
          (c) =>
            c.strategicImportance === "CRITICAL" &&
            (c.currentMaturity === "INITIAL" || c.currentMaturity === "DEVELOPING")
        )
        .map((c) => c.name),
    },
    capabilitiesWithoutOwners: { count: ALL.length, capabilities: ALL.map((c) => c.name) },
    topUnassessedL1: null,
  },
};
