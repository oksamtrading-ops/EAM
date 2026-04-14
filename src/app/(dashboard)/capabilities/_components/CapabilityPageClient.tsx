"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
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
import { BulkAssessDialog } from "./modals/BulkAssessDialog";
import { ExportDialog } from "./modals/ExportDialog";
import { InvestmentChart } from "./views/InvestmentChart";

export type ViewMode = "grid" | "heatmap" | "tree" | "investment";
export type ColorByMode = "maturity" | "importance" | "gap" | "owner";

export function CapabilityPageClient() {
  const searchParams = useSearchParams();
  const [view, setView] = useState<ViewMode>("grid");
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("id"));
  const autoOpenAI = searchParams.get("ai") === "1";
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showBulkAssess, setShowBulkAssess] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [colorBy, setColorBy] = useState<ColorByMode>("maturity");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [filterMaturity, setFilterMaturity] = useState<string>("all");
  const [showExport, setShowExport] = useState(false);

  const { workspaceId } = useWorkspace();
  const utils = trpc.useUtils();
  const { data: tree, isLoading, error } = trpc.capability.getTree.useQuery();

  const moveMutation = trpc.capability.update.useMutation({
    onSuccess: () => {
      utils.capability.getTree.invalidate();
      toast.success("Capability moved successfully");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to move capability");
    },
  });

  function handleMove(capabilityId: string, newParentId: string | null, newLevel: "L1" | "L2" | "L3") {
    moveMutation.mutate({
      id: capabilityId,
      parentId: newParentId,
      level: newLevel,
    });
  }

  const isEmpty = !isLoading && !error && (!tree || tree.length === 0);

  // Client-side filtering of the tree
  const filteredTree = useMemo(() => {
    if (!tree) return [];
    const q = searchQuery.toLowerCase().trim();
    if (!q && filterLevel === "all" && filterMaturity === "all") return tree;

    function matches(node: any): boolean {
      if (q && !node.name.toLowerCase().includes(q)) return false;
      if (filterLevel !== "all" && node.level !== filterLevel) return false;
      if (filterMaturity === "not_assessed" && node.currentMaturity !== "NOT_ASSESSED") return false;
      if (filterMaturity === "assessed" && node.currentMaturity === "NOT_ASSESSED") return false;
      return true;
    }

    function filterNode(node: any): any | null {
      const childResults = (node.children ?? []).map(filterNode).filter(Boolean);
      if (matches(node) || childResults.length > 0) {
        return { ...node, children: childResults };
      }
      return null;
    }

    return tree.map(filterNode).filter(Boolean);
  }, [tree, searchQuery, filterLevel, filterMaturity]);

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
          onCreateNew={() => setShowCreate(true)}
          onImport={() => setShowImport(true)}
          onExport={() => setShowExport(true)}
          onBulkAssess={() => setShowBulkAssess(true)}
          onAI={() => { setShowAI(!showAI); setShowVersions(false); }}
          showAI={showAI}
          onVersions={() => { setShowVersions(!showVersions); setShowAI(false); }}
          showVersions={showVersions}
          capabilityCount={countCapabilities(tree ?? [])}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterLevel={filterLevel}
          onFilterLevelChange={setFilterLevel}
          filterMaturity={filterMaturity}
          onFilterMaturityChange={setFilterMaturity}
          colorBy={colorBy}
          onColorByChange={setColorBy}
        />

        <div className={`flex-1 overflow-auto ${view === "tree" ? "p-2" : "p-3 sm:p-6"}`}>
          {error ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <p className="text-sm text-red-600 mb-2">Failed to load capabilities</p>
              <p className="text-xs text-muted-foreground">{error.message}</p>
            </div>
          ) : isLoading ? (
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
                  tree={filteredTree}
                  colorBy={colorBy}
                  onSelect={setSelectedId}
                  selectedId={selectedId}
                  onMove={handleMove}
                />
              )}
              {view === "heatmap" && (
                <HeatMapView
                  tree={filteredTree}
                  colorBy={colorBy}
                  onSelect={setSelectedId}
                  selectedId={selectedId}
                  onMove={handleMove}
                />
              )}
              {view === "tree" && (
                <TreeView
                  tree={filteredTree}
                  colorBy={colorBy}
                  onSelect={setSelectedId}
                  selectedId={selectedId}
                  onMove={handleMove}
                />
              )}
              {view === "investment" && (
                <InvestmentChart
                  tree={filteredTree}
                  onSelect={setSelectedId}
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
          onSelect={setSelectedId}
          autoOpenAI={autoOpenAI}
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

      <BulkAssessDialog
        open={showBulkAssess}
        onClose={() => setShowBulkAssess(false)}
        tree={tree ?? []}
      />

      <ExportDialog
        open={showExport}
        onClose={() => setShowExport(false)}
        onExportPptx={handleExport}
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
      <div className="w-16 h-16 rounded-2xl bg-[#0B5CD6]/10 flex items-center justify-center mb-5">
        <svg className="h-8 w-8 text-[#0B5CD6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
          className="px-5 py-2.5 bg-[#0B5CD6] text-white rounded-lg text-sm font-semibold hover:bg-[#094cb0] transition-colors shadow-sm"
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
