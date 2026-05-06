import "server-only";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  BorderStyle,
  WidthType,
} from "docx";
import { anthropic } from "@/server/ai/client";
import { MODEL_SONNET } from "@/server/ai/models";
import {
  RATIONALIZATION_EXEC_SUMMARY_PROMPT,
  RATIONALIZATION_EXEC_SUMMARY_VERSION,
} from "@/server/ai/prompts/rationalizationExecSummary.v1";
import {
  RATIONALIZATION_BUCKET_NARRATIVES_PROMPT,
  RATIONALIZATION_BUCKET_NARRATIVES_VERSION,
} from "@/server/ai/prompts/rationalizationBucketNarratives.v1";
import {
  RATIONALIZATION_KEY_FINDINGS_PROMPT,
  RATIONALIZATION_KEY_FINDINGS_VERSION,
} from "@/server/ai/prompts/rationalizationKeyFindings.v1";
import {
  RATIONALIZATION_DEEP_DIVES_PROMPT,
  RATIONALIZATION_DEEP_DIVES_VERSION,
} from "@/server/ai/prompts/rationalizationDeepDives.v1";
import {
  buildActionTitle,
  buildHeading,
  buildCallout,
  buildKpiRow,
  buildStaticTOC,
  buildStatusPillCell,
  buildTable,
  clampForContrast,
  formatCurrency,
  formatCurrencyCompact,
  formatDateISO,
  lifecycleToTone,
  makeFooter,
  normalizeHex,
  renderCoverPage,
  renderInline,
  renderInsideCoverDisclaimer,
  renderSectionDivider,
} from "./_helpers";
import { T, TONE, type Tone } from "./tokens";
import {
  buildTimeQuadrantChart,
  bvToScore,
  thToScore,
  type QuadrantPoint,
} from "./charts/buildTimeQuadrantChart";
import { buildLifecycleDonut } from "./charts/buildLifecycleDonut";
import { buildVendorPareto } from "./charts/buildVendorPareto";
import { buildSavingsWaterfall } from "./charts/buildSavingsWaterfall";

export const RATIONALIZATION_TEMPLATE_VERSION = "3.0";
export const RATIONALIZATION_TEMPLATE_LABEL = `EAM Rationalization Template v${RATIONALIZATION_TEMPLATE_VERSION}`;
export const RATIONALIZATION_PROJECT_LABEL = "Application Rationalization Plan";

// ─── Types (exported for the metrics helper) ───────────────────

export type AppSummary = {
  id: string;
  name: string;
  vendor: string | null;
  rationalizationStatus: string;
  lifecycle: string;
  businessValue: string | null;
  technicalHealth: string | null;
  annualCostUsd: number;
  capabilityNames: string[];
  /** Per-capability maturity context for cross-deliverable bridge.
   *  Populated only when the capability has any of currentMaturity /
   *  targetMaturity / strategicImportance set to a non-default value;
   *  empty when the workspace has not assessed capabilities. */
  capabilityMaturity?: Array<{
    name: string;
    currentMaturity: string;
    targetMaturity: string;
    strategicImportance: string;
  }>;
};

type Bucket = { count: number; annualCostUsd: number; apps: AppSummary[] };

export type ClassifyHint = AppSummary & { reason: string };

export type RationalizationMetrics = {
  totalApps: number;
  activeApps: number;
  classifiedApps: number;
  coverageRatio: number;
  byClassification: Record<string, Bucket>;
  topEliminationCandidates: AppSummary[];
  topMigrationCandidates: AppSummary[];
  redundancyMatrix: Array<{
    capabilityName: string;
    appsCovering: AppSummary[];
  }>;
  projectedSavings: {
    eliminate3yrUsd: number;
    migrate3yrUsd: number;
    totalCandidate3yrUsd: number;
    assumptions: string[];
  };
  costCurrency: string;
  totalAnnualCostUsd: number;
  topAppsByCost: AppSummary[];
  lifecycleDistribution: Record<
    string,
    { count: number; annualCostUsd: number }
  >;
  vendorConcentration: Array<{
    vendor: string;
    count: number;
    annualCostUsd: number;
  }>;
  classifyFirst: ClassifyHint[];

  // ─── Snapshot-tier aggregates (v2.0) ─────────────────────────
  // Pure derivations from the data already fetched. Used by the
  // Portfolio Snapshot Report to surface buried headlines.

  /** PHASING_OUT + RETIRED — the run-cost most likely to slip. */
  phasingOut: {
    count: number;
    annualCostUsd: number;
    shareOfTotal: number;
  };
  /** Conservative split: vendor null/empty/internal-tag = in-house. */
  sourcing: {
    inHouse: { count: number; annualCostUsd: number };
    thirdParty: { count: number; annualCostUsd: number };
    inHouseShare: number;
  };
  /** Vendors with ≥2 apps — the multi-product exposure story. */
  multiProductVendors: Array<{
    vendor: string;
    count: number;
    annualCostUsd: number;
    apps: Array<{ name: string; capabilityNames: string[] }>;
  }>;
  /** Top-N concentration ratios for the Cost Overview headline. */
  topNConcentration: {
    top3Share: number;
    top10Share: number;
  };
  /** Apps with no capability mappings — blocks redundancy analysis. */
  capabilityGap: {
    unmappedAppCount: number;
    unmappedAnnualCostUsd: number;
    topCostlyOrphans: AppSummary[];
  };
  /** Largest single-vendor concentration. */
  vendorTopName: string;
  vendorTopShare: number;
};

export type RationalizationDocxInput = {
  clientName: string;
  brandHex: string | null;
  logoBytes?: Buffer | null;
  logoMimeType?: string | null;
  preparedBy?: string | null;
  /** Optional engagement metadata for the cover engagement-bar. */
  engagementCode?: string | null;
  contactLine?: string | null;
  metrics: RationalizationMetrics;
};

export type RationalizationDocxResult = {
  buffer: Buffer;
  templateVersion: string;
  /** Tracks fact-grounding outcomes per LLM call for traceability. */
  llmSource: "llm" | "partial_fallback" | "deterministic_fallback";
};

// ─── Bucket narrative shape ────────────────────────────────────

type BucketNarrative = {
  governingThought: string;
  whyNow: [string, string, string];
  whatItMeans: string;
  action: string;
};

type AllBucketNarratives = {
  ELIMINATE: BucketNarrative;
  MIGRATE: BucketNarrative;
  INVEST: BucketNarrative;
  TOLERATE: BucketNarrative;
};

// ─── Main builder ──────────────────────────────────────────────

