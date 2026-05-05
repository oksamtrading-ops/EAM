import "server-only";
import {
  brandRef,
  chartFrame,
  esc,
  NEUTRAL_GREY,
  NEUTRAL_LIGHT,
  scale,
  tint,
  toneHex,
} from "./_svg";
import { svgToDocxImage } from "./_renderer";
import type { Tone } from "../tokens";
import type { Paragraph } from "docx";

export type ImportanceMaturityCell = {
  importance: string; // CRITICAL / HIGH / MEDIUM / LOW / NOT_ASSESSED
  maturity: string; // INITIAL / DEVELOPING / DEFINED / MANAGED / OPTIMIZING / NOT_ASSESSED
  count: number;
  /** Top-N capability names in this cell (for hover-equivalent
   *  context; rendered as small text inside the cell when count > 0). */
  topCapabilities?: string[];
};

const IMPORTANCE_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NOT_ASSESSED"];
const MATURITY_ORDER = [
  "INITIAL",
  "DEVELOPING",
  "DEFINED",
  "MANAGED",
  "OPTIMIZING",
  "NOT_ASSESSED",
];

/** Tone-by-quadrant for visual-heat tinting:
 *
 *    HIGH-Importance + LOW-Maturity  → DANGER  (the priority lift)
 *    HIGH-Importance + HIGH-Maturity → SUCCESS (sustain at target)
 *    LOW-Importance  + LOW-Maturity  → INFO    (low priority)
 *    LOW-Importance  + HIGH-Maturity → WARN    (over-served / Reassess)
 *
 *  Plus row/column labels for the NOT_ASSESSED axis on each scale —
 *  rendered as a coverage-gap visual indicator. */
function cellTone(importance: string, maturity: string): Tone {
  if (importance === "NOT_ASSESSED" || maturity === "NOT_ASSESSED")
    return "info";
  const isHighImportance = importance === "CRITICAL" || importance === "HIGH";
  const isLowImportance = importance === "LOW";
  const isHighMaturity = maturity === "MANAGED" || maturity === "OPTIMIZING";
  const isLowMaturity = maturity === "INITIAL" || maturity === "DEVELOPING";

  if (isHighImportance && isLowMaturity) return "danger";
  if (isHighImportance && isHighMaturity) return "success";
  if (isLowImportance && isHighMaturity) return "warn";
  return "info";
}

/** Strategic Importance × Current Maturity 5×6 heatmap.
 *  Cell fill = tinted by tone (per cellTone) and intensity
 *  (count / maxCount). Numbers overlay each cell.
 *
 *  The synthesis-layer chart for the Capability Maturity
 *  Assessment deliverable. Equivalent of TIME 2×2 in the
 *  rationalization plan; surfaces the importance-vs-state
 *  asymmetry that frames the engagement.
 *
 *  v1 note: synthesis-page version SHOULD be a simpler
 *  CRITICAL-only horizontal bar (per design-critique). This
 *  full 5×6 matrix renders in the analysis chapter; the
 *  CRITICAL-band simplified bar is a separate primitive. */
