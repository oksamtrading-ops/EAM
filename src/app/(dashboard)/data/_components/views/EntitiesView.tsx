"use client";

import { useState, useMemo } from "react";
import { Search, Table2, Filter } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { useDataContext } from "../DataContext";
import { ClassificationBadge } from "@/components/shared/ClassificationBadge";
import { RegulatoryTagList } from "@/components/shared/RegulatoryTagList";
import {
  ENTITY_TYPE_LABELS,
  ENTITY_TYPE_COLORS,
} from "@/lib/constants/data-architecture-colors";

export function EntitiesView() {
  const { setSelectedEntityId } = useDataContext();
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState<string>("");
  const [classificationFilter, setClassificationFilter] = useState<string>("");

  const { data: entities = [], isLoading } = trpc.dataEntity.list.useQuery({
    search: search || undefined,
    domainId: domainFilter || undefined,
    classification: classificationFilter
      ? (classificationFilter as "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED" | "DC_UNKNOWN")
      : undefined,
  });

  const { data: domains = [] } = trpc.dataDomain.list.useQuery();

  const filteredCount = entities.length;
  const hasActiveFilter = useMemo(
    () => Boolean(search || domainFilter || classificationFilter),
    [search, domainFilter, classificationFilter]
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Filter bar */}
      <div className="shrink-0 px-4 sm:px-6 py-3 border-b border-border bg-background/60 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search entities…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8 pl-8 pr-3 rounded-md border border-border bg-background text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <select
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value)}
          className="h-8 px-2 rounded-md border border-border bg-background text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">All domains</option>
          {domains.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <select
          value={classificationFilter}
          onChange={(e) => setClassificationFilter(e.target.value)}
          className="h-8 px-2 rounded-md border border-border bg-background text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">All classifications</option>
          <option value="PUBLIC">Public</option>
          <option value="INTERNAL">Internal</option>
          <option value="CONFIDENTIAL">Confidential</option>
          <option value="RESTRICTED">Restricted</option>
          <option value="DC_UNKNOWN">Not Classified</option>
        </select>

        {hasActiveFilter && (
          <button
            onClick={() => {
              setSearch("");
              setDomainFilter("");
              setClassificationFilter("");
            }}
            className="text-[12px] text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}

        <span className="ml-auto text-[11px] text-muted-foreground">
          {isLoading ? "Loading…" : `${filteredCount} entit${filteredCount === 1 ? "y" : "ies"}`}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-14 rounded-lg border border-border bg-muted/30 animate-pulse"
              />
            ))}
          </div>
        ) : entities.length === 0 ? (
          <div className="h-full flex items-center justify-center p-6">
            <div className="text-center max-w-md">
              {hasActiveFilter ? (
                <>
                  <Filter className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <h3 className="text-base font-semibold mb-1">No matches</h3>
                  <p className="text-sm text-muted-foreground">
                    Try adjusting or clearing your filters.
                  </p>
                </>
              ) : (
                <>
                  <Table2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <h3 className="text-base font-semibold mb-1">No data entities yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Create your first domain, then add entities (Customer, Order, Invoice, etc.).
                  </p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background/95 backdrop-blur border-b border-border z-10">
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 sm:px-6 py-2.5 font-semibold">Name</th>
                  <th className="px-3 py-2.5 font-semibold">Domain</th>
                  <th className="px-3 py-2.5 font-semibold">Type</th>
                  <th className="px-3 py-2.5 font-semibold">Classification</th>
                  <th className="px-3 py-2.5 font-semibold">Tags</th>
                  <th className="px-3 py-2.5 font-semibold">Steward</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Apps</th>
                </tr>
              </thead>
              <tbody>
                {entities.map((e) => (
                  <tr
                    key={e.id}
                    onClick={() => setSelectedEntityId(e.id)}
                    className={cn(
                      "border-b border-border hover:bg-muted/30 cursor-pointer transition-colors"
                    )}
                  >
                    <td className="px-4 sm:px-6 py-2.5">
                      <div className="font-medium text-foreground">{e.name}</div>
                      {e.description && (
                        <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                          {e.description}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="inline-flex items-center gap-1.5 text-xs"
                        style={{ color: e.domain.color ?? undefined }}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: e.domain.color ?? "#94a3b8" }}
                        />
                        {e.domain.name}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="text-[11px] font-medium"
                        style={{ color: ENTITY_TYPE_COLORS[e.entityType] }}
                      >
                        {ENTITY_TYPE_LABELS[e.entityType]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <ClassificationBadge classification={e.classification} />
                    </td>
                    <td className="px-3 py-2.5">
                      <RegulatoryTagList tags={e.regulatoryTags} empty="—" />
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-muted-foreground">
                      {e.steward?.name ?? e.steward?.email ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[12px] text-muted-foreground tabular-nums">
                      {e._count.appUsages}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
