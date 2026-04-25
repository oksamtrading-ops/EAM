"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc/client";
import type { DrillDownFilter, DrillDownRow } from "@/lib/contracts/dashboard";

interface Props {
  filter: DrillDownFilter | null;
  onClose: () => void;
}

const TITLE_MAP: Record<DrillDownFilter["kind"], string> = {
  apps_by_health: "Applications by Health",
  risks: "Open Risks",
  capabilities_by_domain: "Capabilities",
  apps_by_domain: "Applications",
  eol_risk: "EOL Exposures",
  overdue_initiatives: "Overdue Initiatives",
};

function getTitle(filter: DrillDownFilter | null): string {
  if (!filter) return "";
  if (filter.kind === "apps_by_health") return `${filter.bucket.charAt(0).toUpperCase() + filter.bucket.slice(1)} Applications`;
  if (filter.kind === "risks") return filter.severity === "all" ? "All Open Risks" : `${filter.severity.charAt(0).toUpperCase() + filter.severity.slice(1)} Risks`;
  if (filter.kind === "capabilities_by_domain") return filter.domainName ? `Capabilities: ${filter.domainName}` : "All Capabilities";
  if (filter.kind === "apps_by_domain") return `Applications: ${filter.domainName}`;
  return TITLE_MAP[filter.kind];
}

function badgeClass(variant?: DrillDownRow["badgeVariant"]): string {
  if (variant === "destructive") return "bg-red-50 text-red-700 border-red-200";
  if (variant === "warning") return "bg-amber-50 text-amber-700 border-amber-200";
  if (variant === "success") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-muted text-muted-foreground border-border";
}

export function DrillDownSheet({ filter, onClose }: Props) {
  const [inputValue, setInputValue] = useState("");
  const [search, setSearch] = useState("");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearch(inputValue), 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  // Reset search when filter changes
  useEffect(() => {
    setInputValue("");
    setSearch("");
  }, [filter?.kind]);

  const queryInput = filter
    ? {
        kind: filter.kind,
        bucket: filter.kind === "apps_by_health" ? filter.bucket : undefined,
        severity: filter.kind === "risks" ? filter.severity : undefined,
        domainId:
          filter.kind === "capabilities_by_domain" || filter.kind === "apps_by_domain"
            ? filter.domainId
            : undefined,
        search: search || undefined,
      }
    : null;

  const { data, isLoading } = trpc.dashboard.getDrillDownItems.useQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryInput as any,
    { enabled: filter !== null && queryInput !== null }
  );

  const items = data?.items ?? [];

  return (
    <Sheet open={filter !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="data-[side=right]:sm:max-w-lg flex flex-col overflow-hidden p-0">
        <SheetHeader className="px-5 pt-5 pb-4 border-b">
          <SheetTitle className="text-base">{getTitle(filter)}</SheetTitle>
          <SheetDescription>
            {isLoading ? "Loading…" : `${data?.total ?? 0} result${(data?.total ?? 0) !== 1 ? "s" : ""}`}
          </SheetDescription>
        </SheetHeader>

        <div className="px-5 pt-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-9"
              placeholder="Search…"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {isLoading ? (
            <div className="space-y-3 pt-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-3 animate-pulse py-2">
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 bg-muted/60 rounded w-2/3" />
                    <div className="h-2.5 bg-muted/40 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              {search ? `No results for "${search}"` : "Nothing to show here"}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 py-3 hover:bg-muted/30 rounded-lg px-2 -mx-2 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-[var(--link)] transition-colors">
                        {item.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.sublabel}</p>
                    </div>
                    {item.badge && (
                      <span
                        className={`flex-shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${badgeClass(item.badgeVariant)}`}
                      >
                        {item.badge}
                      </span>
                    )}
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
