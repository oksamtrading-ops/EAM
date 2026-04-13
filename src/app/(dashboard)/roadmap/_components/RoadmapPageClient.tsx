"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { RoadmapContext } from "./RoadmapContext";
import { RoadmapToolbar, type ViewMode } from "./RoadmapToolbar";
import { ObjectiveProgressStrip } from "./ObjectiveProgressStrip";
import { GanttView } from "./views/GanttView";
import { LaneView } from "./views/LaneView";
import { KanbanView } from "./views/KanbanView";
import { InitiativeDetailPanel } from "./panels/InitiativeDetailPanel";
import { InitiativeFormModal } from "./modals/InitiativeFormModal";
import { ArchStatePanel } from "./panels/ArchStatePanel";

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", JPY: "¥", CAD: "CA$",
};

function formatBudget(amount: any, currency = "USD") {
  if (!amount) return null;
  const num = Number(amount);
  if (isNaN(num)) return null;
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency + " ";
  if (num >= 1_000_000) return `${symbol}${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${symbol}${(num / 1_000).toFixed(0)}K`;
  return `${symbol}${num.toLocaleString()}`;
}

export function RoadmapPageClient() {
  const searchParams = useSearchParams();
  const [view, setView] = useState<ViewMode>("gantt");
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("id"));
  const [showCreate, setShowCreate] = useState(false);
  const [showArchState, setShowArchState] = useState(false);
  const autoOpenAI = searchParams.get("ai") === "1";

  // If ?id is present in URL, make sure it's selected
  useEffect(() => {
    const id = searchParams.get("id");
    if (id) setSelectedId(id);
  }, [searchParams]);

  const { data: roadmap } = trpc.initiative.getRoadmapData.useQuery();
  const { data: objectives } = trpc.objective.list.useQuery();
  const { data: capabilities } = trpc.capability.getTree.useQuery();
  const { data: apps } = trpc.application.list.useQuery();

  const stats = useMemo(() => {
    const all = roadmap?.initiatives ?? [];
    const active = all.filter((i) => i.status !== "CANCELLED" && i.status !== "COMPLETE").length;
    const completed = all.filter((i) => i.status === "COMPLETE").length;
    const inProgress = all.filter((i) => i.status === "IN_PROGRESS").length;
    const cancelled = all.filter((i) => i.status === "CANCELLED").length;
    const totalUsd = all.reduce((sum, i) => sum + (i.budgetUsd ? Number(i.budgetUsd) : 0), 0);
    return { active, completed, inProgress, cancelled, totalUsd };
  }, [roadmap?.initiatives]);

  return (
    <RoadmapContext.Provider
      value={{
        roadmap,
        objectives,
        capabilities,
        selectedId,
        setSelectedId,
      }}
    >
      <div className="h-full">
        <main className="flex flex-col h-full min-w-0 overflow-hidden">
          <RoadmapToolbar
            view={view}
            onViewChange={setView}
            onNewInitiative={() => setShowCreate(true)}
            onArchState={() => setShowArchState(true)}
          />

          {/* Snapshot header */}
          <div className="px-6 pt-4 pb-4 border-b bg-background shrink-0">
            <div className="grid grid-cols-5 gap-4">
              {[
                { label: "Active Initiatives", value: stats.active, color: "text-foreground" },
                { label: "Completed", value: stats.completed, color: "text-emerald-500" },
                { label: "In Progress", value: stats.inProgress, color: "text-blue-500" },
                { label: "Cancelled", value: stats.cancelled, color: "text-rose-500" },
                { label: "Total Investment", value: formatBudget(stats.totalUsd) ?? "—", color: "text-foreground" },
              ].map((s) => (
                <div key={s.label} data-slot="card" className="bg-white rounded-xl border p-4 shadow-sm">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          <ObjectiveProgressStrip objectives={objectives as any} />

          {view === "gantt" && <GanttView />}
          {view === "lanes" && <LaneView />}
          {view === "kanban" && <KanbanView />}
        </main>
      </div>

      {selectedId && (
        <InitiativeDetailPanel
          initiativeId={selectedId}
          onClose={() => setSelectedId(null)}
          autoOpenAI={autoOpenAI}
        />
      )}

      <InitiativeFormModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        apps={apps ?? []}
      />

      <ArchStatePanel
        open={showArchState}
        onClose={() => setShowArchState(false)}
      />
    </RoadmapContext.Provider>
  );
}
