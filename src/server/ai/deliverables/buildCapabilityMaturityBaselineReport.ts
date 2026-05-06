import "server-only";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  Table,
  TextRun,
} from "docx";
import {
  buildActionTitle,
  buildHeading,
  buildCallout,
  buildKpiRow,
  buildTable,
  makeFooter,
  normalizeHex,
  renderCoverPage,
  renderInsideCoverDisclaimer,
  buildStaticTOC,
  renderSectionDivider,
  clampForContrast,
} from "./_helpers";
import { T } from "./tokens";
import { buildImportanceMaturityMatrix } from "./charts/buildImportanceMaturityMatrix";
import type { CapabilityMaturityMetrics } from "./capabilityMaturityMetrics";

export const CAPABILITY_BASELINE_TEMPLATE_VERSION = "1.0";
export const CAPABILITY_BASELINE_TEMPLATE_LABEL = `EAM Capability Maturity Baseline Report v${CAPABILITY_BASELINE_TEMPLATE_VERSION}`;
export const CAPABILITY_BASELINE_PROJECT_LABEL =
  "Capability Maturity Baseline Report";
const COVERAGE_THRESHOLD_PCT = 60;

export type CapabilityBaselineInput = {
  clientName: string;
  brandHex: string | null;
  preparedBy?: string | null;
  engagementCode?: string | null;
  contactLine?: string | null;
  metrics: CapabilityMaturityMetrics;
};

export type CapabilityBaselineResult = {
  buffer: Buffer;
  templateVersion: string;
  llmSource: "deterministic";
};

/**
 * Capability Maturity Baseline Report — coverage-fork deliverable.
 *
 * Generated when assessment coverage is below 60%. Refuses to fake
 * an investment thesis on sparse data; instead names the highest-
 * leverage capabilities to assess first, surfaces workspace risk
 * signals, and gives a 30-day plan to unlock the full Capability
 * Maturity Assessment.
 *
 * Mirrors buildPortfolioSnapshotReport.ts in shape and discipline.
 * Pure deterministic — no LLM calls, no fact-grounding risk. Charts
 * reuse buildImportanceMaturityMatrix from the full builder.
 */
