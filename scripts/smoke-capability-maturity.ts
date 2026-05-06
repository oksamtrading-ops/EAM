/* eslint-disable */
// Smoke test for the Capability Maturity deliverable + Baseline
// Report fork. Builds two docs from in-memory metrics fixtures
// covering both the full path (≥60% coverage) and the baseline
// fork (<60% coverage). LLM calls fall back to deterministic
// (no API key in CLI) — confirms fallback paths render without
// crashing. Run:
//   node --conditions=react-server --import tsx scripts/smoke-capability-maturity.ts
import { writeFileSync } from "node:fs";
import { buildCapabilityMaturityDocx } from "../src/server/ai/deliverables/buildCapabilityMaturityDocx";
import { buildCapabilityMaturityBaselineReport } from "../src/server/ai/deliverables/buildCapabilityMaturityBaselineReport";
import type {
  CapabilityMaturityMetrics,
  CapabilityWithGap,
  CapabilitySummary,
} from "../src/server/ai/deliverables/capabilityMaturityMetrics";

function cap(
  id: string,
  name: string,
  l1Name: string,
  importance: string,
  current: string,
  target: string,
  apps: number,
  hasOwners = true
): CapabilityWithGap {
  const importanceWeight: Record<string, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
    NOT_ASSESSED: 0,
  };
  const m: Record<string, number | null> = {
    INITIAL: 1,
    DEVELOPING: 2,
    DEFINED: 3,
    MANAGED: 4,
    OPTIMIZING: 5,
    NOT_ASSESSED: null,
  };
  const c = m[current] ?? null;
  const t = m[target] ?? null;
  const gapLevels = c != null && t != null ? t - c : null;
  const priorityWeight =
    gapLevels != null && gapLevels > 0
      ? gapLevels *
        (importanceWeight[importance] ?? 0) *
        Math.log(1 + apps)
      : 0;
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
    appsMappedCount: apps,
    appsMapped: Array.from({ length: apps }, (_, i) => ({
      name: `${name} App ${i + 1}`,
      rationalizationStatus: i % 2 === 0 ? "MIGRATE" : "INVEST",
      lifecycle: "ACTIVE",
    })),
    hasBusinessOwner: hasOwners,
    hasItOwner: hasOwners,
  };
  return { ...summary, priorityWeight };
}

