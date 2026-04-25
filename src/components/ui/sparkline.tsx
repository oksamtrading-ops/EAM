import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Sparkline — pure-SVG mini-chart. Three variants:
 *   - line: a single stroke
 *   - trail: stroke + gradient fill (the hero variant from the mockup)
 *   - bars: tiny vertical bars
 *
 * Hand-rolled instead of pulling recharts so we keep it tiny and
 * trivially themeable — `color` accepts a CSS variable like
 * `var(--ai)`. Inputs of 0 or 1 data points render an empty SVG.
 */

type SparklineVariant = "line" | "trail" | "bars";

type SparklineProps = {
  data: number[];
  variant?: SparklineVariant;
  /** Pixel height of the SVG. Width is responsive (100%). */
  height?: number;
  /** Stroke + fill base color. CSS color string. */
  color?: string;
  /** Render a small dot on the last data point. */
  endDot?: boolean;
  /** Render a pulsing ring around the end dot (live indicator). */
  endDotPulse?: boolean;
  /** Pad the SVG so the stroke isn't clipped at edges. Default 2. */
  padding?: number;
  className?: string;
  ariaLabel?: string;
};

const VIEWBOX_WIDTH = 100; // virtual width — SVG is responsive

function buildPath(values: number[], padding: number, height: number): {
  linePath: string;
  fillPath: string;
  lastX: number;
  lastY: number;
} {
  const n = values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const innerW = VIEWBOX_WIDTH - padding * 2;
  const innerH = height - padding * 2;

  const points: Array<[number, number]> = values.map((v, i) => {
    const x = padding + (i / (n - 1 || 1)) * innerW;
    // Invert y because SVG origin is top-left.
    const y = padding + innerH - ((v - min) / range) * innerH;
    return [x, y];
  });

  const linePath = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");

  // Fill closes back to baseline along the bottom.
  const last = points[points.length - 1]!;
  const first = points[0]!;
  const fillPath = `${linePath} L${last[0].toFixed(2)},${height} L${first[0].toFixed(2)},${height} Z`;

  return { linePath, fillPath, lastX: last[0], lastY: last[1] };
}

export function Sparkline({
  data,
  variant = "line",
  height = 32,
  color = "var(--ai)",
  endDot = false,
  endDotPulse = false,
  padding = 2,
  className,
  ariaLabel,
}: SparklineProps) {
  // Stable gradient id per render so multiple sparklines on a page
  // don't collide in shared <defs>.
  const gradId = React.useId();

  if (!data || data.length < 2) {
    return (
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${height}`}
        height={height}
        preserveAspectRatio="none"
        className={cn("w-full", className)}
        aria-hidden={!ariaLabel}
        aria-label={ariaLabel}
      />
    );
  }

  if (variant === "bars") {
    const min = Math.min(...data, 0);
    const max = Math.max(...data, 0);
    const range = max - min || 1;
    const innerW = VIEWBOX_WIDTH - padding * 2;
    const innerH = height - padding * 2;
    const slot = innerW / data.length;
    const barW = Math.max(slot * 0.6, 1);
    return (
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${height}`}
        height={height}
        preserveAspectRatio="none"
        className={cn("w-full overflow-visible", className)}
        aria-label={ariaLabel}
        role={ariaLabel ? "img" : undefined}
      >
        {data.map((v, i) => {
          const h = ((v - min) / range) * innerH;
          const x = padding + slot * i + (slot - barW) / 2;
          const y = padding + innerH - h;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barW}
              height={Math.max(h, 1)}
              rx={Math.min(barW * 0.3, 1.5)}
              fill={color}
              opacity={i === data.length - 1 ? 1 : 0.45}
            />
          );
        })}
      </svg>
    );
  }

  const { linePath, fillPath, lastX, lastY } = buildPath(data, padding, height);

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${height}`}
      height={height}
      preserveAspectRatio="none"
      className={cn("w-full overflow-visible", className)}
      aria-label={ariaLabel}
      role={ariaLabel ? "img" : undefined}
    >
      {variant === "trail" && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {variant === "trail" && (
        <path d={fillPath} fill={`url(#${gradId})`} />
      )}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        // The viewBox is 100×H; we scale non-uniformly so cap thickness
        // stays consistent regardless of width.
        vectorEffect="non-scaling-stroke"
      />
      {endDot && (
        <>
          {endDotPulse && (
            <circle
              cx={lastX}
              cy={lastY}
              r={3.5}
              fill={color}
              opacity={0.25}
            >
              <animate
                attributeName="r"
                from="2"
                to="5"
                dur="1.6s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                from="0.4"
                to="0"
                dur="1.6s"
                repeatCount="indefinite"
              />
            </circle>
          )}
          <circle cx={lastX} cy={lastY} r={1.6} fill={color} />
        </>
      )}
    </svg>
  );
}
