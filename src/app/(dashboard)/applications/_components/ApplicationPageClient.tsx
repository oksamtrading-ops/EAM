"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "sonner";
import { ApplicationToolbar } from "./ApplicationToolbar";
import { TableView } from "./views/TableView";
import { LandscapeView } from "./views/LandscapeView";
import { RationalizationMatrix } from "./views/RationalizationMatrix";
import { ApplicationDetailPanel } from "./panels/ApplicationDetailPanel";
import { RationalizationPanel } from "./panels/RationalizationPanel";
import { AppAIPanel } from "./panels/AppAIPanel";
import { AppMappingPanel } from "./panels/AppMappingPanel";
import { CreateApplicationDialog } from "./modals/CreateApplicationDialog";
import { ImportExcelDialog } from "./modals/ImportExcelDialog";
import { AppWindow } from "lucide-react";

export type AppViewMode = "table" | "landscape" | "matrix";

export function ApplicationPageClient() {
  const [view, setView] = useState<AppViewMode>("table");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showRationalization, setShowRationalization] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showAutoMap, setShowAutoMap] = useState(false);
  const [autoMapAppId, setAutoMapAppId] = useState<string | null>(null);

  const { workspaceId } = useWorkspace();
  const { data: apps, isLoading, error } = trpc.application.list.useQuery();
  const { data: capTree } = trpc.capability.getTree.useQuery();

  const isEmpty = !isLoading && !error && (!apps || apps.length === 0);

  async function handleExport() {
    toast.info("Generating APM PowerPoint...");
    try {
      const res = await fetch("/api/export/apm-pptx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Application_Portfolio.pptx";
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
        <ApplicationToolbar
          view={view}
          onViewChange={setView}
          onCreateNew={() => setShowCreate(true)}
          onImport={() => setShowImport(true)}
          onExport={handleExport}
          onRationalization={() => { setShowRationalization(!showRationalization); setShowAI(false); setShowAutoMap(false); }}
          showRationalization={showRationalization}
          onAI={() => { setShowAI(!showAI); setShowRationalization(false); setShowAutoMap(false); }}
          showAI={showAI}
          onAutoMap={() => { setShowAutoMap(!showAutoMap); setAutoMapAppId(null); setShowAI(false); setShowRationalization(false); }}
          showAutoMap={showAutoMap && !autoMapAppId}
          appCount={apps?.length ?? 0}
        />

        <div className="flex-1 overflow-auto p-6">
          {error ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <p className="text-sm text-red-600 mb-2">Failed to load applications</p>
              <p className="text-xs text-muted-foreground">{error.message}</p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Loading applications...
            </div>
          ) : isEmpty ? (
            <EmptyState onCreateNew={() => setShowCreate(true)} />
          ) : (
            <>
              {view === "table" && (
                <TableView
                  apps={apps ?? []}
                  onSelect={setSelectedId}
                  selectedId={selectedId}
                />
              )}
              {view === "landscape" && (
                <LandscapeView
                  apps={apps ?? []}
                  capTree={capTree ?? []}
                  onSelect={setSelectedId}
                  selectedId={selectedId}
                />
              )}
              {view === "matrix" && (
                <RationalizationMatrix
                  apps={apps ?? []}
                  onSelect={setSelectedId}
                  selectedId={selectedId}
                />
              )}
            </>
          )}
        </div>
      </div>

      {selectedId && !showRationalization && !showAI && !showAutoMap && (
        <ApplicationDetailPanel
          applicationId={selectedId}
          onClose={() => setSelectedId(null)}
          onAutoMap={(id) => { setAutoMapAppId(id); setShowAutoMap(true); }}
        />
      )}

      <AppMappingPanel
        open={showAutoMap}
        onClose={() => { setShowAutoMap(false); setAutoMapAppId(null); }}
        mode={autoMapAppId ? "single" : "batch"}
        applicationId={autoMapAppId}
        apps={apps ?? []}
      />

      <RationalizationPanel
        open={showRationalization}
        onClose={() => setShowRationalization(false)}
        apps={apps ?? []}
      />

      <AppAIPanel
        open={showAI}
        onClose={() => setShowAI(false)}
        apps={apps ?? []}
        capTree={capTree ?? []}
      />

      <CreateApplicationDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        capTree={capTree ?? []}
      />

      <ImportExcelDialog
        open={showImport}
        onClose={() => setShowImport(false)}
      />
    </div>
  );
}

function EmptyState({ onCreateNew }: { onCreateNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#3b82f6]/10 flex items-center justify-center mb-5">
        <AppWindow className="h-8 w-8 text-[#3b82f6]" />
      </div>
      <h2 className="text-xl font-bold text-[#1a1f2e] mb-2">
        No applications catalogued yet
      </h2>
      <p className="text-sm text-muted-foreground mb-8 max-w-md leading-relaxed">
        Start by adding your client's applications to build the portfolio
        landscape. Link them to capabilities to identify redundancy and gaps.
      </p>
      <button
        onClick={onCreateNew}
        className="px-5 py-2.5 bg-[#86BC25] text-white rounded-lg text-sm font-semibold hover:bg-[#76a821] transition-colors shadow-sm"
      >
        Add First Application
      </button>
    </div>
  );
}
