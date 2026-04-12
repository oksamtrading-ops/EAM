"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { CapabilityMaturityDomain } from "@/lib/contracts/dashboard";

interface Props {
  data: CapabilityMaturityDomain[];
  loading: boolean;
}

const MAX_VISIBLE = 5;

function barColor(score: number): string {
  if (score >= 4) return "#86BC25";
  if (score >= 3) return "#0076A8";
  if (score >= 2) return "#f59e0b";
  return "#ef4444";
}

function maturityLabel(score: number): string {
  if (score >= 4) return "Optimizing";
  if (score >= 3) return "Defined/Managed";
  if (score >= 2) return "Developing";
  return "Initial";
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: CapabilityMaturityDomain }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-white border border-[#e2e8d5] rounded-lg px-3 py-2 shadow-sm text-xs">
      <p className="font-semibold mb-1">{d.domain}</p>
      <p className="text-muted-foreground">Avg maturity: <span className="font-medium text-foreground">{d.avgMaturity.toFixed(1)} / 5</span></p>
      <p className="text-muted-foreground">{d.count} capabilit{d.count !== 1 ? "ies" : "y"}</p>
    </div>
  );
}

export function CapabilityMaturityChart({ data, loading }: Props) {
  const [showAll, setShowAll] = useState(false);
  const chartData = data.slice(0, MAX_VISIBLE);
  const hasMore = data.length > MAX_VISIBLE;

  return (
    <>
      <Card className="p-5 flex flex-col">
        <div className="mb-4">
          <h3 className="font-semibold text-sm">Business Capability Maturity</h3>
          <p className="text-xs text-muted-foreground">Average maturity score by domain (scale 1&ndash;5)</p>
        </div>

        {loading ? (
          <div className="h-[220px] animate-pulse bg-muted/40 rounded-lg" />
        ) : data.length === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
            No capability data yet
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
                domain={[0, 5]}
                ticks={[1, 2, 3, 4, 5]}
                tick={{ fontSize: 10, fill: "#94a3b8" }}
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
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
              <Bar dataKey="avgMaturity" radius={[0, 4, 4, 0]} maxBarSize={22}>
                {chartData.map((entry) => (
                  <Cell key={entry.domainId} fill={barColor(entry.avgMaturity)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* Legend */}
        {data.length > 0 && (
          <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground mt-3">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400 inline-block" />Initial (&lt;2)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400 inline-block" />Developing (2&ndash;3)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#0076A8] inline-block" />Defined/Managed (3&ndash;4)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#86BC25] inline-block" />Optimizing (&ge;4)</span>
          </div>
        )}

        {hasMore && (
          <button
            onClick={() => setShowAll(true)}
            className="mt-3 text-xs font-medium text-[#0076A8] hover:underline self-start"
          >
            See all {data.length} domains &rarr;
          </button>
        )}
      </Card>

      {/* Full list sheet */}
      <Sheet open={showAll} onOpenChange={setShowAll}>
        <SheetContent side="right" className="data-[side=right]:sm:max-w-md flex flex-col overflow-hidden p-0">
          <SheetHeader className="px-5 pt-5 pb-4 border-b">
            <SheetTitle className="text-base">All Capability Domains</SheetTitle>
            <SheetDescription>{data.length} domain{data.length !== 1 ? "s" : ""}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-5 pb-5">
            <ul className="divide-y divide-border">
              {data.map((d) => (
                <li key={d.domainId} className="py-3">
                  <Link
                    href={`/capabilities?id=${d.domainId}`}
                    className="flex items-center justify-between gap-3 hover:bg-muted/30 rounded-lg px-2 -mx-2 py-1 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{d.domain}</p>
                      <p className="text-xs text-muted-foreground">{d.count} capabilit{d.count !== 1 ? "ies" : "y"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border"
                        style={{ borderColor: barColor(d.avgMaturity), color: barColor(d.avgMaturity) }}
                      >
                        {d.avgMaturity.toFixed(1)} &mdash; {maturityLabel(d.avgMaturity)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
