import "server-only";
import { Document, Packer, Paragraph, HeadingLevel } from "docx";
import {
  actionTitle,
  brandedHeading,
  buildCallout,
  buildTable,
  formatCurrency,
  makeFooter,
  normalizeHex,
  renderCoverPage,
  renderInline,
} from "./_helpers";
import type { RationalizationMetrics } from "./buildRationalizationDocx";

export const PORTFOLIO_SNAPSHOT_TEMPLATE_VERSION = "1.0";
export const PORTFOLIO_SNAPSHOT_TEMPLATE_LABEL = `EAM Portfolio Snapshot v${PORTFOLIO_SNAPSHOT_TEMPLATE_VERSION}`;
export const PORTFOLIO_SNAPSHOT_PROJECT_LABEL = "Portfolio Snapshot Report";
const COVERAGE_THRESHOLD_PCT = 60;

export type PortfolioSnapshotInput = {
  clientName: string;
  brandHex: string | null;
  preparedBy?: string | null;
  metrics: RationalizationMetrics;
};

export type PortfolioSnapshotResult = {
  buffer: Buffer;
  templateVersion: string;
  llmSource: "deterministic"; // no LLM in the snapshot path
};

/**
 * Smaller, honest doc generated when classification coverage is
 * below 60%. Delivers value without inventing dispositions:
 * lifecycle + cost + vendor overview, plus a ranked work-list of
 * which apps to classify first.
 *
 * Per the MBB-IA reference: refusing to ship is wrong; auto-
 * classifying is wrong; producing a different artifact that's
 * honest about portfolio state is right.
 */
