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
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc/client";

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  suffix,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  accent?: boolean;
  suffix?: string;
}) {
  return (
    <Card
      className={`p-4 flex flex-col gap-1.5 transition-colors ${
        accent ? "border-l-4 border-l-amber-400" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
          {label}
        </p>
        <div className="rounded-md bg-muted p-1">
          <Icon className="h-3 w-3 text-muted-foreground" />
        </div>
      </div>
      <p className="text-2xl font-bold tracking-tight leading-none">
        {typeof value === "number" ? value.toLocaleString() : value}
        {suffix && <span className="text-sm text-muted-foreground ml-1">{suffix}</span>}
      </p>
    </Card>
  );
}

export function TechArchKpiBar() {
  const { data, isLoading } = trpc.techArchitecture.kpis.useQuery();

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="p-4 h-20 animate-pulse bg-muted/50" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3">
      <KpiCard label="Vendors" value={data.vendorCount} icon={Building2} />
      <KpiCard label="Products" value={data.productCount} icon={Package} />
      <KpiCard label="Components" value={data.componentCount} icon={Boxes} />
      <KpiCard
        label="EOL Risk"
        value={data.atRiskComponents}
        icon={AlertTriangle}
        accent={data.atRiskComponents > 0}
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
        accent={data.findingsBySeverity.high > 0}
      />
    </div>
  );
}