export async function buildRationalizationDocx(
  input: RationalizationDocxInput
): Promise<RationalizationDocxResult> {
  const brandHex = normalizeHex(input.brandHex);
  const m = input.metrics;
  const cur = m.costCurrency;
  const fmt = (n: number) => formatCurrency(n, cur);
  const fmtCompact = (n: number) => formatCurrencyCompact(n, cur);

  // Pre-format dollar values once so the LLM input + the doc body
  // share exact strings — what makes the post-check tractable.
  // Each cost ships in BOTH long-form ("£8,400,000") and compact-
  // form ("£8.4M") so the LLM can pick whichever reads more
  // naturally; the post-check accepts either.
  const facts = buildExecSummaryFacts(m, fmt, fmtCompact, input.clientName);
  const bucketFacts = buildBucketFacts(m, fmt, fmtCompact, input.clientName);
  const keyFindingsFacts = buildKeyFindingsFacts(
    m,
    fmt,
    fmtCompact,
    input.clientName
  );

  // Top-5 apps by cost get per-app deep-dive prose. Selection is
  // deterministic; the LLM only writes about apps surfaced here.
  const topAppsForDeepDives = m.topAppsByCost
    .filter((a) => !!a.rationalizationStatus)
    .slice(0, 5);
  const deepDivesFacts = buildDeepDivesFacts(
    m,
    topAppsForDeepDives,
    fmt,
    fmtCompact,
    input.clientName
  );

  // Build chart inputs from metrics. Charts are deterministic;
  // they render in parallel with the LLM calls below.
  const quadrantPoints: QuadrantPoint[] = [
    ...(m.byClassification.ELIMINATE?.apps ?? []),
    ...(m.byClassification.MIGRATE?.apps ?? []),
    ...(m.byClassification.INVEST?.apps ?? []),
    ...(m.byClassification.TOLERATE?.apps ?? []),
  ].map((a) => ({
    x: bvToScore(a.businessValue),
    y: thToScore(a.technicalHealth),
    label: a.name,
    size: a.annualCostUsd,
    disposition: a.rationalizationStatus as
      | "ELIMINATE"
      | "MIGRATE"
      | "INVEST"
      | "TOLERATE",
  }));

  const lifecycleSegments = Object.entries(m.lifecycleDistribution)
    .map(([key, v]) => ({
      label: key,
      count: v.count,
      cost: v.annualCostUsd,
      tone: lifecycleToTone(key),
    }))
    .sort((a, b) => b.cost - a.cost);

  const vendorBars = m.vendorConcentration.map((v) => ({
    vendor: v.vendor,
    cost: v.annualCostUsd,
    appCount: v.count,
  }));

  // Four LLM calls + four chart renders in parallel.
  //   LLM:
  //     - Five Key Findings (synthesis layer)
  //     - Executive Summary
  //     - Bucket Narratives (1 call, all 4 buckets)
  //     - Per-app Deep Dives (1 call, top 5 by cost)
  //   Charts (resvg-wasm, ~50-200ms each, embarrassingly parallel):
  //     - TIME 2×2 scatter
  //     - Lifecycle donut
  //     - Vendor Pareto
  //     - Savings waterfall
  // All eight kicked off in one Promise.all. LLM cost ceiling per
  // generation: ~$0.20 on Sonnet. All LLM calls have deterministic
  // fallbacks; X-Llm-Source aggregates the worst.
  const [
    execSummary,
    bucketNarratives,
    keyFindings,
    deepDives,
    timeQuadrantChart,
    lifecycleDonutChart,
    vendorParetoChart,
    savingsWaterfallChart,
  ] = await Promise.all([
    generateExecutiveSummary(facts),
    generateBucketNarratives(bucketFacts, m, fmt),
    generateKeyFindings(keyFindingsFacts, fmt, fmtCompact, m),
    generateDeepDives(deepDivesFacts),
    buildTimeQuadrantChart({ points: quadrantPoints, brandHex }).catch(
      (err: unknown) => {
        console.warn(
          JSON.stringify({
            evt: "chart_render_error",
            chart: "time_quadrant",
            message: err instanceof Error ? err.message : String(err),
          })
        );
        return null;
      }
    ),
    buildLifecycleDonut({
      segments: lifecycleSegments,
      totalCost: m.totalAnnualCostUsd,
      totalApps: m.totalApps,
      costCurrency: m.costCurrency,
      brandHex,
    }).catch((err: unknown) => {
      console.warn(
        JSON.stringify({
          evt: "chart_render_error",
          chart: "lifecycle_donut",
          message: err instanceof Error ? err.message : String(err),
        })
      );
      return null;
    }),
    buildVendorPareto({
      vendors: vendorBars,
      totalCost: m.totalAnnualCostUsd,
      costCurrency: m.costCurrency,
      brandHex,
    }).catch((err: unknown) => {
      console.warn(
        JSON.stringify({
          evt: "chart_render_error",
          chart: "vendor_pareto",
          message: err instanceof Error ? err.message : String(err),
        })
      );
      return null;
    }),
    buildSavingsWaterfall({
      totalAnnualCostUsd: m.totalAnnualCostUsd,
      eliminate3yrUsd: m.projectedSavings.eliminate3yrUsd,
      migrate3yrUsd: m.projectedSavings.migrate3yrUsd,
      costCurrency: m.costCurrency,
      brandHex,
    }).catch((err: unknown) => {
      console.warn(
        JSON.stringify({
          evt: "chart_render_error",
          chart: "savings_waterfall",
          message: err instanceof Error ? err.message : String(err),
        })
      );
      return null;
    }),
  ]);

  // Aggregate llmSource: "llm" when all four passed; "deterministic_
  // fallback" when all four failed; "partial_fallback" otherwise.
  // The deep-dives call is excluded from the aggregate when there
  // are no top apps (empty input → trivial "deterministic" by
  // construction, not a regression).
  const sourceVotes: Array<"llm" | "deterministic_fallback"> = [
    execSummary.source,
    bucketNarratives.source,
    keyFindings.source,
  ];
  if (topAppsForDeepDives.length > 0) sourceVotes.push(deepDives.source);
  const llmSource: RationalizationDocxResult["llmSource"] =
    sourceVotes.every((s) => s === "llm")
      ? "llm"
      : sourceVotes.every((s) => s === "deterministic_fallback")
        ? "deterministic_fallback"
        : "partial_fallback";

  const children: Array<Paragraph | Table> = [];

  const today = formatDateISO();
  const phasingOutEliminate =
    (m.byClassification.ELIMINATE?.apps ?? []).filter(
      (a) => a.lifecycle === "PHASING_OUT" || a.lifecycle === "RETIRED"
    ).length;
  const phasingOutMigrate =
    (m.byClassification.MIGRATE?.apps ?? []).filter(
      (a) => a.lifecycle === "PHASING_OUT" || a.lifecycle === "RETIRED"
    ).length;
  const wave1Count = phasingOutEliminate + phasingOutMigrate;

  // ─── Cover (with engagement bar) ────────────────────────────
  children.push(
    ...renderCoverPage({
      documentTitle: "Application Rationalization Plan",
      clientName: input.clientName,
      brandHex,
      templateVersionLabel: RATIONALIZATION_TEMPLATE_LABEL,
      preparedBy: input.preparedBy ?? null,
      logoBytes: input.logoBytes ?? null,
      logoMimeType: input.logoMimeType ?? null,
      engagementCode: input.engagementCode ?? null,
      contactLine: input.contactLine ?? null,
      confidentialityLabel: `Strictly Confidential — Prepared for ${input.clientName}`,
    })
  );

  // ─── Inside-cover disclaimer ───────────────────────────────
  children.push(
    ...renderInsideCoverDisclaimer({
      clientName: input.clientName,
      date: today,
      brandHex,
    })
  );

  // ─── Static Table of Contents ──────────────────────────────
  // Page numbers are best-guess from the section sequence; an
  // off-by-one is acceptable. Word's auto-TOC requires "click to
  // update fields" on first open which is unprofessional.
  children.push(
    ...buildStaticTOC({
      brandHex,
      entries: [
        { title: "1. Synthesis", pageNumber: 4, indent: 0 },
        { title: "Portfolio at a Glance", pageNumber: 4, indent: 1 },
        { title: "Five Key Findings", pageNumber: 5, indent: 1 },
        { title: "Portfolio Dashboard", pageNumber: 6, indent: 1 },
        { title: "2. Analysis", pageNumber: 7, indent: 0 },
        { title: "Executive Summary", pageNumber: 7, indent: 1 },
        { title: "Portfolio Snapshot", pageNumber: 8, indent: 1 },
        { title: "TIME Quadrant Analysis", pageNumber: 9, indent: 1 },
        { title: "Vendor & Sourcing Analysis", pageNumber: 10, indent: 1 },
        { title: "Redundancy Map", pageNumber: 12, indent: 1 },
        { title: "3. Bucket Plans", pageNumber: 13, indent: 0 },
        { title: "ELIMINATE — Decommission Candidates", pageNumber: 13, indent: 1 },
        { title: "MIGRATE — Replacement Candidates", pageNumber: 14, indent: 1 },
        { title: "INVEST — Strategic Spend", pageNumber: 15, indent: 1 },
        { title: "TOLERATE — Hold Position", pageNumber: 16, indent: 1 },
        { title: "4. Application Deep Dives", pageNumber: 17, indent: 0 },
        { title: "5. Recommendations", pageNumber: 22, indent: 0 },
        { title: "Decommission Roadmap", pageNumber: 22, indent: 1 },
        { title: "Financial Impact", pageNumber: 23, indent: 1 },
        { title: "Risks & Considerations", pageNumber: 24, indent: 1 },
        { title: "Next Steps", pageNumber: 25, indent: 1 },
        { title: "6. Appendices", pageNumber: 26, indent: 0 },
        { title: "Appendix A — Classified Applications", pageNumber: 26, indent: 1 },
        { title: "Appendix B — Methodology & Data Sources", pageNumber: 27, indent: 1 },
        { title: "Appendix C — Glossary", pageNumber: 28, indent: 1 },
      ],
    })
  );

  // ═══ 1. SYNTHESIS ═══════════════════════════════════════════
  children.push(
    ...renderSectionDivider({
      number: "1",
      title: "Synthesis",
      subtitle:
        "The headline number, the disposition mix, the largest single risk, and the recommended Wave-1 action — answered before the analysis begins.",
      brandHex,
    })
  );

  // ─── Portfolio at a Glance — KPI hero row ──────────────────
  children.push(
    buildHeading(
      "Portfolio at a Glance",
      HeadingLevel.HEADING_1,
      brandHex,
      { spacingBefore: 0 }
    )
  );
  children.push(
    buildActionTitle(
      `${m.totalApps} applications carry ${fmt(m.totalAnnualCostUsd)} in annual run-cost; the recommended programme avoids ${fmt(m.projectedSavings.totalCandidate3yrUsd)} over three years and anchors on ${wave1Count} Wave-1 retirements.`,
      brandHex
    )
  );
  children.push(
    buildKpiRow({
      brandHex,
      tiles: [
        { value: String(m.totalApps), label: "Active applications" },
        { value: fmtCompact(m.totalAnnualCostUsd), label: "Annual run-cost" },
        {
          value: fmtCompact(m.projectedSavings.totalCandidate3yrUsd),
          label: "3-yr savings",
        },
        {
          value: `${Math.round(m.coverageRatio * 100)}%`,
          label: "Disposition coverage",
        },
        {
          value: String(m.redundancyMatrix.length),
          label: "Multi-served capabilities",
        },
        { value: String(wave1Count), label: "Wave-1 candidates" },
      ],
    })
  );

  // Lifecycle donut chart — visual summary of the portfolio's
  // disposition pressure. Anchors the synthesis layer with the
  // first chart a partner-skim reader sees.
  if (lifecycleDonutChart) {
    children.push(lifecycleDonutChart);
  }

  // ─── Five Key Findings ─────────────────────────────────────
  children.push(
    buildHeading("Five Key Findings", HeadingLevel.HEADING_1, brandHex)
  );
  children.push(
    buildActionTitle(
      `Five findings frame the engagement; each leads with the answer and closes with the recommended sequence.`,
      brandHex
    )
  );
  for (let i = 0; i < keyFindings.findings.length; i++) {
    const f = keyFindings.findings[i]!;
    children.push(
      new Paragraph({
        spacing: { before: 160, after: 60 },
        children: [
          new TextRun({
            text: `${i + 1}. `,
            bold: true,
            color: clampForContrastSafe(brandHex),
            size: T.body,
          }),
          new TextRun({
            text: f.title,
            bold: true,
            color: clampForContrastSafe(brandHex),
            size: T.body,
          }),
        ],
      })
    );
    children.push(
      new Paragraph({
        spacing: { after: 120, line: 320 },
        indent: { left: 360 },
        children: renderInline(f.body),
      })
    );
  }

  // ─── Portfolio Dashboard — synthesis table with status pills ─
  children.push(
    buildHeading("Portfolio Dashboard", HeadingLevel.HEADING_1, brandHex)
  );
  children.push(
    buildActionTitle(
      `The disposition mix at a glance: which buckets, how much spend, what saving, and which application anchors each.`,
      brandHex
    )
  );
  children.push(buildPortfolioDashboard(m, fmt, fmtCompact, brandHex));

  children.push(
    sectionCloser(
      `${m.byClassification.MIGRATE?.count ?? 0} MIGRATE retirements anchor the timing; ${m.vendorTopName} commercial concentration anchors the price; the ${m.byClassification.INVEST?.count ?? 0} INVEST applications set the trajectory.`,
      brandHex
    )
  );

  // ═══ 2. ANALYSIS ════════════════════════════════════════════
  children.push(
    ...renderSectionDivider({
      number: "2",
      title: "Analysis",
      subtitle:
        "How the portfolio looks today: cost concentration, business-value vs technical-health, vendor exposure, and capability redundancy.",
      brandHex,
    })
  );

  // ─── Executive Summary (LLM) ───────────────────────────────
  children.push(
    buildHeading("Executive Summary", HeadingLevel.HEADING_1, brandHex, {
      spacingBefore: 0,
    })
  );
  children.push(
    buildActionTitle(
      `The portfolio carries ${fmt(m.totalAnnualCostUsd)} in annual run-cost; ${m.classifiedApps} of ${m.totalApps} applications carry a TIME disposition, releasing ${fmt(m.projectedSavings.totalCandidate3yrUsd)} of run-cost over three years under the assumptions on the next page.`,
      brandHex
    )
  );
  for (const para of execSummary.text.split(/\n{2,}/)) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    children.push(
      new Paragraph({
        spacing: { after: 160, line: 320 },
        children: renderInline(trimmed),
      })
    );
  }

  // ─── Portfolio Snapshot ────────────────────────────────────
  const eliminatePctOfRunCost = pctOf(
    m.byClassification.ELIMINATE?.annualCostUsd ?? 0,
    m.totalAnnualCostUsd
  );
  children.push(
    buildHeading("Portfolio Snapshot", HeadingLevel.HEADING_1, brandHex)
  );
  children.push(
    buildActionTitle(
      `Full disposition coverage on a ${fmtCompact(m.totalAnnualCostUsd)} portfolio surfaces a ${fmtCompact(m.projectedSavings.totalCandidate3yrUsd)} three-year programme; ELIMINATE alone returns ${eliminatePctOfRunCost}% of annual run-cost across the horizon.`,
      brandHex
    )
  );
  children.push(
    buildTable({
      headers: ["Disposition", "Apps", "Annual cost", "% of run-cost"],
      rows: (["TOLERATE", "INVEST", "MIGRATE", "ELIMINATE"] as const).map(
        (key) => [
          key,
          String(m.byClassification[key]?.count ?? 0),
          fmt(m.byClassification[key]?.annualCostUsd ?? 0),
          `${pctOf(m.byClassification[key]?.annualCostUsd ?? 0, m.totalAnnualCostUsd)}%`,
        ]
      ),
      brandHex,
      columnWidthsPct: [30, 18, 30, 22],
      numericColumns: [1, 2, 3],
      barColumns: [
        { index: 3, valueOf: (row) => parseInt(row[3]!, 10) / 100 },
      ],
    })
  );

  // ─── TIME Quadrant Analysis ────────────────────────────────
  const highPoorCount = (m.byClassification.MIGRATE?.apps ?? []).filter(
    (a) =>
      (a.businessValue === "HIGH" || a.businessValue === "CRITICAL") &&
      (a.technicalHealth === "FAIR" ||
        a.technicalHealth === "POOR" ||
        a.technicalHealth === "TH_CRITICAL")
  ).length;
  const highPoorCost = (m.byClassification.MIGRATE?.apps ?? [])
    .filter(
      (a) =>
        (a.businessValue === "HIGH" || a.businessValue === "CRITICAL") &&
        (a.technicalHealth === "FAIR" ||
          a.technicalHealth === "POOR" ||
          a.technicalHealth === "TH_CRITICAL")
    )
    .reduce((s, a) => s + a.annualCostUsd, 0);
  children.push(
    buildHeading("TIME Quadrant Analysis", HeadingLevel.HEADING_1, brandHex)
  );
  children.push(
    buildActionTitle(
      highPoorCount > 0
        ? `${highPoorCount} application${highPoorCount === 1 ? "" : "s"} carrying ${fmtCompact(highPoorCost)} sit in the high-value / poor-health quadrant — the migration backlog that justifies the platform-modernization budget.`
        : `Applications cluster in the strategic-and-healthy quadrant; the lever in this portfolio is consolidation, not platform-debt remediation.`,
      brandHex
    )
  );
  // TIME 2×2 scatter chart — bubble per app, size = annual cost,
  // quadrant tints by disposition. Replaces the v2 text-table
  // rendering (which we keep below as a print/accessibility
  // fallback so screen readers still see the app placements).
  if (timeQuadrantChart) {
    children.push(timeQuadrantChart);
  }
  children.push(buildQuadrantTable(m, brandHex));
  children.push(
    new Paragraph({
      spacing: { before: 80, after: 200 },
      children: [
        new TextRun({
          text: "Placement: CRITICAL business value reads as HIGH; MEDIUM, UNKNOWN, and unset read as LOW. FAIR technical health reads as Poor (the Good half is reserved for actively healthy systems).",
          italics: true,
          size: 18,
          color: "6B7280",
        }),
      ],
    })
  );

  // ─── Vendor & Sourcing Analysis ────────────────────────────
  pushVendorSourcingSection(
    children,
    m,
    fmt,
    fmtCompact,
    brandHex,
    vendorParetoChart
  );

  // ─── Redundancy Map ────────────────────────────────────────
  children.push(
    buildHeading("Redundancy Map", HeadingLevel.HEADING_1, brandHex)
  );
  if (m.redundancyMatrix.length === 0) {
    children.push(
      buildActionTitle(
        "No capability is served by more than one application; consolidation is not the lever in this portfolio.",
        brandHex
      )
    );
  } else {
    const topClusterCount = m.redundancyMatrix[0]?.appsCovering.length ?? 0;
    const topClusterName =
      m.redundancyMatrix[0]?.capabilityName ?? "—";
    children.push(
      buildActionTitle(
        `${m.redundancyMatrix.length} multi-served capabilit${m.redundancyMatrix.length === 1 ? "y" : "ies"} cluster across the portfolio; the densest cluster (${topClusterName}, ${topClusterCount} apps) anchors the consolidation case beyond bucket-level totals.`,
        brandHex
      )
    );
    children.push(
      buildTable({
        headers: ["Capability", "Apps", "Applications covering it"],
        rows: m.redundancyMatrix.slice(0, 30).map((r) => [
          r.capabilityName,
          String(r.appsCovering.length),
          r.appsCovering.map((a) => a.name).join(", "),
        ]),
        brandHex,
        columnWidthsPct: [30, 12, 58],
        numericColumns: [1],
      })
    );
  }

  children.push(
    sectionCloser(
      `Cost concentration plus vendor concentration plus capability redundancy frame the three levers; bucket plans below sequence the actions.`,
      brandHex
    )
  );

  // ═══ 3. BUCKET PLANS ════════════════════════════════════════
  children.push(
    ...renderSectionDivider({
      number: "3",
      title: "Bucket Plans",
      subtitle:
        "Each TIME bucket gets its own governing thought, evidence, implication, and recommended action.",
      brandHex,
    })
  );

  pushBucketSection(
    children,
    "ELIMINATE — Decommission Candidates",
    bucketNarratives.narratives.ELIMINATE,
    m.topEliminationCandidates,
    m.byClassification.ELIMINATE,
    fmt,
    fmtCompact,
    brandHex
  );
  pushBucketSection(
    children,
    "MIGRATE — Replacement Candidates",
    bucketNarratives.narratives.MIGRATE,
    m.topMigrationCandidates,
    m.byClassification.MIGRATE,
    fmt,
    fmtCompact,
    brandHex
  );
  pushBucketSection(
    children,
    "INVEST — Strategic Spend",
    bucketNarratives.narratives.INVEST,
    (m.byClassification.INVEST?.apps ?? [])
      .slice()
      .sort((a, b) => b.annualCostUsd - a.annualCostUsd)
      .slice(0, 10),
    m.byClassification.INVEST,
    fmt,
    fmtCompact,
    brandHex
  );
  pushBucketSection(
    children,
    "TOLERATE — Hold Position",
    bucketNarratives.narratives.TOLERATE,
    (m.byClassification.TOLERATE?.apps ?? [])
      .slice()
      .sort((a, b) => b.annualCostUsd - a.annualCostUsd)
      .slice(0, 10),
    m.byClassification.TOLERATE,
    fmt,
    fmtCompact,
    brandHex
  );

  children.push(
    sectionCloser(
      `Each bucket carries its own clock; the deep dives below extend the case for the top-cost applications individually.`,
      brandHex
    )
  );

  // ═══ 4. APPLICATION DEEP DIVES ══════════════════════════════
  if (topAppsForDeepDives.length > 0) {
    children.push(
      ...renderSectionDivider({
        number: "4",
        title: "Application Deep Dives",
        subtitle: `One page per top-cost application. Disposition rationale, capability mapping, recommended path, and wave assignment.`,
        brandHex,
      })
    );
    for (const app of topAppsForDeepDives) {
      pushDeepDiveSection(
        children,
        app,
        deepDives.byId[app.id] ?? null,
        m,
        fmt,
        fmtCompact,
        brandHex
      );
    }
    children.push(
      sectionCloser(
        `Top-cost applications carry the programme's substance; the recommendations chapter sequences the timing, financial case, and execution scaffolding.`,
        brandHex
      )
    );
  }

  // ═══ 5. RECOMMENDATIONS ═════════════════════════════════════
  children.push(
    ...renderSectionDivider({
      number: topAppsForDeepDives.length > 0 ? "5" : "4",
      title: "Recommendations",
      subtitle: `The decommission roadmap, the financial case, the canonical risks, and the first thirty days of execution.`,
      brandHex,
    })
  );

  // ─── Decommission Roadmap ──────────────────────────────────
  children.push(
    buildHeading("Decommission Roadmap", HeadingLevel.HEADING_1, brandHex, {
      spacingBefore: 0,
    })
  );
  const roadmapRows = buildRoadmapRows(m, fmt);
  if (roadmapRows.length === 0) {
    children.push(
      buildActionTitle(
        "No ELIMINATE or MIGRATE candidates carry costs to schedule; the roadmap is empty by construction.",
        brandHex
      )
    );
  } else {
    const nowCount = roadmapRows.filter((r) => r[2] === "NOW (<12mo)").length;
    children.push(
      buildActionTitle(
        nowCount > 0
          ? `${nowCount} of ${roadmapRows.length} retirement${roadmapRows.length === 1 ? "" : "s"} sit in the NOW horizon (<12 months); their sequencing anchors change-fatigue management across the downstream waves.`
          : `${roadmapRows.length} retirement${roadmapRows.length === 1 ? "" : "s"} are sequenced across NEXT and LATER horizons; lifecycle and cost magnitude drive placement.`,
        brandHex
      )
    );
    children.push(
      buildTable({
        headers: ["Application", "Action", "Horizon", "3-yr saving"],
        rows: roadmapRows,
        brandHex,
        columnWidthsPct: [38, 18, 18, 26],
        numericColumns: [3],
      })
    );
  }

  // ─── Financial Impact ──────────────────────────────────────
  children.push(
    buildHeading("Financial Impact", HeadingLevel.HEADING_1, brandHex)
  );
  children.push(
    buildActionTitle(
      `The recommended programme avoids ${fmtCompact(m.projectedSavings.totalCandidate3yrUsd)} of run-cost across a three-year horizon; one-time decommission and migration costs are excluded and surface separately when building the business case.`,
      brandHex
    )
  );
  // Savings waterfall — shows the three-year run-cost reduction as
  // a budget reconciliation: baseline → ELIMINATE avoidance →
  // MIGRATE avoidance → net post-programme spend.
  if (savingsWaterfallChart) {
    children.push(savingsWaterfallChart);
  }
  children.push(
    buildTable({
      headers: ["Component", "3-year savings", "Basis"],
      rows: [
        [
          "ELIMINATE candidates",
          fmt(m.projectedSavings.eliminate3yrUsd),
          "100% of annual run-cost avoided",
        ],
        [
          "MIGRATE candidates",
          fmt(m.projectedSavings.migrate3yrUsd),
          "50% of annual run-cost avoided (typical SaaS swap)",
        ],
        [
          "Total candidate savings",
          fmt(m.projectedSavings.totalCandidate3yrUsd),
          "Sum of the above",
        ],
      ],
      brandHex,
      columnWidthsPct: [34, 22, 44],
      numericColumns: [1],
    })
  );
  // Methodology callout (info-tone)
  children.push(
    buildCallout({
      title: "Assumptions used to compute projected savings",
      tone: "info",
      bullets: m.projectedSavings.assumptions,
      brandHex,
    })
  );

  // ─── Risks & Considerations ────────────────────────────────
  children.push(
    buildHeading("Risks & Considerations", HeadingLevel.HEADING_1, brandHex)
  );
  // Count how many portfolio-specific rows the table will surface
  // so the action title can lead with workspace-grounded framing.
  let workspaceRiskCount = 0;
  if (m.vendorTopShare >= 0.15) workspaceRiskCount++;
  if (m.phasingOut.count >= 3) workspaceRiskCount++;
  if (
    m.sourcing.inHouse.annualCostUsd > 0 &&
    m.sourcing.inHouseShare >= 0.15
  )
    workspaceRiskCount++;
  children.push(
    buildActionTitle(
      workspaceRiskCount > 0
        ? `${workspaceRiskCount} portfolio-specific risk${workspaceRiskCount === 1 ? "" : "s"} sit above the canonical seven; vendor concentration, forced-timeline exposure, and in-house spend visibility frame the workspace-grounded watch-list.`
        : "Seven canonical risks attend any rationalization programme; each carries a likelihood, impact, and named mitigation gating event.",
      brandHex
    )
  );
  children.push(buildRisksTable(brandHex, m, fmt, fmtCompact));

  // ─── Next Steps ────────────────────────────────────────────
  children.push(buildHeading("Next Steps", HeadingLevel.HEADING_1, brandHex));
  children.push(
    buildActionTitle(
      "Six actions move the programme from analysis to execution within twelve weeks; owners and dependencies are placeholders for engagement-team override.",
      brandHex
    )
  );
  children.push(
    new Paragraph({
      spacing: { after: 160, line: 320 },
      children: renderInline(
        `**Over the next 30 days,** capability owners validate the ${m.byClassification.ELIMINATE?.count ?? 0} ELIMINATE candidates against the redundancy map and confirm contract cliffs called out in the financial section. The technical-architecture team load-tests retained platforms before the first MIGRATE wave opens. Steerco approval gates the start of Wave 1 sunset by Week 12.`
      ),
    })
  );
  children.push(buildNextStepsTable(m, brandHex));

  children.push(
    sectionCloser(
      `The roadmap dates the work; the financial case sizes the prize; the risks frame the gating events; the next-30-day actions kick the programme off.`,
      brandHex
    )
  );

  // ═══ 6. APPENDICES ══════════════════════════════════════════
  children.push(
    ...renderSectionDivider({
      number: topAppsForDeepDives.length > 0 ? "6" : "5",
      title: "Appendices",
      subtitle:
        "Full classified-applications listing, methodology and data lineage, and a glossary of the framework terminology.",
      brandHex,
    })
  );

  // ─── Appendix A — Classified Applications ──────────────────
  children.push(
    buildHeading(
      "Appendix A — Classified Applications",
      HeadingLevel.HEADING_1,
      brandHex,
      { spacingBefore: 0 }
    )
  );
  const allClassified: AppSummary[] = [
    ...(m.byClassification.ELIMINATE?.apps ?? []),
    ...(m.byClassification.MIGRATE?.apps ?? []),
    ...(m.byClassification.INVEST?.apps ?? []),
    ...(m.byClassification.TOLERATE?.apps ?? []),
  ];
  if (allClassified.length === 0) {
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: renderInline(
          "*No applications carry a TIME classification yet.*"
        ),
      })
    );
  } else {
    children.push(
      buildTable({
        headers: [
          "Application",
          "Vendor",
          "Disposition",
          "Lifecycle",
          "Annual cost",
        ],
        rows: allClassified.map((a) => [
          a.name,
          a.vendor ?? "—",
          a.rationalizationStatus,
          a.lifecycle.replace(/_/g, " "),
          fmt(a.annualCostUsd),
        ]),
        brandHex,
        columnWidthsPct: [32, 18, 16, 14, 20],
        numericColumns: [4],
      })
    );
  }

  // ─── Appendix B — Methodology and Data Sources ─────────────
  children.push(
    buildHeading(
      "Appendix B — Methodology & Data Sources",
      HeadingLevel.HEADING_1,
      brandHex
    )
  );
  children.push(
    new Paragraph({
      spacing: { after: 120, line: 320 },
      children: renderInline(
        `This deliverable was generated on ${today} from the live application portfolio in the EAM platform. Counts and costs reflect the values stored on each Application record at the time of generation; the source fields are *rationalizationStatus*, *lifecycle*, *businessValue*, *technicalHealth*, *annualCostUsd*, and the application-capability mapping table.`
      ),
    })
  );
  children.push(
    new Paragraph({
      spacing: { after: 120, line: 320 },
      children: renderInline(
        `**Formulas.** Three-year savings = (ELIMINATE annual run-cost × 3) + (MIGRATE annual run-cost × 0.5 × 3). In-house detection: vendor null/empty OR matches /^in[- ]house|internal|bespoke|custom|self[- ]built/. Multi-product vendor: vendor count ≥ 2. The Risks and Next Steps sections are template defaults intended for engagement-team override.`
      ),
    })
  );

  // ─── Appendix C — Glossary ─────────────────────────────────
  children.push(
    buildHeading("Appendix C — Glossary", HeadingLevel.HEADING_1, brandHex)
  );
  children.push(buildGlossaryTable(brandHex));

  const doc = new Document({
    creator: input.clientName,
    title: `${input.clientName} — Application Rationalization Plan`,
    description: RATIONALIZATION_TEMPLATE_LABEL,
    sections: [
      {
        properties: {},
        children: children as never,
        footers: {
          default: makeFooter(input.clientName, RATIONALIZATION_PROJECT_LABEL),
        },
      },
    ],
    styles: {
      default: { document: { run: { size: 22, font: "Calibri" } } },
    },
  });

  const buffer = await Packer.toBuffer(doc);
  return {
    buffer: Buffer.from(buffer),
    templateVersion: RATIONALIZATION_TEMPLATE_VERSION,
    llmSource,
  };
}

