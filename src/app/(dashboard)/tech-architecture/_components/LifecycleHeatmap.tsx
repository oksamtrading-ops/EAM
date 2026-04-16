"use client";

import { useMemo, useState } from "react";
import { Flame, ChevronDown, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc/client";

const BUCKETS = [
  { key: "past", label: "Past EOL", shortLabel: "Past", hue: 0 },
  { key: "lt30", label: "< 30 days", shortLabel: "<30d", hue: 20 },
  { key: "lt90", label: "30-90 days", shortLabel: "30-90d", hue: 35 },
  { key: "lt180", label: "90-180 days", shortLabel: "90-180d", hue: 45 },
  { key: "lt365", label: "180-365 days", shortLabel: "180-365d", hue: 80 },
  { key: "gte365", label: "1 year+", shortLabel: "1y+", hue: 140 },
  { key: "unknown", label: "Unknown EOL", shortLabel: "Unknown", hue: null },
] as const;

type BucketKey = (typeof BUCKETS)[number]["key"];

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

function cellStyle(bucket: BucketKey, count: number, max: number): React.CSSProperties {
  if (count === 0) return {};
  const def = BUCKETS.find((b) => b.key === bucket)!;
  if (def.hue === null) {
    return { backgroundColor: "#e2e8f0", color: "#1e293b" };
  }
  const intensity = Math.min(1, 0.45 + (count / Math.max(max, 1)) * 0.55);
  const lightness = Math.round(85 - intensity * 40);
  return {
    backgroundColor: `hsl(${def.hue}, 75%, ${lightness}%)`,
    color: lightness < 55 ? "#fff" : "#111827",
  };
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
                      className="px-1 py-1 text-center tabular-nums"
                      style={count > 0 ? cellStyle(b.key, count, maxCell) : undefined}
                      title={`${b.label}: ${count}`}
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
            <span
              className="inline-block h-2.5 w-4 rounded-sm"
              style={
                b.hue === null
                  ? { backgroundColor: "#e2e8f0" }
                  : { backgroundColor: `hsl(${b.hue}, 75%, 60%)` }
              }
            />
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}
