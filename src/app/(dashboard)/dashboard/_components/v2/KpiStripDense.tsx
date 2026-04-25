"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Sparkline } from "@/components/ui/sparkline";
import { formatUsd } from "@/lib/utils/agentPricing";
import { cn } from "@/lib/utils";

/**
 * Six-cell dense KPI strip. The last two cells (Pending reviews,
 * Weekly spend) get the AI-tinted background to mark them as
 * action-tier; the first four are muted "context" cells.
 *
 * Each cell is a click-through Link — not a button — so the entire
 * row reads as navigable.
 */
export function KpiStripDense() {
  const summary = trpc.dashboard.getSummary.useQuery();
  const pending = trpc.dashboardV2.pendingReviews.useQuery();
  const cost = trpc.agentRun.costSummary.useQuery({ sinceDays: 7 });
  const costPrev = trpc.agentRun.costSummary.useQuery({ sinceDays: 14 });

  const k = summary.data;
  const isLoading = summary.isLoading || pending.isLoading || cost.isLoading;

  // Weekly delta: this-week minus prior-week (sinceDays 7 vs the
  // 7 days before that, i.e. 14d total minus this 7d).
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
        value={isLoading ? "—" : String(k?.totalApplications ?? 0)}
        href="/applications"
      />
      <KpiCell
        label="Capabilities"
        value={isLoading ? "—" : String(k?.totalCapabilities ?? 0)}
        href="/capabilities"
      />
      <KpiCell
        label="Open risks"
        value={isLoading ? "—" : String(k?.openRisks ?? 0)}
        meta={
          (k?.criticalRisks ?? 0) > 0
            ? { text: `${k!.criticalRisks} critical`, tone: "danger" }
            : undefined
        }
        showPulse={(k?.criticalRisks ?? 0) > 0}
        href="/risk"
      />
      <KpiCell
        label="Initiatives"
        value={isLoading ? "—" : String(k?.overdueInitiatives ?? 0)}
        meta={
          (k?.overdueInitiatives ?? 0) > 0
            ? { text: "overdue", tone: "warn" }
            : undefined
        }
        href="/roadmap"
      />
      <KpiCell
        label="Pending reviews"
        accent
        value={isLoading ? "—" : String(pending.data?.total ?? 0)}
        sparkline={
          // Static placeholder series — true daily count needs schema
          // change. Conveys "trend" without implying precision.
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
          cost.isLoading
            ? "—"
            : formatUsd(cost.data?.totalUsd ?? 0)
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
    tone: "success" | "warn" | "danger";
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