export async function buildImportanceMaturityMatrix(opts: {
  cells: ImportanceMaturityCell[];
  brandHex: string;
}): Promise<Paragraph> {
  const W = 1600;
  const H = 980;
  const padLeft = 180;
  const padRight = 60;
  const padTop = 110;
  const padBottom = 100;
  const innerW = W - padLeft - padRight;
  const innerH = H - padTop - padBottom;

  const colW = innerW / MATURITY_ORDER.length;
  const rowH = innerH / IMPORTANCE_ORDER.length;

  // Index cells for O(1) lookup.
  const cellMap = new Map<string, ImportanceMaturityCell>();
  for (const c of opts.cells) {
    cellMap.set(`${c.importance}:${c.maturity}`, c);
  }
  const maxCount = Math.max(...opts.cells.map((c) => c.count), 1);

  // Render cells.
  const cellParts: string[] = [];
  for (let r = 0; r < IMPORTANCE_ORDER.length; r++) {
    const importance = IMPORTANCE_ORDER[r]!;
    for (let c = 0; c < MATURITY_ORDER.length; c++) {
      const maturity = MATURITY_ORDER[c]!;
      const cell = cellMap.get(`${importance}:${maturity}`);
      const count = cell?.count ?? 0;
      const x = padLeft + c * colW;
      const y = padTop + r * rowH;
      const tone = cellTone(importance, maturity);
      const baseColor = toneHex(tone);
      // Empty cell: faint grey background.
      let fill: string;
      let textColor: string;
      if (count === 0) {
        fill = "#FAFAFA";
        textColor = NEUTRAL_LIGHT;
      } else {
        const intensity = Math.max(0.05, count / maxCount);
        const tintAmount = 0.85 - intensity * 0.7;
        fill = tint(baseColor, tintAmount);
        textColor = tintAmount < 0.4 ? "#FFFFFF" : "#1F2937";
      }
      cellParts.push(`
        <rect x="${x + 2}" y="${y + 2}" width="${colW - 4}" height="${rowH - 4}" fill="${fill}" rx="3"/>
        <text x="${x + colW / 2}" y="${y + rowH / 2 - 4}" text-anchor="middle" font-size="22" font-weight="700" fill="${textColor}">${count > 0 ? count : "—"}</text>
        ${count > 0 && cell?.topCapabilities?.length ? `<text x="${x + colW / 2}" y="${y + rowH / 2 + 16}" text-anchor="middle" font-size="9" fill="${textColor}">${esc(cell.topCapabilities.slice(0, 1).join(", ").slice(0, 24))}${cell.topCapabilities.length > 1 || (cell.topCapabilities[0] ?? "").length > 24 ? "…" : ""}</text>` : ""}
      `);
    }
  }

  // Column headers (maturity levels along the top).
  const colHeaders: string[] = [];
  for (let c = 0; c < MATURITY_ORDER.length; c++) {
    const x = padLeft + c * colW + colW / 2;
    const label = MATURITY_ORDER[c]!.replace(/_/g, " ");
    const isUnassessed = MATURITY_ORDER[c] === "NOT_ASSESSED";
    colHeaders.push(`
      <text x="${x}" y="${padTop - 18}" text-anchor="middle" font-size="11" font-weight="${isUnassessed ? "400" : "700"}" fill="${isUnassessed ? NEUTRAL_GREY : "#1F2937"}" letter-spacing="1">${esc(label)}</text>
    `);
  }

  // Row headers (importance levels along the left).
  const rowHeaders: string[] = [];
  for (let r = 0; r < IMPORTANCE_ORDER.length; r++) {
    const y = padTop + r * rowH + rowH / 2 + 4;
    const label = IMPORTANCE_ORDER[r]!.replace(/_/g, " ");
    const isUnassessed = IMPORTANCE_ORDER[r] === "NOT_ASSESSED";
    rowHeaders.push(`
      <text x="${padLeft - 16}" y="${y}" text-anchor="end" font-size="11" font-weight="${isUnassessed ? "400" : "700"}" fill="${isUnassessed ? NEUTRAL_GREY : "#1F2937"}" letter-spacing="1">${esc(label)}</text>
    `);
  }

  // Axis titles.
  const axisTitles = `
    <text x="${padLeft - 60}" y="${padTop - 50}" text-anchor="start" font-size="12" font-weight="700" fill="${NEUTRAL_GREY}" letter-spacing="2">↓ STRATEGIC IMPORTANCE</text>
    <text x="${padLeft + innerW / 2}" y="${H - 30}" text-anchor="middle" font-size="12" font-weight="700" fill="${NEUTRAL_GREY}" letter-spacing="2">CURRENT MATURITY →</text>
  `;

  // Quadrant action-zone labels (subtle overlays).
  const actionLabels = `
    <text x="${padLeft + colW * 1}" y="${padTop + rowH * 0.5 + 4}" text-anchor="middle" font-size="9" fill="#DC2626" font-weight="700" letter-spacing="2" opacity="0.55">PRIORITY LIFT</text>
    <text x="${padLeft + colW * 4.5}" y="${padTop + rowH * 0.5 + 4}" text-anchor="middle" font-size="9" fill="#059669" font-weight="700" letter-spacing="2" opacity="0.55">SUSTAIN</text>
    <text x="${padLeft + colW * 4.5}" y="${padTop + rowH * 3.5 + 4}" text-anchor="middle" font-size="9" fill="#D97706" font-weight="700" letter-spacing="2" opacity="0.55">REASSESS</text>
  `;

  // Sub-caption (intensity legend).
  const legend = `
    <text x="${padLeft + innerW - 4}" y="${padTop + innerH + 28}" text-anchor="end" font-size="10" fill="${NEUTRAL_GREY}">Cell tint depth = capability count</text>
  `;

  const body = `${cellParts.join("")}${colHeaders.join("")}${rowHeaders.join("")}${axisTitles}${actionLabels}${legend}`;
  const svg = chartFrame({
    width: W,
    height: H,
    title: "Strategic Importance × Current Maturity",
    brandHex: opts.brandHex,
    body,
  });

  return svgToDocxImage({
    svg,
    displayWidthPx: 640,
    displayHeightPx: 380,
    renderWidth: W,
  });
  // suppress unused
  void brandRef;
}
