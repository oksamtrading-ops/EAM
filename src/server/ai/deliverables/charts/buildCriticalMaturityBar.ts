import "server-only";
import {
  chartFrame,
  esc,
  NEUTRAL_GREY,
  NEUTRAL_LIGHT,
  scale,
  toneHex,
} from "./_svg";
import { svgToDocxImage } from "./_renderer";
import type { Paragraph } from "docx";

export type CriticalCapability = {
  name: string;
  currentMaturity: string;
  targetMaturity: string;
  appCount: number;
};

const MATURITY_ORDER = [
  "NOT_ASSESSED",
  "INITIAL",
  "DEVELOPING",
  "DEFINED",
  "MANAGED",
  "OPTIMIZING",
];

function maturityIndex(level: string): number {
  const i = MATURITY_ORDER.indexOf(level);
  return i < 0 ? 0 : i;
}

/** Synthesis-layer hero chart. CRITICAL-importance capabilities
 *  rendered along the maturity axis as cost-sized bubbles, with
 *  target-state markers showing the gap. Single-glance answer to
 *  "where do my CRITICAL capabilities sit and how far are they
 *  from target."
 *
 *  Per design-critique: the 5×6 importance × maturity matrix
 *  is too dense for partner-skim; this is the simplified
 *  synthesis-page hero.
 *
 *  Layout: maturity scale across the bottom (NOT_ASSESSED →
 *  OPTIMIZING). Bubbles for current state at their maturity-
 *  index position. Target markers (small diamonds) at the
 *  target-state position. Connector line from bubble to target
 *  visualizes the gap. */
export async function buildCriticalMaturityBar(opts: {
  capabilities: CriticalCapability[];
  brandHex: string;
}): Promise<Paragraph> {
  const W = 1600;
  const H = 540;
  const padLeft = 80;
  const padRight = 60;
  const padTop = 100;
  const padBottom = 100;
  const innerW = W - padLeft - padRight;
  const innerH = H - padTop - padBottom;

  // X scale across the 6 maturity levels.
  const xScale = scale([0, 5], [padLeft + 60, padLeft + innerW - 40]);

  // Cluster capabilities at the same current-maturity index so labels
  // stack vertically without overlap.
  type Cluster = {
    cx: number;
    items: CriticalCapability[];
  };
  const clusterMap = new Map<number, Cluster>();
  for (const cap of opts.capabilities) {
    const idx = maturityIndex(cap.currentMaturity);
    const cx = xScale(idx);
    const existing = clusterMap.get(idx);
    if (existing) existing.items.push(cap);
    else clusterMap.set(idx, { cx, items: [cap] });
  }

  // Render axis grid + labels.
  const axisLabels = MATURITY_ORDER.map((label, i) => {
    const x = xScale(i);
    return `
      <line x1="${x}" y1="${padTop}" x2="${x}" y2="${padTop + innerH}" stroke="${NEUTRAL_LIGHT}" stroke-width="1" stroke-dasharray="3 3"/>
      <text x="${x}" y="${padTop + innerH + 26}" text-anchor="middle" font-size="11" font-weight="${label === "NOT_ASSESSED" ? "400" : "700"}" fill="${label === "NOT_ASSESSED" ? NEUTRAL_GREY : "#1F2937"}" letter-spacing="1">${esc(label.replace(/_/g, " "))}</text>
    `;
  }).join("");

  // Render bubbles (current) + target markers + connector lines.
  const bubbleParts: string[] = [];
  const labelParts: string[] = [];
  const lineHeight = 16;

  for (const cluster of clusterMap.values()) {
    // Sort by app-count descending (largest at top).
    cluster.items.sort((a, b) => b.appCount - a.appCount);
    // Vertical stacking: distribute items vertically within the
    // chart inner area.
    const slotHeight = innerH / Math.max(cluster.items.length, 1);
    cluster.items.forEach((cap, i) => {
      const cy = padTop + slotHeight * (i + 0.5);
      const r = 14 + Math.min(cap.appCount, 5) * 4;
      const targetX = xScale(maturityIndex(cap.targetMaturity));

      // Connector line from current → target (only when gap > 0).
      if (cap.targetMaturity !== cap.currentMaturity) {
        bubbleParts.push(
          `<line x1="${cluster.cx}" y1="${cy}" x2="${targetX}" y2="${cy}" stroke="#9CA3AF" stroke-width="1.5" stroke-dasharray="3 3"/>`
        );
        // Target marker — diamond.
        bubbleParts.push(
          `<polygon points="${targetX},${cy - 8} ${targetX + 8},${cy} ${targetX},${cy + 8} ${targetX - 8},${cy}" fill="${toneHex("success")}" fill-opacity="0.55" stroke="${toneHex("success")}" stroke-width="2"/>`
        );
      }

      // Bubble — current state.
      bubbleParts.push(
        `<circle cx="${cluster.cx}" cy="${cy}" r="${r}" fill="${toneHex("danger")}" fill-opacity="0.55" stroke="${toneHex("danger")}" stroke-width="2"/>`
      );

      // Label: capability name to the right (or left if near right edge).
      const labelX = cluster.cx > padLeft + innerW * 0.8
        ? cluster.cx - r - 8
        : cluster.cx + r + 8;
      const anchor = labelX < cluster.cx ? "end" : "start";
      const label = cap.name.length > 32 ? cap.name.slice(0, 30) + "…" : cap.name;
      labelParts.push(
        `<text x="${labelX}" y="${cy - 2}" text-anchor="${anchor}" font-size="11" font-weight="600" fill="#1F2937">${esc(label)}</text>`,
        `<text x="${labelX}" y="${cy + 12}" text-anchor="${anchor}" font-size="9" fill="${NEUTRAL_GREY}">${cap.appCount} app${cap.appCount === 1 ? "" : "s"} mapped</text>`
      );
    });
  }

  // Title legend (current vs target).
  const legend = `
    <g transform="translate(${padLeft}, ${padTop - 60})">
      <circle cx="10" cy="0" r="8" fill="${toneHex("danger")}" fill-opacity="0.55" stroke="${toneHex("danger")}" stroke-width="2"/>
      <text x="26" y="4" font-size="11" font-weight="600" fill="#1F2937">Current maturity</text>
      <polygon points="160,−6 168,0 160,6 152,0" fill="${toneHex("success")}" fill-opacity="0.55" stroke="${toneHex("success")}" stroke-width="2"/>
      <text x="180" y="4" font-size="11" font-weight="600" fill="#1F2937">Target maturity</text>
      <text x="320" y="4" font-size="11" fill="${NEUTRAL_GREY}">— bubble size = applications mapped, dashed line = gap</text>
    </g>
  `;

  const body = `${axisLabels}${bubbleParts.join("")}${labelParts.join("")}${legend}`;
  const svg = chartFrame({
    width: W,
    height: H,
    title: "CRITICAL Capabilities — Current vs Target Maturity",
    brandHex: opts.brandHex,
    body,
  });

  return svgToDocxImage({
    svg,
    displayWidthPx: 640,
    displayHeightPx: 220,
    renderWidth: W,
  });
}
