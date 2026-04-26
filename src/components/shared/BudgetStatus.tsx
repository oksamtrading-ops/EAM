import { AlertTriangle } from "lucide-react";
import { Callout, CalloutBody } from "@/components/ui/callout";
import { cn } from "@/lib/utils";

type Props = {
  capUsd: number | null;
  spentUsd: number;
  /** "strip" — full-width thin row used above page sections.
   *  "inline" — compact row used inside settings next to the input. */
  variant?: "strip" | "inline";
  className?: string;
};

/**
 * Surfaces the per-workspace Anthropic budget (week-1 hardening
 * `monthlyAnthropicBudgetUsd`) with a tone-shifted progress bar.
 *
 * Tone curve:
 *   < 70%  — `var(--ai)` blue
 *   70–89% — amber + ⚠ icon
 *   ≥ 90%  — red + ⚠ icon
 *   ≥ 100% — red + danger Callout ("agents blocked")
 *
 * Solid fill, no gradient (matches PortfolioCostCard pattern). No
 * pulse/animation — pulse reads consumer-app, mismatched with the
 * platform's direct voice.
 *
 * Empty states:
 *   - `capUsd === null` on `strip`  → renders nothing (collapses)
 *   - `capUsd === null` on `inline` → renders muted "no cap" hint
 */
export function BudgetStatus({
  capUsd,
  spentUsd,
  variant = "strip",
  className,
}: Props) {
  if (capUsd === null) {
    if (variant === "strip") return null;
    return (
      <p className={cn("text-[11px] text-muted-foreground", className)}>
        No cap set — agents run unlimited.
      </p>
    );
  }

  const pct = capUsd > 0 ? Math.min(999, (spentUsd / capUsd) * 100) : 0;
  const exceeded = pct >= 100;
  const danger = pct >= 90;
  const warn = !danger && pct >= 70;

  const fillClass = exceeded
    ? "bg-red-600"
    : danger
      ? "bg-red-500"
      : warn
        ? "bg-amber-500"
        : "bg-[var(--ai)]/70";

  const fillWidth = `${Math.min(100, pct)}%`;
  const pctLabel = `${pct < 1 ? pct.toFixed(1) : Math.round(pct)}%`;

  if (variant === "strip") {
    return (
      <div className={cn("space-y-1.5", className)}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
            {(warn || danger) && (
              <AlertTriangle
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  danger ? "text-red-600" : "text-amber-600"
                )}
                aria-hidden="true"
              />
            )}
            <span className="uppercase tracking-wider">Monthly AI budget</span>
          </div>
          <div className="text-[11px] font-mono tabular-nums text-foreground/80">
            <span className="font-semibold text-foreground">
              {formatUsd(spentUsd)}
            </span>
            <span className="text-muted-foreground"> / {formatUsd(capUsd)}</span>
            <span className="text-muted-foreground/70"> · {pctLabel}</span>
          </div>
        </div>
        <div
          className="relative h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800/60 overflow-hidden"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={capUsd}
          aria-valuenow={spentUsd}
          aria-label={`Monthly AI spend: ${formatUsd(spentUsd)} of ${formatUsd(capUsd)}`}
        >
          <div
            className={cn("absolute inset-y-0 left-0 rounded-full", fillClass)}
            style={{ width: fillWidth }}
          />
        </div>
        {exceeded && (
          <Callout tone="danger" density="compact" icon={AlertTriangle}>
            <CalloutBody>
              Budget exceeded — agents blocked. Raise the cap or wait for the
              rolling 30-day window to advance.
            </CalloutBody>
          </Callout>
        )}
      </div>
    );
  }

  // inline variant
  return (
    <div className={cn("space-y-1", className)}>
      <div
        className="relative h-1 rounded-full bg-zinc-100 dark:bg-zinc-800/60 overflow-hidden w-32"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={capUsd}
        aria-valuenow={spentUsd}
        aria-label={`Monthly AI spend: ${formatUsd(spentUsd)} of ${formatUsd(capUsd)}`}
      >
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full", fillClass)}
          style={{ width: fillWidth }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground tabular-nums">
        {formatUsd(spentUsd)} of {formatUsd(capUsd)} ({pctLabel}) used
      </p>
    </div>
  );
}

function formatUsd(n: number): string {
  if (n === 0) return "$0";
  if (n < 1) return `$${n.toFixed(2)}`;
  if (n < 100) return `$${n.toFixed(2)}`;
  return `$${Math.round(n).toLocaleString()}`;
}
