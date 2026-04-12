"use client";

import { Card } from "@/components/ui/card";
import type { DashboardKpis } from "@/lib/contracts/dashboard";
import {
  MonitorCheck,
  Layers,
  ShieldAlert,
  ClipboardCheck,
  DollarSign,
} from "lucide-react";

interface Props {
  kpis: DashboardKpis | null;
  loading: boolean;
  isError?: boolean;
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toLocaleString();
}

function KpiCard({
  label,
  value,
  icon: Icon,
  suffix,
  prefix,
  accent,
  compact,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  suffix?: string;
  prefix?: string;
  accent?: boolean;
  compact?: boolean;
}) {
  return (
    <Card
      className={`p-5 flex flex-col gap-2 ${accent ? "border-l-4 border-l-amber-400" : ""}`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <div className="rounded-md bg-muted p-1.5">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>
      <p className="text-3xl font-bold tracking-tight leading-none">
        {prefix}{compact ? formatCompact(value) : value.toLocaleString()}{suffix}
      </p>
    </Card>
  );
}

export function KpiStripV2({ kpis, loading, isError }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-5 h-24 animate-pulse bg-muted/50" />
        ))}
      </div>
    );
  }

  if (isError || !kpis) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {["Total Applications", "Business Capabilities", "Open Risks", "Compliance Score", "Annual IT Cost"].map((label) => (
          <Card key={label} className="p-5 flex flex-col gap-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold text-muted-foreground">&mdash;</p>
            <p className="text-[10px] text-red-500">Unable to load</p>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          label="Total Applications"
          value={kpis.totalApplications}
          icon={MonitorCheck}
        />
        <KpiCard
          label="Business Capabilities"
          value={kpis.totalCapabilities}
          icon={Layers}
        />
        <KpiCard
          label="Open Risks"
          value={kpis.openRisks}
          icon={ShieldAlert}
          accent={kpis.criticalRisks > 0}
        />
        <KpiCard
          label="Compliance Score"
          value={kpis.avgComplianceScore}
          icon={ClipboardCheck}
          suffix="%"
        />
        <KpiCard
          label="Annual IT Cost"
          value={kpis.totalAnnualCost}
          icon={DollarSign}
          prefix={kpis.costCurrency === "USD" ? "$" : kpis.costCurrency + " "}
          compact
        />
      </div>

      {/* Alert chips */}
      <div className="flex flex-wrap gap-2">
        {kpis.criticalRisks > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-3 py-1 text-xs font-medium text-red-700">
            <ShieldAlert className="h-3 w-3" />
            {kpis.criticalRisks} critical risk{kpis.criticalRisks !== 1 ? "s" : ""}
          </span>
        )}
        {kpis.appsWithEolRisk > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-medium text-amber-700">
            {kpis.appsWithEolRisk} EOL exposure{kpis.appsWithEolRisk !== 1 ? "s" : ""}
          </span>
        )}
        {kpis.overdueInitiatives > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 border border-orange-200 px-3 py-1 text-xs font-medium text-orange-700">
            {kpis.overdueInitiatives} overdue initiative{kpis.overdueInitiatives !== 1 ? "s" : ""}
          </span>
        )}
        {kpis.upcomingRenewals > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-medium text-blue-700">
            {kpis.upcomingRenewals} renewal{kpis.upcomingRenewals !== 1 ? "s" : ""} in 30 days
          </span>
        )}
        {kpis.criticalRisks === 0 && kpis.appsWithEolRisk === 0 && kpis.overdueInitiatives === 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700">
            All clear &mdash; no critical items
          </span>
        )}
      </div>
    </div>
  );
}