// ─── Helpers ───────────────────────────────────────────────────

function pushBucketSection(
  children: Array<Paragraph | Table>,
  title: string,
  narrative: BucketNarrative,
  apps: AppSummary[],
  bucket: Bucket | undefined,
  fmt: (n: number) => string,
  fmtCompact: (n: number) => string,
  brandHex: string
): void {
  children.push(buildHeading(title, HeadingLevel.HEADING_1, brandHex));

  if (!bucket || bucket.count === 0) {
    children.push(
      buildCallout({
        title: "No applications in this bucket",
        tone: "info",
        bullets: [
          "Applications classified into this disposition will populate this section in future runs.",
        ],
        brandHex,
      })
    );
    return;
  }

  // Action title — prescriptive (Pyramid Principle). Surface the
  // bucket-specific finding directly so the section opens with a
  // recommendation, not a count. Uses the LLM-generated narrative
  // action line where available; falls back to a finding-shaped
  // template that derives from the bucket's data when the LLM
  // call returned a deterministic fallback.
  const phasingOutCount = apps.filter(
    (a) => a.lifecycle === "PHASING_OUT" || a.lifecycle === "RETIRED"
  ).length;
  const top2 = apps
    .slice()
    .sort((a, b) => b.annualCostUsd - a.annualCostUsd)
    .slice(0, 2)
    .map((a) => a.name);
  const bucketKey = title.split(" ")[0]; // "ELIMINATE", "MIGRATE", etc.
  const phasingFragment =
    phasingOutCount > 0
      ? ` ${phasingOutCount} sit in PHASING_OUT lifecycle on a forced timeline.`
      : "";
  const bucketActionTitle =
    bucketKey === "ELIMINATE"
      ? `Decommissioning ${top2.join(" and ")} releases ${fmtCompact(bucket.annualCostUsd)} annually and removes ${bucket.count === 1 ? "the" : "both"} unsupported-platform exposure${bucket.count === 1 ? "" : "s"} from the portfolio.${phasingFragment}`
      : bucketKey === "MIGRATE"
        ? `Modernizing ${top2.join(" and ")} on retained platforms preserves ${fmtCompact(bucket.annualCostUsd)} in critical capability while eliminating the technical-debt exposure that drives the current cost base.${phasingFragment}`
        : bucketKey === "INVEST"
          ? `${fmtCompact(bucket.annualCostUsd)} of strategic spend across ${top2.join(" and ")} (and ${bucket.count - 2} other application${bucket.count - 2 === 1 ? "" : "s"}) anchors the next-cycle capability bet; capacity expansion leads the FY plan.`
          : // TOLERATE
            `${fmtCompact(bucket.annualCostUsd)} holds steady on stable platforms (${top2.join(", ")}); revisit at the next portfolio review unless contract economics shift.`;
  children.push(buildActionTitle(bucketActionTitle, brandHex));

  // Governing thought (bold paragraph)
  children.push(
    new Paragraph({
      spacing: { after: 160, line: 320 },
      children: [
        new TextRun({ text: narrative.governingThought, bold: true, size: 24 }),
      ],
    })
  );

  // Why now — three bullets
  children.push(
    new Paragraph({
      spacing: { before: 80, after: 80 },
      children: [
        new TextRun({ text: "Why now", bold: true, color: clampForContrastSafe(brandHex), size: 22 }),
      ],
    })
  );
  for (const bullet of narrative.whyNow) {
    children.push(
      new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 60, line: 320 },
        children: renderInline(bullet),
      })
    );
  }

  // What it means
  children.push(
    new Paragraph({
      spacing: { before: 120, after: 80 },
      children: [
        new TextRun({
          text: "What it means",
          bold: true,
          color: clampForContrastSafe(brandHex),
          size: 22,
        }),
      ],
    })
  );
  children.push(
    new Paragraph({
      spacing: { after: 160, line: 320 },
      children: renderInline(narrative.whatItMeans),
    })
  );

  // Recommended action
  children.push(
    new Paragraph({
      spacing: { before: 80, after: 80 },
      children: [
        new TextRun({
          text: "Recommended action",
          bold: true,
          color: clampForContrastSafe(brandHex),
          size: 22,
        }),
      ],
    })
  );
  children.push(
    new Paragraph({
      spacing: { after: 200, line: 320 },
      children: [
        new TextRun({
          text: narrative.action,
          italics: true,
          size: 22,
        }),
      ],
    })
  );

  // Apps table — with status pills on Lifecycle/BV/TH and brand-
  // tinted bar on the cost column.
  children.push(buildBucketAppsTable(apps, fmt, brandHex));
}

