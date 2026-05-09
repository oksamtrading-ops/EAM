/* eslint-disable */
// Smoke test for the Architecture Roadmap deliverable.
// Builds against an in-memory metrics fixture; LLM calls fall
// back to deterministic (no API key in CLI). Verifies fallback
// path renders without crashing. Run:
//   node --conditions=react-server --import tsx scripts/smoke-architecture-roadmap.ts
import { writeFileSync } from "node:fs";
import { buildArchitectureRoadmapDocx } from "../src/server/ai/deliverables/buildArchitectureRoadmapDocx";
import type {
  ArchitectureRoadmapMetrics,
  InitiativeWithWeight,
  WaveBlock,
} from "../src/server/ai/deliverables/architectureRoadmapMetrics";

function init(
  id: string,
  name: string,
  category: any,
  status: any,
  priority: any,
  horizon: any,
  wave: "NOW" | "NEXT" | "LATER",
  ragStatus: any,
  apps: Array<{ name: string; rationalizationStatus: string | null; lifecycle: string }> = [],
  caps: Array<{ name: string; l1Name: string; strategicImportance: string; currentMaturity: string; targetMaturity: string }> = [],
  dependsOn: Array<{ initiativeId: string; initiativeName: string }> = [],
  blocking: Array<{ initiativeId: string; initiativeName: string }> = [],
  hasOwner = true
): InitiativeWithWeight {
  const inDeg = blocking.length;
  const priorityScore = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }[priority as string] ?? 0;
  const dependencyDegree = dependsOn.length + blocking.length;
  const priorityWeight =
    priorityScore *
    (1 + dependencyDegree * 0.5) *
    Math.log(1 + caps.length + apps.length);
  return {
    id,
    name,
    description: null,
    category,
    status,
    priority,
    horizon,
    wave,
    ragStatus,
    progressPct: 25,
    startDate: null,
    endDate: null,
    hasOwner,
    hasSponsor: hasOwner,
    appsLinkedCount: apps.length,
    appsLinked: apps.map((a, i) => ({ id: `${id}-app${i}`, ...a })),
    capabilitiesLinkedCount: caps.length,
    capabilitiesLinked: caps.map((c, i) => ({ id: `${id}-cap${i}`, ...c })),
    dependsOn: dependsOn.map((d) => ({ ...d, edgeType: "depends-on" as const })),
    blocking: blocking.map((d) => ({ ...d, edgeType: "blocked-by" as const })),
    milestoneCount: 0,
    priorityWeight,
  };
}

const sap = init(
  "i1",
  "S/4HANA Cutover",
  "MODERNISATION",
  "PLANNED",
  "CRITICAL",
  "H1_NOW",
  "NOW",
  "AMBER",
  [{ name: "SAP ECC 6.0", rationalizationStatus: "MIGRATE", lifecycle: "PHASING_OUT" }],
  [{ name: "Finance & Treasury", l1Name: "Finance & Treasury", strategicImportance: "CRITICAL", currentMaturity: "MANAGED", targetMaturity: "OPTIMIZING" }],
  [],
  [
    { initiativeId: "i6", initiativeName: "MES Modernization" },
    { initiativeId: "i5", initiativeName: "Customer 360 Consolidation" },
    { initiativeId: "i7", initiativeName: "ECM Uplift" },
  ]
);

const ota = init(
  "i2",
  "OTA Platform Stand-up",
  "INNOVATION",
  "PLANNED",
  "CRITICAL",
  "H1_NOW",
  "NOW",
  "GREEN",
  [{ name: "Halloran SDV Platform", rationalizationStatus: "INVEST", lifecycle: "PLANNED" }],
  [{ name: "OTA Update Management", l1Name: "Connected Vehicle Services", strategicImportance: "CRITICAL", currentMaturity: "INITIAL", targetMaturity: "OPTIMIZING" }],
  [],
  [{ initiativeId: "i8", initiativeName: "Connected Vehicle Expansion" }]
);

const as400 = init(
  "i3",
  "AS/400 Decommission",
  "DECOMMISSION",
  "IN_PROGRESS",
  "HIGH",
  "H1_NOW",
  "NOW",
  "RED",
  [{ name: "Aftersales Parts Catalog (AS/400)", rationalizationStatus: "ELIMINATE", lifecycle: "PHASING_OUT" }],
  [{ name: "BOM & Part Master", l1Name: "Product Lifecycle Management", strategicImportance: "CRITICAL", currentMaturity: "INITIAL", targetMaturity: "MANAGED" }]
);

