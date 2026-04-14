"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { CostByDomain } from "@/lib/contracts/dashboard";

interface Props {
  data: CostByDomain[];
  loading: boolean;
  currency: string;
}

const MAX_VISIBLE = 5;

function formatCost(value: number, currency: string): string {
  const prefix = currency === "USD" ? "$" : currency + " ";
  if (value >= 1_000_000) return `${prefix}${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${prefix}${(value / 1_000).toFixed(0)}K`;
  return `${prefix}${value.toLocaleString()}`;
}

function CustomTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: { payload: CostByDomain }[];
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-sm text-xs">
      <p className="font-semibold mb-1">{d.domain}</p>
      <p className="text-muted-foreground">
        Cost: <span className="font-medium text-foreground">{formatCost(d.totalCost, currency)}</span>
      </p>
      <p className="text-muted-foreground">{d.appCount} application{d.appCount !== 1 ? "s" : ""}</p>
    </div>
  );
}

export function CostByDomainChart({ data, loading, currency }: Props) {
  const [showAll, setShowAll] = useState(false);
  const chartData = data.slice(0, MAX_VISIBLE);
  const hasMore = data.length > MAX_VISIBLE;
  const totalCost = data.reduce((sum, d) => sum + d.totalCost, 0);

  return (
    <>
      <div className="glass-chart">
        <div className="mb-4">
          <h3 className="font-semibold text-sm">IT Spend by Business Domain</h3>
          <p className="text-xs text-muted-foreground">
            Annual cost allocation across L1 capability domains
            {totalCost > 0 && <span className="ml-1 font-medium">&middot; Total: {formatCost(totalCost, currency)}</span>}
          </p>
        </div>

        {loading ? (
          <div className="h-[200px] animate-pulse bg-muted/40 rounded-lg" />
        ) : data.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
            No cost data available &mdash; add annual cost to applications
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 36)}>
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickFormatter={(v) => formatCost(v, currency)}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="domain"
                width={120}
                tick={{ fontSize: 11, fill: "#374151" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip currency={currency} />} cursor={{ fill: "#f8fafc" }} />
              <Bar dataKey="totalCost" fill="#0076A8" radius={[0, 4, 4, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {hasMore && (
          <button
            onClick={() => setShowAll(true)}
            className="mt-3 text-xs font-medium text-[var(--link)] hover:underline"
          >
            See all {data.length} domains &rarr;
          </button>
        )}
      </div>

      {/* Full list sheet */}
      <Sheet open={showAll} onOpenChange={setShowAll}>
        <SheetContent side="right" className="data-[side=right]:sm:max-w-md flex flex-col overflow-hidden p-0">
          <SheetHeader className="px-5 pt-5 pb-4 border-b">
            <SheetTitle className="text-base">IT Spend by Domain</SheetTitle>
            <SheetDescription>
              {data.length} domain{data.length !== 1 ? "s" : ""} &middot; Total: {formatCost(totalCost, currency)}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-5 pb-5">
            <ul className="divide-y divide-border">
              {data.map((d) => (
                <li key={d.domainId} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{d.domain}</p>
                    <p className="text-xs text-muted-foreground">{d.appCount} application{d.appCount !== 1 ? "s" : ""}</p>
                  </div>
                  <p className="text-sm font-semibold shrink-0">{formatCost(d.totalCost, currency)}</p>
                </li>
              ))}
            </ul>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