/** Bucket-level apps table with status pills on Lifecycle / BV / TH
 *  columns. Hand-built so cells can mix pills and text. Numeric
 *  columns get tabular nums via Consolas. */
function buildBucketAppsTable(
  apps: AppSummary[],
  fmt: (n: number) => string,
  brandHex: string
): Table {
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const headerBottom = {
    style: BorderStyle.SINGLE,
    size: 12,
    color: brandHex,
  };
  const widths = [24, 16, 12, 9, 9, 14, 16];
  const headers = [
    "Application",
    "Vendor",
    "Lifecycle",
    "BV",
    "TH",
    "Annual cost",
    "Primary capability",
  ];
  const headerCells = headers.map(
    (h, i) =>
      new TableCell({
        width: { size: widths[i]!, type: WidthType.PERCENTAGE },
        shading: { fill: "FFFFFF" },
        borders: {
          top: noBorder,
          bottom: headerBottom,
          left: noBorder,
          right: noBorder,
        },
        children: [
          new Paragraph({
            alignment: i === 5 ? AlignmentType.RIGHT : AlignmentType.LEFT,
            spacing: { before: 60, after: 60 },
            children: [
              new TextRun({
                text: h,
                bold: true,
                size: T.small,
                color: clampForContrastSafe(brandHex),
              }),
            ],
          }),
        ],
      })
  );

  const bodyRows = apps.map((a, rowIdx) => {
    const baseFill = rowIdx % 2 === 1 ? "FAFAFA" : "FFFFFF";
    const bvLabel = (a.businessValue ?? "—").replace(/^BV_/, "");
    const thLabel = (a.technicalHealth ?? "—").replace(/^TH_/, "");
    const bvTone = bvToTone(a.businessValue);
    const thTone = thToTone(a.technicalHealth);
    return new TableRow({
      children: [
        // Application
        cellText({
          text: a.name,
          fill: baseFill,
          align: AlignmentType.LEFT,
        }),
        // Vendor
        cellText({
          text: a.vendor ?? "—",
          fill: baseFill,
          align: AlignmentType.LEFT,
        }),
        // Lifecycle pill
        buildStatusPillCell({
          text: a.lifecycle.replace(/_/g, " "),
          tone: lifecycleToTone(a.lifecycle),
        }),
        // BV pill
        buildStatusPillCell({ text: bvLabel, tone: bvTone }),
        // TH pill
        buildStatusPillCell({ text: thLabel, tone: thTone }),
        // Annual cost (right-aligned tabular)
        cellText({
          text: fmt(a.annualCostUsd),
          fill: baseFill,
          align: AlignmentType.RIGHT,
          font: "Consolas",
        }),
        // Primary capability
        cellText({
          text: a.capabilityNames[0] ?? "—",
          fill: baseFill,
          align: AlignmentType.LEFT,
        }),
      ],
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: noBorder,
      bottom: noBorder,
      left: noBorder,
      right: noBorder,
      insideHorizontal: noBorder,
      insideVertical: noBorder,
    },
    rows: [new TableRow({ tableHeader: true, children: headerCells }), ...bodyRows],
  });
}

/** Map businessValue enum to a Tone for status-pill rendering. */
function bvToTone(bv: string | null): Tone {
  switch (bv) {
    case "CRITICAL":
      return "danger";
    case "HIGH":
      return "warn";
    case "MEDIUM":
      return "info";
    case "LOW":
    case "BV_UNKNOWN":
    default:
      return "info";
  }
}

/** Map technicalHealth enum to a Tone for status-pill rendering. */
function thToTone(th: string | null): Tone {
  switch (th) {
    case "EXCELLENT":
    case "GOOD":
      return "success";
    case "FAIR":
      return "warn";
    case "POOR":
    case "TH_CRITICAL":
      return "danger";
    default:
      return "info";
  }
}

/** Plain text TableCell — used inside hand-built tables that mix
 *  text and status pills. Right-align numeric content; pass
 *  font="Consolas" for tabular nums on cost columns. */
function cellText(opts: {
  text: string;
  fill: string;
  align: typeof AlignmentType[keyof typeof AlignmentType];
  font?: string;
}): TableCell {
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return new TableCell({
    shading: { fill: opts.fill },
    borders: {
      top: noBorder,
      bottom: noBorder,
      left: noBorder,
      right: noBorder,
    },
    children: [
      new Paragraph({
        alignment: opts.align,
        spacing: { before: 60, after: 60 },
        children: [
          new TextRun({ text: opts.text, size: T.small, font: opts.font }),
        ],
      }),
    ],
  });
}

/** Wrapper around clampForContrast that returns a brand color
 *  guaranteed to clear WCAG AA against white. Brand color stays
 *  as-is for fills; only text uses get clamped. */
function clampForContrastSafe(brandHex: string): string {
  return clampForContrast({ hex: brandHex });
}

/** "So what" closer for a chapter — one italic 13pt brand-color
 *  line that synthesizes the chapter into the next decision.
 *  MBB convention: every section ends with an implication, not
 *  with the last bullet of evidence. Renders with extra spacing
 *  before to separate from preceding content. */
function sectionCloser(text: string, brandHex: string): Paragraph {
  return new Paragraph({
    spacing: { before: 320, after: 320, line: 320 },
    indent: { left: 360, right: 360 },
    children: [
      new TextRun({
        text,
        italics: true,
        size: T.h3,
        color: clampForContrastSafe(brandHex),
      }),
    ],
  });
}

/** Portfolio Dashboard — synthesis-layer table that puts the
 *  disposition mix on a single page with status pills, costs, and
 *  a top-app anchor per bucket. */
function buildPortfolioDashboard(
  m: RationalizationMetrics,
  fmt: (n: number) => string,
  fmtCompact: (n: number) => string,
  brandHex: string
): Table {
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const headerBottom = {
    style: BorderStyle.SINGLE,
    size: 12,
    color: brandHex,
  };
  const widths = [16, 8, 18, 18, 28, 12];
  const headers = [
    "Bucket",
    "Apps",
    "Annual cost",
    "3-yr saving",
    "Top app",
    "Wave",
  ];
  const headerCells = headers.map(
    (h, i) =>
      new TableCell({
        width: { size: widths[i]!, type: WidthType.PERCENTAGE },
        shading: { fill: "FFFFFF" },
        borders: {
          top: noBorder,
          bottom: headerBottom,
          left: noBorder,
          right: noBorder,
        },
        children: [
          new Paragraph({
            alignment:
              i === 1 || i === 2 || i === 3
                ? AlignmentType.RIGHT
                : AlignmentType.LEFT,
            spacing: { before: 60, after: 60 },
            children: [
              new TextRun({
                text: h,
                bold: true,
                size: T.small,
                color: clampForContrastSafe(brandHex),
              }),
            ],
          }),
        ],
      })
  );

  const bucketTone: Record<string, Tone> = {
    ELIMINATE: "danger",
    MIGRATE: "warn",
    INVEST: "info",
    TOLERATE: "success",
  };
  const buckets = ["ELIMINATE", "MIGRATE", "INVEST", "TOLERATE"] as const;
  const bodyRows = buckets.map((key, idx) => {
    const b = m.byClassification[key];
    const apps = b?.apps ?? [];
    const topApp = apps
      .slice()
      .sort((a, c) => c.annualCostUsd - a.annualCostUsd)[0];
    const cost = b?.annualCostUsd ?? 0;
    const saving =
      key === "ELIMINATE"
        ? cost * 3
        : key === "MIGRATE"
          ? cost * 0.5 * 3
          : 0;
    const phasingOut = apps.filter(
      (a) => a.lifecycle === "PHASING_OUT" || a.lifecycle === "RETIRED"
    ).length;
    const wave =
      key === "ELIMINATE" || key === "MIGRATE"
        ? phasingOut > 0
          ? "NOW"
          : "NEXT"
        : key === "INVEST"
          ? "LATER"
          : "—";
    const baseFill = idx % 2 === 1 ? "FAFAFA" : "FFFFFF";
    return new TableRow({
      children: [
        // Bucket pill
        buildStatusPillCell({ text: key, tone: bucketTone[key]! }),
        // Apps count
        cellText({
          text: String(b?.count ?? 0),
          fill: baseFill,
          align: AlignmentType.RIGHT,
          font: "Consolas",
        }),
        // Annual cost
        cellText({
          text: fmtCompact(cost),
          fill: baseFill,
          align: AlignmentType.RIGHT,
          font: "Consolas",
        }),
        // 3-yr saving
        cellText({
          text: saving > 0 ? fmtCompact(saving) : "—",
          fill: baseFill,
          align: AlignmentType.RIGHT,
          font: "Consolas",
        }),
        // Top app
        cellText({
          text: topApp?.name ?? "—",
          fill: baseFill,
          align: AlignmentType.LEFT,
        }),
        // Wave pill
        wave === "—"
          ? cellText({
              text: "—",
              fill: baseFill,
              align: AlignmentType.CENTER,
            })
          : buildStatusPillCell({
              text: wave,
              tone: wave === "NOW" ? "danger" : wave === "NEXT" ? "warn" : "info",
            }),
      ],
    });
  });

  // Total row
  const totalRow = new TableRow({
    children: [
      cellText({
        text: "Total",
        fill: "FFFFFF",
        align: AlignmentType.LEFT,
        font: undefined,
      }),
      cellText({
        text: String(m.classifiedApps),
        fill: "FFFFFF",
        align: AlignmentType.RIGHT,
        font: "Consolas",
      }),
      cellText({
        text: fmtCompact(m.totalAnnualCostUsd),
        fill: "FFFFFF",
        align: AlignmentType.RIGHT,
        font: "Consolas",
      }),
      cellText({
        text: fmtCompact(m.projectedSavings.totalCandidate3yrUsd),
        fill: "FFFFFF",
        align: AlignmentType.RIGHT,
        font: "Consolas",
      }),
      cellText({
        text: "",
        fill: "FFFFFF",
        align: AlignmentType.LEFT,
      }),
      cellText({
        text: "",
        fill: "FFFFFF",
        align: AlignmentType.CENTER,
      }),
    ],
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: noBorder,
      bottom: noBorder,
      left: noBorder,
      right: noBorder,
      insideHorizontal: noBorder,
      insideVertical: noBorder,
    },
    rows: [
      new TableRow({ tableHeader: true, children: headerCells }),
      ...bodyRows,
      totalRow,
    ],
  });
  // suppress unused warning for fmt
  void fmt;
}

/** Vendor & Sourcing Analysis — three sub-blocks: multi-product
 *  vendor table, in-house vs third-party split, vendor-event
 *  exposure callout. */
