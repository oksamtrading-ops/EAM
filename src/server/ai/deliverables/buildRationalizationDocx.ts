import "server-only";
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
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
  actionTitle,
  brandedHeading,
  buildCallout,
  buildTable,
  formatCurrency,
  formatDateISO,
  makeFooter,
  normalizeHex,
  renderCoverPage,
  renderInline,
} from "./_helpers";

export const RATIONALIZATION_TEMPLATE_VERSION = "2.0";
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
};

export type RationalizationDocxInput = {
  clientName: string;
  brandHex: string | null;
  logoBytes?: Buffer | null;
  logoMimeType?: string | null;
  preparedBy?: string | null;
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

  // Pre-format dollar values once so the LLM input + the doc body
  // share exact strings — what makes the post-check tractable.
  const facts = buildExecSummaryFacts(m, fmt, input.clientName);
  const bucketFacts = buildBucketFacts(m, fmt, input.clientName);

  // Two LLM calls (exec summary + bucket narratives in one).
  const [execSummary, bucketNarratives] = await Promise.all([
    generateExecutiveSummary(facts),
    generateBucketNarratives(bucketFacts, m, fmt),
  ]);

  const llmSource: RationalizationDocxResult["llmSource"] =
    execSummary.source === "llm" && bucketNarratives.source === "llm"
      ? "llm"
      : execSummary.source === "deterministic_fallback" &&
          bucketNarratives.source === "deterministic_fallback"
        ? "deterministic_fallback"
        : "partial_fallback";

  const children: (
    | Paragraph
    | ReturnType<typeof buildTable>
    | ReturnType<typeof buildCallout>
  )[] = [];

  // ─── Cover ──────────────────────────────────────────────────
  children.push(
    ...renderCoverPage({
      documentTitle: "Application Rationalization Plan",
      clientName: input.clientName,
      brandHex,
      templateVersionLabel: RATIONALIZATION_TEMPLATE_LABEL,
      preparedBy: input.preparedBy ?? null,
      logoBytes: input.logoBytes ?? null,
      logoMimeType: input.logoMimeType ?? null,
    })
  );

  // ─── 1. Executive Summary ──────────────────────────────────
  const eliminatePctOfRunCost = pctOf(
    m.byClassification.ELIMINATE?.annualCostUsd ?? 0,
    m.totalAnnualCostUsd
  );
  children.push(
    brandedHeading("Executive Summary", HeadingLevel.HEADING_1, brandHex, {
      spacingBefore: 0,
    })
  );
  children.push(
    actionTitle(
      `Of ${m.totalApps} applications, ${m.classifiedApps} carry a TIME disposition; the recommended programme delivers ${fmt(m.projectedSavings.totalCandidate3yrUsd)} in run-cost savings over three years against a current portfolio cost of ${fmt(m.totalAnnualCostUsd)} per year.`,
      brandHex
    )
  );
  for (const para of execSummary.text.split(/\n{2,}/)) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    children.push(
      new Paragraph({
        spacing: { after: 160 },
        children: renderInline(trimmed),
      })
    );
  }

  // ─── 2. Methodology and Assumptions ────────────────────────
  children.push(
    brandedHeading(
      "Methodology and Assumptions",
      HeadingLevel.HEADING_1,
      brandHex
    )
  );
  children.push(
    buildCallout({
      title: "Assumptions used to compute projected savings",
      bullets: m.projectedSavings.assumptions,
      brandHex,
    })
  );

  // ─── 3. Portfolio Snapshot ─────────────────────────────────
  children.push(
    brandedHeading("Portfolio Snapshot", HeadingLevel.HEADING_1, brandHex)
  );
  children.push(
    actionTitle(
      `${m.classifiedApps} of ${m.totalApps} applications carry a disposition; ELIMINATE candidates alone represent ${eliminatePctOfRunCost}% of total annual run-cost.`,
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
    })
  );

  // ─── 4. TIME Quadrant Analysis ─────────────────────────────
  children.push(
    brandedHeading("TIME Quadrant Analysis", HeadingLevel.HEADING_1, brandHex)
  );
  children.push(
    actionTitle(
      `The Business-Value × Technical-Health 2×2 surfaces where the portfolio is overfunded, underinvested, or genuinely sound; act on the high-value/poor-health quadrant first.`,
      brandHex
    )
  );
  children.push(buildQuadrantTable(m, brandHex));

  // ─── 5–8. Per-bucket narratives ────────────────────────────
  pushBucketSection(
    children,
    "ELIMINATE — Decommission Candidates",
    bucketNarratives.narratives.ELIMINATE,
    m.topEliminationCandidates,
    m.byClassification.ELIMINATE,
    fmt,
    brandHex
  );
  pushBucketSection(
    children,
    "MIGRATE — Replacement Candidates",
    bucketNarratives.narratives.MIGRATE,
    m.topMigrationCandidates,
    m.byClassification.MIGRATE,
    fmt,
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
    brandHex
  );

  // ─── 9. Redundancy Map ─────────────────────────────────────
  children.push(
    brandedHeading("Redundancy Map", HeadingLevel.HEADING_1, brandHex)
  );
  if (m.redundancyMatrix.length === 0) {
    children.push(
      actionTitle(
        "No capability is served by more than one application; consolidation is not the lever in this portfolio.",
        brandHex
      )
    );
  } else {
    children.push(
      actionTitle(
        `${m.redundancyMatrix.length} capabilit${m.redundancyMatrix.length === 1 ? "y is" : "ies are"} served by multiple applications; consolidation onto the strongest retained app surfaces savings beyond the bucket-level totals.`,
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
      })
    );
  }

  // ─── 10. Decommission Roadmap ──────────────────────────────
  children.push(
    brandedHeading("Decommission Roadmap", HeadingLevel.HEADING_1, brandHex)
  );
  const roadmapRows = buildRoadmapRows(m, fmt);
  if (roadmapRows.length === 0) {
    children.push(
      actionTitle(
        "No ELIMINATE or MIGRATE candidates carry costs to schedule; the roadmap is empty by construction.",
        brandHex
      )
    );
  } else {
    children.push(
      actionTitle(
        `${roadmapRows.length} application${roadmapRows.length === 1 ? "" : "s"} are sequenced across NOW (<12mo), NEXT (12–24mo), and LATER (24–36mo) horizons; lifecycle state and cost magnitude drive the placement.`,
        brandHex
      )
    );
    children.push(
      buildTable({
        headers: ["Application", "Action", "Horizon", "3-yr saving"],
        rows: roadmapRows,
        brandHex,
        columnWidthsPct: [38, 18, 18, 26],
      })
    );
  }

  // ─── 11. Financial Impact ──────────────────────────────────
  children.push(
    brandedHeading("Financial Impact", HeadingLevel.HEADING_1, brandHex)
  );
  children.push(
    actionTitle(
      `The recommended programme avoids ${fmt(m.projectedSavings.totalCandidate3yrUsd)} of run-cost across a three-year horizon; one-time decommission and migration costs are excluded and surface separately when building the business case.`,
      brandHex
    )
  );
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
    })
  );

  // ─── 12. Risks and Considerations ──────────────────────────
  children.push(
    brandedHeading(
      "Risks and Considerations",
      HeadingLevel.HEADING_1,
      brandHex
    )
  );
  children.push(
    actionTitle(
      "Seven canonical risks attend any application rationalization programme; mitigation owners and gating events are named below to make execution discoverable.",
      brandHex
    )
  );
  children.push(buildRisksTable(brandHex));

  // ─── 13. Next Steps ────────────────────────────────────────
  children.push(brandedHeading("Next Steps", HeadingLevel.HEADING_1, brandHex));
  children.push(
    actionTitle(
      "Six actions move the programme from analysis to execution within twelve weeks; owners and dependencies are placeholders for engagement-team override.",
      brandHex
    )
  );
  children.push(
    new Paragraph({
      spacing: { after: 160 },
      children: renderInline(
        `Over the next 30 days, capability owners validate the ${m.byClassification.ELIMINATE?.count ?? 0} ELIMINATE candidates against the redundancy map and confirm the contract cliffs called out in the financial section. The technical architecture team load-tests retained platforms before the first MIGRATE wave opens.`
      ),
    })
  );
  children.push(buildNextStepsTable(m, brandHex));

  // ─── Appendix A — Classified Applications ──────────────────
  children.push(
    brandedHeading(
      "Appendix A — Classified Applications",
      HeadingLevel.HEADING_1,
      brandHex
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
      })
    );
  }

  // ─── Appendix B — Methodology and Data Sources ─────────────
  children.push(
    brandedHeading(
      "Appendix B — Methodology and Data Sources",
      HeadingLevel.HEADING_1,
      brandHex
    )
  );
  children.push(
    new Paragraph({
      spacing: { after: 120 },
      children: renderInline(
        `This deliverable was generated on ${formatDateISO()} from the live application portfolio in the EAM platform. Counts and costs reflect the values stored on each Application record at the time of generation; the source fields are *rationalizationStatus*, *lifecycle*, *businessValue*, *technicalHealth*, *annualCostUsd*, and the application-capability mapping table. The Risks and Next Steps sections are template defaults intended for engagement-team override.`
      ),
    })
  );

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
  children: Array<
    Paragraph | ReturnType<typeof buildTable> | ReturnType<typeof buildCallout>
  >,
  title: string,
  narrative: BucketNarrative,
  apps: AppSummary[],
  bucket: Bucket | undefined,
  fmt: (n: number) => string,
  brandHex: string
): void {
  children.push(brandedHeading(title, HeadingLevel.HEADING_1, brandHex));

  if (!bucket || bucket.count === 0) {
    children.push(
      buildCallout({
        title: "No applications in this bucket",
        bullets: [
          "Applications classified into this disposition will populate this section in future runs.",
        ],
        brandHex,
      })
    );
    return;
  }

  // Action title — combines bucket count + cost as a leading hook.
  children.push(
    actionTitle(
      `${bucket.count} application${bucket.count === 1 ? "" : "s"} totaling ${fmt(bucket.annualCostUsd)} in annual run-cost.`,
      brandHex
    )
  );

  // Governing thought (bold paragraph)
  children.push(
    new Paragraph({
      spacing: { after: 160 },
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
        new TextRun({ text: "Why now", bold: true, color: brandHex, size: 22 }),
      ],
    })
  );
  for (const bullet of narrative.whyNow) {
    children.push(
      new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 60 },
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
          color: brandHex,
          size: 22,
        }),
      ],
    })
  );
  children.push(
    new Paragraph({
      spacing: { after: 160 },
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
          color: brandHex,
          size: 22,
        }),
      ],
    })
  );
  children.push(
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: narrative.action,
          italics: true,
          size: 22,
        }),
      ],
    })
  );

  // Apps table
  children.push(
    buildTable({
      headers: [
        "Application",
        "Vendor",
        "Lifecycle",
        "BV",
        "TH",
        "Annual cost",
        "Primary capability",
      ],
      rows: apps.map((a) => [
        a.name,
        a.vendor ?? "—",
        a.lifecycle.replace(/_/g, " "),
        (a.businessValue ?? "—").replace(/^BV_/, ""),
        (a.technicalHealth ?? "—").replace(/^TH_/, ""),
        fmt(a.annualCostUsd),
        a.capabilityNames[0] ?? "—",
      ]),
      brandHex,
      columnWidthsPct: [22, 14, 12, 8, 8, 14, 22],
    })
  );
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
  const isHighBV = (a: AppSummary) => a.businessValue === "HIGH";
  const isLowBV = (a: AppSummary) =>
    a.businessValue === "LOW" || a.businessValue === "BV_UNKNOWN";
  const isGoodTH = (a: AppSummary) =>
    a.technicalHealth === "EXCELLENT" || a.technicalHealth === "GOOD";
  const isPoorTH = (a: AppSummary) =>
    a.technicalHealth === "POOR" || a.technicalHealth === "TH_CRITICAL";
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

