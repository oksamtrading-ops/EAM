"use client";

import { useState } from "react";
import { Wallet, Building2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Donut, type DonutSlice } from "@/components/ui/donut";
import { cn } from "@/lib/utils";
import { DrillDownSheet } from "../DrillDownSheet";
import type { DrillDownFilter } from "@/lib/contracts/dashboard";

const MAX_DOMAINS_VISIBLE = 6;
const UNMAPPED_ID = "__unmapped__";

/** AI-fade palette for ranked domain bars/slices. Top spender is
 *  the saturated AI accent; subsequent ranks fade. Index 0 reserved
 *  for the absolute top — beyond rank 5 we collapse into "more". */
const RANKED_COLORS = [
  "var(--ai)",
  "color-mix(in oklab, var(--ai) 70%, transparent)",
  "color-mix(in oklab, var(--ai) 55%, transparent)",
  "color-mix(in oklab, var(--ai) 40%, transparent)",
  "color-mix(in oklab, var(--ai) 30%, transparent)",
  "color-mix(in oklab, var(--ai) 22%, transparent)",
];

const UNMAPPED_COLOR = "rgb(113, 113, 122)"; // zinc-500
const UNMAPPED_TW_BAR =
  "bg-zinc-400 dark:bg-zinc-500"; // tailwind variant for the bar

/**
 * IT Portfolio cost card — three-zone layout matching the Plan G
 * mockup. Hero stat (left), donut share-of-spend (center), ranked
 * horizontal bars (right). All three views read the same domain
 * array so values reconcile.
 *
 * Reconciliation guarantee: server-side `getCostByDomain` now
 * appends an "Unmapped" bucket for apps with cost but no L1
 * capability mapping, so sum-of-domains === getSummary.totalAnnualCost.
 */