function pushVendorSourcingSection(
  children: Array<Paragraph | Table>,
  m: RationalizationMetrics,
  fmt: (n: number) => string,
  fmtCompact: (n: number) => string,
  brandHex: string,
  paretoChart: Paragraph | null
): void {
  children.push(
    buildHeading(
      "Vendor & Sourcing Analysis",
      HeadingLevel.HEADING_1,
      brandHex
    )
  );

  // 1. Multi-product vendor exposure
  if (m.multiProductVendors.length > 0) {
    const multiCost = m.multiProductVendors.reduce(
      (s, v) => s + v.annualCostUsd,
      0
    );
    const multiNames = m.multiProductVendors
      .slice(0, 2)
      .map((v) => v.vendor)
      .join(", ");
    children.push(
      buildActionTitle(
        `${fmtCompact(multiCost)} of run-cost concentrates in ${m.multiProductVendors.length} multi-product vendor${m.multiProductVendors.length === 1 ? "" : "s"} (${multiNames}); a single commercial event with any one materially impacts multiple capability areas at once.`,
        brandHex
      )
    );
    children.push(
      buildTable({
        headers: [
          "Vendor",
          "Apps",
          "Annual cost",
          "% of total",
          "Capabilities touched",
        ],
        rows: m.multiProductVendors.map((v) => [
          v.vendor,
          String(v.count),
          fmt(v.annualCostUsd),
          `${pctOf(v.annualCostUsd, m.totalAnnualCostUsd)}%`,
          summarizeCapabilities(v.apps),
        ]),
        brandHex,
        columnWidthsPct: [26, 10, 18, 12, 34],
        numericColumns: [1, 2, 3],
        barColumns: [
          { index: 3, valueOf: (row) => parseInt(row[3]!, 10) / 100 },
        ],
      })
    );

    // Vendor-event exposure callout
    const top = m.multiProductVendors[0]!;
    children.push(
      buildCallout({
        title: `Single-vendor exposure — ${top.vendor}`,
        tone: "warn",
        bullets: [
          `${top.vendor} carries ${fmt(top.annualCostUsd)} across ${top.count} application${top.count === 1 ? "" : "s"} in this portfolio.`,
          `Map every ${top.vendor} application to its renewal date before any spend optimization decision; the FY procurement cycle is the natural anchor.`,
        ],
        brandHex,
      })
    );
  }

  // 2. In-house vs third-party split
  if (
    m.sourcing.inHouse.annualCostUsd > 0 ||
    m.sourcing.thirdParty.annualCostUsd > 0
  ) {
    const inHousePct = Math.round(m.sourcing.inHouseShare * 100);
    children.push(
      buildHeading("Sourcing split", HeadingLevel.HEADING_2, brandHex)
    );
    if (m.sourcing.inHouse.annualCostUsd > 0) {
      children.push(
        buildActionTitle(
          `${fmtCompact(m.sourcing.inHouse.annualCostUsd)} (${inHousePct}%) of annual spend is in-house-built across ${m.sourcing.inHouse.count} system${m.sourcing.inHouse.count === 1 ? "" : "s"}; without per-capability allocation this spend is invisible to vendor-driven optimization levers.`,
          brandHex
        )
      );
    }
    children.push(
      buildTable({
        headers: ["Sourcing", "Apps", "Annual cost", "% of total"],
        rows: [
          [
            "Third-party",
            String(m.sourcing.thirdParty.count),
            fmt(m.sourcing.thirdParty.annualCostUsd),
            `${pctOf(m.sourcing.thirdParty.annualCostUsd, m.totalAnnualCostUsd)}%`,
          ],
          [
            "In-house",
            String(m.sourcing.inHouse.count),
            fmt(m.sourcing.inHouse.annualCostUsd),
            `${pctOf(m.sourcing.inHouse.annualCostUsd, m.totalAnnualCostUsd)}%`,
          ],
        ],
        brandHex,
        columnWidthsPct: [40, 16, 22, 22],
        numericColumns: [1, 2, 3],
        barColumns: [
          { index: 3, valueOf: (row) => parseInt(row[3]!, 10) / 100 },
        ],
      })
    );
  }

  // 3. Top vendor concentration (existing list, with table-bars)
  if (m.vendorConcentration.length > 0) {
    children.push(
      buildHeading(
        "Top vendors by run-cost",
        HeadingLevel.HEADING_2,
        brandHex
      )
    );
    const topVendor = m.vendorConcentration[0]!;
    children.push(
      buildActionTitle(
        `Single-vendor exposure of ${fmtCompact(topVendor.annualCostUsd)} (${pctOf(topVendor.annualCostUsd, m.totalAnnualCostUsd)}%) on ${topVendor.vendor} requires contract-cliff analysis before any commercial decision is delegated.`,
        brandHex
      )
    );
    if (paretoChart) {
      children.push(paretoChart);
    }
    children.push(
      buildTable({
        headers: ["Vendor", "Apps", "Annual cost", "% of total"],
        rows: m.vendorConcentration.map((v) => [
          v.vendor,
          String(v.count),
          fmt(v.annualCostUsd),
          `${pctOf(v.annualCostUsd, m.totalAnnualCostUsd)}%`,
        ]),
        brandHex,
        columnWidthsPct: [38, 14, 24, 24],
        numericColumns: [1, 2, 3],
        barColumns: [
          { index: 3, valueOf: (row) => parseInt(row[3]!, 10) / 100 },
        ],
      })
    );
  }
}

function summarizeCapabilities(
  apps: Array<{ name: string; capabilityNames: string[] }>
): string {
  const set = new Set<string>();
  for (const app of apps) {
    for (const cap of app.capabilityNames) set.add(cap);
  }
  if (set.size === 0) return "—";
  const sorted = Array.from(set).sort();
  const top = sorted.slice(0, 4).join(", ");
  return sorted.length > 4 ? `${top} +${sorted.length - 4} more` : top;
}

/** Per-app deep-dive section. Hero box + capability list + LLM
 *  rationale + recommended path + wave assignment. One per top
 *  app by cost. */
function pushDeepDiveSection(
  children: Array<Paragraph | Table>,
  app: AppSummary,
  dive: DeepDive | null,
  m: RationalizationMetrics,
  fmt: (n: number) => string,
  fmtCompact: (n: number) => string,
  brandHex: string
): void {
  // Title — app name as H2 (inside the chapter divider).
  children.push(buildHeading(app.name, HeadingLevel.HEADING_1, brandHex));

  // Action title — cost + disposition framing
  children.push(
    buildActionTitle(
      `${fmt(app.annualCostUsd)} annual run-cost, ${app.rationalizationStatus} disposition; ${app.lifecycle.replace(/_/g, " ")} lifecycle on ${app.vendor ?? "an in-house"} platform.`,
      brandHex
    )
  );

  // Hero box — KPI tile row of app facts
  children.push(
    buildKpiRow({
      brandHex,
      tiles: [
        { value: fmtCompact(app.annualCostUsd), label: "Annual cost" },
        {
          value: app.lifecycle.replace(/_/g, " "),
          label: "Lifecycle",
        },
        {
          value: (app.businessValue ?? "—").replace(/^BV_/, ""),
          label: "Business value",
        },
        {
          value: (app.technicalHealth ?? "—").replace(/^TH_/, ""),
          label: "Technical health",
        },
        { value: app.rationalizationStatus, label: "Disposition" },
        {
          value: String(app.capabilityNames.length),
          label: "Capabilities supported",
        },
      ],
    })
  );

  // Capability mapping
  if (app.capabilityNames.length > 0) {
    children.push(
      new Paragraph({
        spacing: { before: 240, after: 80 },
        children: [
          new TextRun({
            text: "Capability mapping",
            bold: true,
            color: clampForContrastSafe(brandHex),
            size: T.body,
          }),
        ],
      })
    );
    for (const cap of app.capabilityNames) {
      const others = (
        m.redundancyMatrix.find((r) => r.capabilityName === cap)
          ?.appsCovering ?? []
      )
        .filter((a) => a.id !== app.id)
        .map((a) => a.name);
      const altLine =
        others.length > 0
          ? ` — also covered by ${others.slice(0, 3).join(", ")}${others.length > 3 ? `, +${others.length - 3} more` : ""}`
          : " — no alternative app in the portfolio";
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 40 },
          children: [
            new TextRun({ text: cap, size: T.body, bold: true }),
            new TextRun({ text: altLine, size: T.body, color: "4B5563" }),
          ],
        })
      );
    }
  } else {
    children.push(
      buildCallout({
        title: "No capability mapping",
        tone: "warn",
        bullets: [
          "This application carries no capability assignment; mapping it is a precondition for the redundancy and consolidation analyses.",
        ],
        brandHex,
      })
    );
  }

  // ─── Cross-deliverable bridge ───────────────────────────────
  // When the workspace has populated capability maturity for any of
  // this app's linked capabilities, surface the maturity context.
  // Data-gated: when no capability has non-default maturity, the
  // entire subsection is skipped — zero regression risk on
  // workspaces that haven't assessed capabilities.
  const matRows = (app.capabilityMaturity ?? []).filter(
    (c) =>
      c.currentMaturity !== "NOT_ASSESSED" ||
      c.targetMaturity !== "NOT_ASSESSED" ||
      c.strategicImportance !== "NOT_ASSESSED"
  );
  if (matRows.length > 0) {
    children.push(
      new Paragraph({
        spacing: { before: 240, after: 80 },
        children: [
          new TextRun({
            text: "Linked capability maturity",
            bold: true,
            color: clampForContrastSafe(brandHex),
            size: T.body,
          }),
        ],
      })
    );
    children.push(
      buildTable({
        headers: ["Capability", "Importance", "Current", "Target"],
        rows: matRows.map((c) => [
          c.name,
          c.strategicImportance.replace(/_/g, " "),
          c.currentMaturity.replace(/_/g, " "),
          c.targetMaturity.replace(/_/g, " "),
        ]),
        brandHex,
      })
    );
    children.push(
      new Paragraph({
        spacing: { before: 80, after: 160, line: 320 },
        children: [
          new TextRun({
            text:
              "Cross-reference: this disposition decision affects the capability lift case in the Capability Maturity Assessment. Sequence both deliverables together when the capability is rated CRITICAL or HIGH.",
            italics: true,
            color: "4B5563",
            size: T.body,
          }),
        ],
      })
    );
  }

  // LLM-grounded rationale
  if (dive) {
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 80 },
        children: [
          new TextRun({
            text: "Disposition rationale",
            bold: true,
            color: clampForContrastSafe(brandHex),
            size: T.body,
          }),
        ],
      })
    );
    children.push(
      new Paragraph({
        spacing: { after: 160, line: 320 },
        children: renderInline(dive.dispositionRationale),
      })
    );

    children.push(
      new Paragraph({
        spacing: { before: 80, after: 80 },
        children: [
          new TextRun({
            text: "Recommended path",
            bold: true,
            color: clampForContrastSafe(brandHex),
            size: T.body,
          }),
        ],
      })
    );
    children.push(
      new Paragraph({
        spacing: { after: 160, line: 320 },
        children: renderInline(dive.migrationPath),
      })
    );

    children.push(
      new Paragraph({
        spacing: { before: 80, after: 80 },
        children: [
          new TextRun({
            text: "Wave",
            bold: true,
            color: clampForContrastSafe(brandHex),
            size: T.body,
          }),
        ],
      })
    );
    children.push(
      new Paragraph({
        spacing: { after: 240, line: 320 },
        children: [
          new TextRun({
            text: dive.waveJustification,
            italics: true,
            size: T.body,
          }),
        ],
      })
    );
  }
}

/** Glossary appendix table. Documents the framework terminology
 *  the doc uses so reviewers can audit the bucketing rules. */
function buildGlossaryTable(brandHex: string): Table {
  return buildTable({
    headers: ["Term", "Definition"],
    rows: [
      [
        "TIME framework",
        "Tolerate / Invest / Migrate / Eliminate — Gartner's standard disposition framework for application portfolios.",
      ],
      [
        "TOLERATE",
        "Adequate business value, healthy technology, no cheaper alternative — hold position; revisit at the next portfolio review.",
      ],
      [
        "INVEST",
        "High business value, healthy or healthy-enough technology — fund the strategic capability bet; expand capacity or integration.",
      ],
      [
        "MIGRATE",
        "Strategic capability with deteriorating technical health — modernize the platform while preserving the capability.",
      ],
      [
        "ELIMINATE",
        "Insufficient business value or unsupported platform — decommission within 12 months once data archival and capability successor are confirmed.",
      ],
      [
        "Business value (BV) scale",
        "CRITICAL > HIGH > MEDIUM > LOW > UNKNOWN. CRITICAL and HIGH read as the strategic-spend tier; MEDIUM and LOW read as the candidates-for-cuts tier.",
      ],
      [
        "Technical health (TH) scale",
        "EXCELLENT > GOOD > FAIR > POOR > CRITICAL. EXCELLENT and GOOD are healthy; FAIR is a concern; POOR and CRITICAL are unhealthy.",
      ],
      [
        "Lifecycle states",
        "ACTIVE (in production), PLANNED (committed but not yet deployed), PHASING_OUT (forced timeline to retire or replace), RETIRED, SUNSET.",
      ],
      [
        "Disposition coverage",
        "Percentage of the active portfolio carrying a TIME disposition. ≥60% unlocks the full rationalization plan; below that, a Portfolio Snapshot Report is generated instead.",
      ],
      [
        "Redundancy matrix",
        "Capabilities served by ≥2 applications. The densest clusters are the consolidation candidates beyond the bucket-level totals.",
      ],
      [
        "Wave",
        "NOW (<12 months) / NEXT (12-24 months) / LATER (24-36 months). Lifecycle state and cost magnitude drive placement.",
      ],
    ],
    brandHex,
    columnWidthsPct: [22, 78],
  });
}

function buildQuadrantTable(
  m: RationalizationMetrics,
  brandHex: string
): ReturnType<typeof buildTable> {
  const allApps: AppSummary[] = [
    ...(m.byClassification.ELIMINATE?.apps ?? []),
    ...(m.byClassification.MIGRATE?.apps ?? []),
    ...(m.byClassification.INVEST?.apps ?? []),
    ...(m.byClassification.TOLERATE?.apps ?? []),
  ];
  // 2×2 placement covers every BV/TH enum so apps don't fall
  // through. Schema enums:
  //   BV: LOW / MEDIUM / HIGH / CRITICAL / BV_UNKNOWN / null
  //   TH: EXCELLENT / GOOD / FAIR / POOR / TH_CRITICAL / null
  // Convention: CRITICAL BV reads as HIGH (most strategic);
  // MEDIUM/UNKNOWN/null reads as LOW; FAIR TH reads as Poor (the
  // "good" half is reserved for actively healthy systems).
  const isHighBV = (a: AppSummary) =>
    a.businessValue === "HIGH" || a.businessValue === "CRITICAL";
  const isLowBV = (a: AppSummary) =>
    a.businessValue === "LOW" ||
    a.businessValue === "MEDIUM" ||
    a.businessValue === "BV_UNKNOWN" ||
    a.businessValue === null;
  const isGoodTH = (a: AppSummary) =>
    a.technicalHealth === "EXCELLENT" || a.technicalHealth === "GOOD";
  const isPoorTH = (a: AppSummary) =>
    a.technicalHealth === "FAIR" ||
    a.technicalHealth === "POOR" ||
    a.technicalHealth === "TH_CRITICAL" ||
    a.technicalHealth === null;
  const cell = (filter: (a: AppSummary) => boolean): string => {
    const inCell = allApps.filter(filter);
    if (inCell.length === 0) return "—";
    const examples = inCell
      .slice(0, 5)
      .map((a) => a.name)
      .join(", ");
    return `${inCell.length} app${inCell.length === 1 ? "" : "s"}: ${examples}`;
  };
  return buildTable({
    headers: [
      "Business value",
      "Good technical health",
      "Poor technical health",
    ],
    rows: [
      [
        "HIGH",
        cell((a) => isHighBV(a) && isGoodTH(a)),
        cell((a) => isHighBV(a) && isPoorTH(a)),
      ],
      [
        "LOW",
        cell((a) => isLowBV(a) && isGoodTH(a)),
        cell((a) => isLowBV(a) && isPoorTH(a)),
      ],
    ],
    brandHex,
    columnWidthsPct: [16, 42, 42],
  });
}

