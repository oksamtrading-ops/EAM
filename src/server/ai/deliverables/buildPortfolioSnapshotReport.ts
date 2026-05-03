import "server-only";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  TextRun,
  AlignmentType,
  BorderStyle,
  WidthType,
} from "docx";
import {
  actionTitle,
  brandedHeading,
  buildCallout,
  buildKpiRow,
  buildStatusPillCell,
  buildTable,
  formatCurrency,
  lifecycleToTone,
  makeFooter,
  normalizeHex,
  renderCoverPage,
  renderInline,
} from "./_helpers";
import { T } from "./tokens";
import type { RationalizationMetrics } from "./buildRationalizationDocx";

export const PORTFOLIO_SNAPSHOT_TEMPLATE_VERSION = "2.0";
export const PORTFOLIO_SNAPSHOT_TEMPLATE_LABEL = `EAM Portfolio Snapshot v${PORTFOLIO_SNAPSHOT_TEMPLATE_VERSION}`;
export const PORTFOLIO_SNAPSHOT_PROJECT_LABEL = "Portfolio Snapshot Report";
const COVERAGE_THRESHOLD_PCT = 60;

export type PortfolioSnapshotInput = {
  clientName: string;
  brandHex: string | null;
  preparedBy?: string | null;
  /** Optional engagement metadata for the cover engagement-bar. */
  engagementCode?: string | null;
  contactLine?: string | null;
  metrics: RationalizationMetrics;
};

export type PortfolioSnapshotResult = {
  buffer: Buffer;
  templateVersion: string;
  llmSource: "deterministic"; // no LLM in the snapshot path
};

/**
 * Portfolio Snapshot Report v2.0 — boutique-tier deliverable.
 *
 * Generated when classification coverage is below 60%. Delivers
 * value without inventing dispositions: KPI row, prescriptive
 * exec summary, cost / lifecycle / vendor & sourcing analysis,
 * capability coverage gap, ranked classify-first work-list, and
 * a small Risks & Watchouts table. All deterministic — no LLM.
 *
 * Per the MBB-IA reference: refusing to ship is wrong;
 * auto-classifying is wrong; producing a different artifact
 * that's honest about portfolio state is right.
 */
