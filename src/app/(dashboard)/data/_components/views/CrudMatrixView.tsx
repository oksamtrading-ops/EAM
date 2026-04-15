"use client";

import { useMemo, useState } from "react";
import { AppWindow, Table2, Filter, Grid3x3 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ClassificationBadge } from "@/components/shared/ClassificationBadge";
import { useDataContext } from "../DataContext";
import { ENTITY_TYPE_LABELS } from "@/lib/constants/data-architecture-colors";

type Axis = "app" | "entity";

const OPS = [
  { key: "creates", letter: "C", title: "Creates" },
  { key: "reads", letter: "R", title: "Reads" },
  { key: "updates", letter: "U", title: "Updates" },
  { key: "deletes", letter: "D", title: "Deletes" },
] as const;

type OpKey = (typeof OPS)[number]["key"];

export function CrudMatrixView() {
  const { setSelectedEntityId } = useDataContext();
  const [axis, setAxis] = useState<Axis>("app");
  const [pivotId, setPivotId] = useState<string>("");
  const [search, setSearch] = useState("");

  const { data: apps = [] } = trpc.application.list.useQuery();
  const { data: entities = [] } = trpc.dataEntity.list.useQuery({});
  const { data: usages = [], isLoading } = trpc.appEntityUsage.list.useQuery(
    pivotId
      ? axis === "app"
        ? { appId: pivotId }
        : { entityId: pivotId }
      : undefined,
    { enabled: true }
  );

  const utils = trpc.useUtils();
  const upsertMutation = trpc.appEntityUsage.upsert.useMutation({
    onSuccess: () => {
      utils.appEntityUsage.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  // Index existing usages for quick lookup by (appId, entityId)
  const usageMap = useMemo(() => {
    const m = new Map<string, (typeof usages)[number]>();
    for (const u of usages) m.set(`${u.appId}::${u.entityId}`, u);
    return m;
  }, [usages]);

  const lookup = (appId: string, entityId: string) =>
    usageMap.get(`${appId}::${entityId}`);

  function toggle(appId: string, entityId: string, op: OpKey) {
    const existing = lookup(appId, entityId);
    const current = existing?.[op] ?? false;
    upsertMutation.mutate({
      appId,
      entityId,
      creates: op === "creates" ? !current : existing?.creates ?? false,
      reads: op === "reads" ? !current : existing?.reads ?? false,
      updates: op === "updates" ? !current : existing?.updates ?? false,
      deletes: op === "deletes" ? !current : existing?.deletes ?? false,
    });
  }

  // When no pivot is selected, show aggregate view: list of existing usages
  if (!pivotId) {
    const filtered = search
      ? usages.filter(
          (u) =>
            u.app.name.toLowerCase().includes(search.toLowerCase()) ||
            u.entity.name.toLowerCase().includes(search.toLowerCase())
        )
      : usages;

    return (
      <div className="h-full flex flex-col overflow-hidden">
        <FilterBar
          axis={axis}
          setAxis={setAxis}
          pivotId={pivotId}
          setPivotId={setPivotId}
          apps={apps}
          entities={entities}
          search={search}
          setSearch={setSearch}
          count={filtered.length}
          isLoading={isLoading}
          aggregate
        />

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 rounded-lg border border-border bg-muted/30 animate-pulse"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="h-full flex items-center justify-center p-6">
              <div className="text-center max-w-md">
                <Grid3x3 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-base font-semibold mb-1">
                  No application ↔ entity usage recorded yet
                </h3>
                <p className="text-sm text-muted-foreground">
                  Pick an application or an entity above to pivot the matrix and start
                  recording which apps create, read, update, or delete each entity.
                </p>
              </div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background/95 backdrop-blur border-b border-border z-10">
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 sm:px-6 py-2.5 font-semibold">Application</th>
                  <th className="px-3 py-2.5 font-semibold">Entity</th>
                  <th className="px-3 py-2.5 font-semibold">Classification</th>
                  <th className="px-3 py-2.5 font-semibold text-center">C R U D</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-border hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 sm:px-6 py-2.5">
                      <div className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                        <AppWindow className="h-3.5 w-3.5 text-muted-foreground" />
                        {u.app.name}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => setSelectedEntityId(u.entity.id)}
                        className="inline-flex items-center gap-1.5 text-sm text-foreground hover:text-primary hover:underline"
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: u.entity.domain.color ?? "#94a3b8" }}
                        />
                        {u.entity.name}
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <ClassificationBadge classification={u.entity.classification} />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        {OPS.map((op) => (
                          <CrudCell
                            key={op.key}
                            active={u[op.key]}
                            letter={op.letter}
                            title={op.title}
                            onClick={() => toggle(u.appId, u.entityId, op.key)}
                          />
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  // Pivoted view — rows = the opposite axis, all options shown
  const rows =
    axis === "app"
      ? entities.filter((e) =>
          search ? e.name.toLowerCase().includes(search.toLowerCase()) : true
        )
      : apps.filter((a) =>
          search ? a.name.toLowerCase().includes(search.toLowerCase()) : true
        );

  const pivotLabel =
    axis === "app"
      ? apps.find((a) => a.id === pivotId)?.name ?? ""
      : entities.find((e) => e.id === pivotId)?.name ?? "";

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <FilterBar
        axis={axis}
        setAxis={setAxis}
        pivotId={pivotId}
        setPivotId={setPivotId}
        apps={apps}
        entities={entities}
        search={search}
        setSearch={setSearch}
        count={rows.length}
        isLoading={false}
      />

      <div className="flex-1 overflow-auto">
        <div className="px-4 sm:px-6 py-3 border-b border-border bg-muted/20 text-xs text-muted-foreground">
          Showing {axis === "app" ? "all entities used by" : "all apps that use"}{" "}
          <span className="font-semibold text-foreground">{pivotLabel}</span>. Click any
          C/R/U/D cell to toggle — empty rows are auto-cleaned.
        </div>

        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background/95 backdrop-blur border-b border-border z-10">
            <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 sm:px-6 py-2.5 font-semibold">
                {axis === "app" ? "Entity" : "Application"}
              </th>
              {axis === "app" ? (
                <>
                  <th className="px-3 py-2.5 font-semibold">Type</th>
                  <th className="px-3 py-2.5 font-semibold">Classification</th>
                </>
              ) : (
                <th className="px-3 py-2.5 font-semibold">Lifecycle</th>
              )}
              <th className="px-3 py-2.5 font-semibold text-center">C R U D</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const appId = axis === "app" ? pivotId : row.id;
              const entityId = axis === "app" ? row.id : pivotId;
              const usage = lookup(appId, entityId);
              return (
                <tr
                  key={row.id}
                  className="border-b border-border hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 sm:px-6 py-2.5">
                    {axis === "app" ? (
                      <button
                        onClick={() => setSelectedEntityId(row.id)}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary hover:underline"
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{
                            background:
                              "domain" in row
                                ? row.domain.color ?? "#94a3b8"
                                : "#94a3b8",
                          }}
                        />
                        {row.name}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                        <AppWindow className="h-3.5 w-3.5 text-muted-foreground" />
                        {row.name}
                      </span>
                    )}
                  </td>
                  {axis === "app" && "entityType" in row ? (
                    <>
                      <td className="px-3 py-2.5 text-[12px] text-muted-foreground">
                        {ENTITY_TYPE_LABELS[row.entityType]}
                      </td>
                      <td className="px-3 py-2.5">
                        <ClassificationBadge classification={row.classification} />
                      </td>
                    </>
                  ) : (
                    <td className="px-3 py-2.5 text-[12px] text-muted-foreground">
                      {"lifecycle" in row ? row.lifecycle : "—"}
                    </td>
                  )}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-1">
                      {OPS.map((op) => (
                        <CrudCell
                          key={op.key}
                          active={usage?.[op.key] ?? false}
                          letter={op.letter}
                          title={op.title}
                          onClick={() => toggle(appId, entityId, op.key)}
                        />
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 sm:px-6 py-10 text-center">
                  <Filter className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No {axis === "app" ? "entities" : "applications"} match your search.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CrudCell({
  active,
  letter,
  title,
  onClick,
}: {
  active: boolean;
  letter: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded border text-[10px] font-mono font-semibold transition-colors",
        active
          ? "bg-primary/15 text-primary border-primary/40 hover:bg-primary/25"
          : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/60"
      )}
    >
      {letter}
    </button>
  );
}

function FilterBar({
  axis,
  setAxis,
  pivotId,
  setPivotId,
  apps,
  entities,
  search,
  setSearch,
  count,
  isLoading,
  aggregate = false,
}: {
  axis: Axis;
  setAxis: (a: Axis) => void;
  pivotId: string;
  setPivotId: (id: string) => void;
  apps: { id: string; name: string }[];
  entities: { id: string; name: string }[];
  search: string;
  setSearch: (s: string) => void;
  count: number;
  isLoading: boolean;
  aggregate?: boolean;
}) {
  return (
    <div className="shrink-0 px-4 sm:px-6 py-3 border-b border-border bg-background/60 flex items-center gap-2 flex-wrap">
      <div className="inline-flex rounded-md border border-border overflow-hidden">
        <button
          onClick={() => {
            setAxis("app");
            setPivotId("");
          }}
          className={cn(
            "px-3 h-8 text-[12px] font-medium transition-colors inline-flex items-center gap-1.5",
            axis === "app"
              ? "bg-primary/10 text-primary"
              : "bg-background text-muted-foreground hover:text-foreground"
          )}
        >
          <AppWindow className="h-3.5 w-3.5" />
          By App
        </button>
        <button
          onClick={() => {
            setAxis("entity");
            setPivotId("");
          }}
          className={cn(
            "px-3 h-8 text-[12px] font-medium transition-colors inline-flex items-center gap-1.5 border-l border-border",
            axis === "entity"
              ? "bg-primary/10 text-primary"
              : "bg-background text-muted-foreground hover:text-foreground"
          )}
        >
          <Table2 className="h-3.5 w-3.5" />
          By Entity
        </button>
      </div>

      <select
        value={pivotId}
        onChange={(e) => setPivotId(e.target.value)}
        className="h-8 px-2 min-w-[180px] rounded-md border border-border bg-background text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        <option value="">— All recorded usage —</option>
        {(axis === "app" ? apps : entities).map((it) => (
          <option key={it.id} value={it.id}>
            {it.name}
          </option>
        ))}
      </select>

      <input
        type="text"
        placeholder={`Search ${aggregate ? "app or entity" : axis === "app" ? "entities" : "apps"}…`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-8 px-3 min-w-[180px] flex-1 max-w-xs rounded-md border border-border bg-background text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
      />

      {(search || pivotId) && (
        <button
          onClick={() => {
            setSearch("");
            setPivotId("");
          }}
          className="text-[12px] text-muted-foreground hover:text-foreground"
        >
          Clear
        </button>
      )}

      <span className="ml-auto text-[11px] text-muted-foreground">
        {isLoading ? "Loading…" : `${count} row${count === 1 ? "" : "s"}`}
      </span>
    </div>
  );
}