function buildRoadmapRows(
  m: RationalizationMetrics,
  fmt: (n: number) => string
): string[][] {
  const rows: string[][] = [];
  for (const app of m.topEliminationCandidates) {
    const horizon =
      app.lifecycle === "PHASING_OUT" || app.lifecycle === "RETIRED"
        ? "NOW (<12mo)"
        : app.lifecycle === "ACTIVE"
          ? "NEXT (12–24mo)"
          : "LATER (24–36mo)";
    rows.push([app.name, "ELIMINATE", horizon, fmt(app.annualCostUsd * 3)]);
  }
  for (const app of m.topMigrationCandidates) {
    const horizon =
      app.lifecycle === "PHASING_OUT"
        ? "NOW (<12mo)"
        : app.lifecycle === "ACTIVE"
          ? "NEXT (12–24mo)"
          : "LATER (24–36mo)";
    rows.push([
      app.name,
      "MIGRATE",
      horizon,
      fmt(app.annualCostUsd * 0.5 * 3),
    ]);
  }
  return rows;
}

function buildRisksTable(
  brandHex: string,
  m: RationalizationMetrics,
  fmt: (n: number) => string,
  fmtCompact: (n: number) => string
): ReturnType<typeof buildTable> {
  // Workspace-specific risks (top 2-3) above the canonical 7.
  // These derive from this portfolio's actual data — vendor
  // concentration, PHASING_OUT cohort, in-house spend — so the
  // doc reads as if the firm understood THIS portfolio, not as
  // a generic template.
  const portfolioRisks: string[][] = [];

  if (m.vendorTopShare >= 0.15) {
    const topVendorCost =
      m.vendorConcentration[0]?.annualCostUsd ?? 0;
    portfolioRisks.push([
      `${m.vendorTopName} commercial concentration (${fmtCompact(topVendorCost)} / ${Math.round(m.vendorTopShare * 100)}% of run-cost) creates single-vendor negotiation exposure`,
      "M",
      "H",
      `Map every ${m.vendorTopName} application to its renewal date and TCO before the FY procurement cycle; the portfolio's largest single commercial lever runs through this counterparty.`,
    ]);
  }

  if (m.phasingOut.count >= 3) {
    portfolioRisks.push([
      `${m.phasingOut.count} PHASING_OUT applications carrying ${fmt(m.phasingOut.annualCostUsd)} face forced timelines independent of programme strategy`,
      "H",
      "H",
      `Sequence Wave-1 around the PHASING_OUT cohort; vendor-driven sunset dates dictate the schedule, not the engagement-team preference.`,
    ]);
  }

  if (m.sourcing.inHouse.annualCostUsd > 0 && m.sourcing.inHouseShare >= 0.15) {
    portfolioRisks.push([
      `${fmtCompact(m.sourcing.inHouse.annualCostUsd)} of in-house spend (${Math.round(m.sourcing.inHouseShare * 100)}%) is invisible to vendor-driven optimization`,
      "M",
      "M",
      `Allocate in-house run-cost to capabilities before the next portfolio review; without this, a third of programme spend is outside the optimization frame.`,
    ]);
  }

  return buildTable({
    headers: ["Risk", "Likelihood", "Impact", "Mitigation"],
    rows: [
      ...portfolioRisks,
      [
        "Hidden integration dependencies surface during decommission",
        "H",
        "H",
        "Validate via the application-interface graph before any sunset commitment.",
      ],
      [
        "Shadow data ownership — business unit objects post-announcement",
        "M",
        "H",
        "Capability-owner sign-off recorded prior to decommission.",
      ],
      [
        "License contract cliffs — savings lag the renewal date",
        "M",
        "M",
        "Map every ELIMINATE candidate to its renewal date before committing the savings figure.",
      ],
      [
        "Retained-platform capacity — target cannot absorb load",
        "L",
        "H",
        "Load-test the migration target before any commitment opens.",
      ],
      [
        "Change fatigue — concurrent migrations exceed absorption rate",
        "M",
        "M",
        "Sequence migrations so concurrent active count stays under three.",
      ],
      [
        "Knowledge loss — SME attrition during the sunset window",
        "H",
        "M",
        "Runbook capture from each application's primary owner before sunset.",
      ],
      [
        "Regulatory and audit-trail continuity for decommissioned systems",
        "L",
        "H",
        "Archive read-only snapshots before decommission; record the retention period.",
      ],
    ],
    brandHex,
    columnWidthsPct: [40, 12, 12, 36],
  });
}

function buildNextStepsTable(
  m: RationalizationMetrics,
  brandHex: string
): ReturnType<typeof buildTable> {
  const eliminateCount = m.byClassification.ELIMINATE?.count ?? 0;
  const migrateCount = m.byClassification.MIGRATE?.count ?? 0;
  const investCount = m.byClassification.INVEST?.count ?? 0;
  return buildTable({
    headers: ["Action", "Owner", "Due", "Dependency"],
    rows: [
      [
        `Validate the ${eliminateCount} ELIMINATE candidates with capability owners`,
        "[Capability Lead]",
        "Week 2",
        "Capability ownership map",
      ],
      [
        `Confirm contract cliffs for the top 5 ELIMINATE candidates by cost`,
        "[Vendor Mgmt]",
        "Week 2",
        "Vendor contract registry",
      ],
      [
        `Load-test retained platforms for ${migrateCount} MIGRATE candidate${migrateCount === 1 ? "" : "s"}`,
        "[Architecture Team]",
        "Week 4",
        "Performance baseline",
      ],
      [
        `Architecture review of the ${investCount} INVEST candidate${investCount === 1 ? "" : "s"}`,
        "[Architecture Team]",
        "Week 6",
        "Strategic capability map",
      ],
      [
        "Steerco review of the decommission roadmap",
        "[Programme Sponsor]",
        "Week 8",
        "Above artefacts complete",
      ],
      [
        "Begin Wave 1 sunset of NOW-horizon applications",
        "[Programme Lead]",
        "Week 12",
        "Steerco approval",
      ],
    ],
    brandHex,
    columnWidthsPct: [40, 22, 12, 26],
  });
}

function pctOf(part: number, whole: number): string {
  if (whole <= 0) return "0";
  return ((part / whole) * 100).toFixed(0);
}

// ─── Exec summary LLM call (kept from v1 with voice tweaks) ────

type ExecSummaryFacts = {
  clientName: string;
  totalApps: number;
  activeApps: number;
  classifiedApps: number;
  // Each cost ships in BOTH long-form ("£8,400,000") and
  // compact-form ("£8.4M"). The LLM picks whichever reads more
  // naturally; the post-check `verifyDollarAmounts` accepts either;
  // any number not in either form fails (hallucination).
  eliminate: { count: number; cost: string; costCompact: string };
  migrate: { count: number; cost: string; costCompact: string };
  invest: { count: number; cost: string; costCompact: string };
  tolerate: { count: number; cost: string; costCompact: string };
  topEliminate3: string[];
  topMigrate3: string[];
  projectedSavings3yr: string;
  projectedSavings3yrCompact: string;
  totalAnnualCost: string;
  totalAnnualCostCompact: string;
  redundancyCapCount: number;
  costCurrency: string;
};

export function buildExecSummaryFacts(
  m: RationalizationMetrics,
  fmt: (n: number) => string,
  fmtCompact: (n: number) => string,
  clientName: string
): ExecSummaryFacts {
  const bucket = (key: "ELIMINATE" | "MIGRATE" | "INVEST" | "TOLERATE") => {
    const cost = m.byClassification[key]?.annualCostUsd ?? 0;
    return {
      count: m.byClassification[key]?.count ?? 0,
      cost: fmt(cost),
      costCompact: fmtCompact(cost),
    };
  };
  return {
    clientName,
    totalApps: m.totalApps,
    activeApps: m.activeApps,
    classifiedApps: m.classifiedApps,
    eliminate: bucket("ELIMINATE"),
    migrate: bucket("MIGRATE"),
    invest: bucket("INVEST"),
    tolerate: bucket("TOLERATE"),
    topEliminate3: m.topEliminationCandidates.slice(0, 3).map((a) => a.name),
    topMigrate3: m.topMigrationCandidates.slice(0, 3).map((a) => a.name),
    projectedSavings3yr: fmt(m.projectedSavings.totalCandidate3yrUsd),
    projectedSavings3yrCompact: fmtCompact(m.projectedSavings.totalCandidate3yrUsd),
    totalAnnualCost: fmt(m.totalAnnualCostUsd),
    totalAnnualCostCompact: fmtCompact(m.totalAnnualCostUsd),
    redundancyCapCount: m.redundancyMatrix.length,
    costCurrency: m.costCurrency,
  };
}

export async function generateExecutiveSummary(
  facts: ExecSummaryFacts
): Promise<{ text: string; source: "llm" | "deterministic_fallback" }> {
  if (facts.classifiedApps === 0) {
    return {
      text: deterministicExecFallback(facts),
      source: "deterministic_fallback",
    };
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: MODEL_SONNET,
        max_tokens: 800,
        system: RATIONALIZATION_EXEC_SUMMARY_PROMPT,
        messages: [
          {
            role: "user",
            content: `Facts:\n${JSON.stringify(facts, null, 2)}\n\nReturn JSON only.`,
          },
        ],
      });
      const textBlock = response.content.find((b) => b.type === "text");
      const raw =
        textBlock && "text" in textBlock && typeof textBlock.text === "string"
          ? textBlock.text
          : "";
      const parsed = parseJsonish(raw);
      const text = parsed.executiveSummary?.trim();
      if (!text) continue;
      if (!verifyDollarAmounts(text, [
        facts.eliminate.cost,
        facts.eliminate.costCompact,
        facts.migrate.cost,
        facts.migrate.costCompact,
        facts.invest.cost,
        facts.invest.costCompact,
        facts.tolerate.cost,
        facts.tolerate.costCompact,
        facts.projectedSavings3yr,
        facts.projectedSavings3yrCompact,
        facts.totalAnnualCost,
        facts.totalAnnualCostCompact,
      ])) {
        console.warn(
          JSON.stringify({
            evt: "exec_summary_fact_mismatch",
            template: "rationalization-v2",
            attempt: attempt + 1,
          })
        );
        continue;
      }
      return { text, source: "llm" };
    } catch (err) {
      console.warn(
        JSON.stringify({
          evt: "exec_summary_llm_error",
          template: "rationalization-v2",
          attempt: attempt + 1,
          message: err instanceof Error ? err.message : String(err),
        })
      );
    }
  }
  return {
    text: deterministicExecFallback(facts),
    source: "deterministic_fallback",
  };
}

function deterministicExecFallback(facts: ExecSummaryFacts): string {
  const lines: string[] = [];
  lines.push(
    `Findings indicate the ${facts.clientName} portfolio comprises ${facts.totalApps} active applications, of which ${facts.classifiedApps} carry a TIME disposition. Elimination accounts for ${facts.eliminate.count} applications (${facts.eliminate.cost} annual run-cost), migration ${facts.migrate.count} (${facts.migrate.cost}), investment ${facts.invest.count} (${facts.invest.cost}), and retention ${facts.tolerate.count} (${facts.tolerate.cost}).`
  );
  lines.push(
    `Analysis projects ${facts.projectedSavings3yr} in candidate run-cost savings over a three-year horizon under the assumptions documented in the methodology section.`
  );
  if (facts.redundancyCapCount > 0) {
    lines.push(
      `${facts.redundancyCapCount} capabilities are served by multiple applications, surfacing consolidation opportunity beyond the bucket-level totals.`
    );
  }
  return lines.join("\n\n");
}

// ─── Bucket narratives LLM call ────────────────────────────────

type BucketFacts = {
  clientName: string;
  costCurrency: string;
  buckets: Record<
    "ELIMINATE" | "MIGRATE" | "INVEST" | "TOLERATE",
    {
      count: number;
      // Dual-form per the post-check; LLM picks whichever reads
      // best in prose. See ExecSummaryFacts for full rationale.
      cost: string;
      costCompact: string;
      // Apps in this bucket whose lifecycle is PHASING_OUT or
      // RETIRED — drives the LIFECYCLE-DISPOSITION TENSION rule
      // in the bucket-narratives prompt.
      phasingOutCount: number;
      top5: Array<{
        name: string;
        vendor: string;
        capability: string;
        cost: string;
        costCompact: string;
        lifecycle: string;
        bv: string;
        th: string;
      }>;
    }
  >;
};

