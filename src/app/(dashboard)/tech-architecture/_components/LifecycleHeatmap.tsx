"use client";

import { useMemo, useState } from "react";
import { Flame, ChevronDown, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc/client";

const BUCKETS = [
  { key: "past", label: "Past EOL", shortLabel: "Past" },
  { key: "lt30", label: "< 30 days", shortLabel: "<30d" },
  { key: "lt90", label: "30-90 days", shortLabel: "30-90d" },
  { key: "lt180", label: "90-180 days", shortLabel: "90-180d" },
  { key: "lt365", label: "180-365 days", shortLabel: "180-365d" },
  { key: "gte365", label: "1 year+", shortLabel: "1y+" },
  { key: "unknown", label: "Unknown EOL", shortLabel: "Unknown" },
] as const;

type BucketKey = (typeof BUCKETS)[number]["key"];

const TONE_SCALES: Record<BucketKey, readonly string[]> = {
  past: [
    "bg-rose-100 text-rose-900",
    "bg-rose-200 text-rose-900",
    "bg-rose-300 text-rose-900",
    "bg-rose-400 text-white",
    "bg-rose-500 text-white",
  ],
  lt30: [
    "bg-amber-100 text-amber-900",
    "bg-amber-200 text-amber-900",
    "bg-amber-300 text-amber-900",
    "bg-amber-400 text-amber-950",
    "bg-amber-500 text-white",
  ],
  lt90: [
    "bg-amber-100 text-amber-900",
    "bg-amber-200 text-amber-900",
    "bg-amber-300 text-amber-900",
    "bg-amber-400 text-amber-950",
    "bg-amber-500 text-white",
  ],
  lt180: [
    "bg-yellow-100 text-yellow-900",
    "bg-yellow-200 text-yellow-900",
    "bg-yellow-300 text-yellow-900",
    "bg-yellow-400 text-yellow-950",
    "bg-yellow-500 text-yellow-950",
  ],
  lt365: [
    "bg-lime-100 text-lime-900",
    "bg-lime-200 text-lime-900",
    "bg-lime-300 text-lime-900",
    "bg-lime-400 text-lime-950",
    "bg-lime-500 text-white",
  ],
  gte365: [
    "bg-emerald-100 text-emerald-900",
    "bg-emerald-200 text-emerald-900",
    "bg-emerald-300 text-emerald-900",
    "bg-emerald-400 text-white",
    "bg-emerald-500 text-white",
  ],
  unknown: [
    "bg-slate-100 text-slate-700",
    "bg-slate-200 text-slate-700",
    "bg-slate-300 text-slate-800",
  ],
};

const LEGEND_TONE: Record<BucketKey, string> = {
  past: "bg-rose-400",
  lt30: "bg-amber-400",
  lt90: "bg-amber-300",
  lt180: "bg-yellow-400",
  lt365: "bg-lime-400",
  gte365: "bg-emerald-400",
  unknown: "bg-slate-300",
};

function bucketFor(eol: Date | string | null | undefined): BucketKey {
  if (!eol) return "unknown";
  const date = typeof eol === "string" ? new Date(eol) : eol;
  const days = Math.ceil((date.getTime() - Date.now()) / 86400000);
  if (days < 0) return "past";
  if (days < 30) return "lt30";
  if (days < 90) return "lt90";
  if (days < 180) return "lt180";
  if (days < 365) return "lt365";
  return "gte365";
}

function bucketTone(bucket: BucketKey, count: number, max: number): string {
  if (count === 0) return "bg-muted/20";
  const scale = TONE_SCALES[bucket];
  if (max <= 0) return scale[0];
  const ratio = count / max;
  const maxStep = scale.length - 1;
  const step = Math.min(maxStep, Math.floor(ratio * scale.length));
  return scale[step];
}

export function LifecycleHeatmap() {
  const [collapsed, setCollapsed] = useState(false);
  const { data: versions = [], isLoading } = trpc.technologyVersion.list.useQuery({});

  const { rows, maxCell, total } = useMemo(() => {
    const byProduct = new Map<
      string,
      { productName: string; productId: string; counts: Record<BucketKey, number>; total: number }
    >();
    for (const v of versions) {
      const key = v.productId;
      const row =
        byProduct.get(key) ??
        {
          productName: v.product.name,
          productId: v.productId,
          counts: {
            past: 0, lt30: 0, lt90: 0, lt180: 0, lt365: 0, gte365: 0, unknown: 0,
          },
          total: 0,
        };
      row.counts[bucketFor(v.endOfLifeDate)] += 1;
      row.total += 1;
      byProduct.set(key, row);
    }
    const sorted = Array.from(byProduct.values()).sort((a, b) => {
      const aRisk = a.counts.past * 4 + a.counts.lt30 * 3 + a.counts.lt90 * 2 + a.counts.lt180;
      const bRisk = b.counts.past * 4 + b.counts.lt30 * 3 + b.counts.lt90 * 2 + b.counts.lt180;
      if (aRisk !== bRisk) return bRisk - aRisk;
      return b.total - a.total;
    });
    let max = 0;
    for (const r of sorted) {
      for (const k of Object.keys(r.counts) as BucketKey[]) {
        if (r.counts[k] > max) max = r.counts[k];
      }
    }
    return { rows: sorted, maxCell: max, total: versions.length };
  }, [versions]);

  if (isLoading) {
    return <div className="h-32 rounded-lg bg-muted/40 animate-pulse" />;
  }
  if (total === 0) {
    return null;
  }

  const displayRows = collapsed ? rows.slice(0, 5) : rows;

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left border-b border-border hover:bg-muted/30"
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <Flame className="h-3.5 w-3.5 text-orange-500" />
        <span className="text-sm font-medium">Lifecycle Heatmap</span>
        <span className="text-xs text-muted-foreground">
          {rows.length} product{rows.length !== 1 ? "s" : ""} · {total} version{total !== 1 ? "s" : ""}
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {collapsed ? "Show all" : "Hide"}
        </span>
      </button>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/30">
              <th className="text-left font-medium px-2 py-1.5 text-muted-foreground sticky left-0 bg-muted/30">
                Product
              </th>
              {BUCKETS.map((b) => (
                <th
                  key={b.key}
                  className="text-center font-medium px-1 py-1.5 text-muted-foreground whitespace-nowrap"
                  title={b.label}
                >
                  {b.shortLabel}
                </th>
              ))}
              <th className="text-right font-medium px-2 py-1.5 text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((r) => (
              <tr key={r.productId} className="border-t border-border">
                <td className="px-2 py-1.5 font-medium sticky left-0 bg-card whitespace-nowrap">
                  {r.productName}
                </td>
                {BUCKETS.map((b) => {
                  const count = r.counts[b.key];
                  return (
                    <td
                      key={b.key}
                      className={`px-1 py-1 text-center tabular-nums ${bucketTone(b.key, count, maxCell)}`}
                      title={`${r.productName} — ${b.label}: ${count}`}
                    >
                      {count > 0 ? count : ""}
                    </td>
                  );
                })}
                <td className="px-2 py-1.5 text-right font-medium tabular-nums">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {collapsed && rows.length > 5 && (
        <div className="px-3 py-1.5 border-t border-border text-[10px] text-muted-foreground">
          {rows.length - 5} more product{rows.length - 5 !== 1 ? "s" : ""} hidden — click header to expand.
        </div>
      )}
      <div className="px-3 py-1.5 border-t border-border flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
        <span>Legend:</span>
        {BUCKETS.map((b) => (
          <span key={b.key} className="flex items-center gap-1">
            <span className={`inline-block h-2.5 w-4 rounded-sm ${LEGEND_TONE[b.key]}`} />
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}
