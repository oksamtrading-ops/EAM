import "server-only";
import {
  chartFrame,
  esc,
  NEUTRAL_GREY,
  NEUTRAL_LIGHT,
  toneHex,
  brandRef,
} from "./_svg";
import { svgToDocxImage } from "./_renderer";
import type { Paragraph } from "docx";

export type BenefitsPoint = {
  label: string; // e.g. "Q1", "Q2", "End Y1", "End Y2", "End Y3"
  cumulativeCount: number;
};

/**
 * Cumulative-completion benefits curve. Substitute for the
 * rationalization waterfall (which is money-shaped). Plots the
 * cumulative count of completed initiatives over the 3-year
 * horizon, communicating pace of value delivery without citing
 * money. v1 is initiative-count-shaped; v2 (when budget data
 * stabilizes) layers a benefits-£ axis on top.
 */
export async function buildBenefitsCurve(opts: {
  points: BenefitsPoint[];
  totalInitiatives: number;
  brandHex: string;
}): Promise<Paragraph> {
  const W = 1400;
  const H = 700;
  const titleBarH = 90;
  const top = titleBarH + 60;
  const bottom = H - 90;
  const left = 110;
  const right = W - 80;
  const innerW = right - left;
  const innerH = bottom - top;

  const points = opts.points.length > 0 ? opts.points : [{ label: "—", cumulativeCount: 0 }];
  const maxY = Math.max(opts.totalInitiatives, points[points.length - 1]!.cumulativeCount, 1);
  const xStep = points.length > 1 ? innerW / (points.length - 1) : innerW;

  const xy = points.map((p, i) => {
    const x = left + i * xStep;
    const y = bottom - (p.cumulativeCount / maxY) * innerH;
    return { x, y, p };
  });

  // Y-axis gridlines at 25/50/75/100% of total
  const gridlines = [0.25, 0.5, 0.75, 1.0]
    .map((frac) => {
      const y = bottom - frac * innerH;
      const v = Math.round(maxY * frac);
      return `
        <line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="${NEUTRAL_LIGHT}" stroke-width="1" stroke-dasharray="2,3"/>
        <text x="${left - 10}" y="${y + 4}" font-size="10" fill="${NEUTRAL_GREY}" text-anchor="end">${v}</text>
      `;
    })
    .join("");

  // Area fill (under curve) with brand color tint
  const brand = brandRef(opts.brandHex);
  const areaPath =
    `M ${xy[0]!.x} ${bottom} ` +
    xy.map((pt) => `L ${pt.x} ${pt.y}`).join(" ") +
    ` L ${xy[xy.length - 1]!.x} ${bottom} Z`;

  // Line on top
  const linePath = `M ${xy[0]!.x} ${xy[0]!.y} ` + xy.slice(1).map((pt) => `L ${pt.x} ${pt.y}`).join(" ");

  // Data points + value labels
  const dots = xy
    .map(
      (pt) => `
        <circle cx="${pt.x}" cy="${pt.y}" r="5" fill="${brand}" stroke="#FFFFFF" stroke-width="2"/>
        <text x="${pt.x}" y="${pt.y - 12}" font-size="11" font-weight="700" fill="#1F2937" text-anchor="middle">${pt.p.cumulativeCount}</text>
      `
    )
    .join("");

  // X-axis labels
  const xLabels = xy
    .map(
      (pt) => `
        <text x="${pt.x}" y="${bottom + 22}" font-size="11" fill="${NEUTRAL_GREY}" text-anchor="middle">${esc(pt.p.label)}</text>
      `
    )
    .join("");

  // Axis lines
  const axes = `
    <line x1="${left}" y1="${top}" x2="${left}" y2="${bottom}" stroke="${NEUTRAL_GREY}" stroke-width="1.2"/>
    <line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="${NEUTRAL_GREY}" stroke-width="1.2"/>
  `;

  // Y-axis title
  const yTitle = `<text x="${left - 60}" y="${top - 30}" font-size="11" font-weight="700" fill="${NEUTRAL_GREY}" letter-spacing="1.5">CUMULATIVE COMPLETED INITIATIVES</text>`;

  // Subtle annotation for the total line
  const totalLine = `
    <line x1="${left}" y1="${bottom - innerH}" x2="${right}" y2="${bottom - innerH}" stroke="${toneHex("success")}" stroke-width="1.5" stroke-dasharray="6,4" opacity="0.7"/>
    <text x="${right + 4}" y="${bottom - innerH + 4}" font-size="11" font-weight="700" fill="${toneHex("success")}">${opts.totalInitiatives} TOTAL</text>
  `;

  const body = `${yTitle}${gridlines}${axes}${totalLine}<path d="${areaPath}" fill="${brand}" fill-opacity="0.15"/><path d="${linePath}" fill="none" stroke="${brand}" stroke-width="3"/>${dots}${xLabels}`;
  const svg = chartFrame({
    width: W,
    height: H,
    title: "Benefits Delivery Curve — Cumulative Initiative Completion",
    brandHex: opts.brandHex,
    body,
  });

  return svgToDocxImage({
    svg,
    displayWidthPx: 620,
    displayHeightPx: 320,
    renderWidth: W,
  });
}