export async function buildPortfolioSnapshotReport(
  input: PortfolioSnapshotInput
): Promise<PortfolioSnapshotResult> {
  const brandHex = normalizeHex(input.brandHex);
  const m = input.metrics;
  const cur = m.costCurrency;
  const fmt = (n: number) => formatCurrency(n, cur);
  const fmtCompact = (n: number) => formatCompactCurrency(n, cur);
  const coveragePct = Math.round(m.coverageRatio * 100);
  const unclassifiedCount = m.totalApps - m.classifiedApps;

  const children: (Paragraph | Table)[] = [];

  // ─── 1. Cover ────────────────────────────────────────────────
  children.push(
    ...renderCoverPage({
      documentTitle: "Portfolio Snapshot Report",
      clientName: input.clientName,
      brandHex,
      templateVersionLabel: PORTFOLIO_SNAPSHOT_TEMPLATE_LABEL,
      preparedBy: input.preparedBy ?? null,
      logoBytes: null,
      logoMimeType: null,
      engagementCode: input.engagementCode ?? null,
      contactLine: input.contactLine ?? null,
      confidentialityLabel: `Strictly Confidential — Prepared for ${input.clientName}`,
    })
  );

  // ─── 2. Portfolio at a Glance — KPI tile row ─────────────────
  children.push(
    brandedHeading("Portfolio at a Glance", HeadingLevel.HEADING_1, brandHex, {
      spacingBefore: 0,
    })
  );
  children.push(
    buildKpiRow({
      tiles: [
        {
          value: String(m.totalApps),
          label: "Active applications",
        },
        {
          value: fmtCompact(m.totalAnnualCostUsd),
          label: "Annual run-cost",
        },
        {
          value: `${Math.round(m.phasingOut.shareOfTotal * 100)}%`,
          label: "Run-cost phasing out",
        },
        {
          value: `${coveragePct}%`,
          label: "Disposition coverage",
        },
        {
          value: `${Math.round(m.vendorTopShare * 100)}%`,
          label: "Top vendor share",
        },
        {
          value: fmtCompact(m.sourcing.inHouse.annualCostUsd),
          label: "In-house spend",
        },
      ],
      brandHex,
    })
  );
  children.push(spacer());

  // ─── 3. Executive Summary — Pyramid Principle ────────────────
  children.push(
    brandedHeading("Executive Summary", HeadingLevel.HEADING_1, brandHex)
  );
  // Lead with the finding, not the meta description.
  const phasingOutShare = Math.round(m.phasingOut.shareOfTotal * 100);
  const phasingOutCount = m.phasingOut.count;
  children.push(
    new Paragraph({
      spacing: { after: 160 },
      children: renderInline(
        phasingOutCount > 0
          ? `**The ${input.clientName} application portfolio carries ${fmt(m.totalAnnualCostUsd)} in annual run-cost across ${m.totalApps} active applications, of which ${fmt(m.phasingOut.annualCostUsd)} (${phasingOutShare}%) sits in PHASING_OUT or RETIRED status with no documented replacement plan and no TIME disposition on file.**`
          : `**The ${input.clientName} portfolio carries ${fmt(m.totalAnnualCostUsd)} in annual run-cost across ${m.totalApps} active applications. ${unclassifiedCount} of the ${m.totalApps} applications carry no TIME disposition; classifying them unlocks the redundancy, savings, and roadmap analyses that the full rationalization plan delivers.**`
      ),
    })
  );

  // Three signals
  children.push(
    new Paragraph({
      spacing: { after: 80 },
      children: renderInline("Three signals frame the conversation:"),
    })
  );
  const signals: string[] = [];
  if (m.vendorTopShare > 0) {
    const vendorShare = Math.round(m.vendorTopShare * 100);
    const multiVendor = m.multiProductVendors[0];
    if (multiVendor) {
      signals.push(
        `**Vendor concentration.** ${m.vendorTopName} accounts for ${fmt((m.vendorConcentration[0]?.annualCostUsd) ?? 0)} (${vendorShare}%) of run-cost; ${multiVendor.vendor} appears across ${multiVendor.count} application contexts (${fmt(multiVendor.annualCostUsd)}), creating single-vendor commercial-event exposure on the operations stack.`
      );
    } else {
      signals.push(
        `**Vendor concentration.** ${m.vendorTopName} accounts for ${fmt((m.vendorConcentration[0]?.annualCostUsd) ?? 0)} (${vendorShare}%) of run-cost — a single commercial event materially impacts the portfolio.`
      );
    }
  }
  if (m.sourcing.inHouse.annualCostUsd > 0) {
    signals.push(
      `**In-house exposure.** ${fmt(m.sourcing.inHouse.annualCostUsd)} (${Math.round(m.sourcing.inHouseShare * 100)}%) of annual spend sits in ${m.sourcing.inHouse.count} in-house-built system${m.sourcing.inHouse.count === 1 ? "" : "s"}; without per-capability allocation this spend is invisible to vendor-driven optimization levers.`
    );
  }
  signals.push(
    coveragePct === 0
      ? `**Classification gap.** None of the ${m.totalApps} applications carry a TIME disposition, blocking the redundancy, savings, and roadmap analyses that the full rationalization plan delivers.`
      : `**Classification gap.** ${unclassifiedCount} of ${m.totalApps} applications carry no TIME disposition (${coveragePct}% coverage); the full plan unlocks at ≥${COVERAGE_THRESHOLD_PCT}%.`
  );
  for (const signal of signals) {
    children.push(
      new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 60 },
        children: renderInline(signal),
      })
    );
  }
  // Imperative closing.
  children.push(
    new Paragraph({
      spacing: { before: 160, after: 160 },
      children: renderInline(
        phasingOutCount > 0
          ? `**Decide the disposition of the ${phasingOutCount} PHASING_OUT application${phasingOutCount === 1 ? "" : "s"} (${fmt(m.phasingOut.annualCostUsd)}) before any further architecture investment.** The Recommended Next Steps section ranks the highest-leverage classifications to enable that decision.`
          : `**Classify the highest-cost active applications first to unlock the full rationalization plan.** Recommended Next Steps below sequences the work.`
      ),
    })
  );

  // ─── 4. Coverage gate callout ────────────────────────────────
  children.push(
    buildCallout({
      title: `Coverage gate — ${coveragePct}% of ${m.totalApps} apps classified`,
      tone: "info",
      bullets: [
        `Disposition coverage is ${coveragePct}% (${m.classifiedApps} of ${m.totalApps} active applications).`,
        `At ≥${COVERAGE_THRESHOLD_PCT}% coverage, the full Application Rationalization Plan replaces this snapshot — with TIME bucket narratives, redundancy mapping, decommission roadmap, and projected savings.`,
        `Classifications are set on each Application record under /applications.`,
      ],
      brandHex,
    })
  );
  children.push(spacer());

  // ─── 5. Cost Overview ────────────────────────────────────────
  children.push(brandedHeading("Cost Overview", HeadingLevel.HEADING_1, brandHex));
  const top10Share = Math.round(m.topNConcentration.top10Share * 100);
  const phasingInTop10 = m.topAppsByCost.filter(
    (a) => a.lifecycle === "PHASING_OUT" || a.lifecycle === "RETIRED"
  );
  const phasingInTop10Cost = phasingInTop10.reduce(
    (s, a) => s + a.annualCostUsd,
    0
  );
  if (m.topAppsByCost.length === 0) {
    children.push(
      buildCallout({
        title: "No cost data set",
        tone: "warn",
        bullets: [
          "No applications carry an annualCostUsd value. Set costs on each Application to surface where money is going.",
        ],
        brandHex,
      })
    );
  } else {
    children.push(
      actionTitle(
        phasingInTop10.length >= 1
          ? `The top 10 applications carry ${fmt(m.topAppsByCost.reduce((s, a) => s + a.annualCostUsd, 0))} (${top10Share}%) of annual run-cost; ${phasingInTop10.length} of them are PHASING_OUT or RETIRED, concentrating ${fmt(phasingInTop10Cost)} on a sunset path with no end date set.`
          : `The top 10 applications carry ${fmt(m.topAppsByCost.reduce((s, a) => s + a.annualCostUsd, 0))} (${top10Share}%) of annual run-cost; spend optimization on this decile alone touches the majority of the portfolio.`,
        brandHex
      )
    );
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
        numericColumns: [2, 3],
        barColumns: [
          {
            index: 3,
            valueOf: (row) => parseInt(row[3]!, 10) / 100,
          },
        ],
      })
    );
  }

  // ─── 6. Lifecycle Distribution ───────────────────────────────
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
    if (m.phasingOut.count > 0) {
      const quarterlySlip = m.phasingOut.annualCostUsd / 4;
      children.push(
        actionTitle(
          `${m.phasingOut.count} PHASING_OUT or RETIRED application${m.phasingOut.count === 1 ? "" : "s"} carry ${fmt(m.phasingOut.annualCostUsd)} in run-cost (${phasingOutShare}% of total). A single-quarter slip on the retirement calendar leaks ${fmt(quarterlySlip)} into the next fiscal year.`,
          brandHex
        )
      );
    } else {
      children.push(
        actionTitle(
          `Every application sits in ACTIVE or PLANNED lifecycle; no immediate retirement queue. The portfolio's optimization lever is consolidation, not retirement.`,
          brandHex
        )
      );
    }

    // Lifecycle table with status pills + cost share bar.
    children.push(
      buildLifecycleTable({
        entries: lifecycleEntries,
        totalAnnualCostUsd: m.totalAnnualCostUsd,
        brandHex,
        fmt,
      })
    );
  }

  // ─── 7. Vendor & Sourcing Analysis ───────────────────────────
  children.push(
    brandedHeading(
      "Vendor & Sourcing Analysis",
      HeadingLevel.HEADING_1,
      brandHex
    )
  );

  // 7a. Multi-product vendor exposure
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
      actionTitle(
        `${fmt(multiCost)} of run-cost concentrates in ${m.multiProductVendors.length} multi-product vendor${m.multiProductVendors.length === 1 ? "" : "s"} (${multiNames}); a single commercial event with any one of them materially impacts multiple capability areas at once.`,
        brandHex
      )
    );
    children.push(
      buildTable({
        headers: ["Vendor", "Apps", "Annual cost", "% of total", "Capabilities touched"],
        rows: m.multiProductVendors.map((v) => [
          v.vendor,
          String(v.count),
          fmt(v.annualCostUsd),
          `${pctOf(v.annualCostUsd, m.totalAnnualCostUsd)}%`,
          summarizeCapabilities(v.apps),
        ]),
        brandHex,
        columnWidthsPct: [28, 10, 18, 12, 32],
        numericColumns: [1, 2, 3],
        barColumns: [
          {
            index: 3,
            valueOf: (row) => parseInt(row[3]!, 10) / 100,
          },
        ],
      })
    );
    children.push(spacer());
  }

  // 7b. In-house vs third-party split
  if (
    m.sourcing.inHouse.annualCostUsd > 0 ||
    m.sourcing.thirdParty.annualCostUsd > 0
  ) {
    const inHousePct = Math.round(m.sourcing.inHouseShare * 100);
    children.push(
      brandedHeading("Sourcing split", HeadingLevel.HEADING_2, brandHex)
    );
    if (m.sourcing.inHouse.annualCostUsd > 0) {
      children.push(
        actionTitle(
          `${fmt(m.sourcing.inHouse.annualCostUsd)} (${inHousePct}%) of annual spend is in-house-built across ${m.sourcing.inHouse.count} system${m.sourcing.inHouse.count === 1 ? "" : "s"}; without per-capability allocation this spend is invisible to vendor-driven optimization levers.`,
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
          {
            index: 3,
            valueOf: (row) => parseInt(row[3]!, 10) / 100,
          },
        ],
      })
    );
    children.push(spacer());
  }

  // 7c. Top vendor concentration (existing flat list)
  if (m.vendorConcentration.length > 0) {
    children.push(
      brandedHeading("Top vendors by run-cost", HeadingLevel.HEADING_2, brandHex)
    );
    const topVendor = m.vendorConcentration[0]!;
    children.push(
      actionTitle(
        `Single-vendor exposure of ${fmt(topVendor.annualCostUsd)} (${pctOf(topVendor.annualCostUsd, m.totalAnnualCostUsd)}%) on ${topVendor.vendor} requires contract-cliff analysis before any commercial decision is delegated.`,
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
        numericColumns: [1, 2, 3],
        barColumns: [
          {
            index: 3,
            valueOf: (row) => parseInt(row[3]!, 10) / 100,
          },
        ],
      })
    );
  }

  // ─── 8. Capability Coverage Gap (skipped if no orphans) ──────
  if (m.capabilityGap.unmappedAppCount > 0) {
    children.push(
      brandedHeading(
        "Capability Coverage Gap",
        HeadingLevel.HEADING_1,
        brandHex
      )
    );
    children.push(
      actionTitle(
        `${m.capabilityGap.unmappedAppCount} application${m.capabilityGap.unmappedAppCount === 1 ? "" : "s"} carrying ${fmt(m.capabilityGap.unmappedAnnualCostUsd)} in annual run-cost have no capability mapping. Until they're mapped, the redundancy and consolidation analyses that drive savings cannot run.`,
        brandHex
      )
    );
    if (m.capabilityGap.topCostlyOrphans.length > 0) {
      children.push(
        buildTable({
          headers: ["Application", "Vendor", "Annual cost", "Lifecycle"],
          rows: m.capabilityGap.topCostlyOrphans.map((a) => [
            a.name,
            a.vendor ?? "—",
            fmt(a.annualCostUsd),
            a.lifecycle.replace(/_/g, " "),
          ]),
          brandHex,
          columnWidthsPct: [38, 24, 20, 18],
          numericColumns: [2],
        })
      );
    }
  }

  // ─── 9. Recommended Next Steps — bug fixed ───────────────────
  children.push(
    brandedHeading(
      "Recommended Next Steps",
      HeadingLevel.HEADING_1,
      brandHex
    )
  );
  if (m.classifyFirst.length === 0) {
    // Defensive — this branch is unreachable when coverage < 60%.
    // The previous version emitted "ready for full plan" which
    // contradicted the cover-page coverage callout when coverage
    // was 0%. New copy is factually correct in every case.
    children.push(
      actionTitle(
        unclassifiedCount === 0
          ? `Every active application carries a TIME disposition. Re-run as a full Rationalization Plan to unlock the bucket narratives, redundancy mapping, and decommission roadmap.`
          : `Disposition decisions remain outstanding on ${unclassifiedCount} application${unclassifiedCount === 1 ? "" : "s"}. Classify the highest-cost active applications first to unlock the full rationalization plan.`,
        brandHex
      )
    );
  } else {
    children.push(
      actionTitle(
        `Classifying the ${m.classifyFirst.length} application${m.classifyFirst.length === 1 ? "" : "s"} below — sequenced by retirement urgency and cost — closes the largest gap in disposition coverage and unlocks the full plan.`,
        brandHex
      )
    );
    children.push(
      new Paragraph({
        spacing: { after: 160 },
        children: renderInline(
          `**Over the next 30 days,** capability owners and architecture validate the ranked applications below. Each row carries a reason that maps to the input required: lifecycle decision (PHASING_OUT), cost-driver classification (high run-cost), or capability mapping (orphan). The full Application Rationalization Plan unlocks once disposition coverage clears ${COVERAGE_THRESHOLD_PCT}%.`
        ),
      })
    );
    children.push(
      buildTable({
        headers: ["#", "Application", "Vendor", "Annual cost", "Reason"],
        rows: m.classifyFirst.map((a, i) => [
          String(i + 1),
          a.name,
          a.vendor ?? "—",
          fmt(a.annualCostUsd),
          a.reason,
        ]),
        brandHex,
        columnWidthsPct: [5, 25, 18, 16, 36],
        numericColumns: [0, 3],
      })
    );
  }

  // ─── 10. Risks & Watchouts ───────────────────────────────────
  const riskRows: string[][] = [];
  if (m.vendorTopShare > 0) {
    const vendorPct = Math.round(m.vendorTopShare * 100);
    const topVendorCost = m.vendorConcentration[0]?.annualCostUsd ?? 0;
    riskRows.push([
      `${m.vendorTopName} concentration (${vendorPct}%) triggers contract-cliff exposure on ${fmt(topVendorCost)}`,
      "M",
      "H",
      `Map each ${m.vendorTopName} application to its renewal date before any spend optimization`,
    ]);
  }
  if (m.phasingOut.count > 0) {
    riskRows.push([
      `${m.phasingOut.count} PHASING_OUT application${m.phasingOut.count === 1 ? "" : "s"} without disposition decisions become silent run-rate creep`,
      "H",
      "M",
      `Classify within 30 days; sequence the retirement decision by Week 8`,
    ]);
  }
  riskRows.push([
    `${coveragePct}% TIME disposition coverage blocks redundancy and savings analyses`,
    "H",
    "H",
    `Sequence per Recommended Next Steps; minimum ${COVERAGE_THRESHOLD_PCT}% to unlock the full plan`,
  ]);
  if (m.sourcing.inHouse.annualCostUsd > 0) {
    riskRows.push([
      `${fmt(m.sourcing.inHouse.annualCostUsd)} of in-house spend without per-capability allocation hides true TCO`,
      "M",
      "M",
      `Map in-house systems to capabilities before negotiating any vendor swap`,
    ]);
  }
  if (m.capabilityGap.unmappedAppCount > 0) {
    riskRows.push([
      `${m.capabilityGap.unmappedAppCount} unmapped application${m.capabilityGap.unmappedAppCount === 1 ? "" : "s"} (${fmt(m.capabilityGap.unmappedAnnualCostUsd)}) prevent redundancy detection`,
      "M",
      "H",
      `Assign each orphaned application to a capability before the next portfolio review`,
    ]);
  }
  if (riskRows.length > 0) {
    children.push(
      brandedHeading("Risks & Watchouts", HeadingLevel.HEADING_1, brandHex)
    );
    children.push(
      buildCallout({
        title: "Snapshot-tier risks",
        tone: "warn",
        bullets: [
          "Risks below are scoped to what the portfolio data exposes today; the full Application Rationalization Plan adds the canonical seven and workspace-specific risks once disposition coverage clears the threshold.",
        ],
        brandHex,
      })
    );
    children.push(spacer());
    children.push(
      buildTable({
        headers: ["Risk", "Likelihood", "Impact", "Mitigation"],
        rows: riskRows,
        brandHex,
        columnWidthsPct: [40, 12, 12, 36],
        numericColumns: [1, 2],
      })
    );
  }

  // ─── 11. Methodology ─────────────────────────────────────────
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
        `This snapshot was generated from the live application portfolio in the EAM platform. Counts and costs reflect values stored on each Application record; the source fields are *lifecycle*, *vendor*, *annualCostUsd*, *rationalizationStatus*, and the application-capability mapping table. The Recommended Next Steps ranking combines lifecycle urgency (PHASING_OUT first), annual cost magnitude, and capability-mapping gaps. The in-house sourcing classification flags applications whose vendor field is null, empty, or matches an internal-build pattern (in-house, internal, bespoke, custom, self-built); ambiguous vendors stay third-party.`
      ),
    })
  );
  children.push(
    new Paragraph({
      spacing: { after: 120 },
      children: renderInline(
        `**What this snapshot is not.** No TIME dispositions are inferred from the data — every classification recommendation is identified, never assigned. No peer benchmarking is performed. Contract cliff dates, capability-criticality ratings, and integration topology are not analyzed in this snapshot; the full Application Rationalization Plan adds those layers once classification coverage reaches ${COVERAGE_THRESHOLD_PCT}%.`
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
      default: { document: { run: { size: T.body, font: "Calibri" } } },
    },
  });

  const buffer = await Packer.toBuffer(doc);
  return {
    buffer: Buffer.from(buffer),
    templateVersion: PORTFOLIO_SNAPSHOT_TEMPLATE_VERSION,
    llmSource: "deterministic",
  };
}