export async function buildCapabilityMaturityBaselineReport(
  input: CapabilityBaselineInput
): Promise<CapabilityBaselineResult> {
  const brandHex = normalizeHex(input.brandHex);
  const m = input.metrics;
  const today = new Date().toISOString().slice(0, 10);
  const clamp = (h: string) => clampForContrast({ hex: h, bg: "#FFFFFF" });

  const coveragePct = Math.round(m.assessmentCoverageRatio * 100);
  const unassessedCount = m.bands.notAssessed.length;
  const criticalCount = m.byStrategicImportance.CRITICAL ?? 0;
  const ownerlessCount =
    m.workspaceSpecificRisks.capabilitiesWithoutOwners.count;
  const totalGapLevels = m.bands.liftToTarget.reduce(
    (s, c) => s + (c.gapLevels ?? 0),
    0
  );

  const children: (Paragraph | Table)[] = [];

  // Cover
  children.push(
    ...renderCoverPage({
      documentTitle: "Capability Maturity Baseline Report",
      clientName: input.clientName,
      brandHex,
      templateVersionLabel: CAPABILITY_BASELINE_TEMPLATE_LABEL,
      preparedBy: input.preparedBy ?? null,
      logoBytes: null,
      logoMimeType: null,
      engagementCode: input.engagementCode ?? null,
      contactLine: input.contactLine ?? null,
      confidentialityLabel: `Strictly Confidential — Prepared for ${input.clientName}`,
    })
  );

  // Inside-cover disclaimer
  children.push(
    ...renderInsideCoverDisclaimer({
      clientName: input.clientName,
      date: today,
      brandHex,
    })
  );

  // Static TOC
  children.push(
    ...buildStaticTOC({
      brandHex,
      entries: [
        { title: "1. Where the portfolio stands", pageNumber: 4, indent: 0 },
        { title: "Capability Portfolio at a Glance", pageNumber: 4, indent: 1 },
        { title: "Coverage gate", pageNumber: 5, indent: 1 },
        { title: "Importance × Maturity (assessed subset)", pageNumber: 6, indent: 1 },
        { title: "2. Top capabilities to assess first", pageNumber: 7, indent: 0 },
        { title: "3. Workspace-specific risks", pageNumber: 8, indent: 0 },
        { title: "4. 30-day work plan", pageNumber: 9, indent: 0 },
        { title: "5. Methodology & glossary", pageNumber: 10, indent: 0 },
      ],
    })
  );

  // ═══ 1. Where the portfolio stands ═════════════════════════
  children.push(
    ...renderSectionDivider({
      number: "1",
      title: "Where the portfolio stands",
      subtitle:
        "The honest picture before any disposition or investment thesis: what's assessed, what isn't, and what that means for the case ahead.",
      brandHex,
    })
  );

  const topL1Name =
    m.workspaceSpecificRisks.topUnassessedL1?.l1Name ??
    m.l1Rollups[0]?.l1Name ??
    "—";
  const topL1Share = Math.round(
    (m.workspaceSpecificRisks.topUnassessedL1?.share ?? 0) * 100
  );

  // Portfolio at a Glance — KPI hero row
  children.push(
    buildHeading(
      "Capability Portfolio at a Glance",
      HeadingLevel.HEADING_1,
      brandHex,
      { spacingBefore: 0 }
    )
  );
  children.push(
    buildActionTitle(
      `${m.totalCapabilities} capabilities in the portfolio; assessment coverage on ${coveragePct}% — below the ${COVERAGE_THRESHOLD_PCT}% threshold required for an investment-thesis-grade plan. This report ranks where to focus the next assessment cycle.`,
      brandHex
    )
  );
  children.push(
    buildKpiRow({
      brandHex,
      tiles: [
        { value: String(m.totalCapabilities), label: "Total capabilities" },
        { value: `${coveragePct}%`, label: "Assessment coverage" },
        { value: String(unassessedCount), label: "Capabilities not assessed" },
        { value: String(criticalCount), label: "CRITICAL importance" },
        { value: String(ownerlessCount), label: "Without an owner" },
        { value: String(totalGapLevels), label: "Gap levels (assessed)" },
      ],
    })
  );

  // Coverage callout
  children.push(
    buildCallout({
      title: "Coverage gate",
      tone: "warn",
      brandHex,
      bullets: [
        `Assessment coverage is ${coveragePct}%; the full Capability Maturity Assessment unlocks at ${COVERAGE_THRESHOLD_PCT}%.`,
        `Until coverage clears the threshold, this report deliberately stops short of asserting strategic importance, target maturity, or wave-sequencing decisions on capabilities without data.`,
        `The Top capabilities to assess first table below ranks the next assessment cycle to clear the threshold with the least effort.`,
      ],
    })
  );

  // Importance × Maturity (assessed subset) — chart with deterministic prose
  children.push(
    buildHeading(
      "Importance × Maturity (assessed subset)",
      HeadingLevel.HEADING_1,
      brandHex
    )
  );
  children.push(
    buildActionTitle(
      `Among the ${m.totalCapabilities - unassessedCount} capabilities with at least one maturity rating on file, the densest cells point to where the unmet investment case is forming.`,
      brandHex
    )
  );
  const matrixChart = await buildImportanceMaturityMatrix({
    cells: m.importanceMaturityMatrix,
    brandHex,
  }).catch(() => null);
  if (matrixChart) children.push(matrixChart);
  children.push(
    new Paragraph({
      spacing: { before: 160, after: 160, line: 320 },
      children: [
        new TextRun({
          text:
            "The matrix populates only where data exists. Empty cells are not zero counts — they are unknowns. Closing the assessment gap shifts capabilities into the matrix, which is why coverage is the prerequisite, not an afterthought.",
          italics: true,
          color: "4B5563",
          size: T.body,
        }),
      ],
    })
  );

  // ═══ 2. Top capabilities to assess first ═══════════════════
  children.push(
    ...renderSectionDivider({
      number: "2",
      title: "Top capabilities to assess first",
      subtitle:
        "Ranked by importance × current data signal × linked-application count; assessing these first gives the steepest coverage gain per workshop hour.",
      brandHex,
    })
  );

  // Top-10 to assess: prefer notAssessed band sorted by appCount + importance,
  // fall back to topGapsByImpact when notAssessed is empty (rare).
  const importanceWeight: Record<string, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
    NOT_ASSESSED: 0,
  };
  const candidates = m.bands.notAssessed.length > 0
    ? m.bands.notAssessed
        .slice()
        .sort((a, b) => {
          const wa =
            (importanceWeight[a.strategicImportance] ?? 0) *
              (1 + Math.log(1 + a.appsMappedCount));
          const wb =
            (importanceWeight[b.strategicImportance] ?? 0) *
              (1 + Math.log(1 + b.appsMappedCount));
          return wb - wa;
        })
    : m.topGapsByImpact;

  const top10 = candidates.slice(0, 10);

  if (top10.length > 0) {
    children.push(
      buildHeading(
        `Top ${top10.length} capabilities to assess first`,
        HeadingLevel.HEADING_1,
        brandHex
      )
    );
    children.push(
      buildTable({
        headers: ["Capability", "L1 domain", "Importance", "Current", "Apps mapped", "Reason"],
        rows: top10.map((c) => [
          c.name,
          c.l1Name,
          c.strategicImportance.replace(/_/g, " "),
          c.currentMaturity.replace(/_/g, " "),
          String(c.appsMappedCount),
          reasonFor(c),
        ]),
        brandHex,
      })
    );
  } else {
    children.push(
      new Paragraph({
        spacing: { after: 160 },
        children: [
          new TextRun({
            text:
              "No assessment candidates surface from the current dataset. Add capabilities to the workspace before generating the Baseline Report.",
            italics: true,
            color: "4B5563",
            size: T.body,
          }),
        ],
      })
    );
  }

  // ═══ 3. Workspace-specific risks ═══════════════════════════
  children.push(
    ...renderSectionDivider({
      number: "3",
      title: "Workspace-specific risks",
      subtitle:
        "Signals already visible in the partial data — they don't require coverage to clear before action.",
      brandHex,
    })
  );

  const riskRows: string[][] = [];
  const r = m.workspaceSpecificRisks;
  if (r.topUnassessedL1) {
    riskRows.push([
      `Assessment gap concentrates in ${r.topUnassessedL1.l1Name} (${Math.round(r.topUnassessedL1.share * 100)}% unassessed)`,
      "H",
      "M",
      `Sequence the assessment workshop on the ${r.topUnassessedL1.l1Name} cluster first; the concentration means one workshop closes the largest single gap.`,
    ]);
  }
  if (r.criticalAtInitialOrDeveloping.count > 0) {
    riskRows.push([
      `${r.criticalAtInitialOrDeveloping.count} CRITICAL capabilities sit at INITIAL or DEVELOPING maturity`,
      "H",
      "H",
      `Assess target maturity for these capabilities within 30 days; the lift case for the FY budget anchors here.`,
    ]);
  }
  if (r.capabilitiesWithoutOwners.count > 0) {
    riskRows.push([
      `${r.capabilitiesWithoutOwners.count} capabilities have no business or IT owner on file`,
      "M",
      "M",
      `Assign ownership before the next assessment cycle; ownerless capabilities slip the schedule and blunt accountability.`,
    ]);
  }
  // Canonical baseline risks (always render — apply at any coverage)
  riskRows.push([
    "Below-threshold coverage blocks the full Capability Maturity Assessment",
    "H",
    "H",
    `Clear the ${COVERAGE_THRESHOLD_PCT}% coverage threshold; the full deliverable's investment thesis cannot be framed against partial data without inventing dispositions.`,
  ]);
  riskRows.push([
    "Cross-deliverable bridge to Application Rationalization is partial",
    "M",
    "M",
    "When linked-application TIME dispositions are populated, the maturity deliverable's deep dives surface them; close coverage to activate the bridge.",
  ]);

  children.push(
    buildHeading(
      "Risks visible in partial data",
      HeadingLevel.HEADING_1,
      brandHex
    )
  );
  children.push(
    buildTable({
      headers: ["Risk", "Likelihood", "Impact", "Mitigation"],
      rows: riskRows,
      brandHex,
    })
  );

  // ═══ 4. 30-day work plan ═══════════════════════════════════
  children.push(
    ...renderSectionDivider({
      number: "4",
      title: "30-day work plan",
      subtitle:
        "How to clear the coverage threshold and unlock the full Capability Maturity Assessment.",
      brandHex,
    })
  );

  const planSteps: Array<[string, string]> = [
    [
      "Week 1: confirm ownership",
      `Name a business owner and IT owner for each capability. ${ownerlessCount} capabilit${ownerlessCount === 1 ? "y is" : "ies are"} ownerless today.`,
    ],
    [
      "Week 2: assessment workshop on the largest cluster",
      `Run a 60-minute workshop with the ${topL1Name} domain owners; rate currentMaturity and targetMaturity for every capability in the cluster. ${topL1Share > 0 ? `The cluster carries ${topL1Share}% of the unassessed share.` : ""}`,
    ],
    [
      "Week 3: assess remaining CRITICAL/HIGH capabilities",
      `Apply the same protocol to the ${criticalCount} CRITICAL capabilit${criticalCount === 1 ? "y" : "ies"} not yet rated, then HIGH-importance gaps surfaced by the Top capabilities to assess first table.`,
    ],
    [
      "Week 4: regenerate the deliverable",
      `When coverage clears ${COVERAGE_THRESHOLD_PCT}%, regenerate from the deliverables console; the full Capability Maturity Assessment runs with the four-call LLM orchestration and named-target deep dives.`,
    ],
  ];
  for (const [title, body] of planSteps) {
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 80 },
        children: [
          new TextRun({
            text: title,
            bold: true,
            color: clamp(brandHex),
            size: T.body,
          }),
        ],
      })
    );
    children.push(
      new Paragraph({
        spacing: { after: 160, line: 320 },
        children: [new TextRun({ text: body, size: T.body })],
      })
    );
  }

  // ═══ 5. Methodology & glossary ═════════════════════════════
  children.push(
    ...renderSectionDivider({
      number: "5",
      title: "Methodology & glossary",
      subtitle:
        "Source fields, ranking heuristic, scope boundaries, and a glossary of the terms the report uses.",
      brandHex,
    })
  );
  children.push(
    buildHeading("Methodology", HeadingLevel.HEADING_1, brandHex)
  );
  children.push(
    new Paragraph({
      spacing: { after: 160, line: 320 },
      children: [
        new TextRun({
          text: `Generated on ${today} from the live capability portfolio in the EAM platform. Counts reflect values stored on each BusinessCapability record at generation; the source fields are *currentMaturity*, *targetMaturity*, *strategicImportance*, *businessOwnerId*, *itOwnerId*, and the application-capability mapping table.`,
          size: T.body,
        }),
      ],
    })
  );
  children.push(
    buildCallout({
      title: "What this report is not",
      tone: "info",
      brandHex,
      bullets: [
        "Not an investment-cost case. The deliverable's currency is gap-levels and sequencing; per-capability investment cost is not modeled.",
        "Not a disposition recommendation. Capability dispositions are surfaced by the Application Rationalization Plan, not the Maturity Baseline.",
        `Not a substitute for the full assessment. When coverage clears ${COVERAGE_THRESHOLD_PCT}%, regenerate from the deliverables console.`,
      ],
    })
  );

  children.push(
    buildHeading("Glossary", HeadingLevel.HEADING_1, brandHex)
  );
  children.push(
    buildTable({
      headers: ["Term", "Definition"],
      rows: [
        [
          "Maturity scale",
          "INITIAL → DEVELOPING → DEFINED → MANAGED → OPTIMIZING. NOT_ASSESSED indicates no data on file.",
        ],
        [
          "Strategic importance",
          "CRITICAL > HIGH > MEDIUM > LOW. NOT_ASSESSED indicates no data on file.",
        ],
        [
          "Coverage threshold",
          `${COVERAGE_THRESHOLD_PCT}% of capabilities with assessment data on BOTH currentMaturity AND targetMaturity. Below threshold the full assessment is withheld.`,
        ],
        [
          "Gap levels",
          "Numeric difference between target and current maturity (1-5 scale). Sum across CRITICAL/HIGH capabilities is the cumulative lift case.",
        ],
        [
          "L1 domain",
          "Top-level capability grouping in the workspace's capability hierarchy.",
        ],
      ],
      brandHex,
    })
  );

  // ─── Build doc ────────────────────────────────────────────
  const doc = new Document({
    creator: input.clientName,
    title: `${input.clientName} — Capability Maturity Baseline Report`,
    description: CAPABILITY_BASELINE_TEMPLATE_LABEL,
    sections: [
      {
        properties: {},
        children: children as never,
        footers: {
          default: makeFooter(
            input.clientName,
            CAPABILITY_BASELINE_PROJECT_LABEL
          ),
        },
      },
    ],
    styles: {
      default: { document: { run: { size: T.body, font: "Calibri" } } },
    },
  });

  const buffer = await Packer.toBuffer(doc);
  return {
    buffer: Buffer.from(buffer),
    templateVersion: CAPABILITY_BASELINE_TEMPLATE_VERSION,
    llmSource: "deterministic",
  };
}

function reasonFor(c: {
  strategicImportance: string;
  currentMaturity: string;
  targetMaturity: string;
  appsMappedCount: number;
}): string {
  if (
    c.currentMaturity === "NOT_ASSESSED" &&
    c.targetMaturity === "NOT_ASSESSED"
  ) {
    return c.strategicImportance === "CRITICAL"
      ? "CRITICAL importance with no maturity data — assessment cycle starts here."
      : c.appsMappedCount > 0
      ? `${c.appsMappedCount} application${c.appsMappedCount === 1 ? "" : "s"} mapped — execution-stack signal already present.`
      : "Unassessed capability — assess to surface gap or confirm sustain.";
  }
  if (c.currentMaturity === "NOT_ASSESSED") {
    return "Target on file but current not assessed — close the gap to surface lift size.";
  }
  if (c.targetMaturity === "NOT_ASSESSED") {
    return "Current on file but no target — assess target to enable wave sequencing.";
  }
  return `${c.strategicImportance} importance, current ${c.currentMaturity}, target ${c.targetMaturity}.`;
}