const cyber = init(
  "i4",
  "Vehicle Cybersecurity R155",
  "COMPLIANCE",
  "PLANNED",
  "CRITICAL",
  "H1_NOW",
  "NOW",
  "AMBER",
  [{ name: "Halloran SDV Platform", rationalizationStatus: "INVEST", lifecycle: "PLANNED" }],
  [{ name: "Vehicle Cybersecurity (R155/R156)", l1Name: "Cyber & Vehicle Security", strategicImportance: "CRITICAL", currentMaturity: "DEVELOPING", targetMaturity: "OPTIMIZING" }],
  [{ initiativeId: "i2", initiativeName: "OTA Platform Stand-up" }]
);

const c360 = init(
  "i5",
  "Customer 360 Consolidation",
  "CONSOLIDATION",
  "DRAFT",
  "HIGH",
  "H2_NEXT",
  "NEXT",
  "GREEN",
  [
    { name: "Salesforce Sales Cloud (US)", rationalizationStatus: "TOLERATE", lifecycle: "ACTIVE" },
    { name: "Salesforce Automotive Cloud (UK & EU)", rationalizationStatus: "INVEST", lifecycle: "ACTIVE" },
  ],
  [{ name: "Customer 360 & Loyalty", l1Name: "Customer Experience & CRM", strategicImportance: "HIGH", currentMaturity: "DEVELOPING", targetMaturity: "MANAGED" }],
  [{ initiativeId: "i1", initiativeName: "S/4HANA Cutover" }]
);

const mes = init(
  "i6",
  "MES Modernization",
  "MODERNISATION",
  "DRAFT",
  "CRITICAL",
  "H2_NEXT",
  "NEXT",
  "GREEN",
  [
    { name: "Apriso MES (Halewood plant)", rationalizationStatus: "INVEST", lifecycle: "ACTIVE" },
    { name: "Solihull MES (bespoke)", rationalizationStatus: "MIGRATE", lifecycle: "PHASING_OUT" },
  ],
  [{ name: "Plant-Floor Execution (MES)", l1Name: "Manufacturing Operations", strategicImportance: "CRITICAL", currentMaturity: "DEVELOPING", targetMaturity: "MANAGED" }],
  [{ initiativeId: "i1", initiativeName: "S/4HANA Cutover" }]
);

const ecm = init("i7", "ECM Uplift", "OPTIMISATION", "DRAFT", "HIGH", "H2_NEXT", "NEXT", "AMBER",
  [{ name: "Teamcenter PLM", rationalizationStatus: "MIGRATE", lifecycle: "PHASING_OUT" }],
  [{ name: "Engineering Change Management", l1Name: "Product Lifecycle Management", strategicImportance: "HIGH", currentMaturity: "DEVELOPING", targetMaturity: "MANAGED" }],
  [{ initiativeId: "i1", initiativeName: "S/4HANA Cutover" }]
);

const cve = init("i8", "Connected Vehicle Expansion", "INNOVATION", "DRAFT", "HIGH", "H3_LATER", "LATER", "GREEN",
  [{ name: "Halloran SDV Platform", rationalizationStatus: "INVEST", lifecycle: "PLANNED" }],
  [{ name: "Connected Vehicle Services", l1Name: "Connected Vehicle Services", strategicImportance: "CRITICAL", currentMaturity: "DEVELOPING", targetMaturity: "OPTIMIZING" }],
  [{ initiativeId: "i2", initiativeName: "OTA Platform Stand-up" }]
);

const dpr = init("i9", "Dealer Portal Refresh", "DIGITALISATION", "DRAFT", "MEDIUM", "H3_LATER", "LATER", "GREEN",
  [],
  [],
  [{ initiativeId: "i3", initiativeName: "AS/400 Decommission" }]
);

const ALL = [sap, ota, as400, cyber, c360, mes, ecm, cve, dpr];

function buildWaveBlock(wave: "NOW" | "NEXT" | "LATER"): WaveBlock {
  const items = ALL.filter((i) => i.wave === wave).sort((a, b) => b.priorityWeight - a.priorityWeight);
  const ragMix: any = { GREEN: 0, AMBER: 0, RED: 0 };
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
}

