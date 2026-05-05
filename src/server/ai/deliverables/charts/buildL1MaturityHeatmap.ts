import "server-only";
import {
  chartFrame,
  esc,
  NEUTRAL_GREY,
  NEUTRAL_LIGHT,
  tint,
  toneHex,
} from "./_svg";
import { svgToDocxImage } from "./_renderer";
import type { Paragraph } from "docx";

export type L1MaturityRow = {
  l1Name: string;
  /** Count of L2/L3 capabilities under this L1 at each maturity level. */
  byMaturity: Record<string, number>;
  /** Weighted-mean target maturity (1-5 scale) shown as overlay marker. */
  targetMean: number;
  /** Weighted-mean current maturity (1-5 scale) — anchors the row. */
  currentMean: number;
  totalChildren: number;
};

const MATURITY_ORDER = [
  "INITIAL",
  "DEVELOPING",
  "DEFINED",
  "MANAGED",
  "OPTIMIZING",
];

/** L1 capability domain × maturity-level heatmap. Rows = L1
 *  domains; columns = 5 maturity levels (NOT_ASSESSED rolled
 *  into a separate sidebar column). Cell fill = count of L2/L3
 *  capabilities at that maturity. Row total + target-mean marker
 *  on the right.
 *
 *  The analysis-chapter chart for the Capability Maturity
 *  Assessment deliverable. Surfaces concentration of
 *  low-maturity capabilities by business domain. */
export async function buildL1MaturityHeatmap(opts: {
  rows: L1MaturityRow[];
  brandHex: string;
}): Promise<Paragraph> {
  const W = 1600;
  const H = Math.max(540, 130 + 60 * opts.rows.length + 100);
  const padLeft = 280;
  const padRight = 200; // room for total + target-mean column
  const padTop = 110;
  const padBottom = 80;
  const innerW = W - padLeft - padRight;
  const innerH = H - padTop - padBottom;

  const colW = innerW / MATURITY_ORDER.length;
  const rowH = innerH / Math.max(opts.rows.length, 1);

  // Maximum count across all cells for tint scaling.
  let maxCount = 1;
  for (const row of opts.rows) {
    for (const m of MATURITY_ORDER) {
      const c = row.byMaturity[m] ?? 0;
      if (c > maxCount) maxCount = c;
    }
  }

  // Cells.
  const cellParts: string[] = [];
  for (let r = 0; r < opts.rows.length; r++) {
    const row = opts.rows[r]!;
    for (let c = 0; c < MATURITY_ORDER.length; c++) {
      const maturity = MATURITY_ORDER[c]!;
      const count = row.byMaturity[maturity] ?? 0;
      const x = padLeft + c * colW;
      const y = padTop + r * rowH;
      let fill: string;
      let textColor: string;
      if (count === 0) {
        fill = "#FAFAFA";
        textColor = NEUTRAL_LIGHT;
      } else {
        const intensity = Math.max(0.05, count / maxCount);
        const tintAmount = 0.85 - intensity * 0.7;
        // Tone progresses across columns: INITIAL=danger, DEVELOPING=warn,
        // DEFINED=info, MANAGED=success, OPTIMIZING=auth.
        const colTone =
          maturity === "INITIAL" ? toneHex("danger") :
          maturity === "DEVELOPING" ? toneHex("warn") :
          maturity === "DEFINED" ? toneHex("info") :
          maturity === "MANAGED" ? toneHex("success") :
          toneHex("auth");
        fill = tint(colTone, tintAmount);
        textColor = tintAmount < 0.4 ? "#FFFFFF" : "#1F2937";
      }
      cellParts.push(`
        <rect x="${x + 2}" y="${y + 2}" width="${colW - 4}" height="${rowH - 4}" fill="${fill}" rx="2"/>
        <text x="${x + colW / 2}" y="${y + rowH / 2 + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="${textColor}">${count > 0 ? count : "—"}</text>
      `);
    }
  }

  // Column headers.
  const colHeaders = MATURITY_ORDER.map((label, c) => {
    const x = padLeft + c * colW + colW / 2;
    return `<text x="${x}" y="${padTop - 18}" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937" letter-spacing="1">${esc(label)}</text>`;
  }).join("");

  // Row headers (L1 domain names).
  const rowHeaders = opts.rows.map((row, r) => {
    const y = padTop + r * rowH + rowH / 2 + 4;
    const truncated = row.l1Name.length > 32 ? row.l1Name.slice(0, 30) + "…" : row.l1Name;
    return `
      <text x="${padLeft - 16}" y="${y - 2}" text-anchor="end" font-size="11" font-weight="700" fill="#1F2937">${esc(truncated)}</text>
      <text x="${padLeft - 16}" y="${y + 12}" text-anchor="end" font-size="9" fill="${NEUTRAL_GREY}">${row.totalChildren} L2/L3</text>
    `;
  }).join("");

  // Right column: target-mean marker + current-mean text.
  const rightColX = padLeft + innerW + 24;
  const rightCol = opts.rows.map((row, r) => {
    const y = padTop + r * rowH + rowH / 2 + 4;
    // Mini-bar showing current → target progression on a 0-5 scale.
    const barW = 100;
    const barX = rightColX;
    const barY = y - 4;
    const currentX = barX + (row.currentMean / 5) * barW;
    const targetX = barX + (row.targetMean / 5) * barW;
    return `
      <line x1="${barX}" y1="${barY}" x2="${barX + barW}" y2="${barY}" stroke="${NEUTRAL_LIGHT}" stroke-width="3"/>
      <line x1="${currentX}" y1="${barY}" x2="${targetX}" y2="${barY}" stroke="${toneHex("success")}" stroke-width="3"/>
      <circle cx="${currentX}" cy="${barY}" r="5" fill="${toneHex("danger")}" stroke="white" stroke-width="1.5"/>
      <polygon points="${targetX},${barY - 6} ${targetX + 6},${barY} ${targetX},${barY + 6} ${targetX - 6},${barY}" fill="${toneHex("success")}" stroke="white" stroke-width="1.5"/>
      <text x="${barX + barW + 12}" y="${barY + 4}" font-size="10" fill="${NEUTRAL_GREY}">${row.currentMean.toFixed(1)} → ${row.targetMean.toFixed(1)}</text>
    `;
  }).join("");

  // Right-column header.
  const rightHeader = `<text x="${rightColX + 50}" y="${padTop - 18}" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2937" letter-spacing="1">CURRENT → TARGET</text>`;

  // Axis title.
  const axisTitle = `
    <text x="${padLeft + innerW / 2}" y="${padTop + innerH + 50}" text-anchor="middle" font-size="11" font-weight="700" fill="${NEUTRAL_GREY}" letter-spacing="2">MATURITY LEVEL →</text>
  `;

  const body = `${cellParts.join("")}${colHeaders}${rowHeaders}${rightCol}${rightHeader}${axisTitle}`;
  const svg = chartFrame({
    width: W,
    height: H,
    title: "L1 Capability Domains — Maturity Distribution",
    brandHex: opts.brandHex,
    body,
  });

  return svgToDocxImage({
    svg,
    displayWidthPx: 640,
    displayHeightPx: Math.round((H / W) * 640),
    renderWidth: W,
  });
}
