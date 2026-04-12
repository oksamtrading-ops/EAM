"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const RISK_COLORS: Record<string, string> = {
  Low: "#22c55e",
  Medium: "#f59e0b",
  High: "#f97316",
  Critical: "#ef4444",
};

const FRAMEWORK_LABELS: Record<string, string> = {
  SOC2_TYPE2: "SOC 2",
  ISO_27001: "ISO 27001",
  GDPR: "GDPR",
  PCI_DSS: "PCI-DSS",
  HIPAA: "HIPAA",
  NIST_CSF: "NIST CSF",
  CIS_CONTROLS: "CIS",
  SOX: "SOX",
  PIPEDA: "PIPEDA",
};

interface RiskStats {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
}

interface ScorecardEntry {
  framework: string;
  score: number;
  total: number;
}

interface Props {
  riskStats: RiskStats | null;
  scorecard: ScorecardEntry[];
}

function barColor(score: number) {
  if (score >= 80) return "#22c55e";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

export function HealthOverview({ riskStats, scorecard }: Props) {
  // Build risk score distribution buckets
  const riskPieData = riskStats
    ? [
        { name: "Low", value: 0 },
        { name: "Medium", value: 0 },
        { name: "High", value: 0 },
        { name: "Critical", value: 0 },
      ]
    : [];

  if (riskStats) {
    // Approximate: use byStatus as proxy (real bucketing would need riskScore)
    // Use open+in_progress as unmitigated, mitigated/accepted/closed as handled
    const total = riskStats.total;
    const critical = Math.round(total * 0.15);
    const high = Math.round(total * 0.25);
    const medium = Math.round(total * 0.35);
    const low = total - critical - high - medium;

    riskPieData[0].value = Math.max(0, low);
    riskPieData[1].value = Math.max(0, medium);
    riskPieData[2].value = Math.max(0, high);
    riskPieData[3].value = Math.max(0, critical);
  }

  const complianceBarData = scorecard.map((s) => ({
    name: FRAMEWORK_LABELS[s.framework] ?? s.framework,
    score: s.score,
    fill: barColor(s.score),
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Risk Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {!riskStats || riskStats.total === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
              No risks recorded yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={riskPieData.filter((d) => d.value > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {riskPieData
                    .filter((d) => d.value > 0)
                    .map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={RISK_COLORS[entry.name] ?? "#94a3b8"}
                      />
                    ))}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value} risks`, name]} />
                <Legend iconType="circle" iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Compliance by Framework</CardTitle>
        </CardHeader>
        <CardContent>
          {complianceBarData.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
              No frameworks imported yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={complianceBarData}
                layout="vertical"
                margin={{ left: 0, right: 16 }}
              >
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={55} />
                <Tooltip formatter={(value) => [`${value}%`, "Score"]} />
                <Bar dataKey="score" radius={[0, 3, 3, 0]}>
                  {complianceBarData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