export function buildBucketFacts(
  m: RationalizationMetrics,
  fmt: (n: number) => string,
  fmtCompact: (n: number) => string,
  clientName: string
): BucketFacts {
  const top5 = (apps: AppSummary[]) =>
    apps
      .slice()
      .sort((a, b) => b.annualCostUsd - a.annualCostUsd)
      .slice(0, 5)
      .map((a) => ({
        name: a.name,
        vendor: a.vendor ?? "—",
        capability: a.capabilityNames[0] ?? "—",
        cost: fmt(a.annualCostUsd),
        costCompact: fmtCompact(a.annualCostUsd),
        lifecycle: a.lifecycle.replace(/_/g, " "),
        bv: (a.businessValue ?? "—").replace(/^BV_/, ""),
        th: (a.technicalHealth ?? "—").replace(/^TH_/, ""),
      }));
  const buildBucket = (
    key: "ELIMINATE" | "MIGRATE" | "INVEST" | "TOLERATE"
  ) => {
    const cost = m.byClassification[key]?.annualCostUsd ?? 0;
    const apps = m.byClassification[key]?.apps ?? [];
    const phasingOutCount = apps.filter(
      (a) => a.lifecycle === "PHASING_OUT" || a.lifecycle === "RETIRED"
    ).length;
    return {
      count: m.byClassification[key]?.count ?? 0,
      cost: fmt(cost),
      costCompact: fmtCompact(cost),
      phasingOutCount,
      top5: top5(apps),
    };
  };
  return {
    clientName,
    costCurrency: m.costCurrency,
    buckets: {
      ELIMINATE: buildBucket("ELIMINATE"),
      MIGRATE: buildBucket("MIGRATE"),
      INVEST: buildBucket("INVEST"),
      TOLERATE: buildBucket("TOLERATE"),
    },
  };
}

export async function generateBucketNarratives(
  facts: BucketFacts,
  m: RationalizationMetrics,
  fmt: (n: number) => string
): Promise<{
  narratives: AllBucketNarratives;
  source: "llm" | "deterministic_fallback";
}> {
  // No classified apps anywhere → skip the LLM, use deterministic.
  const totalClassified =
    facts.buckets.ELIMINATE.count +
    facts.buckets.MIGRATE.count +
    facts.buckets.INVEST.count +
    facts.buckets.TOLERATE.count;
  if (totalClassified === 0) {
    return {
      narratives: deterministicBucketFallback(m, fmt),
      source: "deterministic_fallback",
    };
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: MODEL_SONNET,
        max_tokens: 2500,
        system: RATIONALIZATION_BUCKET_NARRATIVES_PROMPT,
        messages: [
          {
            role: "user",
            content: `Facts:\n${JSON.stringify(facts, null, 2)}\n\nReturn JSON only.`,
          },
        ],
      });
      const textBlock = response.content.find((b) => b.type === "text");
      const raw =
        textBlock && "text" in textBlock && typeof textBlock.text === "string"
          ? textBlock.text
          : "";
      const parsed = parseJsonish(raw) as Partial<AllBucketNarratives>;
      const narratives = normalizeBucketNarratives(parsed);
      if (!narratives) continue;

      // Fact-grounding post-check across all bucket narratives.
      // Allowed costs: each bucket total in BOTH forms, plus every
      // top-5 per-app cost in BOTH forms (the LLM is told to name
      // specific apps from top5 — those costs are valid quotes).
      const allCosts: string[] = [];
      for (const k of ["ELIMINATE", "MIGRATE", "INVEST", "TOLERATE"] as const) {
        const b = facts.buckets[k];
        allCosts.push(b.cost, b.costCompact);
        for (const a of b.top5) {
          allCosts.push(a.cost, a.costCompact);
        }
      }
      const allText =
        narratives.ELIMINATE.governingThought +
        narratives.ELIMINATE.whyNow.join(" ") +
        narratives.ELIMINATE.whatItMeans +
        narratives.ELIMINATE.action +
        narratives.MIGRATE.governingThought +
        narratives.MIGRATE.whyNow.join(" ") +
        narratives.MIGRATE.whatItMeans +
        narratives.MIGRATE.action +
        narratives.INVEST.governingThought +
        narratives.INVEST.whyNow.join(" ") +
        narratives.INVEST.whatItMeans +
        narratives.INVEST.action +
        narratives.TOLERATE.governingThought +
        narratives.TOLERATE.whyNow.join(" ") +
        narratives.TOLERATE.whatItMeans +
        narratives.TOLERATE.action;
      if (!verifyDollarAmounts(allText, allCosts)) {
        console.warn(
          JSON.stringify({
            evt: "bucket_narratives_fact_mismatch",
            template: "rationalization-v2",
            attempt: attempt + 1,
          })
        );
        continue;
      }
      return { narratives, source: "llm" };
    } catch (err) {
      console.warn(
        JSON.stringify({
          evt: "bucket_narratives_llm_error",
          template: "rationalization-v2",
          attempt: attempt + 1,
          message: err instanceof Error ? err.message : String(err),
        })
      );
    }
  }

  return {
    narratives: deterministicBucketFallback(m, fmt),
    source: "deterministic_fallback",
  };
}

function normalizeBucketNarratives(
  parsed: Partial<AllBucketNarratives>
): AllBucketNarratives | null {
  const keys = ["ELIMINATE", "MIGRATE", "INVEST", "TOLERATE"] as const;
  const out: Partial<AllBucketNarratives> = {};
  for (const k of keys) {
    const b = parsed[k];
    if (
      !b ||
      typeof b.governingThought !== "string" ||
      !Array.isArray(b.whyNow) ||
      b.whyNow.length < 1 ||
      typeof b.whatItMeans !== "string" ||
      typeof b.action !== "string"
    ) {
      return null;
    }
    out[k] = {
      governingThought: b.governingThought,
      whyNow: [
        String(b.whyNow[0] ?? ""),
        String(b.whyNow[1] ?? ""),
        String(b.whyNow[2] ?? ""),
      ],
      whatItMeans: b.whatItMeans,
      action: b.action,
    };
  }
  return out as AllBucketNarratives;
}

function deterministicBucketFallback(
  m: RationalizationMetrics,
  fmt: (n: number) => string
): AllBucketNarratives {
  const mk = (
    key: "ELIMINATE" | "MIGRATE" | "INVEST" | "TOLERATE",
    summary: string,
    action: string
  ): BucketNarrative => {
    const bucket = m.byClassification[key];
    const count = bucket?.count ?? 0;
    if (count === 0) {
      return {
        governingThought: "—",
        whyNow: ["—", "—", "—"],
        whatItMeans: "—",
        action: "—",
      };
    }
    const top = (bucket?.apps ?? [])
      .slice()
      .sort((a, b) => b.annualCostUsd - a.annualCostUsd)
      .slice(0, 3)
      .map((a) => a.name)
      .join(", ");
    return {
      governingThought: `${count} application${count === 1 ? "" : "s"} totaling ${fmt(bucket?.annualCostUsd ?? 0)} in annual run-cost. ${summary}`,
      whyNow: [
        `Top candidates by cost: ${top}.`,
        `Bucket disposition is set on each Application record.`,
        `Engagement team validates the list before committing the recommendation.`,
      ],
      whatItMeans: `The next steps section names owners and dates; the financial impact section captures the savings figure.`,
      action,
    };
  };
  return {
    ELIMINATE: mk(
      "ELIMINATE",
      "These applications deliver low business value against high technical debt and warrant decommissioning within twelve months.",
      "Sequence sunset across NOW, NEXT, and LATER horizons per the decommission roadmap."
    ),
    MIGRATE: mk(
      "MIGRATE",
      "These applications carry strategic capability but technical debt; replacement onto a retained platform recovers run-cost and de-risks operation.",
      "Confirm retained platform capacity, then sequence migration waves across the next 24 months."
    ),
    INVEST: mk(
      "INVEST",
      "These applications carry high business value against weak technical health; under-investment compounds risk.",
      "Fund remediation programmes against each INVEST candidate in the next budget cycle."
    ),
    TOLERATE: mk(
      "TOLERATE",
      "These applications carry adequate business value and technical health and have no cheaper alternative; holding is the disciplined call.",
      "Hold position; revisit at the next portfolio review."
    ),
  };
}

// ─── Shared parsing + verification ─────────────────────────────

function parseJsonish(raw: string): Record<string, unknown> & {
  executiveSummary?: string;
} {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence?.[1]?.trim() ?? raw.trim();
  try {
    return JSON.parse(candidate);
  } catch {
    return {};
  }
}

/** Parse a money string ("£8.4M", "£8,400,000", "$2.5B") into its
 *  numeric value. Returns null if the string isn't a recognizable
 *  money expression. */
function parseMoney(s: string): number | null {
  const m = s.match(/[$€£¥]\s*([\d.,]+)\s*([KkMmBb])?/);
  if (!m) return null;
  const digits = m[1]!.replace(/,/g, "");
  const num = parseFloat(digits);
  if (!isFinite(num)) return null;
  const suffix = m[2]?.toUpperCase();
  const mult =
    suffix === "K" ? 1_000 :
    suffix === "M" ? 1_000_000 :
    suffix === "B" ? 1_000_000_000 :
    1;
  return num * mult;
}

/** Verify every dollar amount in `text` matches a value in
 *  `allowedCosts` within 1.5% tolerance (covers rounding diffs
 *  between e.g. "£4.58M" and "£4.6M"). Hallucinated numbers (any
 *  value not within tolerance of an allowed value) fail.
 *
 *  This loosens the previous string-equality check that rejected
 *  any compact-form currency the LLM emitted (the input only had
 *  long-form). The cost-grounding intent is preserved: the LLM
 *  cannot invent dollar amounts; it can only paraphrase the ones
 *  in the input. */
function verifyDollarAmounts(
  text: string,
  allowedCosts: string[]
): boolean {
  const allowedNumbers = allowedCosts
    .map(parseMoney)
    .filter((n): n is number => n !== null);
  if (allowedNumbers.length === 0) {
    // No allowed costs known — fall back to the strict "no money in
    // text" rule (any money expression in the prose is a hallucination).
    return !/[$€£¥]\s*[\d.,]+\s*(?:[KkMmBb])?/.test(text);
  }
  const pattern = /[$€£¥]\s*[\d.,]+\s*(?:[KkMmBb])?/g;
  const matches = text.match(pattern) ?? [];
  for (const m of matches) {
    const n = parseMoney(m);
    if (n === null) return false;
    const ok = allowedNumbers.some((a) =>
      a === 0 ? n === 0 : Math.abs(n - a) / Math.max(a, 1) < 0.015
    );
    if (!ok) return false;
  }
  return true;
}

// ─── Five Key Findings (synthesis layer LLM call) ──────────────

type KeyFinding = { title: string; body: string };

type KeyFindingsFacts = {
  clientName: string;
  costCurrency: string;
  totals: {
    apps: number;
    classified: number;
    annualCost: string;
    annualCostCompact: string;
    threeYearSavings: string;
    threeYearSavingsCompact: string;
  };
  buckets: Array<{
    name: "ELIMINATE" | "MIGRATE" | "INVEST" | "TOLERATE";
    count: number;
    cost: string;
    costCompact: string;
    phasingOutCount: number;
    topApps: string[];
  }>;
  multiProductVendors: Array<{
    vendor: string;
    count: number;
    cost: string;
    costCompact: string;
    capabilities: string[];
  }>;
  redundancyCapCount: number;
  topRedundantCapabilities: Array<{
    capability: string;
    appCount: number;
    apps: string[];
  }>;
  vendorTopName: string;
  vendorTopShare: string; // "19%"
  inHouseCost: string;
  inHouseCostCompact: string;
  inHouseShare: string; // "23%"
};

export function buildKeyFindingsFacts(
  m: RationalizationMetrics,
  fmt: (n: number) => string,
  fmtCompact: (n: number) => string,
  clientName: string
): KeyFindingsFacts {
  const buckets = (
    ["ELIMINATE", "MIGRATE", "INVEST", "TOLERATE"] as const
  ).map((name) => {
    const apps = m.byClassification[name]?.apps ?? [];
    const cost = m.byClassification[name]?.annualCostUsd ?? 0;
    const phasingOutCount = apps.filter(
      (a) => a.lifecycle === "PHASING_OUT" || a.lifecycle === "RETIRED"
    ).length;
    const topApps = apps
      .slice()
      .sort((a, b) => b.annualCostUsd - a.annualCostUsd)
      .slice(0, 3)
      .map((a) => a.name);
    return {
      name,
      count: m.byClassification[name]?.count ?? 0,
      cost: fmt(cost),
      costCompact: fmtCompact(cost),
      phasingOutCount,
      topApps,
    };
  });
  return {
    clientName,
    costCurrency: m.costCurrency,
    totals: {
      apps: m.totalApps,
      classified: m.classifiedApps,
      annualCost: fmt(m.totalAnnualCostUsd),
      annualCostCompact: fmtCompact(m.totalAnnualCostUsd),
      threeYearSavings: fmt(m.projectedSavings.totalCandidate3yrUsd),
      threeYearSavingsCompact: fmtCompact(
        m.projectedSavings.totalCandidate3yrUsd
      ),
    },
    buckets,
    multiProductVendors: m.multiProductVendors.map((v) => ({
      vendor: v.vendor,
      count: v.count,
      cost: fmt(v.annualCostUsd),
      costCompact: fmtCompact(v.annualCostUsd),
      capabilities: Array.from(
        new Set(v.apps.flatMap((a) => a.capabilityNames))
      ).slice(0, 6),
    })),
    redundancyCapCount: m.redundancyMatrix.length,
    topRedundantCapabilities: m.redundancyMatrix.slice(0, 5).map((r) => ({
      capability: r.capabilityName,
      appCount: r.appsCovering.length,
      apps: r.appsCovering.map((a) => a.name),
    })),
    vendorTopName: m.vendorTopName,
    vendorTopShare: `${Math.round(m.vendorTopShare * 100)}%`,
    inHouseCost: fmt(m.sourcing.inHouse.annualCostUsd),
    inHouseCostCompact: fmtCompact(m.sourcing.inHouse.annualCostUsd),
    inHouseShare: `${Math.round(m.sourcing.inHouseShare * 100)}%`,
  };
}

