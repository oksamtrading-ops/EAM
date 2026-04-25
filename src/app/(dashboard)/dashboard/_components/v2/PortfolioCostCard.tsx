"use client";

import { Wallet, Building2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

const MAX_DOMAINS_VISIBLE = 6;

/**
 * IT Portfolio cost card. Hero stat (total annual spend across the
 * application portfolio) on the left, horizontal-bar breakdown by
 * L1 capability domain on the right. Domain bars are width-scaled
 * to the largest spender so the longest bar always fills the row.
 *
 * Data sources:
 *   - dashboard.getSummary  → totalAnnualCost + costCurrency + totalApps
 *   - dashboard.getCostByDomain → per-domain cost + app counts
 */
export function PortfolioCostCard() {
  const summary = trpc.dashboard.getSummary.useQuery();
  const byDomain = trpc.dashboard.getCostByDomain.useQuery();

  const isLoading = summary.isLoading || byDomain.isLoading;
  const total = summary.data?.totalAnnualCost ?? 0;
  const currency = summary.data?.costCurrency ?? "USD";
  const totalApps = summary.data?.totalApplications ?? 0;

  const domains = (byDomain.data ?? [])
    .filter((d) => d.totalCost > 0)
    .sort((a, b) => b.totalCost - a.totalCost);
  const visible = domains.slice(0, MAX_DOMAINS_VISIBLE);
  const hidden = domains.slice(MAX_DOMAINS_VISIBLE);
  const hiddenSum = hidden.reduce((s, d) => s + d.totalCost, 0);

  const max = visible[0]?.totalCost ?? 1;

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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* Left — hero total */}
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
              <div className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1.5">
                <Building2 className="h-3 w-3" />
                Across {totalApps.toLocaleString()} application
                {totalApps === 1 ? "" : "s"}
                {domains.length > 0 && (
                  <>
                    <span className="text-muted-foreground/50">·</span>
                    <span>
                      {domains.length} domain{domains.length === 1 ? "" : "s"}
                    </span>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right — bars */}
        <div className="lg:col-span-8 space-y-2.5">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-6 rounded bg-muted/40 animate-pulse" />
            ))
          ) : domains.length === 0 ? (
            <div className="text-xs text-muted-foreground italic py-4">
              No annual cost data on the application portfolio yet.
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
};

function DomainBar({
  label,
  appCount,
  cost,
  currency,
  pct,
  rank,
}: DomainBarProps) {
  return (
    <div className="group">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <span className="text-xs font-medium truncate">{label}</span>
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
            // Top spender uses the AI accent; rest fade through a
            // muted-but-not-invisible scale so the visual hierarchy
            // matches the spend ranking.
            rank === 0
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
    </div>
  );
}

/**
 * Compact currency formatting — "$5.2M", "$842K", "$1.4B". Uses the
 * Intl compact notation. Falls back to a formatted full number under
 * 1000 ("$420").
 */
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
