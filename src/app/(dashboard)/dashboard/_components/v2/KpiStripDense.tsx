"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Sparkline } from "@/components/ui/sparkline";
import { formatUsd } from "@/lib/utils/agentPricing";
import { cn } from "@/lib/utils";

/**
 * Six-cell dense KPI strip. Each cell renders a primary value with
 * an optional secondary metadata phrase ("+2", "3 levels", "2
 * critical", "3 overdue", etc.) sourced from the kpiStrip aggregator
 * so the strip matches the mockup exactly.
 *
 * The last two cells (Pending reviews, Weekly spend) get the AI-
 * tinted background to mark them as action-tier; the first four are
 * muted "context" cells.
 */
export function KpiStripDense() {
  const strip = trpc.dashboardV2.kpiStrip.useQuery();
  const pending = trpc.dashboardV2.pendingReviews.useQuery();
  const cost = trpc.agentRun.costSummary.useQuery({ sinceDays: 7 });
  const costPrev = trpc.agentRun.costSummary.useQuery({ sinceDays: 14 });

  const isLoading = strip.isLoading || pending.isLoading || cost.isLoading;

  // Weekly delta: this-week minus prior-week.
  const weeklyDelta = (() => {
    if (!cost.data || !costPrev.data) return null;
    const thisWeek = cost.data.totalUsd;
    const priorWeek = costPrev.data.totalUsd - thisWeek;
    if (priorWeek <= 0.01) return null;
    const delta = thisWeek - priorWeek;
    if (Math.abs(delta) < 0.5) return null;
    return delta;
  })();

  return (
    <div
      className={cn(
        "rounded-2xl glass border-t",
        "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-black/5 dark:divide-white/5"
      )}
    >
      <KpiCell
        label="Applications"
        value={isLoading ? "—" : String(strip.data?.applications.total ?? 0)}
        meta={
          (strip.data?.applications.addedRecently ?? 0) > 0
            ? {
                text: `+${strip.data!.applications.addedRecently}`,
                tone: "muted",
              }
            : undefined
        }
        href="/applications"
      />
      <KpiCell
        label="Capabilities"
        value={isLoading ? "—" : String(strip.data?.capabilities.total ?? 0)}
        meta={
          (strip.data?.capabilities.levelDepth ?? 0) > 0
            ? {
                text: `${strip.data!.capabilities.levelDepth} level${
                  strip.data!.capabilities.levelDepth === 1 ? "" : "s"
                }`,
                tone: "muted",
              }
            : undefined
        }
        href="/capabilities"
      />
      <KpiCell
        label="Open risks"
        value={isLoading ? "—" : String(strip.data?.risks.total ?? 0)}
        meta={
          (strip.data?.risks.critical ?? 0) > 0
            ? {
                text: `${strip.data!.risks.critical} critical`,
                tone: "danger",
              }
            : undefined
        }
        showPulse={(strip.data?.risks.critical ?? 0) > 0}
        href="/risk"
      />
      <KpiCell
        label="Initiatives"
        value={isLoading ? "—" : String(strip.data?.initiatives.total ?? 0)}
        meta={
          (strip.data?.initiatives.overdue ?? 0) > 0
            ? {
                text: `${strip.data!.initiatives.overdue} overdue`,
                tone: "warn",
              }
            : undefined
        }
        href="/roadmap"
      />
      <KpiCell
        label="Pending reviews"
        accent
        value={isLoading ? "—" : String(pending.data?.total ?? 0)}
        sparkline={
          // Static placeholder series until we track per-day counts —
          // conveys trend shape without implying precision.
          <Sparkline
            data={[3, 5, 4, 7, 6, 8, pending.data?.total ?? 0]}
            variant="line"
            height={16}
            color="var(--ai)"
          />
        }
        href="/agents/knowledge"
      />
      <KpiCell
        label="Weekly spend"
        accent
        value={
          cost.isLoading ? "—" : formatUsd(cost.data?.totalUsd ?? 0)
        }
        meta={
          weeklyDelta != null
            ? {
                text: `${weeklyDelta >= 0 ? "+" : ""}${formatUsd(Math.abs(weeklyDelta))} vs prev`,
                tone: weeklyDelta > 0 ? "warn" : "success",
                icon: weeklyDelta > 0 ? ArrowUpRight : undefined,
              }
            : undefined
        }
        href="/agents/costs"
      />
    </div>
  );
}

type KpiCellProps = {
  label: string;
  value: string;
  meta?: {
    text: string;
    tone: "success" | "warn" | "danger" | "muted";
    icon?: React.ComponentType<{ className?: string }>;
  };
  sparkline?: React.ReactNode;
  href: string;
  accent?: boolean;
  showPulse?: boolean;
};

const metaToneClass: Record<NonNullable<KpiCellProps["meta"]>["tone"], string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
  muted: "text-zinc-400 dark:text-zinc-500",
};

function KpiCell({
  label,
  value,
  meta,
  sparkline,
  href,
  accent,
  showPulse,
}: KpiCellProps) {
  const MetaIcon = meta?.icon;
  return (
    <Link
      href={href}
      className={cn(
        "px-4 py-3 text-left transition-colors",
        accent
          ? "bg-[var(--ai)]/[0.06] hover:bg-[var(--ai)]/[0.10]"
          : "hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
      )}
    >
      <div
        className={cn(
          "text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1",
          accent ? "text-[var(--ai)]" : "text-muted-foreground"
        )}
      >
        {label}
        {showPulse && (
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
        )}
      </div>
      <div className="mt-0.5 flex items-baseline gap-2 flex-wrap">
        <span className="text-xl font-semibold tabular-nums">{value}</span>
        {meta && (
          <span
            className={cn(
              "text-[10px] font-mono flex items-center gap-0.5",
              metaToneClass[meta.tone]
            )}
          >
            {MetaIcon && <MetaIcon className="h-2.5 w-2.5" />}
            {meta.text}
          </span>
        )}
        {sparkline && <span className="ml-auto h-4 w-12">{sparkline}</span>}
      </div>
    </Link>
  );
}
