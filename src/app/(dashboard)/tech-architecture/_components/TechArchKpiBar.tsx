"use client";

import {
  Building2,
  Package,
  Boxes,
  AlertTriangle,
  Link2,
  ShieldCheck,
  BookOpen,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";

function KpiCard({
  label,
  value,
  icon: Icon,
  valueClass,
  suffix,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  valueClass?: string;
  suffix?: string;
}) {
  return (
    <div className="bg-card rounded-lg border border-border px-4 py-2.5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <Icon className="h-3 w-3 text-muted-foreground" />
      </div>
      <p className={`text-xl font-bold tabular-nums ${valueClass ?? ""}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
        {suffix && <span className="text-xs text-muted-foreground ml-1 font-normal">{suffix}</span>}
      </p>
    </div>
  );
}

export function TechArchKpiBar() {
  const { data, isLoading } = trpc.techArchitecture.kpis.useQuery();

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-8 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-[68px] rounded-lg bg-muted/40 animate-pulse" />
        ))}
      </div>
    );
  }

  const eolClass = data.atRiskComponents > 0 ? "text-rose-600" : "";
  const findingsClass = data.findingsBySeverity.high > 0 ? "text-rose-600" : data.findingsTotal > 0 ? "text-amber-600" : "";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-8 gap-3">
      <KpiCard label="Vendors" value={data.vendorCount} icon={Building2} />
      <KpiCard label="Products" value={data.productCount} icon={Package} />
      <KpiCard label="Components" value={data.componentCount} icon={Boxes} />
      <KpiCard
        label="EOL Risk"
        value={data.atRiskComponents}
        icon={AlertTriangle}
        valueClass={eolClass}
      />
      <KpiCard label="App Coverage" value={`${data.coveragePct}`} suffix="%" icon={Link2} />
      <KpiCard label="Standards" value={data.activeStandardCount} icon={ShieldCheck} />
      <KpiCard
        label="Ref Archs"
        value={data.activeReferenceArchCount}
        icon={BookOpen}
      />
      <KpiCard
        label="Findings"
        value={data.findingsTotal}
        icon={AlertTriangle}
        valueClass={findingsClass}
      />
    </div>
  );
}
