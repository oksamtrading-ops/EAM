import "server-only";
import { Document, Packer, Paragraph, HeadingLevel } from "docx";
import { anthropic } from "@/server/ai/client";
import { MODEL_SONNET } from "@/server/ai/models";
import {
  RATIONALIZATION_EXEC_SUMMARY_PROMPT,
  RATIONALIZATION_EXEC_SUMMARY_VERSION,
} from "@/server/ai/prompts/rationalizationExecSummary.v1";
import {
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

export const RATIONALIZATION_TEMPLATE_VERSION = "1.0";
export const RATIONALIZATION_TEMPLATE_LABEL = `EAM Rationalization Template v${RATIONALIZATION_TEMPLATE_VERSION}`;

type AppSummary = {
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

export type RationalizationMetrics = {
  totalApps: number;
  activeApps: number;
  classifiedApps: number;
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
  execSummarySource: "llm" | "deterministic_fallback";
};

export async function buildRationalizationDocx(
  input: RationalizationDocxInput
): Promise<RationalizationDocxResult> {
  const brandHex = normalizeHex(input.brandHex);
  const m = input.metrics;
  const cur = m.costCurrency;

  // Pre-format the dollar values once so the LLM input + the doc body
  // share the same exact strings. This is what makes the post-check
  // tractable: the LLM either echoes these strings verbatim or it's
  // hallucinating.
  const fmt = (n: number) => formatCurrency(n, cur);
  const facts = {
    clientName: input.clientName,
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
    costCurrency: cur,
  };

  const execSummary = await generateExecutiveSummary(facts);

  // ─── Build the document ────────────────────────────────────
  const children: (Paragraph | ReturnType<typeof buildTable> | ReturnType<typeof buildCallout>)[] = [];

  // 1. Cover page
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

  // 2. Executive Summary
  children.push(
    brandedHeading(
      "Executive Summary",
      HeadingLevel.HEADING_1,
      brandHex,
      { spacingBefore: 0 }
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

  // 3. Methodology + Assumptions
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

  // 4. Portfolio Snapshot
  children.push(
    brandedHeading("Portfolio Snapshot", HeadingLevel.HEADING_1, brandHex)
  );
  children.push(
    new Paragraph({
      spacing: { after: 160 },
      children: renderInline(
        `The current application portfolio comprises **${m.totalApps}** active records, of which **${m.classifiedApps}** carry a TIME classification.`
      ),
    })
  );
  children.push(
    buildTable({
      headers: ["Classification", "Count", "Annual cost"],
      rows: [
        [
          "TOLERATE",
          String(m.byClassification.TOLERATE?.count ?? 0),
          fmt(m.byClassification.TOLERATE?.annualCostUsd ?? 0),
        ],
        [
          "INVEST",
          String(m.byClassification.INVEST?.count ?? 0),
          fmt(m.byClassification.INVEST?.annualCostUsd ?? 0),
        ],
        [
          "MIGRATE",
          String(m.byClassification.MIGRATE?.count ?? 0),
          fmt(m.byClassification.MIGRATE?.annualCostUsd ?? 0),
        ],
        [
          "ELIMINATE",
          String(m.byClassification.ELIMINATE?.count ?? 0),
          fmt(m.byClassification.ELIMINATE?.annualCostUsd ?? 0),
        ],
      ],
      brandHex,
      columnWidthsPct: [40, 25, 35],
    })
  );

  // 5. TIME Quadrant Analysis (2×2)
  children.push(
    brandedHeading(
      "TIME Quadrant Analysis",
      HeadingLevel.HEADING_1,
      brandHex
    )
  );
  children.push(
    new Paragraph({
      spacing: { after: 160 },
      children: renderInline(
        "Applications are placed in a 2×2 of business value (rows) and technical health (columns). Each cell lists the count of applications and up to five example names."
      ),
    })
  );
  children.push(buildQuadrantTable(m, brandHex));

  // 6. Top Elimination Candidates
  children.push(
    brandedHeading(
      "Top Elimination Candidates",
      HeadingLevel.HEADING_1,
      brandHex
    )
  );
  if (m.topEliminationCandidates.length === 0) {
    children.push(
      buildCallout({
        title: "No elimination candidates yet",
        bullets: [
          "No applications carry an ELIMINATE classification today.",
          "Classify applications in /applications to populate this section.",
        ],
        brandHex,
      })
    );
  } else {
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
        rows: m.topEliminationCandidates.map((a) => [
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

  // 7. Top Migration Candidates
  children.push(
    brandedHeading(
      "Top Migration Candidates",
      HeadingLevel.HEADING_1,
      brandHex
    )
  );
  if (m.topMigrationCandidates.length === 0) {
    children.push(
      buildCallout({
        title: "No migration candidates yet",
        bullets: [
          "No applications carry a MIGRATE classification today.",
        ],
        brandHex,
      })
    );
  } else {
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
        rows: m.topMigrationCandidates.map((a) => [
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

  // 8. Redundancy Map
  children.push(
    brandedHeading("Redundancy Map", HeadingLevel.HEADING_1, brandHex)
  );
  if (m.redundancyMatrix.length === 0) {
    children.push(
      buildCallout({
        title: "No redundancy detected",
        bullets: [
          "Every capability with applications mapped to it has exactly one supporting application.",
          "If you expect overlap, verify capability mappings in /applications.",
        ],
        brandHex,
      })
    );
  } else {
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

  // 9. Decommission Roadmap (simple bucketing — ELIMINATE first)
  children.push(
    brandedHeading(
      "Decommission Roadmap",
      HeadingLevel.HEADING_1,
      brandHex
    )
  );
  const roadmapRows = buildRoadmapRows(m, fmt);
  if (roadmapRows.length === 0) {
    children.push(
      buildCallout({
        title: "Nothing scheduled",
        bullets: [
          "No ELIMINATE or MIGRATE candidates currently in the portfolio.",
        ],
        brandHex,
      })
    );
  } else {
    children.push(
      buildTable({
        headers: ["Application", "Action", "Horizon", "Estimated 3-yr saving"],
        rows: roadmapRows,
        brandHex,
        columnWidthsPct: [38, 18, 18, 26],
      })
    );
  }

  // 10. Projected Savings
  children.push(
    brandedHeading("Projected Savings", HeadingLevel.HEADING_1, brandHex)
  );
  children.push(
    new Paragraph({
      spacing: { after: 80 },
      children: renderInline(
        `**Eliminate, 3-year horizon:** ${fmt(m.projectedSavings.eliminate3yrUsd)}`
      ),
    })
  );
  children.push(
    new Paragraph({
      spacing: { after: 80 },
      children: renderInline(
        `**Migrate, 3-year horizon (50% retained run-rate):** ${fmt(m.projectedSavings.migrate3yrUsd)}`
      ),
    })
  );
  children.push(
    new Paragraph({
      spacing: { after: 200 },
      children: renderInline(
        `**Total candidate 3-year savings:** ${fmt(m.projectedSavings.totalCandidate3yrUsd)}`
      ),
    })
  );

  // 11. Appendix A — Full classified application list
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
          "*No applications carry a TIME classification yet. Classify applications in /applications first.*"
        ),
      })
    );
  } else {
    children.push(
      buildTable({
        headers: [
          "Application",
          "Vendor",
          "Status",
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
        columnWidthsPct: [32, 18, 14, 16, 20],
      })
    );
  }

  // 12. Appendix B — Methodology & Data Sources
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
        `This deliverable was generated on ${formatDateISO()} from the live application portfolio in the EAM platform. Counts and costs reflect the values stored on each Application record at the time of generation; the source fields are *rationalizationStatus*, *lifecycle*, *businessValue*, *technicalHealth*, *annualCostUsd*, and the application-capability mapping table. Refresh those values for an up-to-date picture.`
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
          default: makeFooter(input.clientName, RATIONALIZATION_TEMPLATE_LABEL),
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
    execSummarySource: execSummary.source,
  };
}

// ─── Internals ─────────────────────────────────────────────────

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

async function generateExecutiveSummary(
  facts: ExecSummaryFacts
): Promise<{ text: string; source: "llm" | "deterministic_fallback" }> {
  // No data path → skip LLM entirely. The doc is informational, not
  // a sales pitch — be honest when there's nothing classified.
  if (facts.classifiedApps === 0) {
    return {
      text: deterministicFallback(facts),
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

      const parsed = parseSummaryJson(raw);
      const text = parsed.executiveSummary?.trim();
      if (!text) {
        continue;
      }

      // Fact-grounding post-check — every dollar amount in the LLM
      // output must appear verbatim in the input facts. Catches
      // hallucinations before they reach a client.
      if (!verifyGrounded(text, facts)) {
        console.warn(
          JSON.stringify({
            evt: "exec_summary_fact_mismatch",
            template: "rationalization",
            attempt: attempt + 1,
            reason: "dollar amount not in input facts",
          })
        );
        continue;
      }

      return { text, source: "llm" };
    } catch (err) {
      console.warn(
        JSON.stringify({
          evt: "exec_summary_llm_error",
          template: "rationalization",
          attempt: attempt + 1,
          message: err instanceof Error ? err.message : String(err),
        })
      );
    }
  }

  return {
    text: deterministicFallback(facts),
    source: "deterministic_fallback",
  };
}

function deterministicFallback(facts: ExecSummaryFacts): string {
  const lines: string[] = [];
  lines.push(
    `Findings indicate that ${facts.classifiedApps} of ${facts.totalApps} active applications in the ${facts.clientName} portfolio carry a TIME classification. Of these, ${facts.eliminate.count} are flagged for elimination (${facts.eliminate.cost} annual run-cost), ${facts.migrate.count} for migration (${facts.migrate.cost}), ${facts.invest.count} for investment (${facts.invest.cost}), and ${facts.tolerate.count} for retention (${facts.tolerate.cost}).`
  );
  lines.push(
    `Analysis projects ${facts.projectedSavings3yr} in candidate savings over a three-year horizon under the assumptions documented in the methodology section.`
  );
  if (facts.redundancyCapCount > 0) {
    lines.push(
      `Several capabilities (${facts.redundancyCapCount}) are served by multiple applications, suggesting consolidation opportunity addressed in the redundancy map below.`
    );
  }
  lines.push(
    `The decommission roadmap below sequences these candidates for action.`
  );
  return lines.join("\n\n");
}

function parseSummaryJson(raw: string): { executiveSummary?: string } {
  // Tolerate markdown-fenced output even though the prompt forbids it.
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence?.[1]?.trim() ?? raw.trim();
  try {
    return JSON.parse(candidate);
  } catch {
    return {};
  }
}

/** Every dollar amount mentioned in the LLM output must appear
 *  verbatim in one of the cost strings on the input facts. This is
 *  a coarse check (catches the worst hallucination — fabricated
 *  totals) without false-positiving on ordinary numbers like years. */
function verifyGrounded(text: string, facts: ExecSummaryFacts): boolean {
  const allowedCosts = new Set<string>(
    [
      facts.eliminate.cost,
      facts.migrate.cost,
      facts.invest.cost,
      facts.tolerate.cost,
      facts.projectedSavings3yr,
    ]
      .map((s) => s.trim())
      .filter(Boolean)
  );
  // Find currency-styled tokens like $1,250,000 / €420 / $2.8M.
  // Conservative: only flag obvious dollar/euro markers.
  const pattern = /[$€£¥][\d.,KMB]+/g;
  const matches = text.match(pattern) ?? [];
  for (const m of matches) {
    if (!allowedCosts.has(m)) return false;
  }
  return true;
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
    headers: ["Business value", "Good technical health", "Poor technical health"],
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

  // ELIMINATE candidates first — already PHASING_OUT goes NOW (<12mo);
  // ACTIVE goes NEXT (12-24mo); everything else LATER.
  for (const app of m.topEliminationCandidates) {
    const horizon =
      app.lifecycle === "PHASING_OUT" || app.lifecycle === "RETIRED"
        ? "NOW (<12mo)"
        : app.lifecycle === "ACTIVE"
          ? "NEXT (12-24mo)"
          : "LATER (24-36mo)";
    rows.push([
      app.name,
      "ELIMINATE",
      horizon,
      fmt(app.annualCostUsd * 3),
    ]);
  }

  // MIGRATE candidates — typically NEXT.
  for (const app of m.topMigrationCandidates) {
    const horizon =
      app.lifecycle === "PHASING_OUT"
        ? "NOW (<12mo)"
        : app.lifecycle === "ACTIVE"
          ? "NEXT (12-24mo)"
          : "LATER (24-36mo)";
    rows.push([
      app.name,
      "MIGRATE",
      horizon,
      fmt(app.annualCostUsd * 0.5 * 3),
    ]);
  }

  return rows;
}

export { RATIONALIZATION_EXEC_SUMMARY_VERSION };
