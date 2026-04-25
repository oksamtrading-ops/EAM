import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * StatTile — the hero KPI building block. Two layout modes:
 *   - layout="hero" — full-width 3-col grid: label+number+verdict /
 *     sparkline / components. Used once per page (the dashboard
 *     Engagement Health card).
 *   - layout="card" — vertical stack inside a smaller card. Used
 *     in repeating contexts (Agent activity card, etc.).
 *
 * Tabular numerals + display tracking on `primary` are the visual
 * signature. Pass `primary` as a string so the caller controls
 * formatting (e.g. "$184.21", "82", "12.4k").
 */

type Tone = "success" | "warn" | "danger" | "info" | "auth" | "ai" | "neutral";

const toneText: Record<Tone, string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
  info: "text-blue-600 dark:text-blue-400",
  auth: "text-violet-600 dark:text-violet-400",
  ai: "text-[var(--ai)]",
  neutral: "text-muted-foreground",
};

type Delta = {
  value: string;
  direction: "up" | "down" | "flat";
  /**
   * "up" is rendered with success tone by default. Set
   * `goodDirection: "down"` for metrics where lower is better
   * (cost, latency).
   */
  goodDirection?: "up" | "down";
};

type Verdict = {
  text: string;
  tone: Tone;
};

type ComponentRow = {
  label: string;
  value: number | string;
  tone?: Tone;
};

type PrimarySize = "sm" | "md" | "xl" | "hero";

const primarySizeClass: Record<PrimarySize, string> = {
  sm: "text-2xl",
  md: "text-3xl",
  xl: "text-5xl",
  hero: "text-7xl",
};

type StatTileProps = {
  label: string;
  /** Optional eyebrow icon shown before the label. */
  eyebrow?: LucideIcon;
  primary: string;
  primarySize?: PrimarySize;
  delta?: Delta;
  verdict?: Verdict;
  body?: React.ReactNode;
  sparkline?: React.ReactNode;
  components?: ComponentRow[];
  layout?: "hero" | "card";
  className?: string;
};

function deltaTone(delta: Delta): Tone {
  if (delta.direction === "flat") return "neutral";
  const good = delta.goodDirection ?? "up";
  return delta.direction === good ? "success" : "warn";
}

function DeltaPill({ delta }: { delta: Delta }) {
  const tone = deltaTone(delta);
  const Icon =
    delta.direction === "up"
      ? ArrowUp
      : delta.direction === "down"
        ? ArrowDown
        : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[11px] font-mono font-medium",
        toneText[tone]
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {delta.value}
    </span>
  );
}

export function StatTile({
  label,
  eyebrow: Eyebrow,
  primary,
  primarySize = "xl",
  delta,
  verdict,
  body,
  sparkline,
  components,
  layout = "card",
  className,
}: StatTileProps) {
  const Number = (
    <span
      className={cn(
        "font-bold leading-none tracking-tight tabular-nums",
        primarySizeClass[primarySize],
        primarySize === "hero" && "tracking-[-0.035em]"
      )}
    >
      {primary}
    </span>
  );

  if (layout === "hero") {
    return (
      <div
        data-slot="stat-tile-hero"
        className={cn("grid grid-cols-1 lg:grid-cols-12 gap-6 items-end", className)}
      >
        {/* Left column — label, number, verdict, body */}
        <div className="lg:col-span-4 min-w-0">
          <div
            className={cn(
              "flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest",
              toneText.ai
            )}
          >
            {Eyebrow && <Eyebrow className="h-3 w-3" aria-hidden="true" />}
            {label}
          </div>
          <div className="mt-2 flex items-baseline gap-3 flex-wrap">
            {Number}
            {(verdict || delta) && (
              <div className="pb-1.5">
                {verdict && (
                  <div
                    className={cn(
                      "text-sm font-semibold flex items-center gap-1",
                      toneText[verdict.tone]
                    )}
                  >
                    {verdict.text}
                  </div>
                )}
                {delta && (
                  <div className="mt-0.5">
                    <DeltaPill delta={delta} />
                  </div>
                )}
              </div>
            )}
          </div>
          {body && (
            <div className="mt-3 text-sm text-muted-foreground max-w-md leading-relaxed">
              {body}
            </div>
          )}
        </div>

        {/* Center column — sparkline */}
        {sparkline && (
          <div className="lg:col-span-5 min-w-0">{sparkline}</div>
        )}

        {/* Right column — components */}
        {components && components.length > 0 && (
          <div className="lg:col-span-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Components
            </div>
            <div className="space-y-1.5">
              {components.map((c) => (
                <div
                  key={c.label}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-muted-foreground">{c.label}</span>
                  <span
                    className={cn(
                      "font-mono tabular-nums",
                      toneText[c.tone ?? "neutral"]
                    )}
                  >
                    {c.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // layout = "card"
  return (
    <div data-slot="stat-tile-card" className={cn("min-w-0", className)}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {Eyebrow && <Eyebrow className="h-3 w-3" aria-hidden="true" />}
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2 flex-wrap">
        {Number}
        {delta && <DeltaPill delta={delta} />}
      </div>
      {body && (
        <div className="mt-1 text-[11px] text-muted-foreground">{body}</div>
      )}
      {sparkline && <div className="mt-2">{sparkline}</div>}
    </div>
  );
}
