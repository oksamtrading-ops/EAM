"use client";

import { useState } from "react";
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

export function RoadmapPageClient() {
  const [view, setView] = useState<ViewMode>("gantt");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showArchState, setShowArchState] = useState(false);

  const { data: roadmap } = trpc.initiative.getRoadmapData.useQuery();
  const { data: objectives } = trpc.objective.list.useQuery();
  const { data: capabilities } = trpc.capability.getTree.useQuery();

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
      <div className="flex h-full">
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <RoadmapToolbar
            view={view}
            onViewChange={setView}
            onNewInitiative={() => setShowCreate(true)}
            onArchState={() => setShowArchState(true)}
          />

          <ObjectiveProgressStrip objectives={objectives as any} />

          {view === "gantt" && <GanttView />}
          {view === "lanes" && <LaneView />}
          {view === "kanban" && <KanbanView />}
        </main>

        {selectedId && (
          <InitiativeDetailPanel
            initiativeId={selectedId}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>

      <InitiativeFormModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
      />

      <ArchStatePanel
        open={showArchState}
        onClose={() => setShowArchState(false)}
      />
    </RoadmapContext.Provider>
  );
}