function buildRisksTable(brandHex: string): ReturnType<typeof buildTable> {
  return buildTable({
    headers: ["Risk", "Likelihood", "Impact", "Mitigation"],
    rows: [
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
  eliminate: { count: number; cost: string };
  migrate: { count: number; cost: string };
  invest: { count: number; cost: string };
  tolerate: { count: number; cost: string };
  topEliminate3: string[];
  topMigrate3: string[];
  projectedSavings3yr: string;
  redundancyCapCount: number;
  costCurrency: string;
};

function buildExecSummaryFacts(
  m: RationalizationMetrics,
  fmt: (n: number) => string,
  clientName: string
): ExecSummaryFacts {
  return {
    clientName,
    totalApps: m.totalApps,
    activeApps: m.activeApps,
    classifiedApps: m.classifiedApps,
    eliminate: {
      count: m.byClassification.ELIMINATE?.count ?? 0,
      cost: fmt(m.byClassification.ELIMINATE?.annualCostUsd ?? 0),
    },
    migrate: {
      count: m.byClassification.MIGRATE?.count ?? 0,
      cost: fmt(m.byClassification.MIGRATE?.annualCostUsd ?? 0),
    },
    invest: {
      count: m.byClassification.INVEST?.count ?? 0,
      cost: fmt(m.byClassification.INVEST?.annualCostUsd ?? 0),
    },
    tolerate: {
      count: m.byClassification.TOLERATE?.count ?? 0,
      cost: fmt(m.byClassification.TOLERATE?.annualCostUsd ?? 0),
    },
    topEliminate3: m.topEliminationCandidates.slice(0, 3).map((a) => a.name),
    topMigrate3: m.topMigrationCandidates.slice(0, 3).map((a) => a.name),
    projectedSavings3yr: fmt(m.projectedSavings.totalCandidate3yrUsd),
    redundancyCapCount: m.redundancyMatrix.length,
    costCurrency: m.costCurrency,
  };
}

async function generateExecutiveSummary(
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
        facts.migrate.cost,
        facts.invest.cost,
        facts.tolerate.cost,
        facts.projectedSavings3yr,
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
      cost: string;
      top5: Array<{
        name: string;
        vendor: string;
        capability: string;
        cost: string;
        bv: string;
        th: string;
      }>;
    }
  >;
};

function buildBucketFacts(
  m: RationalizationMetrics,
  fmt: (n: number) => string,
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
        bv: (a.businessValue ?? "—").replace(/^BV_/, ""),
        th: (a.technicalHealth ?? "—").replace(/^TH_/, ""),
      }));
  const buildBucket = (
    key: "ELIMINATE" | "MIGRATE" | "INVEST" | "TOLERATE"
  ) => ({
    count: m.byClassification[key]?.count ?? 0,
    cost: fmt(m.byClassification[key]?.annualCostUsd ?? 0),
    top5: top5(m.byClassification[key]?.apps ?? []),
  });
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

async function generateBucketNarratives(
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
      const allCosts = [
        facts.buckets.ELIMINATE.cost,
        facts.buckets.MIGRATE.cost,
        facts.buckets.INVEST.cost,
        facts.buckets.TOLERATE.cost,
      ];
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

function verifyDollarAmounts(
  text: string,
  allowedCosts: string[]
): boolean {
  const allowed = new Set<string>(
    allowedCosts.map((s) => s.trim()).filter(Boolean)
  );
  const pattern = /[$€£¥][\d.,KMB]+/g;
  const matches = text.match(pattern) ?? [];
  for (const m of matches) {
    if (!allowed.has(m)) return false;
  }
  return true;
}

export {
  RATIONALIZATION_EXEC_SUMMARY_VERSION,
  RATIONALIZATION_BUCKET_NARRATIVES_VERSION,
};
