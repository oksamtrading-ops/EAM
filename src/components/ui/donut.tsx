import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Donut — pure-SVG donut chart. No recharts dep, themeable via
 * CSS-color slice colors (supports `var(--ai)`, hex, rgb).
 *
 * Use cases:
 *   - Portfolio cost share-of-spend by domain (PortfolioCostCard)
 *   - Future: agent cost share by run kind, etc.
 *
 * Behavior notes:
 *   - 0 or 1 visible slices renders a single full ring (handles the
 *     degenerate `start === end` case that breaks SVG arc paths).
 *   - Slices touch — no padding-angle gap. Keeps the ring visually
 *     continuous and avoids confusing gaps when one slice dominates.
 *   - `centerLabel` is rendered absolute-center inside a wrapping
 *     relative div so callers can pass arbitrary JSX (totals,
 *     percentages, icons).
 */

export type DonutSlice = {
  /** Identifier for keys + aria. */
  id: string;
  /** Numeric weight; relative magnitudes drive arc lengths. */
  value: number;
  /** Any CSS color string. */
  color: string;
  /** Accessible label for the slice (used as `<title>`). */
  label?: string;
};

type DonutProps = {
  slices: DonutSlice[];
  /** Square SVG side in px. Default 120. */
  size?: number;
  /** Ring thickness in px. Smaller = bigger hole. Default 18. */
  thickness?: number;
  /** Optional JSX rendered absolute-center, e.g. a total. */
  centerLabel?: React.ReactNode;
  ariaLabel?: string;
  className?: string;
};

const VIEWBOX = 100;
const CENTER = VIEWBOX / 2;

/** Convert (start, end) angles in radians → SVG arc path centered
 *  on the donut origin. Angles measured clockwise from 12 o'clock. */
function arcPath(
  startAngle: number,
  endAngle: number,
  outerRadius: number,
  innerRadius: number
): string {
  const sweep = endAngle - startAngle;
  // Start-angle 0 = 12 o'clock; convert to standard SVG (3 o'clock).
  const a1 = startAngle - Math.PI / 2;
  const a2 = endAngle - Math.PI / 2;

  const x1 = CENTER + outerRadius * Math.cos(a1);
  const y1 = CENTER + outerRadius * Math.sin(a1);
  const x2 = CENTER + outerRadius * Math.cos(a2);
  const y2 = CENTER + outerRadius * Math.sin(a2);
  const x3 = CENTER + innerRadius * Math.cos(a2);
  const y3 = CENTER + innerRadius * Math.sin(a2);
  const x4 = CENTER + innerRadius * Math.cos(a1);
  const y4 = CENTER + innerRadius * Math.sin(a1);

  const largeArc = sweep > Math.PI ? 1 : 0;

  return [
    `M ${x1.toFixed(3)} ${y1.toFixed(3)}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2.toFixed(3)} ${y2.toFixed(3)}`,
    `L ${x3.toFixed(3)} ${y3.toFixed(3)}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4.toFixed(3)} ${y4.toFixed(3)}`,
    "Z",
  ].join(" ");
}

export function Donut({
  slices,
  size = 120,
  thickness = 18,
  centerLabel,
  ariaLabel,
  className,
}: DonutProps) {
  // Filter zero/negative slices and dedupe by id.
  const positive = slices.filter((s) => s.value > 0);
  const total = positive.reduce((sum, s) => sum + s.value, 0);

  const outerRadius = CENTER - 1; // 1px breathing room inside viewBox
  const innerRadius = Math.max(outerRadius - thickness * (CENTER / size), 1);

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        width={size}
        height={size}
        role={ariaLabel ? "img" : undefined}
        aria-label={ariaLabel}
      >
        {total <= 0 ? (
          // Empty placeholder ring — neutral, prevents layout jump.
          <circle
            cx={CENTER}
            cy={CENTER}
            r={(outerRadius + innerRadius) / 2}
            fill="none"
            strokeWidth={outerRadius - innerRadius}
            stroke="currentColor"
            opacity={0.08}
          />
        ) : positive.length === 1 ? (
          // Single full-circle slice — avoids degenerate arc path.
          <circle
            cx={CENTER}
            cy={CENTER}
            r={(outerRadius + innerRadius) / 2}
            fill="none"
            strokeWidth={outerRadius - innerRadius}
            stroke={positive[0]!.color}
          >
            {positive[0]!.label && <title>{positive[0]!.label}</title>}
          </circle>
        ) : (
          (() => {
            let cumulative = 0;
            return positive.map((slice) => {
              const start = (cumulative / total) * 2 * Math.PI;
              cumulative += slice.value;
              const end = (cumulative / total) * 2 * Math.PI;
              const d = arcPath(start, end, outerRadius, innerRadius);
              return (
                <path key={slice.id} d={d} fill={slice.color}>
                  {slice.label && <title>{slice.label}</title>}
                </path>
              );
            });
          })()
        )}
      </svg>
      {centerLabel != null && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {centerLabel}
        </div>
      )}
    </div>
  );
}
