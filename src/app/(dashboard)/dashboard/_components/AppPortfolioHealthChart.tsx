"use client";

import { Card } from "@/components/ui/card";
import type { AppHealthDistribution } from "@/lib/contracts/dashboard";

interface Props {
  data: AppHealthDistribution | null;
  loading: boolean;
}

const BUCKETS: {
  key: keyof Omit<AppHealthDistribution, "total">;
  label: string;
  color: string;
  bg: string;
  dot: string;
}[] = [
  { key: "healthy",  label: "Healthy",  color: "#0B5CD6", bg: "bg-[#0B5CD6]", dot: "bg-[#0B5CD6]" },
  { key: "warning",  label: "Warning",  color: "#f59e0b", bg: "bg-amber-400",  dot: "bg-amber-400" },
  { key: "critical", label: "Critical", color: "#ef4444", bg: "bg-red-500",    dot: "bg-red-500" },
];

export function AppPortfolioHealthChart({ data, loading }: Props) {
  if (loading) {
    return (
      <Card className="p-5">
        <div className="mb-4">
          <h3 className="font-semibold text-sm">Application Portfolio Health</h3>
          <p className="text-xs text-muted-foreground">Current status distribution</p>
        </div>
        <div className="h-[140px] animate-pulse bg-muted/40 rounded-lg" />
      </Card>
    );
  }

  if (!data || data.total === 0) {
    return (
      <Card className="p-5">
        <div className="mb-4">
          <h3 className="font-semibold text-sm">Application Portfolio Health</h3>
          <p className="text-xs text-muted-foreground">Current status distribution</p>
        </div>
        <div className="h-[140px] flex items-center justify-center text-sm text-muted-foreground">
          No applications in portfolio
        </div>
      </Card>
    );
  }

  const segments = BUCKETS.map((b) => ({
    ...b,
    value: data[b.key],
    pct: data.total > 0 ? Math.round((data[b.key] / data.total) * 100) : 0,
  })).filter((s) => s.value > 0);

  return (
    <Card className="p-5 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-sm">Application Portfolio Health</h3>
          <p className="text-xs text-muted-foreground">Current status distribution</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold leading-none">{data.total}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">total apps</p>
        </div>
      </div>

      {/* Stacked horizontal bar */}
      <div className="flex h-7 rounded-full overflow-hidden gap-0.5">
        {segments.map((s) => (
          <div
            key={s.key}
            className={`${s.bg} transition-all duration-500 relative group`}
            style={{ width: `${Math.max(s.pct, 3)}%` }}
          >
            {/* Hover tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
              <div className="bg-[#1a1f2e] text-white text-[10px] font-medium px-2 py-1 rounded shadow-lg whitespace-nowrap">
                {s.label}: {s.value} ({s.pct}%)
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Breakdown list */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {BUCKETS.map((b) => {
          const value = data[b.key];
          const pct = data.total > 0 ? Math.round((value / data.total) * 100) : 0;
          return (
            <div key={b.key} className="flex items-center gap-2.5">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${b.dot}`} />
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-none">{value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {b.label} &middot; {pct}%
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
