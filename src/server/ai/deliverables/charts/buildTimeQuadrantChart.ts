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
import type { Paragraph } from "docx";

export type QuadrantPoint = {
  /** Business value: 0 (low) to 100 (critical). */
  x: number;
  /** Technical health: 0 (poor) to 100 (excellent). */
  y: number;
  /** Bubble label (app name). */
  label: string;
  /** Bubble area driver (annual cost). */
  size: number;
  /** Disposition for color: ELIMINATE/MIGRATE/INVEST/TOLERATE. */
  disposition: "ELIMINATE" | "MIGRATE" | "INVEST" | "TOLERATE";
};

/** TIME 2×2 quadrant scatter chart. Bubble area scales with annual
 *  cost (sqrt-scaled for perceptual accuracy). Quadrants tinted by
 *  disposition tone. Labels placed beside bubbles where space
 *  permits; collisions get truncated to "..." with a numeric index
 *  in a legend (deferred — for now labels show; small overlap is
 *  acceptable in v1).
 *
 *  Returns a docx Paragraph ready to push into the doc.
 */
export async function buildTimeQuadrantChart(opts: {
  points: QuadrantPoint[];
  brandHex: string;
}): Promise<Paragraph> {
  const W = 1600;
  const H = 980;
  const padLeft = 120;
  const padRight = 80;
  const padTop = 80;
  const padBottom = 80;
  const innerW = W - padLeft - padRight;
  const innerH = H - padTop - padBottom;

  const xScale = scale([0, 100], [padLeft, padLeft + innerW]);
  const yScale = scale([0, 100], [padTop + innerH, padTop]); // inverted

  // Bubble radius: sqrt-scale of cost. Min 14, max 64 px.
  const sizes = opts.points.map((p) => p.size);
  const maxSize = Math.max(...sizes, 1);
  const minSize = Math.min(...sizes, 0);
  const rScale = (n: number) => {
    const t = maxSize === minSize ? 0.5 : (n - minSize) / (maxSize - minSize);
    return 14 + Math.sqrt(t) * 50;
  };

  // Quadrant tints — light fill behind each cell. yScale is
  // inverted (high y in domain = top of screen), so:
  //   y in [50,100] = Good TH (top half of screen)
  //   y in [0,50]   = Poor TH (bottom half of screen)
  // TIME framework placement:
  //   High BV / Good TH  → INVEST or TOLERATE (strategic + healthy)
  //   High BV / Poor TH  → MIGRATE (the migration backlog)
  //   Low BV  / Good TH  → TOLERATE (cheap to keep)
  //   Low BV  / Poor TH  → ELIMINATE (kill it)
  const dispoTone = {
    ELIMINATE: "danger" as const,
    MIGRATE: "warn" as const,
    INVEST: "info" as const,
    TOLERATE: "success" as const,
  };
  const quadrants = [
    {
      x: 50,
      y: 50,
      w: 50,
      h: 50,
      tone: "info" as const,
      label: "INVEST · TOLERATE",
      labelX: padLeft + (innerW / 4) * 3,
      labelY: padTop + 30,
    }, // High BV / Good TH (top-right)
    {
      x: 50,
      y: 0,
      w: 50,
      h: 50,
      tone: "warn" as const,
      label: "MIGRATE",
      labelX: padLeft + (innerW / 4) * 3,
      labelY: padTop + innerH / 2 + 30,
    }, // High BV / Poor TH (bottom-right)
    {
      x: 0,
      y: 50,
      w: 50,
      h: 50,
      tone: "success" as const,
      label: "TOLERATE",
      labelX: padLeft + innerW / 4,
      labelY: padTop + 30,
    }, // Low BV / Good TH (top-left)
    {
      x: 0,
      y: 0,
      w: 50,
      h: 50,
      tone: "danger" as const,
      label: "ELIMINATE",
      labelX: padLeft + innerW / 4,
      labelY: padTop + innerH / 2 + 30,
    }, // Low BV / Poor TH (bottom-left)
  ];

  // Render quadrant tints
  const quadParts = quadrants
    .map((q) => {
      const x0 = xScale(q.x);
      const y0 = yScale(q.y + q.h);
      const x1 = xScale(q.x + q.w);
      const y1 = yScale(q.y);
      const fill = tint(toneHex(q.tone), 0.92);
      return `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="${fill}"/>`;
    })
    .join("");

  // Quadrant labels (small, top corner of each cell)
  const quadLabels = quadrants
    .map(
      (q) =>
        `<text x="${q.labelX}" y="${q.labelY}" text-anchor="middle" font-size="14" font-weight="700" fill="${toneHex(q.tone)}" letter-spacing="2">${esc(q.label)}</text>`
    )
    .join("");

  // Axes
  const midX = xScale(50);
  const midY = yScale(50);
  const axes = `
    <line x1="${padLeft}" y1="${padTop + innerH}" x2="${padLeft + innerW}" y2="${padTop + innerH}" stroke="${NEUTRAL_GREY}" stroke-width="1.5"/>
    <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${padTop + innerH}" stroke="${NEUTRAL_GREY}" stroke-width="1.5"/>
    <line x1="${midX}" y1="${padTop}" x2="${midX}" y2="${padTop + innerH}" stroke="${NEUTRAL_LIGHT}" stroke-width="1" stroke-dasharray="4 4"/>
    <line x1="${padLeft}" y1="${midY}" x2="${padLeft + innerW}" y2="${midY}" stroke="${NEUTRAL_LIGHT}" stroke-width="1" stroke-dasharray="4 4"/>
  `;

  // Axis labels
  const axisLabels = `
    <text x="${padLeft + innerW / 2}" y="${H - 25}" text-anchor="middle" font-size="14" font-weight="600" fill="${NEUTRAL_GREY}">BUSINESS VALUE →</text>
    <text x="${padLeft - 20}" y="${padTop - 20}" text-anchor="start" font-size="14" font-weight="600" fill="${NEUTRAL_GREY}">↑ TECHNICAL HEALTH</text>
    <text x="${padLeft - 30}" y="${padTop + innerH + 30}" text-anchor="end" font-size="11" fill="${NEUTRAL_GREY}">Poor</text>
    <text x="${padLeft - 30}" y="${padTop + 10}" text-anchor="end" font-size="11" fill="${NEUTRAL_GREY}">Good</text>
    <text x="${padLeft + 5}" y="${padTop + innerH + 25}" text-anchor="start" font-size="11" fill="${NEUTRAL_GREY}">Low</text>
    <text x="${padLeft + innerW - 5}" y="${padTop + innerH + 25}" text-anchor="end" font-size="11" fill="${NEUTRAL_GREY}">Critical</text>
  `;

  // Bubbles — render circles first so labels overlay on top.
  const circleParts = opts.points
    .map((p) => {
      const cx = xScale(p.x);
      const cy = yScale(p.y);
      const r = rScale(p.size);
      const fill = toneHex(dispoTone[p.disposition]);
      const stroke = brandRef(opts.brandHex);
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" fill-opacity="0.55" stroke="${stroke}" stroke-width="1.5"/>`;
    })
    .join("");

  // Labels — group apps by (x, y) bucket so apps at the same
  // BV/TH coordinate get stacked vertically with a leader line
  // pointing to the cluster center. Eliminates the unreadable
  // overlap when Halloran SDV / CATIA / Apriso etc. all sit in
  // (CRITICAL, GOOD).
  type Cluster = {
    cx: number;
    cy: number;
    r: number;
    apps: Array<{ label: string; size: number }>;
  };
  const clusterMap = new Map<string, Cluster>();
  for (const p of opts.points) {
    // 5-unit buckets in BV/TH score-space — apps within ~5pts of
    // the same coordinate get clustered.
    const xKey = Math.round(p.x / 5);
    const yKey = Math.round(p.y / 5);
    const key = `${xKey}:${yKey}`;
    const existing = clusterMap.get(key);
    if (existing) {
      // Largest bubble in the cluster anchors the leader line.
      if (rScale(p.size) > existing.r) {
        existing.cx = xScale(p.x);
        existing.cy = yScale(p.y);
        existing.r = rScale(p.size);
      }
      existing.apps.push({ label: p.label, size: p.size });
    } else {
      clusterMap.set(key, {
        cx: xScale(p.x),
        cy: yScale(p.y),
        r: rScale(p.size),
        apps: [{ label: p.label, size: p.size }],
      });
    }
  }

  const labelParts: string[] = [];
  for (const cluster of clusterMap.values()) {
    // Sort biggest first so the most important app reads at the top
    cluster.apps.sort((a, b) => b.size - a.size);
    // Stack labels below the cluster (or above if near bottom)
    const placeBelow = cluster.cy + cluster.r + 14 + cluster.apps.length * 14 < padTop + innerH;
    const lineHeight = 13;
    const baseLabelY = placeBelow
      ? cluster.cy + cluster.r + 14
      : cluster.cy - cluster.r - 6 - (cluster.apps.length - 1) * lineHeight;
    // Leader line from bubble edge to first label (only when stacking)
    if (cluster.apps.length > 1) {
      const leaderY = placeBelow ? cluster.cy + cluster.r : cluster.cy - cluster.r;
      const leaderEnd = placeBelow ? baseLabelY - 4 : baseLabelY + cluster.apps.length * lineHeight + 2;
      labelParts.push(
        `<line x1="${cluster.cx}" y1="${leaderY}" x2="${cluster.cx}" y2="${leaderEnd}" stroke="#9CA3AF" stroke-width="0.8" stroke-dasharray="2 2"/>`
      );
    }
    cluster.apps.forEach((app, i) => {
      const label = app.label.length > 28 ? app.label.slice(0, 26) + "…" : app.label;
      const labelY = baseLabelY + i * lineHeight;
      labelParts.push(
        `<text x="${cluster.cx}" y="${labelY}" text-anchor="middle" font-size="10.5" font-weight="500" fill="#1F2937">${esc(label)}</text>`
      );
    });
  }
  const bubbleParts = circleParts + labelParts.join("");

  // Legend bottom-right: bubble size = annual cost
  const legend = `
    <g transform="translate(${padLeft + innerW - 220}, ${padTop + 10})">
      <text x="0" y="0" font-size="11" font-weight="600" fill="${NEUTRAL_GREY}">BUBBLE SIZE = ANNUAL COST</text>
    </g>
  `;

  const body = `${quadParts}${quadLabels}${axes}${axisLabels}${bubbleParts}${legend}`;
  const svg = chartFrame({
    width: W,
    height: H,
    title: "TIME 2×2 — Business Value × Technical Health",
    brandHex: opts.brandHex,
    body,
  });

  return svgToDocxImage({
    svg,
    displayWidthPx: 620,
    displayHeightPx: 380,
    renderWidth: W,
  });
}

/** Map a BV enum to the 0–100 x-axis. */
export function bvToScore(bv: string | null): number {
  switch (bv) {
    case "CRITICAL":
      return 92;
    case "HIGH":
      return 72;
    case "MEDIUM":
      return 45;
    case "LOW":
      return 22;
    case "BV_UNKNOWN":
    default:
      return 30;
  }
}

/** Map a TH enum to the 0–100 y-axis. */
export function thToScore(th: string | null): number {
  switch (th) {
    case "EXCELLENT":
      return 92;
    case "GOOD":
      return 72;
    case "FAIR":
      return 50;
    case "POOR":
      return 28;
    case "TH_CRITICAL":
      return 10;
    default:
      return 30;
  }
}
