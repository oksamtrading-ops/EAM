import "server-only";
import {
  brandRef,
  chartFrame,
  esc,
  fmtMoneyShort,
  NEUTRAL_GREY,
  NEUTRAL_LIGHT,
  scale,
  toneHex,
} from "./_svg";
import { svgToDocxImage } from "./_renderer";
import type { Paragraph } from "docx";

/** Three-year savings waterfall:
 *    Bar 1 (full height): Total 3-yr run-cost (£44M × 3 = baseline)
 *    Bar 2: ELIMINATE avoidance (down)
 *    Bar 3: MIGRATE avoidance (down)
 *    Bar 4: Net 3-yr run-cost after programme (positive)
 *
 *  Layout left-to-right with floating bars connected by leader
 *  lines so the chain reads as a budget reconciliation. */
export async function buildSavingsWaterfall(opts: {
  totalAnnualCostUsd: number;
  eliminate3yrUsd: number;
  migrate3yrUsd: number;
  costCurrency: string;
  brandHex: string;
}): Promise<Paragraph> {
  const W = 1500;
  const H = 800;
  const padLeft = 100;
  const padRight = 50;
  const padTop = 90;
  const padBottom = 140;
  const innerW = W - padLeft - padRight;
  const innerH = H - padTop - padBottom;

  const baseline = opts.totalAnnualCostUsd * 3;
  const elim = opts.eliminate3yrUsd;
  const mig = opts.migrate3yrUsd;
  const net = baseline - elim - mig;

  const segments = [
    {
      label: "3-yr current run-cost",
      sublabel: "Baseline @ today's spend",
      value: baseline,
      from: 0,
      to: baseline,
      color: brandRef(opts.brandHex),
      type: "total" as const,
    },
    {
      label: "ELIMINATE avoidance",
      sublabel: "100% × 3 yrs",
      value: -elim,
      from: baseline,
      to: baseline - elim,
      color: toneHex("danger"),
      type: "down" as const,
    },
    {
      label: "MIGRATE avoidance",
      sublabel: "50% × 3 yrs",
      value: -mig,
      from: baseline - elim,
      to: baseline - elim - mig,
      color: toneHex("warn"),
      type: "down" as const,
    },
    {
      label: "3-yr net run-cost",
      sublabel: "Post-programme",
      value: net,
      from: 0,
      to: net,
      color: toneHex("success"),
      type: "total" as const,
    },
  ];

  const yMax = baseline * 1.05;
  const yScale = scale([0, yMax], [padTop + innerH, padTop]);

  // Y-axis grid + labels
  const ticks = 5;
  const grid: string[] = [];
  for (let i = 0; i <= ticks; i++) {
    const v = (yMax / ticks) * i;
    const y = yScale(v);
    grid.push(`<line x1="${padLeft}" y1="${y}" x2="${padLeft + innerW}" y2="${y}" stroke="${NEUTRAL_LIGHT}" stroke-width="1"/>`);
    grid.push(`<text x="${padLeft - 12}" y="${y + 4}" text-anchor="end" font-size="11" fill="${NEUTRAL_GREY}">${esc(fmtMoneyShort(v, opts.costCurrency))}</text>`);
  }

  // Bars
  const barWidth = innerW / segments.length * 0.55;
  const slot = innerW / segments.length;
  const bars: string[] = [];
  const labels: string[] = [];
  const connectors: string[] = [];

  segments.forEach((seg, i) => {
    const xC = padLeft + slot * i + slot / 2;
    const xL = xC - barWidth / 2;
    const yT = yScale(Math.max(seg.from, seg.to));
    const yB = yScale(Math.min(seg.from, seg.to));
    const h = Math.max(2, yB - yT);
    bars.push(`<rect x="${xL}" y="${yT}" width="${barWidth}" height="${h}" fill="${seg.color}" fill-opacity="0.85" rx="3"/>`);

    const valueLabel =
      seg.type === "total"
        ? esc(fmtMoneyShort(seg.value, opts.costCurrency))
        : esc(`−${fmtMoneyShort(Math.abs(seg.value), opts.costCurrency)}`);
    labels.push(`
      <text x="${xC}" y="${yT - 14}" text-anchor="middle" font-size="13" font-weight="700" fill="#1F2937">${valueLabel}</text>
      <text x="${xC}" y="${padTop + innerH + 24}" text-anchor="middle" font-size="12" font-weight="600" fill="#1F2937">${esc(seg.label)}</text>
      <text x="${xC}" y="${padTop + innerH + 42}" text-anchor="middle" font-size="11" fill="${NEUTRAL_GREY}">${esc(seg.sublabel)}</text>
    `);

    // Connector line to the next bar's "from"
    if (i < segments.length - 1) {
      const next = segments[i + 1]!;
      const yEnd = yScale(seg.to);
      const xNext = padLeft + slot * (i + 1) + slot / 2 - barWidth / 2;
      // Skip connector when transitioning from MIGRATE (i=2) to net total (i=3)
      if (next.type !== "total") {
        connectors.push(`<line x1="${xC + barWidth / 2}" y1="${yEnd}" x2="${xNext}" y2="${yEnd}" stroke="${NEUTRAL_GREY}" stroke-width="1" stroke-dasharray="3 3"/>`);
      }
    }
  });

  // Savings annotation: arrow from baseline-top to net-top showing the saving figure
  const savingPctOf = ((elim + mig) / baseline) * 100;
  const annotation = `
    <g transform="translate(${padLeft + innerW / 2}, ${padTop - 12})">
      <text x="0" y="0" text-anchor="middle" font-size="13" font-weight="700" fill="${brandRef(opts.brandHex)}">Total savings: ${esc(fmtMoneyShort(elim + mig, opts.costCurrency))} (${savingPctOf.toFixed(0)}% of 3-yr baseline)</text>
    </g>
  `;

  // Frame axes
  const axes = `
    <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${padTop + innerH}" stroke="${NEUTRAL_GREY}" stroke-width="1.5"/>
    <line x1="${padLeft}" y1="${padTop + innerH}" x2="${padLeft + innerW}" y2="${padTop + innerH}" stroke="${NEUTRAL_GREY}" stroke-width="1.5"/>
  `;

  const body = `${grid.join("")}${axes}${connectors.join("")}${bars.join("")}${labels.join("")}${annotation}`;
  const svg = chartFrame({
    width: W,
    height: H,
    title: "Three-Year Savings Waterfall",
    brandHex: opts.brandHex,
    body,
  });

  return svgToDocxImage({
    svg,
    displayWidthPx: 620,
    displayHeightPx: 340,
    renderWidth: W,
  });
}