function makeFullMetrics(): CapabilityMaturityMetrics {
  // 12 capabilities, ~83% coverage, mixed bands
  const lift = [
    cap("c1", "Customer 360", "Customer Experience", "CRITICAL", "DEVELOPING", "MANAGED", 3),
    cap("c2", "Order Management", "Customer Experience", "HIGH", "INITIAL", "MANAGED", 2),
    cap("c3", "Manufacturing Execution", "Operations", "CRITICAL", "DEFINED", "OPTIMIZING", 2),
    cap("c4", "Plant Maintenance", "Operations", "HIGH", "DEVELOPING", "DEFINED", 1),
    cap("c5", "Vehicle Engineering", "Engineering", "CRITICAL", "DEFINED", "MANAGED", 4),
  ];
  const sustain = [
    cap("c6", "Finance Reporting", "Finance", "HIGH", "MANAGED", "MANAGED", 2),
    cap("c7", "Procurement", "Finance", "MEDIUM", "DEFINED", "DEFINED", 1),
  ];
  const investBeyond = [
    cap("c8", "Telemetry & Connected Services", "Engineering", "CRITICAL", "MANAGED", "MANAGED", 3),
  ];
  const reassess = [
    cap("c9", "Wirecast", "Operations", "LOW", "OPTIMIZING", "OPTIMIZING", 1),
  ];
  const notAssessed = [
    cap("c10", "Aftersales Parts", "Customer Experience", "MEDIUM", "NOT_ASSESSED", "NOT_ASSESSED", 1, false),
    cap("c11", "Warranty Claims", "Customer Experience", "HIGH", "NOT_ASSESSED", "NOT_ASSESSED", 1),
    cap("c12", "Dealer Portal", "Customer Experience", "MEDIUM", "NOT_ASSESSED", "DEFINED", 1),
  ];
  const all = [...lift, ...sustain, ...investBeyond, ...reassess, ...notAssessed];
  const assessed = all.filter(
    (c) =>
      c.currentMaturity !== "NOT_ASSESSED" &&
      c.targetMaturity !== "NOT_ASSESSED"
  ).length;
  return {
    totalCapabilities: all.length,
    byLevel: { L1: 4, L2: 8, L3: 0 },
    byCurrentMaturity: countBy(all, "currentMaturity"),
    byTargetMaturity: countBy(all, "targetMaturity"),
    byStrategicImportance: countBy(all, "strategicImportance"),
    importanceMaturityMatrix: buildMatrix(all),
    l1Rollups: buildL1(all),
    bands: {
      liftToTarget: lift,
      sustainAtTarget: sustain,
      investBeyondTarget: investBeyond,
      reassessStrategy: reassess,
      notAssessed,
    },
    topGapsByImpact: lift.slice().sort((a, b) => b.priorityWeight - a.priorityWeight).slice(0, 5),
    assessmentCoverageRatio: assessed / all.length,
    topUnassessedL1: {
      l1Id: "customer-experience",
      l1Name: "Customer Experience",
      unassessedCount: 3,
      unassessedShare: 3 / 4,
    },
    workspaceSpecificRisks: {
      criticalAtInitialOrDeveloping: { count: 2, capabilities: ["Customer 360", "Order Management"] },
      capabilitiesWithoutOwners: { count: 1, capabilities: ["Aftersales Parts"] },
      topUnassessedL1: { l1Name: "Customer Experience", share: 3 / 4 },
    },
  };
}

function makeBaselineMetrics(): CapabilityMaturityMetrics {
  // 10 capabilities, ~30% coverage — forks to baseline
  const assessed = [
    cap("c1", "Customer 360", "Customer Experience", "CRITICAL", "DEVELOPING", "MANAGED", 3),
    cap("c2", "Manufacturing Execution", "Operations", "CRITICAL", "DEFINED", "OPTIMIZING", 2),
    cap("c3", "Finance Reporting", "Finance", "HIGH", "MANAGED", "MANAGED", 2),
  ];
  const unassessed = [
    cap("c4", "Order Management", "Customer Experience", "HIGH", "NOT_ASSESSED", "NOT_ASSESSED", 2, false),
    cap("c5", "Plant Maintenance", "Operations", "HIGH", "NOT_ASSESSED", "NOT_ASSESSED", 1),
    cap("c6", "Vehicle Engineering", "Engineering", "CRITICAL", "NOT_ASSESSED", "NOT_ASSESSED", 4),
    cap("c7", "Procurement", "Finance", "MEDIUM", "NOT_ASSESSED", "NOT_ASSESSED", 1, false),
    cap("c8", "Aftersales Parts", "Customer Experience", "MEDIUM", "NOT_ASSESSED", "NOT_ASSESSED", 1, false),
    cap("c9", "Warranty Claims", "Customer Experience", "HIGH", "NOT_ASSESSED", "NOT_ASSESSED", 1),
    cap("c10", "Telemetry", "Engineering", "CRITICAL", "NOT_ASSESSED", "NOT_ASSESSED", 3),
  ];
  const all = [...assessed, ...unassessed];
  return {
    totalCapabilities: all.length,
    byLevel: { L1: 4, L2: 6, L3: 0 },
    byCurrentMaturity: countBy(all, "currentMaturity"),
    byTargetMaturity: countBy(all, "targetMaturity"),
    byStrategicImportance: countBy(all, "strategicImportance"),
    importanceMaturityMatrix: buildMatrix(all),
    l1Rollups: buildL1(all),
    bands: {
      liftToTarget: assessed.filter((c) => (c.gapLevels ?? 0) > 0),
      sustainAtTarget: assessed.filter((c) => c.gapLevels === 0),
      investBeyondTarget: [],
      reassessStrategy: [],
      notAssessed: unassessed,
    },
    topGapsByImpact: assessed.slice().sort((a, b) => b.priorityWeight - a.priorityWeight).slice(0, 5),
    assessmentCoverageRatio: 3 / 10,
    topUnassessedL1: {
      l1Id: "customer-experience",
      l1Name: "Customer Experience",
      unassessedCount: 3,
      unassessedShare: 3 / 4,
    },
    workspaceSpecificRisks: {
      criticalAtInitialOrDeveloping: { count: 1, capabilities: ["Customer 360"] },
      capabilitiesWithoutOwners: { count: 3, capabilities: ["Order Management", "Procurement", "Aftersales Parts"] },
      topUnassessedL1: { l1Name: "Customer Experience", share: 0.75 },
    },
  };
}