const metrics: ArchitectureRoadmapMetrics = {
  totalInitiatives: ALL.length,
  byCategory: ALL.reduce((acc, i) => ({ ...acc, [i.category]: (acc[i.category] ?? 0) + 1 }), {} as Record<string, number>),
  byStatus: ALL.reduce((acc, i) => ({ ...acc, [i.status]: (acc[i.status] ?? 0) + 1 }), {} as Record<string, number>),
  byPriority: ALL.reduce((acc, i) => ({ ...acc, [i.priority]: (acc[i.priority] ?? 0) + 1 }), {} as Record<string, number>),
  byRagStatus: ALL.reduce((acc, i) => ({ ...acc, [i.ragStatus]: (acc[i.ragStatus] ?? 0) + 1 }), {} as Record<string, number>),
  waves: { NOW: buildWaveBlock("NOW"), NEXT: buildWaveBlock("NEXT"), LATER: buildWaveBlock("LATER") },
  topInitiativesByImpact: ALL.slice().sort((a, b) => b.priorityWeight - a.priorityWeight).slice(0, 7),
  dependencyNetwork: {
    edgeCount: ALL.reduce((s, i) => s + i.dependsOn.length, 0),
    connectedCount: ALL.filter((i) => i.dependsOn.length + i.blocking.length > 0).length,
    isolatedCount: ALL.filter((i) => i.dependsOn.length + i.blocking.length === 0).length,
    keystoneInitiatives: [
      { id: "i1", name: "S/4HANA Cutover", inDegree: 3 },
      { id: "i2", name: "OTA Platform Stand-up", inDegree: 1 },
      { id: "i3", name: "AS/400 Decommission", inDegree: 1 },
    ],
  },
  crossDeliverableCoverage: {
    appLinkedShare: 8 / 9,
    capabilityLinkedShare: 8 / 9,
    fullBridgeShare: 8 / 9,
  },
  workspaceSpecificRisks: {
    wave1WithoutOwner: { count: 0, initiatives: [] },
    redRagInitiatives: { count: 1, initiatives: ["AS/400 Decommission"] },
    orphanedInitiatives: { count: 1, initiatives: ["Dealer Portal Refresh"] },
    blockedByIncomplete: { count: 4, initiatives: ["Customer 360 Consolidation", "MES Modernization", "ECM Uplift", "Connected Vehicle Expansion"] },
  },
  allInitiatives: ALL,
};

async function main() {
  console.log("Building Architecture Roadmap (full path, in-memory fixture)…");
  const result = await buildArchitectureRoadmapDocx({
    clientName: "Halloran Motor Company",
    brandHex: "#5A4FCF",
    preparedBy: "Smoke Test",
    engagementCode: "HALLORAN-2026-05",
    contactLine: "test@example.com",
    metrics,
  });
  writeFileSync("/tmp/smoke-architecture-roadmap.docx", result.buffer);
  console.log(`  full: ${result.buffer.length} bytes, llmSource=${result.llmSource}, detail=${result.llmSourceDetail}`);
  if (result.buffer.length < 100_000) throw new Error("full doc too small");

  // Baseline path — sparse fixture
  const { buildArchitectureRoadmapBaselineReport } = await import(
    "../src/server/ai/deliverables/buildArchitectureRoadmapBaselineReport"
  );
  console.log("Building Architecture Roadmap Baseline Report (sparse fixture)…");
  const sparseMetrics = {
    ...metrics,
    totalInitiatives: 4,
    allInitiatives: ALL.slice(0, 4),
    waves: {
      NOW: { ...buildWaveBlock("NOW"), count: ALL.slice(0, 4).filter((i) => i.wave === "NOW").length, initiatives: ALL.slice(0, 4).filter((i) => i.wave === "NOW") },
      NEXT: { ...buildWaveBlock("NEXT"), count: 0, initiatives: [] },
      LATER: { ...buildWaveBlock("LATER"), count: 0, initiatives: [] },
    },
  };
  const baseline = await buildArchitectureRoadmapBaselineReport({
    clientName: "Halloran Motor Company",
    brandHex: "#5A4FCF",
    preparedBy: "Smoke Test",
    engagementCode: "HALLORAN-2026-05",
    contactLine: "test@example.com",
    metrics: sparseMetrics as any,
  });
  writeFileSync("/tmp/smoke-architecture-roadmap-baseline.docx", baseline.buffer);
  console.log(`  baseline: ${baseline.buffer.length} bytes, llmSource=${baseline.llmSource}`);
  // Baseline is text-only (no charts, by design — no chart is
  // meaningful at <8 initiatives). 12KB+ is plausible.
  if (baseline.buffer.length < 12_000) throw new Error("baseline doc too small");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