export function PortfolioCostCard() {
  const summary = trpc.dashboard.getSummary.useQuery();
  const byDomain = trpc.dashboard.getCostByDomain.useQuery();
  const [drillFilter, setDrillFilter] = useState<DrillDownFilter | null>(null);

  const openDomain = (domainId: string, domainName: string) => {
    if (domainId === "__hidden__") return;
    setDrillFilter({ kind: "apps_by_domain", domainId, domainName });
  };

  const isLoading = summary.isLoading || byDomain.isLoading;
  const total = summary.data?.totalAnnualCost ?? 0;
  const currency = summary.data?.costCurrency ?? "USD";
  const totalApps = summary.data?.totalApplications ?? 0;

  const domains = (byDomain.data ?? [])
    .filter((d) => d.totalCost > 0)
    .sort((a, b) => b.totalCost - a.totalCost);

  // For both donut + bars: top N visible, rest folded into "+N more".
  const visible = domains.slice(0, MAX_DOMAINS_VISIBLE);
  const hidden = domains.slice(MAX_DOMAINS_VISIBLE);
  const hiddenSum = hidden.reduce((s, d) => s + d.totalCost, 0);

  const max = visible[0]?.totalCost ?? 1;

  // Donut slices — same colors as bars so the eye traces between
  // the two views. Unmapped always uses the neutral zinc.
  const slices: DonutSlice[] = visible.map((d, i) => ({
    id: d.domainId,
    value: d.totalCost,
    color:
      d.domainId === UNMAPPED_ID
        ? UNMAPPED_COLOR
        : RANKED_COLORS[i] ?? RANKED_COLORS[RANKED_COLORS.length - 1]!,
    label: `${d.domain}: ${formatCompact(d.totalCost, currency)}`,
  }));
  if (hidden.length > 0) {
    slices.push({
      id: "__hidden__",
      value: hiddenSum,
      color: "color-mix(in oklab, var(--ai) 15%, transparent)",
      label: `+${hidden.length} more: ${formatCompact(hiddenSum, currency)}`,
    });
  }

  return (
    <div className="rounded-2xl glass p-5 sm:p-6">
      <header className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold tracking-tight flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            IT Portfolio cost
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Annual spend by capability domain
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* Hero stat */}
        <div className="lg:col-span-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Total annual spend
          </div>
          {isLoading ? (
            <div className="h-12 mt-2 bg-muted/40 animate-pulse rounded" />
          ) : (
            <>
              <div
                className="mt-1 font-bold tabular-nums leading-none tracking-tight"
                style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
              >
                {formatCompact(total, currency)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1.5 flex-wrap">
                <Building2 className="h-3 w-3 shrink-0" />
                <span>
                  Across {totalApps.toLocaleString()} application
                  {totalApps === 1 ? "" : "s"}
                </span>
                {domains.length > 0 && (
                  <>
                    <span className="text-muted-foreground/50">·</span>
                    <span>
                      {domains.length} domain
                      {domains.length === 1 ? "" : "s"}
                    </span>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Donut */}
        <div className="lg:col-span-3 flex items-center justify-center">
          {isLoading ? (
            <div className="h-[140px] w-[140px] rounded-full bg-muted/40 animate-pulse" />
          ) : domains.length === 0 ? (
            <div className="h-[140px] w-[140px] rounded-full border-[18px] border-muted/40" />
          ) : (
            <Donut
              slices={slices}
              size={140}
              thickness={20}
              ariaLabel="Cost share by domain"
              onSliceClick={(id) => {
                if (id === "__hidden__") return;
                const d = visible.find((v) => v.domainId === id);
                if (d) openDomain(d.domainId, d.domain);
              }}
              centerLabel={
                <div className="text-center">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Total
                  </div>
                  <div className="font-mono tabular-nums text-sm font-semibold">
                    {formatCompact(total, currency)}
                  </div>
                </div>
              }
            />
          )}
        </div>

        {/* Bars */}
        <div className="lg:col-span-5 space-y-2.5 min-w-0">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-6 rounded bg-muted/40 animate-pulse" />
            ))
          ) : domains.length === 0 ? (
            <div className="text-xs text-muted-foreground italic py-4 leading-relaxed">
              No annual cost data on the application portfolio yet.
              <br />
              Set <code className="font-mono">annualCostUsd</code> on
              applications to populate this view.
            </div>
          ) : (
            <>
              {visible.map((d, i) => (
                <DomainBar
                  key={d.domainId}
                  label={d.domain}
                  appCount={d.appCount}
                  cost={d.totalCost}
                  currency={currency}
                  pct={(d.totalCost / max) * 100}
                  rank={i}
                  isUnmapped={d.domainId === UNMAPPED_ID}
                  onClick={() => openDomain(d.domainId, d.domain)}
                />
              ))}
              {hidden.length > 0 && (
                <div className="flex items-center gap-3 pt-1.5 text-[11px] text-muted-foreground border-t border-black/5 dark:border-white/5">
                  <span className="font-mono">
                    +{hidden.length} more domain
                    {hidden.length === 1 ? "" : "s"}
                  </span>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="font-mono">
                    {formatCompact(hiddenSum, currency)} combined
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <DrillDownSheet
        filter={drillFilter}
        onClose={() => setDrillFilter(null)}
      />
    </div>
  );
}

type DomainBarProps = {
  label: string;
  appCount: number;
  cost: number;
  currency: string;
  pct: number;
  rank: number;
  isUnmapped: boolean;
  onClick?: () => void;
};

function DomainBar({
  label,
  appCount,
  cost,
  currency,
  pct,
  rank,
  isUnmapped,
  onClick,
}: DomainBarProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group block w-full text-left rounded-md px-1.5 -mx-1.5 py-0.5 transition-colors hover:bg-black/5 dark:hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ai)]/50"
    >
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <span
          className={cn(
            "text-xs font-medium truncate",
            isUnmapped && "text-muted-foreground italic"
          )}
        >
          {label}
        </span>
        <div className="flex items-center gap-2 shrink-0 text-[11px]">
          <span className="text-muted-foreground font-mono">
            {appCount} app{appCount === 1 ? "" : "s"}
          </span>
          <span className="font-mono tabular-nums font-semibold">
            {formatCompact(cost, currency)}
          </span>
        </div>
      </div>
      <div className="relative h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800/60 overflow-hidden">
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-all",
            isUnmapped
              ? UNMAPPED_TW_BAR
              : rank === 0
                ? "bg-[var(--ai)]"
                : rank === 1
                  ? "bg-[var(--ai)]/70"
                  : rank === 2
                    ? "bg-[var(--ai)]/55"
                    : "bg-[var(--ai)]/40"
          )}
          style={{ width: `${Math.max(pct, 1.5)}%` }}
        />
      </div>
    </button>
  );
}

/** Compact currency formatting — "$5.2M", "$842K". Sub-1000 uses
 *  full notation so small workspaces render "$420" not "$0.4K". */
function formatCompact(value: number, currency: string): string {
  if (value < 1000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