export async function buildPortfolioSnapshotReport(
  input: PortfolioSnapshotInput
): Promise<PortfolioSnapshotResult> {
  const brandHex = normalizeHex(input.brandHex);
  const m = input.metrics;
  const cur = m.costCurrency;
  const fmt = (n: number) => formatCurrency(n, cur);
  const coveragePct = Math.round(m.coverageRatio * 100);

  const children: (
    | Paragraph
    | ReturnType<typeof buildTable>
    | ReturnType<typeof buildCallout>
  )[] = [];

  // 1. Cover
  children.push(
    ...renderCoverPage({
      documentTitle: "Portfolio Snapshot Report",
      clientName: input.clientName,
      brandHex,
      templateVersionLabel: PORTFOLIO_SNAPSHOT_TEMPLATE_LABEL,
      preparedBy: input.preparedBy ?? null,
      logoBytes: null,
      logoMimeType: null,
    })
  );

  // 2. Executive Summary
  children.push(
    brandedHeading("Executive Summary", HeadingLevel.HEADING_1, brandHex, {
      spacingBefore: 0,
    })
  );
  children.push(
    actionTitle(
      `The ${input.clientName} portfolio comprises ${m.totalApps} active applications carrying ${fmt(m.totalAnnualCostUsd)} in annual run-cost; ${coveragePct}% disposition coverage gates the full Application Rationalization Plan.`,
      brandHex
    )
  );
  children.push(
    new Paragraph({
      spacing: { after: 160 },
      children: renderInline(
        `This snapshot reports the current state of the portfolio without inventing TIME dispositions. ${m.totalApps - m.classifiedApps} of ${m.totalApps} applications carry no rationalization status, leaving their disposition decisions open. The Recommended Next Steps section below ranks the highest-leverage applications to classify first.`
      ),
    })
  );

  // 3. Coverage gate callout
  children.push(
    buildCallout({
      title: `Coverage gate — ${coveragePct}% of ${m.totalApps} apps classified`,
      bullets: [
        `Disposition coverage is ${coveragePct}% (${m.classifiedApps} of ${m.totalApps} active applications).`,
        `At ≥${COVERAGE_THRESHOLD_PCT}% coverage, the full Application Rationalization Plan replaces this snapshot — with TIME bucket narratives, redundancy mapping, decommission roadmap, and projected savings.`,
        `Classifications are set on each Application record under /applications.`,
      ],
      brandHex,
    })
  );

  // 4. Cost Overview
  children.push(brandedHeading("Cost Overview", HeadingLevel.HEADING_1, brandHex));
  children.push(
    actionTitle(
      `Total annual run-cost is ${fmt(m.totalAnnualCostUsd)} across ${m.totalApps} applications; the top 10 carry ${pctOf(m.topAppsByCost.reduce((s, a) => s + a.annualCostUsd, 0), m.totalAnnualCostUsd)}% of the spend.`,
      brandHex
    )
  );
  if (m.topAppsByCost.length === 0) {
    children.push(
      buildCallout({
        title: "No cost data set",
        bullets: [
          "No applications carry an annualCostUsd value. Set costs on each Application to surface where money is going.",
        ],
        brandHex,
      })
    );
  } else {
    children.push(
      buildTable({
        headers: ["Application", "Vendor", "Annual cost", "% of total", "Lifecycle"],
        rows: m.topAppsByCost.map((a) => [
          a.name,
          a.vendor ?? "—",
          fmt(a.annualCostUsd),
          `${pctOf(a.annualCostUsd, m.totalAnnualCostUsd)}%`,
          a.lifecycle.replace(/_/g, " "),
        ]),
        brandHex,
        columnWidthsPct: [32, 22, 18, 12, 16],
      })
    );
  }

  // 5. Lifecycle Distribution
  children.push(
    brandedHeading("Lifecycle Distribution", HeadingLevel.HEADING_1, brandHex)
  );
  const lifecycleEntries = Object.entries(m.lifecycleDistribution).sort(
    (a, b) => b[1].annualCostUsd - a[1].annualCostUsd
  );
  if (lifecycleEntries.length === 0) {
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: renderInline("*No lifecycle data on the portfolio.*"),
      })
    );
  } else {
    const phasingOut = m.lifecycleDistribution.PHASING_OUT?.count ?? 0;
    const retired = m.lifecycleDistribution.RETIRED?.count ?? 0;
    const sunsetCount = phasingOut + retired;
    children.push(
      actionTitle(
        sunsetCount > 0
          ? `${sunsetCount} application${sunsetCount === 1 ? "" : "s"} are PHASING_OUT or RETIRED — these need disposition decisions before any further analysis.`
          : `Every application sits in ACTIVE or PLANNED lifecycle; no immediate retirement queue.`,
        brandHex
      )
    );
    children.push(
      buildTable({
        headers: ["Lifecycle", "Count", "Annual cost"],
        rows: lifecycleEntries.map(([key, v]) => [
          key.replace(/_/g, " "),
          String(v.count),
          fmt(v.annualCostUsd),
        ]),
        brandHex,
        columnWidthsPct: [40, 20, 40],
      })
    );
  }

  // 6. Vendor Concentration
  children.push(
    brandedHeading("Vendor Concentration", HeadingLevel.HEADING_1, brandHex)
  );
  if (m.vendorConcentration.length === 0) {
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: renderInline("*No vendor data on the portfolio.*"),
      })
    );
  } else {
    const topVendor = m.vendorConcentration[0]!;
    children.push(
      actionTitle(
        `${topVendor.vendor} carries ${pctOf(topVendor.annualCostUsd, m.totalAnnualCostUsd)}% of annual run-cost across ${topVendor.count} application${topVendor.count === 1 ? "" : "s"}; concentration risk warrants explicit review.`,
        brandHex
      )
    );
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
      })
    );
  }

  // 7. Recommended Next Steps — the high-leverage section
  children.push(
    brandedHeading(
      "Recommended Next Steps",
      HeadingLevel.HEADING_1,
      brandHex
    )
  );
  if (m.classifyFirst.length === 0) {
    children.push(
      buildCallout({
        title: "Portfolio is ready for the full plan",
        bullets: [
          "Every active application carries a TIME disposition. Re-run the deliverable to receive the full Application Rationalization Plan.",
        ],
        brandHex,
      })
    );
  } else {
    children.push(
      actionTitle(
        `Classifying the top ${m.classifyFirst.length} application${m.classifyFirst.length === 1 ? "" : "s"} below — sequenced by retirement urgency and cost — closes the largest gap in disposition coverage.`,
        brandHex
      )
    );
    children.push(
      new Paragraph({
        spacing: { after: 160 },
        children: renderInline(
          "Each row identifies an application that should carry a TIME disposition before the full rationalization analysis can run. The reason column states why this row matters."
        ),
      })
    );
    children.push(
      buildTable({
        headers: [
          "#",
          "Application",
          "Vendor",
          "Annual cost",
          "Reason",
        ],
        rows: m.classifyFirst.map((a, i) => [
          String(i + 1),
          a.name,
          a.vendor ?? "—",
          fmt(a.annualCostUsd),
          a.reason,
        ]),
        brandHex,
        columnWidthsPct: [5, 25, 18, 16, 36],
      })
    );
  }

  // 8. Methodology
  children.push(
    brandedHeading(
      "Methodology and Data Sources",
      HeadingLevel.HEADING_1,
      brandHex
    )
  );
  children.push(
    new Paragraph({
      spacing: { after: 120 },
      children: renderInline(
        `This snapshot was generated from the live application portfolio in the EAM platform. Counts and costs reflect values stored on each Application record; the source fields are *lifecycle*, *vendor*, *annualCostUsd*, *rationalizationStatus*, and the application-capability mapping table. The Recommended Next Steps ranking combines lifecycle urgency (PHASING_OUT first), annual cost magnitude, and capability-mapping gaps. No TIME dispositions were inferred — applications without a *rationalizationStatus* are reported as unclassified.`
      ),
    })
  );

  const doc = new Document({
    creator: input.clientName,
    title: `${input.clientName} — Portfolio Snapshot Report`,
    description: PORTFOLIO_SNAPSHOT_TEMPLATE_LABEL,
    sections: [
      {
        properties: {},
        children: children as never,
        footers: {
          default: makeFooter(input.clientName, PORTFOLIO_SNAPSHOT_PROJECT_LABEL),
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
    templateVersion: PORTFOLIO_SNAPSHOT_TEMPLATE_VERSION,
    llmSource: "deterministic",
  };
}

function pctOf(part: number, whole: number): string {
  if (whole <= 0) return "0";
  return ((part / whole) * 100).toFixed(0);
}
