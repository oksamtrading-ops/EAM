"use client";

import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DashboardKpis } from "@/lib/contracts/dashboard";
import {
  Layers,
  AlertTriangle,
  MonitorCheck,
  ShieldAlert,
  ClipboardCheck,
  CalendarX,
} from "lucide-react";

interface Props {
  kpis: DashboardKpis | null;
  loading: boolean;
}

function KpiCard({
  label,
  primary,
  secondary,
  secondaryLabel,
  icon: Icon,
  alertCondition,
  tooltip,
  secondaryTooltip,
}: {
  label: string;
  primary: number | string;
  secondary?: number | string;
  secondaryLabel?: string;
  icon: React.ElementType;
  alertCondition?: boolean;
  tooltip?: string;
  secondaryTooltip?: string;
}) {
  const card = (
    <Card className="p-4 flex items-start gap-3">
      <div className="mt-0.5 rounded-md bg-muted p-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-2xl font-bold tracking-tight leading-none mt-1">{primary}</p>
        {secondary !== undefined && (
          secondaryTooltip ? (
            <Tooltip>
              <TooltipTrigger>
                <p className={`text-xs mt-1 cursor-help w-fit ${alertCondition ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                  {secondary} {secondaryLabel}
                </p>
              </TooltipTrigger>
              <TooltipContent side="bottom">{secondaryTooltip}</TooltipContent>
            </Tooltip>
          ) : (
            <p className={`text-xs mt-1 ${alertCondition ? "text-destructive font-medium" : "text-muted-foreground"}`}>
              {secondary} {secondaryLabel}
            </p>
          )
        )}
      </div>
    </Card>
  );

  if (!tooltip) return card;
  return (
    <Tooltip>
      <TooltipTrigger>{card}</TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function KpiBar({ kpis, loading }: Props) {
  if (loading || !kpis) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-4 h-24 animate-pulse bg-muted/50" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      <KpiCard
        label="Capabilities"
        primary={kpis.totalCapabilities}
        secondary={kpis.criticalCapabilities}
        secondaryLabel="critical"
        icon={Layers}
        alertCondition={kpis.criticalCapabilities > 0}
        tooltip="Total business capabilities mapped across all hierarchy levels (L1–L3)"
        secondaryTooltip="Capabilities rated as Critical strategic importance — require immediate attention"
      />
      <KpiCard
        label="Applications"
        primary={kpis.totalApplications}
        secondary={kpis.appsWithEolRisk}
        secondaryLabel="EOL risk"
        icon={MonitorCheck}
        alertCondition={kpis.appsWithEolRisk > 0}
        tooltip="Total applications in the portfolio, including all lifecycle stages"
        secondaryTooltip="Applications approaching or past their End-of-Life date — action recommended"
      />
      <KpiCard
        label="Open Risks"
        primary={kpis.openRisks}
        secondary={kpis.criticalRisks}
        secondaryLabel="critical"
        icon={ShieldAlert}
        alertCondition={kpis.criticalRisks > 0}
        tooltip="Active technology risks that have not yet been mitigated or accepted"
        secondaryTooltip="Risks scored as Critical (High likelihood × High impact) — urgent remediation required"
      />
      <KpiCard
        label="Compliance Score"
        primary={`${kpis.avgComplianceScore}%`}
        icon={ClipboardCheck}
        alertCondition={kpis.avgComplianceScore < 50}
        tooltip="Average compliance score across all active compliance frameworks (SOC2, ISO27001, GDPR, etc.). Below 50% requires urgent attention."
      />
      <KpiCard
        label="Overdue Initiatives"
        primary={kpis.overdueInitiatives}
        icon={CalendarX}
        alertCondition={kpis.overdueInitiatives > 0}
        tooltip="Architecture roadmap initiatives whose end date has passed and are not yet marked Complete"
      />
      <KpiCard
        label="EOL Exposures"
        primary={kpis.appsWithEolRisk}
        secondary={kpis.appsWithEolRisk > 0 ? "needs attention" : "all clear"}
        icon={AlertTriangle}
        alertCondition={kpis.appsWithEolRisk > 0}
        tooltip="Applications with an End-of-Life date within the next 12 months or already expired"
      />
    </div>
  );
}
