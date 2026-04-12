"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card } from "@/components/ui/card";
import type { MigrationTrendPoint } from "@/lib/contracts/dashboard";

interface Props {
  data: MigrationTrendPoint[];
  loading: boolean;
}

const LINES: { key: keyof Omit<MigrationTrendPoint, "month">; color: string; label: string }[] = [
  { key: "Cloud", color: "#0076A8", label: "Cloud" },
  { key: "OnPremise", color: "#f97316", label: "On-Premise" },
  { key: "Hybrid", color: "#8b5cf6", label: "Hybrid" },
  { key: "SaaS", color: "#86BC25", label: "SaaS" },
];

export function MigrationTrendChart({ data, loading }: Props) {
  return (
    <Card className="p-5 flex flex-col gap-4">
      <div>
        <h3 className="font-semibold text-sm">Technology Migration Trend</h3>
        <p className="text-xs text-muted-foreground">Cumulative application distribution by hosting model</p>
      </div>

      {loading ? (
        <div className="h-52 animate-pulse bg-muted/40 rounded-lg" />
      ) : data.length === 0 ? (
        <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">
          No application data yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={210}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8d5", background: "#fff" }}
              labelStyle={{ fontWeight: 600 }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={(value) => <span style={{ color: "#64748b" }}>{value}</span>}
            />
            {LINES.map(({ key, color, label }) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={label}
                stroke={color}
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0, fill: color }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