// ─── Helpers ───────────────────────────────────────────────────

function spacer(): Paragraph {
  return new Paragraph({
    spacing: { before: 0, after: 120 },
    children: [new TextRun({ text: "" })],
  });
}

function pctOf(part: number, whole: number): string {
  if (whole <= 0) return "0";
  return ((part / whole) * 100).toFixed(0);
}

/** Compact currency for KPI hero cells (£44.0M / €1.2B / $850k). */
function formatCompactCurrency(n: number, currency: string): string {
  const symbol = currencySymbol(currency);
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${symbol}${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${symbol}${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${symbol}${(n / 1_000).toFixed(0)}k`;
  return `${symbol}${n.toFixed(0)}`;
}

function currencySymbol(currency: string): string {
  switch (currency.toUpperCase()) {
    case "GBP":
      return "£";
    case "EUR":
      return "€";
    case "JPY":
      return "¥";
    case "USD":
    default:
      return "$";
  }
}

/** Summarize capability list for the multi-product vendor table.
 *  Dedups, picks top 4, joins with comma, truncates if too many. */
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

/** Lifecycle table — one row per lifecycle, with a tone-aware
 *  status pill in the Lifecycle column and a brand-tinted bar in
 *  the % of cost column. Hand-built (not via buildTable) so we can
 *  put a TableCell pill into a cell rather than a string. */
function buildLifecycleTable(opts: {
  entries: Array<[string, { count: number; annualCostUsd: number }]>;
  totalAnnualCostUsd: number;
  brandHex: string;
  fmt: (n: number) => string;
}): Table {
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const headerBottom = {
    style: BorderStyle.SINGLE,
    size: 12,
    color: opts.brandHex,
  };

  const headerCells = ["Lifecycle", "Count", "Annual cost", "% of cost"].map(
    (h, i) =>
      new TableCell({
        width: {
          size: i === 0 ? 28 : i === 3 ? 36 : 18,
          type: WidthType.PERCENTAGE,
        },
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
              i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
            spacing: { before: 60, after: 60 },
            children: [
              new TextRun({
                text: h,
                bold: true,
                size: T.small,
                color: opts.brandHex,
              }),
            ],
          }),
        ],
      })
  );

  const bodyRows = opts.entries.map(([lifecycle, v], rowIdx) => {
    const baseFill = rowIdx % 2 === 1 ? "FAFAFA" : "FFFFFF";
    const share =
      opts.totalAnnualCostUsd > 0
        ? v.annualCostUsd / opts.totalAnnualCostUsd
        : 0;
    const pct = `${Math.round(share * 100)}%`;
    return new TableRow({
      children: [
        // Lifecycle pill cell
        buildStatusPillCell({
          text: lifecycle.replace(/_/g, " "),
          tone: lifecycleToTone(lifecycle),
        }),
        // Count
        new TableCell({
          shading: { fill: baseFill },
          borders: {
            top: noBorder,
            bottom: noBorder,
            left: noBorder,
            right: noBorder,
          },
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { before: 60, after: 60 },
              children: [
                new TextRun({
                  text: String(v.count),
                  size: T.small,
                  font: "Consolas",
                }),
              ],
            }),
          ],
        }),
        // Annual cost
        new TableCell({
          shading: { fill: baseFill },
          borders: {
            top: noBorder,
            bottom: noBorder,
            left: noBorder,
            right: noBorder,
          },
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { before: 60, after: 60 },
              children: [
                new TextRun({
                  text: opts.fmt(v.annualCostUsd),
                  size: T.small,
                  font: "Consolas",
                }),
              ],
            }),
          ],
        }),
        // Bar cell — recreate the inner-table bar inline.
        buildBarCell({ pct, share, baseFill, brandHex: opts.brandHex }),
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

/** Inline-rendered bar cell (filled portion + empty portion). */
function buildBarCell(opts: {
  pct: string;
  share: number; // 0..1
  baseFill: string;
  brandHex: string;
}): TableCell {
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const filledPct = Math.max(2, Math.round(opts.share * 100));
  const emptyPct = 100 - filledPct;
  const barColor = (() => {
    // Reuse tintHex math privately here — keep this module self-contained.
    const r = parseInt(opts.brandHex.slice(0, 2), 16);
    const g = parseInt(opts.brandHex.slice(2, 4), 16);
    const b = parseInt(opts.brandHex.slice(4, 6), 16);
    const tint = (c: number) => Math.round(c + (255 - c) * 0.6);
    const toHex = (n: number) =>
      n.toString(16).padStart(2, "0").toUpperCase();
    return `${toHex(tint(r))}${toHex(tint(g))}${toHex(tint(b))}`;
  })();

  const innerTable = new Table({
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
      new TableRow({
        children: [
          new TableCell({
            width: { size: filledPct, type: WidthType.PERCENTAGE },
            shading: { fill: barColor },
            borders: {
              top: noBorder,
              bottom: noBorder,
              left: noBorder,
              right: noBorder,
            },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({
                    text: opts.pct,
                    size: T.small,
                    bold: true,
                    color: "FFFFFF",
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: emptyPct, type: WidthType.PERCENTAGE },
            shading: { fill: opts.baseFill },
            borders: {
              top: noBorder,
              bottom: noBorder,
              left: noBorder,
              right: noBorder,
            },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [new TextRun({ text: "" })],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  return new TableCell({
    shading: { fill: opts.baseFill },
    borders: {
      top: noBorder,
      bottom: noBorder,
      left: noBorder,
      right: noBorder,
    },
    children: [innerTable],
  });
}