export async function generateKeyFindings(
  facts: KeyFindingsFacts,
  fmt: (n: number) => string,
  fmtCompact: (n: number) => string,
  m: RationalizationMetrics
): Promise<{
  findings: KeyFinding[];
  source: "llm" | "deterministic_fallback";
}> {
  if (facts.totals.classified === 0) {
    return {
      findings: deterministicKeyFindingsFallback(facts, fmt, fmtCompact, m),
      source: "deterministic_fallback",
    };
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: MODEL_SONNET,
        max_tokens: 1500,
        system: RATIONALIZATION_KEY_FINDINGS_PROMPT,
        messages: [
          {
            role: "user",
            content: `Facts:\n${JSON.stringify(facts, null, 2)}\n\nReturn JSON only.`,
          },
        ],
      });
      const textBlock = response.content.find((b) => b.type === "text");
      const raw =
        textBlock && "text" in textBlock && typeof textBlock.text === "string"
          ? textBlock.text
          : "";
      const parsed = parseJsonish(raw) as {
        findings?: Array<{ title?: unknown; body?: unknown }>;
      };
      const findings: KeyFinding[] = (parsed.findings ?? [])
        .filter(
          (f): f is { title: string; body: string } =>
            typeof f.title === "string" && typeof f.body === "string"
        )
        .slice(0, 5);
      if (findings.length < 3) continue;

      // Fact-grounding post-check across all 5 findings.
      const allowedCosts = collectAllowedCostsForKeyFindings(facts);
      const allText = findings.map((f) => `${f.title} ${f.body}`).join(" ");
      if (!verifyDollarAmounts(allText, allowedCosts)) {
        console.warn(
          JSON.stringify({
            evt: "key_findings_fact_mismatch",
            template: "rationalization-v3",
            attempt: attempt + 1,
          })
        );
        continue;
      }
      return { findings, source: "llm" };
    } catch (err) {
      console.warn(
        JSON.stringify({
          evt: "key_findings_llm_error",
          template: "rationalization-v3",
          attempt: attempt + 1,
          message: err instanceof Error ? err.message : String(err),
        })
      );
    }
  }
  return {
    findings: deterministicKeyFindingsFallback(facts, fmt, fmtCompact, m),
    source: "deterministic_fallback",
  };
}

function collectAllowedCostsForKeyFindings(
  facts: KeyFindingsFacts
): string[] {
  const out: string[] = [
    facts.totals.annualCost,
    facts.totals.annualCostCompact,
    facts.totals.threeYearSavings,
    facts.totals.threeYearSavingsCompact,
    facts.inHouseCost,
    facts.inHouseCostCompact,
  ];
  for (const b of facts.buckets) out.push(b.cost, b.costCompact);
  for (const v of facts.multiProductVendors) out.push(v.cost, v.costCompact);
  return out;
}

function deterministicKeyFindingsFallback(
  facts: KeyFindingsFacts,
  fmt: (n: number) => string,
  _fmtCompact: (n: number) => string,
  m: RationalizationMetrics
): KeyFinding[] {
  const out: KeyFinding[] = [];

  // 1. Programme size + Wave-1 anchor
  const phasingOut = facts.buckets.reduce(
    (s, b) => s + b.phasingOutCount,
    0
  );
  out.push({
    title: `${facts.totals.threeYearSavingsCompact} three-year programme anchored on ${phasingOut} Wave-1 retirements`,
    body: `The recommended programme avoids ${facts.totals.threeYearSavings} of run-cost over a three-year horizon. ${phasingOut} application${phasingOut === 1 ? "" : "s"} sit in PHASING_OUT lifecycle and have already been classified — these form the Wave-1 retirement queue and close the open commitments first.`,
  });

  // 2. Vendor concentration
  const topVendor = facts.multiProductVendors[0];
  if (topVendor) {
    out.push({
      title: `${topVendor.vendor} concentration is the largest single-vendor lever`,
      body: `${topVendor.vendor} carries ${topVendor.cost} across ${topVendor.count} applications spanning ${topVendor.capabilities.slice(0, 3).join(", ") || "multiple capabilities"}. Sequencing the FY27 procurement decision around this trio anchors the strongest negotiating position the portfolio offers.`,
    });
  } else if (facts.vendorTopShare !== "0%") {
    out.push({
      title: `${facts.vendorTopName} concentration shapes the procurement strategy`,
      body: `${facts.vendorTopName} carries ${facts.vendorTopShare} of annual run-cost — the largest single-vendor exposure in the portfolio. Map every ${facts.vendorTopName} application to its renewal date before any spend optimization decision.`,
    });
  }

  // 3. Phasing-out asymmetry
  const eliminate = facts.buckets.find((b) => b.name === "ELIMINATE");
  const migrate = facts.buckets.find((b) => b.name === "MIGRATE");
  if ((eliminate?.phasingOutCount ?? 0) > 0 || (migrate?.phasingOutCount ?? 0) > 0) {
    out.push({
      title: `PHASING_OUT applications split between platform replacement and capability retirement`,
      body: `${migrate?.phasingOutCount ?? 0} PHASING_OUT applications carry MIGRATE disposition (capability continues, app changes), and ${eliminate?.phasingOutCount ?? 0} carry ELIMINATE (capability retires with the app). The asymmetry is the strategic story: the operations stack is being modernized, not retired.`,
    });
  }

  // 4. INVEST priority
  const invest = facts.buckets.find((b) => b.name === "INVEST");
  if (invest && invest.count > 0) {
    out.push({
      title: `${invest.costCompact} INVEST commitment frames the digital-transformation pace`,
      body: `${invest.count} strategic applications carrying ${invest.cost} of committed spend on healthy platforms include ${invest.topApps.slice(0, 2).join(" and ")}. Capacity expansion on these systems leads the FY27 capital plan.`,
    });
  }

  // 5. Redundancy
  if (facts.redundancyCapCount > 0) {
    const top = facts.topRedundantCapabilities[0];
    out.push({
      title: `${facts.redundancyCapCount} multi-served capabilities surface consolidation opportunity`,
      body: `${facts.redundancyCapCount} capabilit${facts.redundancyCapCount === 1 ? "y is" : "ies are"} served by more than one application${top ? `; ${top.capability} alone is covered by ${top.appCount} apps (${top.apps.slice(0, 3).join(", ")})` : ""}. Consolidation onto the strongest retained app per capability surfaces savings beyond the bucket-level totals.`,
    });
  } else if (facts.inHouseCost && facts.inHouseShare !== "0%") {
    out.push({
      title: `${facts.inHouseShare} of annual spend sits in in-house systems without per-capability allocation`,
      body: `${facts.inHouseCost} of annual run-cost is in-house-built. Without per-capability allocation this spend is invisible to vendor-driven optimization levers; mapping each in-house system to its capability surface is a precondition for the next round of cost analysis.`,
    });
  }

  // Pad to 5 with the next-most-important deterministic finding.
  while (out.length < 5) {
    out.push({
      title: `${facts.totals.classified} of ${facts.totals.apps} applications carry a TIME disposition`,
      body: `Disposition coverage is ${Math.round((facts.totals.classified / Math.max(facts.totals.apps, 1)) * 100)}%, unlocking the full rationalization analysis. The portfolio totals ${facts.totals.annualCost} per year across ${facts.totals.apps} active applications.`,
    });
    break; // unreachable, but defensive
  }
  return out.slice(0, 5);
}

// ─── Per-app deep dives (top-decile LLM call) ──────────────────

type DeepDive = {
  dispositionRationale: string;
  migrationPath: string;
  waveJustification: string;
};

type DeepDivesFacts = {
  clientName: string;
  costCurrency: string;
  apps: Array<{
    id: string;
    name: string;
    vendor: string;
    lifecycle: string;
    businessValue: string;
    technicalHealth: string;
    disposition: string;
    cost: string;
    costCompact: string;
    capabilities: string[];
    capabilityAlternatives: Array<{ capability: string; otherApps: string[] }>;
  }>;
};

export function buildDeepDivesFacts(
  m: RationalizationMetrics,
  topApps: AppSummary[],
  fmt: (n: number) => string,
  fmtCompact: (n: number) => string,
  clientName: string
): DeepDivesFacts {
  // For each top app, build the capability-alternatives view.
  const altsFor = (app: AppSummary) => {
    const out: Array<{ capability: string; otherApps: string[] }> = [];
    for (const cap of app.capabilityNames) {
      const matrixEntry = m.redundancyMatrix.find(
        (r) => r.capabilityName === cap
      );
      if (matrixEntry) {
        const others = matrixEntry.appsCovering
          .filter((a) => a.id !== app.id)
          .map((a) => a.name);
        if (others.length > 0) {
          out.push({ capability: cap, otherApps: others });
        }
      }
    }
    return out;
  };
  return {
    clientName,
    costCurrency: m.costCurrency,
    apps: topApps.map((a) => ({
      id: a.id,
      name: a.name,
      vendor: a.vendor ?? "—",
      lifecycle: a.lifecycle.replace(/_/g, " "),
      businessValue: (a.businessValue ?? "—").replace(/^BV_/, ""),
      technicalHealth: (a.technicalHealth ?? "—").replace(/^TH_/, ""),
      disposition: a.rationalizationStatus,
      cost: fmt(a.annualCostUsd),
      costCompact: fmtCompact(a.annualCostUsd),
      capabilities: a.capabilityNames,
      capabilityAlternatives: altsFor(a),
    })),
  };
}

export async function generateDeepDives(
  facts: DeepDivesFacts
): Promise<{
  byId: Record<string, DeepDive>;
  source: "llm" | "deterministic_fallback";
}> {
  if (facts.apps.length === 0) {
    return { byId: {}, source: "deterministic_fallback" };
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: MODEL_SONNET,
        max_tokens: 2500,
        system: RATIONALIZATION_DEEP_DIVES_PROMPT,
        messages: [
          {
            role: "user",
            content: `Facts:\n${JSON.stringify(facts, null, 2)}\n\nReturn JSON only.`,
          },
        ],
      });
      const textBlock = response.content.find((b) => b.type === "text");
      const raw =
        textBlock && "text" in textBlock && typeof textBlock.text === "string"
          ? textBlock.text
          : "";
      const parsed = parseJsonish(raw) as Record<
        string,
        Partial<DeepDive>
      >;
      const byId: Record<string, DeepDive> = {};
      let valid = 0;
      for (const app of facts.apps) {
        const entry = parsed[app.id];
        if (
          entry &&
          typeof entry.dispositionRationale === "string" &&
          typeof entry.migrationPath === "string" &&
          typeof entry.waveJustification === "string"
        ) {
          byId[app.id] = {
            dispositionRationale: entry.dispositionRationale,
            migrationPath: entry.migrationPath,
            waveJustification: entry.waveJustification,
          };
          valid++;
        }
      }
      if (valid < facts.apps.length) continue;

      // Fact-grounding post-check.
      const allowedCosts: string[] = [];
      for (const a of facts.apps) allowedCosts.push(a.cost, a.costCompact);
      const allText = Object.values(byId)
        .map(
          (d) =>
            `${d.dispositionRationale} ${d.migrationPath} ${d.waveJustification}`
        )
        .join(" ");
      if (!verifyDollarAmounts(allText, allowedCosts)) {
        console.warn(
          JSON.stringify({
            evt: "deep_dives_fact_mismatch",
            template: "rationalization-v3",
            attempt: attempt + 1,
          })
        );
        continue;
      }
      return { byId, source: "llm" };
    } catch (err) {
      console.warn(
        JSON.stringify({
          evt: "deep_dives_llm_error",
          template: "rationalization-v3",
          attempt: attempt + 1,
          message: err instanceof Error ? err.message : String(err),
        })
      );
    }
  }
  // Deterministic fallback per app.
  const byId: Record<string, DeepDive> = {};
  for (const a of facts.apps) {
    byId[a.id] = deterministicDeepDiveFallback(a);
  }
  return { byId, source: "deterministic_fallback" };
}

function deterministicDeepDiveFallback(
  a: DeepDivesFacts["apps"][number]
): DeepDive {
  const altsLine =
    a.capabilityAlternatives.length === 0
      ? "no alternative app in the portfolio covers the same capabilities"
      : `the portfolio offers alternatives on ${a.capabilityAlternatives.map((x) => x.capability).slice(0, 2).join(" and ")}`;
  const wave =
    a.lifecycle.includes("PHASING") || a.lifecycle === "RETIRED"
      ? "NOW (<12 months)"
      : a.disposition === "INVEST"
        ? "LATER (24-36 months)"
        : "NEXT (12-24 months)";
  return {
    dispositionRationale: `${a.name} sits in the ${a.disposition} bucket, reflecting ${a.businessValue} business value against ${a.technicalHealth} technical health on a ${a.lifecycle} platform; ${altsLine}.`,
    migrationPath:
      a.disposition === "ELIMINATE"
        ? "Decommission via data archival and capability successor confirmation; align with the contract renewal cycle to capture the full saving."
        : a.disposition === "MIGRATE"
          ? "Modernize onto the retained platform that covers the same capability area; load-test before commitment opens."
          : a.disposition === "INVEST"
            ? "Expand capacity and integration to support the strategic capability bet."
            : "Maintain at current service levels through the standard support contract.",
    waveJustification: `Wave: ${wave}, driven by ${a.lifecycle} lifecycle and ${a.disposition} disposition.`,
  };
}

export {
  RATIONALIZATION_EXEC_SUMMARY_VERSION,
  RATIONALIZATION_BUCKET_NARRATIVES_VERSION,
  RATIONALIZATION_KEY_FINDINGS_VERSION,
  RATIONALIZATION_DEEP_DIVES_VERSION,
};
