"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "sonner";
import { CapabilityToolbar } from "./CapabilityToolbar";
import { GridView } from "./views/GridView";
import { HeatMapView } from "./views/HeatMapView";
import { TreeView } from "./views/TreeView";
import { CapabilityDetailPanel } from "./panels/CapabilityDetailPanel";
import { AISuggestionPanel } from "./panels/AISuggestionPanel";
import { VersionHistoryPanel } from "./panels/VersionHistoryPanel";
import { CreateCapabilityDialog } from "./modals/CreateCapabilityDialog";
import { TemplateImportDialog } from "./modals/TemplateImportDialog";

export type ViewMode = "grid" | "heatmap" | "tree";

export function CapabilityPageClient() {
  const [view, setView] = useState<ViewMode>("grid");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [colorBy, setColorBy] = useState<"maturity" | "importance">("maturity");

  const { workspaceId } = useWorkspace();
  const { data: tree, isLoading } = trpc.capability.getTree.useQuery();

  const isEmpty = !isLoading && (!tree || tree.length === 0);

  async function handleExport() {
    toast.info("Generating PowerPoint...");
    try {
      const res = await fetch("/api/export/pptx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") ?? "Capability_Map.pptx";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PPTX downloaded");
    } catch {
      toast.error("Export failed");
    }
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <CapabilityToolbar
          view={view}
          onViewChange={setView}
          colorBy={colorBy}
          onColorByChange={setColorBy}
          onCreateNew={() => setShowCreate(true)}
          onImport={() => setShowImport(true)}
          onExport={handleExport}
          onAI={() => { setShowAI(!showAI); setShowVersions(false); }}
          showAI={showAI}
          onVersions={() => { setShowVersions(!showVersions); setShowAI(false); }}
          showVersions={showVersions}
          capabilityCount={countCapabilities(tree ?? [])}
        />

        <div className={`flex-1 overflow-auto ${view === "tree" ? "p-2" : "p-6"}`}>
          {isLoading ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Loading capabilities...
            </div>
          ) : isEmpty ? (
            <EmptyState
              onCreateNew={() => setShowCreate(true)}
              onImport={() => setShowImport(true)}
            />
          ) : (
            <>
              {view === "grid" && (
                <GridView
                  tree={tree ?? []}
                  colorBy={colorBy}
                  onSelect={setSelectedId}
                  selectedId={selectedId}
                />
              )}
              {view === "heatmap" && (
                <HeatMapView
                  tree={tree ?? []}
                  colorBy={colorBy}
                  onSelect={setSelectedId}
                  selectedId={selectedId}
                />
              )}
              {view === "tree" && (
                <TreeView
                  tree={tree ?? []}
                  colorBy={colorBy}
                  onSelect={setSelectedId}
                  selectedId={selectedId}
                />
              )}
            </>
          )}
        </div>
      </div>

      {selectedId && !showAI && (
        <CapabilityDetailPanel
          capabilityId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}

      <AISuggestionPanel
        open={showAI}
        onClose={() => setShowAI(false)}
        tree={tree ?? []}
      />

      <VersionHistoryPanel
        open={showVersions}
        onClose={() => setShowVersions(false)}
      />

      <CreateCapabilityDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        parentOptions={tree ?? []}
      />

      <TemplateImportDialog
        open={showImport}
        onClose={() => setShowImport(false)}
      />
    </div>
  );
}

function EmptyState({
  onCreateNew,
  onImport,
}: {
  onCreateNew: () => void;
  onImport: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#86BC25]/10 flex items-center justify-center mb-5">
        <svg className="h-8 w-8 text-[#86BC25]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-[#1a1f2e] mb-2">
        No capabilities mapped yet
      </h2>
      <p className="text-sm text-muted-foreground mb-8 max-w-md leading-relaxed">
        Start by importing a pre-built industry template with L1 and L2
        capabilities, or create your first capability from scratch.
      </p>
      <div className="flex gap-3">
        <button
          onClick={onImport}
          className="px-5 py-2.5 bg-[#86BC25] text-white rounded-lg text-sm font-semibold hover:bg-[#76a821] transition-colors shadow-sm"
        >
          Import Industry Template
        </button>
        <button
          onClick={onCreateNew}
          className="px-5 py-2.5 border border-[#dee2e6] rounded-lg text-sm font-medium text-[#495057] hover:bg-[#f8f9fa] transition-colors"
        >
          Create Manually
        </button>
      </div>
    </div>
  );
}

function countCapabilities(tree: any[]): number {
  let count = 0;
  for (const node of tree) {
    count += 1;
    if (node.children) {
      count += countCapabilities(node.children);
    }
  }
  return count;
}
