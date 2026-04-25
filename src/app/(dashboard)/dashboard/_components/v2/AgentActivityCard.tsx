"use client";

import Link from "next/link";
import { Activity, ArrowUpRight, ArrowDownRight, CalendarClock } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Sparkline } from "@/components/ui/sparkline";
import { formatUsd } from "@/lib/utils/agentPricing";
import { cn } from "@/lib/utils";
import type { DateRangeKey } from "@/lib/contracts/dashboard";
import { dateRangeToSinceDays } from "./dateRangeUtils";

type Props = { dateRange: DateRangeKey };

/**
 * Agent activity card — Stripe-style hero spend with daily area
 * sparkline + top 3 expensive runs + active scheduled-task footer.
 */
export function AgentActivityCard({ dateRange }: Props) {
  const sinceDays = dateRangeToSinceDays(dateRange);
  const summary = trpc.agentRun.costSummary.useQuery({ sinceDays });
  const byDay = trpc.agentRun.costByDay.useQuery({ sinceDays });
  const topRuns = trpc.agentRun.topCostRuns.useQuery({ sinceDays, limit: 3 });
  const scheduled = trpc.scheduledAgentTask.list.useQuery();

  const isLoading = summary.isLoading || byDay.isLoading;
  const totalUsd = summary.data?.totalUsd ?? 0;
  const runCount = summary.data?.runCount ?? 0;
  const tokens =
    (summary.data?.totalTokensIn ?? 0) + (summary.data?.totalTokensOut ?? 0);

  // Day-by-day series for the sparkline. Pad missing days with zero
  // so the visual width stays stable across windows.
  const dayValues = (byDay.data ?? []).map((d) => d.usd);

  const enabledTasks = (scheduled.data ?? []).filter((t) => t.enabled).length;
  const nextTask = (scheduled.data ?? [])
    .filter((t) => t.enabled && t.nextRunAt)
    .sort(
      (a, b) =>
        (a.nextRunAt?.getTime() ?? Infinity) -
        (b.nextRunAt?.getTime() ?? Infinity)
    )[0];

  return (
    <div className="rounded-2xl glass p-5 sm:p-6">
      <header className="mb-4">
        <h2 className="text-base font-semibold tracking-tight flex items-center gap-2">
          <Activity className="h-4 w-4 text-[var(--ai)]" />
          Agent activity
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Last {sinceDays} days
        </p>
      </header>

      {/* Hero spend */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-3xl font-bold tabular-nums tracking-tight">
            {isLoading ? "—" : formatUsd(totalUsd)}
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          {runCount.toLocaleString()} run{runCount === 1 ? "" : "s"} ·{" "}
          {tokens.toLocaleString()} tokens ·{" "}
          {runCount > 0 ? formatUsd(totalUsd / runCount) : "—"} / run
        </div>
      </div>

      {/* Daily spend sparkline */}
      <div className="mb-4">
        {dayValues.length > 1 ? (
          <Sparkline
            data={dayValues}
            variant="trail"
            height={64}
            color="var(--ai)"
            ariaLabel="Daily agent spend"
          />
        ) : (
          <div className="h-16 flex items-center justify-center text-[11px] text-muted-foreground">
            Not enough data for a trend yet
          </div>
        )}
      </div>

      {/* Top runs */}
      <div className="space-y-1.5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
          Top expensive runs
        </div>
        {topRuns.isLoading ? (
          <div className="space-y-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-5 rounded bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : (topRuns.data?.length ?? 0) === 0 ? (
          <div className="text-[11px] text-muted-foreground py-1">
            No runs in this range.
          </div>
        ) : (
          topRuns.data!.map((r) => (
            <Link
              key={r.id}
              href={`/agents/runs/${r.id}`}
              className="flex items-center justify-between text-xs py-1 -mx-2 px-2 rounded hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors"
            >
              <span className="truncate flex-1 mr-3">
                {r.conversation?.title?.trim() || r.kind}
              </span>
              <span className="font-mono tabular-nums text-muted-foreground shrink-0">
                {formatUsd(r.usd)}
              </span>
            </Link>
          ))
        )}
      </div>

      {/* Scheduled tasks footer */}
      <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
        <Link
          href="/agents/scheduled"
          className="text-[11px] text-muted-foreground flex items-center gap-1.5 hover:text-foreground transition-colors"
        >
          <CalendarClock className="h-3 w-3" />
          {enabledTasks} scheduled task{enabledTasks === 1 ? "" : "s"} active
        </Link>
        {nextTask?.nextRunAt && (
          <span className="text-[10px] text-muted-foreground font-mono">
            next: {formatNextRun(nextTask.nextRunAt)}
          </span>
        )}
      </div>
    </div>
  );
}

function formatNextRun(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = date.getTime() - Date.now();
  if (diff < 0) return "due now";
  if (diff < 60_000) return "<1m";
  if (diff < 3_600_000) return `in ${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `in ${Math.floor(diff / 3_600_000)}h`;
  return `in ${Math.floor(diff / 86_400_000)}d`;
}
