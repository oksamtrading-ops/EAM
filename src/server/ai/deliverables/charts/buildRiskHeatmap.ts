import "server-only";
import {
  chartFrame,
  esc,
  NEUTRAL_GREY,
  NEUTRAL_LIGHT,
  toneHex,
  tint,
} from "./_svg";
import { svgToDocxImage } from "./_renderer";
import type { Paragraph } from "docx";

export type RiskBubble = {
  initiativeName: string;
  /** 1-3 scale: LOW / MEDIUM / HIGH likelihood of slipping or failing. */
  likelihood: 1 | 2 | 3;
  /** 1-3 scale: LOW / MEDIUM / HIGH impact on the broader programme. */
  impact: 1 | 2 | 3;
  /** Bubble size driver — capability + app impact count.
   *  Higher means more cross-deliverable surface area. */
  size: number;
};

/**
 * Risk heatmap — likelihood × impact 2×2 with initiative bubbles
 * sized by capability + app impact. Reuses the maturity-domain
 * heatmap-cell tinting pattern (danger red on the high-high cell,
 * fading to success green on the low-low cell). Initiative names
 * label the largest bubbles; smaller ones render as unlabeled
 * dots to preserve readability.
 */
export async function buildRiskHeatmap(opts: {
  bubbles: RiskBubble[];
  brandHex: string;
}): Promise<Paragraph> {
  const W = 1400;
  const H = 800;
  const titleBarH = 90;
  const top = titleBarH + 60;
  const bottom = H - 100;
  const left = 180;
  const right = W - 200;
  const innerW = right - left;
  const innerH = bottom - top;

  // 3×3 cell grid (LOW/MEDIUM/HIGH on both axes). Tint per
  // quadrant: top-right (high impact + high likelihood) is danger.
  const cellW = innerW / 3;
  const cellH = innerH / 3;

  const cellTone = (likelihood: number, impact: number) => {
    const sum = likelihood + impact;
    if (sum >= 5) return "danger" as const;
    if (sum >= 4) return "warn" as const;
    if (sum >= 3) return "info" as const;
    return "success" as const;
  };

  const cells: string[] = [];
  for (let li = 1; li <= 3; li++) {
    for (let im = 1; im <= 3; im++) {
      const x = left + (li - 1) * cellW;
      // y axis inverted: impact 3 (HIGH) at top
      const y = top + (3 - im) * cellH;
      const tone = cellTone(li, im);
      const fill = tint(toneHex(tone), 0.85);
      cells.push(`
        <rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" fill="${fill}" stroke="${NEUTRAL_LIGHT}" stroke-width="1"/>
      `);
    }
  }

  // Bubble positions: jitter within each cell to avoid overlap
  const sized = opts.bubbles.map((b, idx) => {
    const cx = left + (b.likelihood - 0.5) * cellW;
    const cy = top + (3 - b.impact + 0.5) * cellH;
    // Deterministic jitter based on initiative name hash (stable across renders)
    const hash = Array.from(b.initiativeName).reduce((s, c) => s + c.charCodeAt(0), 0);
    const jitterX = ((hash * 17 + idx * 37) % 80) - 40;
    const jitterY = ((hash * 23 + idx * 41) % 60) - 30;
    const r = 14 + Math.min(36, Math.sqrt(b.size) * 8);
    return { ...b, x: cx + jitterX, y: cy + jitterY, r };
  });

  // Sort by size desc so larger bubbles render first (smaller ones overlay)
  sized.sort((a, b) => b.r - a.r);

  const bubbles = sized
    .map((b) => {
      const tone = cellTone(b.likelihood, b.impact);
      const fill = toneHex(tone);
      return `
        <circle cx="${b.x}" cy="${b.y}" r="${b.r}" fill="${fill}" fill-opacity="0.55" stroke="${fill}" stroke-width="1.6"/>
      `;
    })
    .join("");

  // Label only the top-5 largest bubbles to preserve readability
  const labels = sized
    .slice(0, 5)
    .map((b) => {
      const name = b.initiativeName.length > 22 ? b.initiativeName.slice(0, 21) + "…" : b.initiativeName;
      return `
        <text x="${b.x}" y="${b.y + b.r + 14}" font-size="10" font-weight="700" fill="#1F2937" text-anchor="middle">${esc(name)}</text>
      `;
    })
    .join("");

  // Axis labels
  const xLabels = ["LOW", "MEDIUM", "HIGH"]
    .map(
      (lbl, i) => `
        <text x="${left + (i + 0.5) * cellW}" y="${bottom + 24}" font-size="11" font-weight="700" fill="${NEUTRAL_GREY}" text-anchor="middle">${lbl}</text>
      `
    )
    .join("");
  const yLabels = ["LOW", "MEDIUM", "HIGH"]
    .map(
      (lbl, i) => `
        <text x="${left - 16}" y="${top + (3 - i - 0.5) * cellH + 4}" font-size="11" font-weight="700" fill="${NEUTRAL_GREY}" text-anchor="end">${lbl}</text>
      `
    )
    .join("");

  // Axis titles
  const axisTitleX = `<text x="${left + innerW / 2}" y="${bottom + 50}" font-size="12" font-weight="800" fill="${NEUTRAL_GREY}" text-anchor="middle" letter-spacing="2">LIKELIHOOD</text>`;
  const axisTitleY = `<text x="${left - 80}" y="${top + innerH / 2}" font-size="12" font-weight="800" fill="${NEUTRAL_GREY}" text-anchor="middle" letter-spacing="2" transform="rotate(-90, ${left - 80}, ${top + innerH / 2})">IMPACT</text>`;

  // Right legend explaining bubble size
  const legendX = right + 30;
  const legendY = top + 20;
  const legend = `
    <text x="${legendX}" y="${legendY}" font-size="11" font-weight="800" fill="${NEUTRAL_GREY}" letter-spacing="1.5">BUBBLE SIZE</text>
    <text x="${legendX}" y="${legendY + 22}" font-size="10" fill="#1F2937">capability +</text>
    <text x="${legendX}" y="${legendY + 36}" font-size="10" fill="#1F2937">app impact</text>
    <text x="${legendX}" y="${legendY + 50}" font-size="10" fill="#1F2937">count</text>

    <text x="${legendX}" y="${legendY + 84}" font-size="11" font-weight="800" fill="${NEUTRAL_GREY}" letter-spacing="1.5">CELL TONE</text>
    <text x="${legendX}" y="${legendY + 106}" font-size="10" fill="#1F2937">red = priority</text>
    <text x="${legendX}" y="${legendY + 120}" font-size="10" fill="#1F2937">amber = watch</text>
    <text x="${legendX}" y="${legendY + 134}" font-size="10" fill="#1F2937">green = OK</text>
  `;

  const body = `${cells.join("")}${bubbles}${labels}${xLabels}${yLabels}${axisTitleX}${axisTitleY}${legend}`;
  const svg = chartFrame({
    width: W,
    height: H,
    title: "Initiative Risk Heatmap — Likelihood × Impact",
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
