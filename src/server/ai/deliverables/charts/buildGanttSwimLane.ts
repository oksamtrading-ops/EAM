import "server-only";
import {
  brandRef,
  chartFrame,
  esc,
  NEUTRAL_GREY,
  NEUTRAL_LIGHT,
  toneHex,
  tint,
} from "./_svg";
import { svgToDocxImage } from "./_renderer";
import { INITIATIVE_CATEGORY_TONE, INITIATIVE_RAG_TONE } from "../tokens";
import type { Paragraph } from "docx";

export type GanttInitiative = {
  id: string;
  name: string;
  category: string;
  ragStatus: string;
  /** Position within the wave row (0-based) for stacking. */
  laneIndex?: number;
};

export type GanttDependencyEdge = {
  fromId: string;
  toId: string;
};

/**
 * Architecture Roadmap hero chart — 3-row swim-lane (NOW / NEXT /
 * LATER) with initiative blocks colored by category and a thin
 * RAG-status edge stripe. Dependency arrows traced between blocks
 * when both ends are present.
 *
 * Reuses existing chartFrame + tint + toneHex utilities. Inter
 * font + resvg-wasm pipeline via svgToDocxImage. No new
 * infrastructure introduced.
 */
export async function buildGanttSwimLane(opts: {
  waves: {
    NOW: GanttInitiative[];
    NEXT: GanttInitiative[];
    LATER: GanttInitiative[];
  };
  dependencies: GanttDependencyEdge[];
  brandHex: string;
}): Promise<Paragraph> {
  const W = 1600;
  const H = 900;
  const titleBarH = 90;
  const top = titleBarH + 60;
  const bottom = H - 80;
  const left = 180;
  const right = W - 60;
  const innerW = right - left;
  const rowH = (bottom - top) / 3;

  const waves: Array<{ key: "NOW" | "NEXT" | "LATER"; label: string; subtitle: string; items: GanttInitiative[] }> = [
    { key: "NOW", label: "NOW", subtitle: "&lt;12 months", items: opts.waves.NOW },
    { key: "NEXT", label: "NEXT", subtitle: "12–24 months", items: opts.waves.NEXT },
    { key: "LATER", label: "LATER", subtitle: "24–36 months", items: opts.waves.LATER },
  ];

  // Lane (row) backgrounds — alternating fill, brand-tinted left
  // border indicating wave urgency.
  const rowBackgrounds = waves
    .map((wave, i) => {
      const y = top + i * rowH;
      const bandFill = i % 2 === 0 ? "#FFFFFF" : "#FAFAFA";
      const tone = wave.key === "NOW" ? "danger" : wave.key === "NEXT" ? "warn" : "info";
      const accent = toneHex(tone);
      return `
        <rect x="${left - 130}" y="${y}" width="${right - left + 130}" height="${rowH}" fill="${bandFill}"/>
        <rect x="${left - 130}" y="${y}" width="6" height="${rowH}" fill="${accent}"/>
        <text x="${left - 110}" y="${y + 36}" font-size="22" font-weight="800" fill="${accent}">${wave.label}</text>
        <text x="${left - 110}" y="${y + 60}" font-size="11" fill="${NEUTRAL_GREY}">${wave.subtitle}</text>
        <text x="${left - 110}" y="${y + 80}" font-size="11" font-weight="700" fill="#1F2937">${wave.items.length} init${wave.items.length === 1 ? "ative" : "iatives"}</text>
      `;
    })
    .join("");

  // Initiative blocks — laid out left-to-right within each row,
  // wrapping to a 2nd or 3rd internal lane when row gets crowded.
  type Placed = { initiative: GanttInitiative; x: number; y: number; w: number; h: number };
  const placedById = new Map<string, Placed>();
  const blockMargin = 8;
  const minBlockW = 130;
  const blockH = 44;

  const blocks = waves
    .map((wave, rowIdx) => {
      const rowY = top + rowIdx * rowH;
      const lanesPerRow = Math.max(2, Math.ceil(wave.items.length / 4));
      const itemsPerLane = Math.ceil(wave.items.length / lanesPerRow);
      const blockW = Math.max(
        minBlockW,
        (innerW - blockMargin * (itemsPerLane + 1)) / Math.max(itemsPerLane, 1)
      );
      const usableLaneH = rowH - 24;
      const laneH = usableLaneH / lanesPerRow;

      return wave.items
        .map((init, idx) => {
          const lane = Math.floor(idx / itemsPerLane);
          const col = idx % itemsPerLane;
          const x = left + blockMargin + col * (blockW + blockMargin);
          const y = rowY + 16 + lane * laneH;
          const w = blockW;
          const h = blockH;

          const categoryTone =
            INITIATIVE_CATEGORY_TONE[init.category] ?? "info";
          const fill = toneHex(categoryTone);
          const fillTint = tint(fill, 0.65);
          const ragTone = INITIATIVE_RAG_TONE[init.ragStatus] ?? "success";
          const ragColor = toneHex(ragTone);

          placedById.set(init.id, { initiative: init, x, y, w, h });

          // Truncate long names. Keep ≤22 chars + ellipsis.
          const name = init.name.length > 22 ? init.name.slice(0, 21) + "…" : init.name;
          const cat = init.category.replace(/_/g, " ");
          const catShort = cat.length > 14 ? cat.slice(0, 13) + "…" : cat;

          return `
            <g>
              <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fillTint}" stroke="${fill}" stroke-width="1.5" rx="6"/>
              <rect x="${x}" y="${y}" width="4" height="${h}" fill="${ragColor}" rx="2"/>
              <text x="${x + 14}" y="${y + 19}" font-size="11" font-weight="700" fill="#1F2937">${esc(name)}</text>
              <text x="${x + 14}" y="${y + 35}" font-size="9" fill="${NEUTRAL_GREY}">${esc(catShort)}</text>
            </g>
          `;
        })
        .join("");
    })
    .join("");

  // Dependency arrows — trace between placed blocks. Skip when
  // either end isn't placed (cross-wave dependencies still trace;
  // intra-wave dependencies trace too — both communicate
  // sequencing risk).
  const arrows = opts.dependencies
    .map((dep) => {
      const a = placedById.get(dep.fromId);
      const b = placedById.get(dep.toId);
      if (!a || !b) return "";
      // Arrow from blocking (a, "must finish first") to dependent (b)
      const ax = a.x + a.w;
      const ay = a.y + a.h / 2;
      const bx = b.x;
      const by = b.y + b.h / 2;
      // Skip same-block (self-loop) or trivial overlap
      if (Math.abs(ax - bx) < 8 && Math.abs(ay - by) < 8) return "";
      // Curved path control
      const cx = (ax + bx) / 2;
      return `
        <path d="M ${ax} ${ay} C ${cx} ${ay}, ${cx} ${by}, ${bx} ${by}"
              fill="none" stroke="${NEUTRAL_GREY}" stroke-width="1.2"
              stroke-dasharray="3,3" opacity="0.6" marker-end="url(#arrowhead)"/>
      `;
    })
    .join("");

  // Legend — category color key (compact bottom strip)
  const categoriesPresent = new Set<string>();
  for (const w of [opts.waves.NOW, opts.waves.NEXT, opts.waves.LATER]) {
    for (const i of w) categoriesPresent.add(i.category);
  }
  const legendY = bottom + 20;
  const legend = Array.from(categoriesPresent)
    .slice(0, 7)
    .map((cat, idx) => {
      const tone = INITIATIVE_CATEGORY_TONE[cat] ?? "info";
      const fill = toneHex(tone);
      const x = left + idx * 200;
      return `
        <rect x="${x}" y="${legendY}" width="14" height="14" fill="${tint(fill, 0.65)}" stroke="${fill}" stroke-width="1.2" rx="3"/>
        <text x="${x + 22}" y="${legendY + 12}" font-size="10" fill="#1F2937">${esc(cat.replace(/_/g, " "))}</text>
      `;
    })
    .join("");

  // Defs: arrow marker
  const defs = `
    <defs>
      <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="4"
              orient="auto" markerUnits="strokeWidth">
        <path d="M 0 0 L 8 4 L 0 8 Z" fill="${NEUTRAL_GREY}" opacity="0.6"/>
      </marker>
    </defs>
  `;

  const body = `${defs}${rowBackgrounds}${blocks}${arrows}${legend}`;
  const svg = chartFrame({
    width: W,
    height: H,
    title: "Architecture Roadmap — NOW / NEXT / LATER",
    brandHex: opts.brandHex,
    body,
  });

  return svgToDocxImage({
    svg,
    displayWidthPx: 660,
    displayHeightPx: 380,
    renderWidth: W,
  });
}

void brandRef;
void NEUTRAL_LIGHT;
