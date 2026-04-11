"use client";

import { useMemo } from "react";
import { trpc } from "@/lib/trpc/client";
import { useRoadmapContext } from "../RoadmapContext";
import { InitiativeCard } from "../shared/InitiativeCard";

const KANBAN_COLUMNS = [
  "DRAFT",
  "PLANNED",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETE",
] as const;

const COLUMN_CONFIG: Record<
  string,
  { label: string; headerClass: string; bodyClass: string }
> = {
  DRAFT: {
    label: "Draft",
    headerClass: "border-gray-300 bg-gray-50",
    bodyClass: "bg-gray-50/50",
  },
  PLANNED: {
    label: "Planned",
    headerClass: "border-blue-300 bg-blue-50",
    bodyClass: "bg-blue-50/50",
  },
  IN_PROGRESS: {
    label: "In Progress",
    headerClass: "border-green-300 bg-green-50",
    bodyClass: "bg-green-50/50",
  },
  ON_HOLD: {
    label: "On Hold",
    headerClass: "border-yellow-300 bg-yellow-50",
    bodyClass: "bg-yellow-50/50",
  },
  COMPLETE: {
    label: "Complete",
    headerClass: "border-emerald-300 bg-emerald-50",
    bodyClass: "bg-emerald-50/50",
  },
};

export function KanbanView() {
  const { roadmap, setSelectedId } = useRoadmapContext();
  const utils = trpc.useUtils();
  const updateStatus = trpc.initiative.updateStatus.useMutation({
    onSuccess: () => utils.initiative.getRoadmapData.invalidate(),
  });

  const byStatus = useMemo(() => {
    const map = new Map<string, any[]>();
    KANBAN_COLUMNS.forEach((s) => map.set(s, []));
    roadmap?.initiatives?.forEach((i) => {
      const bucket = map.get(i.status) ?? [];
      bucket.push(i);
      map.set(i.status, bucket);
    });
    return map;
  }, [roadmap?.initiatives]);

  return (
    <div className="flex gap-3 p-4 overflow-x-auto h-full">
      {KANBAN_COLUMNS.map((status) => {
        const items = byStatus.get(status) ?? [];
        const config = COLUMN_CONFIG[status];

        return (
          <div
            key={status}
            className={`w-72 shrink-0 rounded-lg border-2 flex flex-col ${config.headerClass}`}
          >
            <div className="p-3 border-b border-inherit">
              <span className="font-semibold text-sm">{config.label}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                ({items.length})
              </span>
            </div>
            <div
              className={`flex-1 p-2 space-y-2 overflow-y-auto ${config.bodyClass}`}
            >
              {items.map((initiative) => (
                <InitiativeCard
                  key={initiative.id}
                  initiative={initiative}
                  onClick={() => setSelectedId(initiative.id)}
                  onStatusChange={(newStatus) =>
                    updateStatus.mutate({ id: initiative.id, status: newStatus as any })
                  }
                />
              ))}
              {items.length === 0 && (
                <p className="text-[11px] text-muted-foreground text-center py-6">
                  Empty
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
