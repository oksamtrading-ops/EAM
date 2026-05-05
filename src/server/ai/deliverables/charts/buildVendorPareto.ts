import "server-only";
import {
  brandRef,
  chartFrame,
  esc,
  fmtMoneyShort,
  NEUTRAL_GREY,
  NEUTRAL_LIGHT,
  scale,
} from "./_svg";
import { svgToDocxImage } from "./_renderer";
import type { Paragraph } from "docx";

export type VendorBar = {
  vendor: string;
  cost: number;
  appCount: number;
};

/** Vendor Pareto chart: top-N vendors by annual run-cost as
 *  brand-colored bars + a cumulative-share line in a contrasting
 *  color. The 80% line is drawn as a reference. */
export async function buildVendorPareto(opts: {
  vendors: VendorBar[]; // pre-sorted descending by cost
  totalCost: number;
  costCurrency: string;
  brandHex: string;
  topN?: number;
}): Promise<Paragraph> {
  const W = 1600;
  const H = 900;
  const padLeft = 90;
  const padRight = 120; // for cumulative axis
  const padTop = 90;
  const padBottom = 220; // room for vendor labels (rotated)
  const innerW = W - padLeft - padRight;
  const innerH = H - padTop - padBottom;

  const N = Math.min(opts.topN ?? 10, opts.vendors.length);
  const top = opts.vendors.slice(0, N);
  const maxCost = Math.max(...top.map((v) => v.cost), 1);

  // Cumulative shares
  const cum: number[] = [];
  let acc = 0;
  for (const v of top) {
    acc += v.cost;
    cum.push(acc / Math.max(opts.totalCost, 1));
  }

  const xBand = innerW / N;
  const yScaleCost = scale([0, maxCost], [padTop + innerH, padTop]);
  const yScalePct = scale([0, 1], [padTop + innerH, padTop]);

  // Y-axis grid + labels (cost on left)
  const ticks = 5;
  const gridLines: string[] = [];
  for (let i = 0; i <= ticks; i++) {
    const v = (maxCost / ticks) * i;
    const y = yScaleCost(v);
    gridLines.push(`<line x1="${padLeft}" y1="${y}" x2="${padLeft + innerW}" y2="${y}" stroke="${NEUTRAL_LIGHT}" stroke-width="1"/>`);
    gridLines.push(`<text x="${padLeft - 12}" y="${y + 4}" text-anchor="end" font-size="11" fill="${NEUTRAL_GREY}">${esc(fmtMoneyShort(v, opts.costCurrency))}</text>`);
  }

  // Right-axis labels (cumulative %)
  const pctLabels: string[] = [];
  for (const pct of [0.25, 0.5, 0.75, 1.0]) {
    const y = yScalePct(pct);
    pctLabels.push(`<text x="${padLeft + innerW + 12}" y="${y + 4}" text-anchor="start" font-size="11" fill="${NEUTRAL_GREY}">${Math.round(pct * 100)}%</text>`);
  }

  // 80% reference line
  const y80 = yScalePct(0.8);
  const ref80 = `
    <line x1="${padLeft}" y1="${y80}" x2="${padLeft + innerW}" y2="${y80}" stroke="#DC2626" stroke-width="1" stroke-dasharray="6 4" opacity="0.6"/>
    <text x="${padLeft + innerW - 5}" y="${y80 - 6}" text-anchor="end" font-size="10" font-weight="600" fill="#DC2626">80% reference</text>
  `;

  // Bars
  const barWidth = xBand * 0.7;
  const bars = top.map((v, i) => {
    const xC = padLeft + xBand * i + xBand / 2;
    const xL = xC - barWidth / 2;
    const yT = yScaleCost(v.cost);
    const fill = brandRef(opts.brandHex);
    return `
      <rect x="${xL}" y="${yT}" width="${barWidth}" height="${padTop + innerH - yT}" fill="${fill}" fill-opacity="0.85" rx="2"/>
      <text x="${xC}" y="${yT - 8}" text-anchor="middle" font-size="11" font-weight="600" fill="#1F2937">${esc(fmtMoneyShort(v.cost, opts.costCurrency))}</text>
    `;
  }).join("");

  // Vendor labels (rotated)
  const vendorLabels = top.map((v, i) => {
    const xC = padLeft + xBand * i + xBand / 2;
    const yL = padTop + innerH + 12;
    const label = v.vendor.length > 32 ? v.vendor.slice(0, 30) + "…" : v.vendor;
    return `
      <text x="${xC}" y="${yL}" text-anchor="end" font-size="11" fill="#1F2937" transform="rotate(-35, ${xC}, ${yL})">${esc(label)}</text>
      <text x="${xC}" y="${yL + 16}" text-anchor="end" font-size="10" fill="${NEUTRAL_GREY}" transform="rotate(-35, ${xC}, ${yL + 16})">${v.appCount} app${v.appCount === 1 ? "" : "s"}</text>
    `;
  }).join("");

  // Cumulative line (contrasting orange to read against brand)
  const cumColor = "#D97706";
  let pathD = "";
  cum.forEach((p, i) => {
    const xC = padLeft + xBand * i + xBand / 2;
    const yC = yScalePct(p);
    pathD += i === 0 ? `M ${xC} ${yC}` : ` L ${xC} ${yC}`;
  });
  const cumLine = `<path d="${pathD}" fill="none" stroke="${cumColor}" stroke-width="2.5"/>`;
  const cumPoints = cum.map((p, i) => {
    const xC = padLeft + xBand * i + xBand / 2;
    const yC = yScalePct(p);
    return `<circle cx="${xC}" cy="${yC}" r="4" fill="${cumColor}" stroke="white" stroke-width="1.5"/>`;
  }).join("");

  // Frame axes
  const axes = `
    <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${padTop + innerH}" stroke="${NEUTRAL_GREY}" stroke-width="1.5"/>
    <line x1="${padLeft}" y1="${padTop + innerH}" x2="${padLeft + innerW}" y2="${padTop + innerH}" stroke="${NEUTRAL_GREY}" stroke-width="1.5"/>
    <line x1="${padLeft + innerW}" y1="${padTop}" x2="${padLeft + innerW}" y2="${padTop + innerH}" stroke="${NEUTRAL_GREY}" stroke-width="1.5"/>
  `;

  // Axis titles
  const axisTitles = `
    <text x="${padLeft}" y="${padTop - 18}" text-anchor="start" font-size="11" font-weight="600" fill="${NEUTRAL_GREY}" letter-spacing="2">ANNUAL COST</text>
    <text x="${padLeft + innerW}" y="${padTop - 18}" text-anchor="end" font-size="11" font-weight="600" fill="${cumColor}" letter-spacing="2">CUMULATIVE %</text>
  `;

  const body = `${gridLines.join("")}${axes}${ref80}${bars}${cumLine}${cumPoints}${vendorLabels}${pctLabels.join("")}${axisTitles}`;
  const svg = chartFrame({
    width: W,
    height: H,
    title: "Vendor Pareto — Run-Cost Concentration",
    brandHex: opts.brandHex,
    body,
  });

  return svgToDocxImage({
    svg,
    displayWidthPx: 640,
    displayHeightPx: 360,
    renderWidth: W,
  });
}
