"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Database, ShieldAlert, UserX, Crown } from "lucide-react";
import { trpc } from "@/lib/trpc/client";

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  href,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  accent?: boolean;
  href?: string;
}) {
  const inner = (
    <Card
      className={`p-5 flex flex-col gap-2 transition-colors ${
        accent ? "border-l-4 border-l-amber-400" : ""
      } ${href ? "hover:bg-muted/40 cursor-pointer" : ""}`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
          {label}
        </p>
        <div className="rounded-md bg-muted p-1.5">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>
      <p className="text-3xl font-bold tracking-tight leading-none">
        {value.toLocaleString()}
      </p>
    </Card>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}

export function DataKpiStrip() {
  const { data: stats, isLoading, isError } = trpc.dataEntity.stats.useQuery();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-5 h-24 animate-pulse bg-muted/50" />
        ))}
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {["Data Entities", "Sensitive", "Without Steward", "Without Golden Source"].map(
          (label) => (
            <Card key={label} className="p-5 flex flex-col gap-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                {label}
              </p>
              <p className="text-2xl font-bold text-muted-foreground">&mdash;</p>
              <p className="text-[10px] text-red-500">Unable to load</p>
            </Card>
          )
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Data Architecture
        </h2>
        <Link
          href="/data"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View catalog &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Data Entities"
          value={stats.total}
          icon={Database}
          href="/data"
        />
        <KpiCard
          label="Sensitive"
          value={stats.sensitive}
          icon={ShieldAlert}
          accent={stats.sensitive > 0}
          href="/data?classification=CONFIDENTIAL"
        />
        <KpiCard
          label="Without Steward"
          value={stats.withoutSteward}
          icon={UserX}
          accent={stats.withoutSteward > 0}
          href="/data"
        />
        <KpiCard
          label="Without Golden Source"
          value={stats.withoutGoldenSource}
          icon={Crown}
          accent={stats.withoutGoldenSource > 0}
          href="/data?view=matrix"
        />
      </div>
    </div>
  );
}
