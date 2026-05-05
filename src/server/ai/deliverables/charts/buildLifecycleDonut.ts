import "server-only";
import {
  brandRef,
  chartFrame,
  esc,
  fmtMoneyShort,
  NEUTRAL_GREY,
  toneHex,
} from "./_svg";
import { svgToDocxImage } from "./_renderer";
import type { Tone } from "../tokens";
import type { Paragraph } from "docx";

export type LifecycleSegment = {
  label: string;
  count: number;
  cost: number;
  tone: Tone;
};

/** Lifecycle donut: one segment per lifecycle state, sized by
 *  annual cost. Center hole shows total. Segment labels include
 *  count + cost + percentage. */
export async function buildLifecycleDonut(opts: {
  segments: LifecycleSegment[];
  totalCost: number;
  totalApps: number;
  costCurrency: string;
  brandHex: string;
}): Promise<Paragraph> {
  const W = 1400;
  const H = 800;
  const cx = 380;
  const cy = 380;
  const rOuter = 280;
  const rInner = 160;

  const total = Math.max(
    opts.segments.reduce((s, x) => s + x.cost, 0),
    1
  );

  // Generate path arcs for each segment.
  let cursor = -Math.PI / 2; // start at 12 o'clock
  const arcs: string[] = [];
  const labels: string[] = [];
  for (const seg of opts.segments) {
    const frac = seg.cost / total;
    const angle = frac * Math.PI * 2;
    const a0 = cursor;
    const a1 = cursor + angle;
    cursor = a1;

    const x0o = cx + rOuter * Math.cos(a0);
    const y0o = cy + rOuter * Math.sin(a0);
    const x1o = cx + rOuter * Math.cos(a1);
    const y1o = cy + rOuter * Math.sin(a1);
    const x0i = cx + rInner * Math.cos(a1);
    const y0i = cy + rInner * Math.sin(a1);
    const x1i = cx + rInner * Math.cos(a0);
    const y1i = cy + rInner * Math.sin(a0);
    const largeArc = angle > Math.PI ? 1 : 0;
    const fill = toneHex(seg.tone);

    arcs.push(`<path d="M ${x0o} ${y0o} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x1o} ${y1o} L ${x0i} ${y0i} A ${rInner} ${rInner} 0 ${largeArc} 0 ${x1i} ${y1i} Z" fill="${fill}" fill-opacity="0.85" stroke="white" stroke-width="3"/>`);

    // Label at midpoint of the arc, just outside the donut.
    const aMid = (a0 + a1) / 2;
    const lx = cx + (rOuter + 30) * Math.cos(aMid);
    const ly = cy + (rOuter + 30) * Math.sin(aMid);
    if (frac > 0.04) {
      const anchor = Math.cos(aMid) > 0.1 ? "start" : Math.cos(aMid) < -0.1 ? "end" : "middle";
      const pct = Math.round(frac * 100);
      labels.push(`
        <text x="${lx}" y="${ly}" text-anchor="${anchor}" font-size="13" font-weight="600" fill="#1F2937">${esc(seg.label.replace(/_/g, " "))}</text>
        <text x="${lx}" y="${ly + 16}" text-anchor="${anchor}" font-size="11" fill="${NEUTRAL_GREY}">${seg.count} apps · ${fmtMoneyShort(seg.cost, opts.costCurrency)} · ${pct}%</text>
      `);
    }
  }

  // Center: total
  const centerText = `
    <text x="${cx}" y="${cy - 14}" text-anchor="middle" font-size="20" font-weight="700" fill="${brandRef(opts.brandHex)}">${esc(fmtMoneyShort(opts.totalCost, opts.costCurrency))}</text>
    <text x="${cx}" y="${cy + 8}" text-anchor="middle" font-size="13" fill="${NEUTRAL_GREY}">${opts.totalApps} apps</text>
    <text x="${cx}" y="${cy + 26}" text-anchor="middle" font-size="11" fill="${NEUTRAL_GREY}">annual run-cost</text>
  `;

  // Right-side legend (every segment listed for clarity)
  const legendX = 820;
  const legendItems = opts.segments
    .map((seg, i) => {
      const y = 200 + i * 56;
      const fill = toneHex(seg.tone);
      const pct = Math.round((seg.cost / total) * 100);
      return `
        <rect x="${legendX}" y="${y}" width="20" height="20" fill="${fill}" fill-opacity="0.85" rx="3"/>
        <text x="${legendX + 32}" y="${y + 14}" font-size="13" font-weight="600" fill="#1F2937">${esc(seg.label.replace(/_/g, " "))}</text>
        <text x="${legendX + 32}" y="${y + 32}" font-size="11" fill="${NEUTRAL_GREY}">${seg.count} apps · ${fmtMoneyShort(seg.cost, opts.costCurrency)} · ${pct}% of run-cost</text>
      `;
    })
    .join("");

  const legend = `
    <text x="${legendX}" y="170" font-size="13" font-weight="700" fill="${NEUTRAL_GREY}" letter-spacing="2">LIFECYCLE STATES</text>
    ${legendItems}
  `;

  const body = `${arcs.join("")}${labels.join("")}${centerText}${legend}`;
  const svg = chartFrame({
    width: W,
    height: H,
    title: "Lifecycle Distribution — by Annual Run-Cost",
    brandHex: opts.brandHex,
    body,
  });

  return svgToDocxImage({
    svg,
    displayWidthPx: 620,
    displayHeightPx: 360,
    renderWidth: W,
  });
}