function countBy(arr: CapabilityWithGap[], key: keyof CapabilityWithGap): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of arr) {
    const k = String(c[key]);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function buildMatrix(arr: CapabilityWithGap[]) {
  const cells: Record<string, { count: number; topCapabilities: string[] }> = {};
  for (const c of arr) {
    const key = `${c.strategicImportance}|${c.currentMaturity}`;
    const e = cells[key] ?? { count: 0, topCapabilities: [] };
    e.count++;
    if (e.topCapabilities.length < 3) e.topCapabilities.push(c.name);
    cells[key] = e;
  }
  return Object.entries(cells).map(([key, v]) => {
    const [importance, maturity] = key.split("|");
    return { importance, maturity, count: v.count, topCapabilities: v.topCapabilities };
  });
}

function buildL1(arr: CapabilityWithGap[]) {
  const groups = new Map<string, CapabilityWithGap[]>();
  for (const c of arr) {
    const list = groups.get(c.l1Name) ?? [];
    list.push(c);
    groups.set(c.l1Name, list);
  }
  const out: CapabilityMaturityMetrics["l1Rollups"] = [];
  const m: Record<string, number | null> = {
    INITIAL: 1, DEVELOPING: 2, DEFINED: 3, MANAGED: 4, OPTIMIZING: 5, NOT_ASSESSED: null,
  };
  for (const [name, list] of groups) {
    const cur = list.map((c) => m[c.currentMaturity]).filter((x): x is number => x != null);
    const tgt = list.map((c) => m[c.targetMaturity]).filter((x): x is number => x != null);
    const byMaturity: Record<string, number> = {};
    for (const c of list) byMaturity[c.currentMaturity] = (byMaturity[c.currentMaturity] ?? 0) + 1;
    out.push({
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
  return out;
}

async function main() {
  console.log("Building full path (high coverage)...");
  const full = await buildCapabilityMaturityDocx({
    clientName: "Test Motors Co",
    brandHex: "#5A4FCF",
    preparedBy: "Smoke Test",
    engagementCode: "TEST-2026-05",
    contactLine: "test@example.com",
    metrics: makeFullMetrics(),
  });
  writeFileSync("/tmp/smoke-capability-maturity-full.docx", full.buffer);
  console.log(`  full: ${full.buffer.length} bytes, llmSource=${full.llmSource}, detail=${full.llmSourceDetail}`);
  if (full.buffer.length < 50_000) throw new Error("full doc too small");

  console.log("Building baseline path (low coverage)...");
  const baseline = await buildCapabilityMaturityBaselineReport({
    clientName: "Test Motors Co",
    brandHex: "#5A4FCF",
    preparedBy: "Smoke Test",
    engagementCode: "TEST-2026-05",
    contactLine: "test@example.com",
    metrics: makeBaselineMetrics(),
  });
  writeFileSync("/tmp/smoke-capability-baseline.docx", baseline.buffer);
  console.log(`  baseline: ${baseline.buffer.length} bytes, llmSource=${baseline.llmSource}`);
  if (baseline.buffer.length < 30_000) throw new Error("baseline doc too small");

  console.log("OK — both paths render. Files in /tmp.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
