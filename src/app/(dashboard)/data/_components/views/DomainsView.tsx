"use client";

import { trpc } from "@/lib/trpc/client";
import { Layers, User as UserIcon, FileCog } from "lucide-react";
import { useDataContext } from "../DataContext";

export function DomainsView() {
  const { setSelectedDomainId } = useDataContext();
  const { data: domains = [], isLoading } = trpc.dataDomain.list.useQuery();

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-xl border border-border bg-muted/30 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (domains.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <Layers className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-base font-semibold mb-1">No data domains yet</h3>
          <p className="text-sm text-muted-foreground">
            Domains group related entities (e.g. Customer, Product, Finance). Create
            your first one to organize your data architecture.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 overflow-auto h-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {domains.map((d) => (
          <button
            key={d.id}
            onClick={() => setSelectedDomainId(d.id)}
            className="group text-left rounded-xl border border-border bg-card hover:shadow-md hover:border-primary/40 transition-all p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div
                className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${d.color}18`, color: d.color }}
              >
                <Layers className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-sm text-foreground truncate group-hover:text-primary">
                  {d.name}
                </h3>
                {d.description ? (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                    {d.description}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No description</p>
                )}
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-border flex items-center gap-4 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <FileCog className="h-3 w-3" />
                {d._count.entities} entit{d._count.entities === 1 ? "y" : "ies"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <UserIcon className="h-3 w-3" />
                {d.owner?.name ?? d.owner?.email ?? "No owner"}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
