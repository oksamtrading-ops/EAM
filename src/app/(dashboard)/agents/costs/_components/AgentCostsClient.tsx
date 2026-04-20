"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  DollarSign,
  Activity,
  Calculator,
  Cpu,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { formatUsd } from "@/lib/utils/agentPricing";

type Range = "7d" | "30d" | "90d";

const RANGE_DAYS: Record<Range, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

const RANGE_LABELS: Record<Range, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
};

export function AgentCostsClient() {
  const [range, setRange] = useState<Range>("30d");
  const sinceDays = RANGE_DAYS[range];

  const summary = trpc.agentRun.costSummary.useQuery({ sinceDays });
  const byKind = trpc.agentRun.costByKind.useQuery({ sinceDays });
  const byDay = trpc.agentRun.costByDay.useQuery({ sinceDays });
  const topRuns = trpc.agentRun.topCostRuns.useQuery({
    sinceDays,
    limit: 10,
  });

  const loading =
    summary.isLoading ||
    byKind.isLoading ||
    byDay.isLoading ||
    topRuns.isLoading;

  const avgPerRun =
    summary.data && summary.data.runCount > 0
      ? summary.data.totalUsd / summary.data.runCount
      : 0;
  const totalTokens =
    (summary.data?.totalTokensIn ?? 0) + (summary.data?.totalTokensOut ?? 0);

  return (
    <div className="flex h-full flex-col">
      <div className="glass-toolbar border-b px-4 sm:px-5 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-md font-semibold text-foreground tracking-tight flex items-center gap-2">
              <span className="h-6 w-6 rounded-md bg-[var(--ai)]/15 flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-[var(--ai)]" />
              </span>
              Agent Costs
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Estimated spend per run-kind and over time. Sub-agent rollups
              are attributed to their parent.
            </p>
          </div>
          <Select value={range} onValueChange={(v) => setRange(v as Range)}>
            <SelectTrigger className="w-44 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(RANGE_LABELS) as Range[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {RANGE_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="max-w-6xl mx-auto space-y-5">
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Total cost"
              value={loading ? "—" : formatUsd(summary.data?.totalUsd ?? 0)}
              icon={DollarSign}
            />
            <KpiCard
              label="Total runs"
              value={loading ? "—" : (summary.data?.runCount ?? 0).toLocaleString()}
              icon={Activity}
            />
            <KpiCard
              label="Avg per run"
              value={loading ? "—" : formatUsd(avgPerRun)}
              icon={Calculator}
            />
            <KpiCard
              label="Total tokens"
              value={loading ? "—" : totalTokens.toLocaleString()}
              icon={Cpu}
            />
          </div>

          {/* Line chart: cost/runs over time */}
          <Card className="p-5 flex flex-col gap-4">
            <div>
              <h3 className="font-semibold text-sm">Daily cost</h3>
              <p className="text-xs text-muted-foreground">
                USD estimate by calendar day (UTC). Runs plotted on the
                secondary axis.
              </p>
            </div>
            {loading ? (
              <div className="h-56 animate-pulse bg-muted/40 rounded-lg" />
            ) : !byDay.data || byDay.data.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
                No runs in this range.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart
                  data={byDay.data}
                  margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="usd"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) =>
                      v < 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(0)}`
                    }
                  />
                  <YAxis
                    yAxisId="runs"
                    orientation="right"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: "1px solid #e2e8d5",
                      background: "#fff",
                    }}
                    labelStyle={{ fontWeight: 600 }}
                    formatter={(value, name) =>
                      name === "USD"
                        ? [formatUsd(Number(value)), name]
                        : [String(value), name]
                    }
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                    formatter={(v) => (
                      <span style={{ color: "#64748b" }}>{v}</span>
                    )}
                  />
                  <Line
                    yAxisId="usd"
                    type="monotone"
                    dataKey="usd"
                    name="USD"
                    stroke="#7c3aed"
                    strokeWidth={2}
                    dot={{ r: 3, strokeWidth: 0, fill: "#7c3aed" }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    yAxisId="runs"
                    type="monotone"
                    dataKey="runs"
                    name="Runs"
                    stroke="#0B5CD6"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    dot={{ r: 2, strokeWidth: 0, fill: "#0B5CD6" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Bar chart: cost by kind */}
          <Card className="p-5 flex flex-col gap-4">
            <div>
              <h3 className="font-semibold text-sm">Cost by run kind</h3>
              <p className="text-xs text-muted-foreground">
                Where the spend concentrates — console chats, scheduled
                tasks, critic loops, and sub-agent fan-outs.
              </p>
            </div>
            {loading ? (
              <div className="h-56 animate-pulse bg-muted/40 rounded-lg" />
            ) : !byKind.data || byKind.data.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
                No runs in this range.
              </div>
            ) : (
              <ResponsiveContainer
                width="100%"
                height={Math.max(160, byKind.data.length * 36)}
              >
                <BarChart
                  data={byKind.data}
                  layout="vertical"
                  margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) =>
                      v < 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(0)}`
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey="kind"
                    tick={{ fontSize: 11, fill: "#475569" }}
                    axisLine={false}
                    tickLine={false}
                    width={160}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: "1px solid #e2e8d5",
                      background: "#fff",
                    }}
                    formatter={(value) => formatUsd(Number(value))}
                  />
                  <Bar dataKey="usd" name="USD" fill="#7c3aed" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Top runs table */}
          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b">
              <h3 className="font-semibold text-sm">Top expensive runs</h3>
              <p className="text-xs text-muted-foreground">
                Click a row to open the full trace.
              </p>
            </div>
            {loading ? (
              <div className="h-40 animate-pulse bg-muted/40 m-4 rounded-lg" />
            ) : !topRuns.data || topRuns.data.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
                No runs in this range.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Title</th>
                    <th className="text-left px-4 py-2 font-medium">Kind</th>
                    <th className="text-right px-4 py-2 font-medium">Tokens</th>
                    <th className="text-right px-4 py-2 font-medium">Model</th>
                    <th className="text-right px-4 py-2 font-medium">When</th>
                    <th className="text-right px-4 py-2 font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {topRuns.data.map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-2 max-w-[320px]">
                        <Link
                          href={`/agents/runs/${r.id}`}
                          className="text-[var(--ai)] hover:underline truncate inline-block max-w-full"
                        >
                          {r.conversation?.title?.trim() || r.kind}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground font-mono">
                        {r.kind}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-xs text-muted-foreground">
                        {(
                          r.totalTokensIn + r.totalTokensOut
                        ).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-right text-[11px] text-muted-foreground font-mono">
                        {r.model ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-muted-foreground tabular-nums">
                        {new Date(r.startedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium">
                        {formatUsd(r.usd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <p className="text-[10px] text-muted-foreground text-center">
            Cost is estimated from token counts × published model pricing.
            Approximate — not a billing figure.
          </p>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <Card className="p-4 flex items-start gap-3">
      <div className="mt-0.5 rounded-md bg-muted p-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-2xl font-bold tracking-tight leading-none mt-1">
          {value}
        </p>
      </div>
    </Card>
  );
}
