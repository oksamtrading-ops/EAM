"use client";

import { Table2, LayoutGrid, ScatterChart, Plus, FileDown, FileUp, BarChart3, Sparkles, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AppViewMode } from "./ApplicationPageClient";

type Props = {
  view: AppViewMode;
  onViewChange: (v: AppViewMode) => void;
  onCreateNew: () => void;
  onImport: () => void;
  onExport: () => void;
  onRationalization: () => void;
  showRationalization: boolean;
  onAI: () => void;
  showAI: boolean;
  onAutoMap: () => void;
  showAutoMap: boolean;
  appCount: number;
};

export function ApplicationToolbar({
  view,
  onViewChange,
  onCreateNew,
  onImport,
  onExport,
  onRationalization,
  showRationalization,
  onAI,
  showAI,
  onAutoMap,
  showAutoMap,
  appCount,
}: Props) {
  return (
    <div className="bg-white border-b px-6 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#1a1f2e] tracking-tight">
            Application Portfolio
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {appCount} applications catalogued
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* View toggle */}
        <div className="flex bg-[#f1f3f5] rounded-lg p-0.5">
          <ViewBtn active={view === "table"} onClick={() => onViewChange("table")} icon={<Table2 className="h-3.5 w-3.5" />} label="Table" />
          <ViewBtn active={view === "landscape"} onClick={() => onViewChange("landscape")} icon={<LayoutGrid className="h-3.5 w-3.5" />} label="Landscape" />
          <ViewBtn active={view === "matrix"} onClick={() => onViewChange("matrix")} icon={<ScatterChart className="h-3.5 w-3.5" />} label="Matrix" />
        </div>

        <div className="w-px h-6 bg-border mx-1" />

        <Button
          size="sm"
          variant={showRationalization ? "default" : "outline"}
          onClick={onRationalization}
          className={`h-9 text-xs ${showRationalization ? "bg-[#1a1f2e] hover:bg-[#2a2f3e] text-white" : ""}`}
        >
          <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
          Rationalize
        </Button>

        <Button
          size="sm"
          variant={showAutoMap ? "default" : "outline"}
          onClick={onAutoMap}
          title="AI suggests which capabilities each app supports"
          className={`h-9 text-xs ${showAutoMap ? "bg-[#7c3aed] hover:bg-[#6d28d9] text-white" : "text-[#7c3aed] border-[#7c3aed]/30 hover:bg-[#7c3aed]/5"}`}
        >
          <Network className="h-3.5 w-3.5 mr-1.5" />
          AI Auto-Map
        </Button>

        <Button
          size="sm"
          variant={showAI ? "default" : "outline"}
          onClick={onAI}
          className={`h-9 text-xs ${showAI ? "bg-[#7c3aed] hover:bg-[#6d28d9] text-white" : "text-[#7c3aed] border-[#7c3aed]/30 hover:bg-[#7c3aed]/5"}`}
        >
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          AI Assistant
        </Button>

        <Button size="sm" variant="outline" onClick={onImport} className="h-9 text-xs">
          <FileUp className="h-3.5 w-3.5 mr-1.5" />
          Import / Export
        </Button>

        <Button size="sm" onClick={onCreateNew} className="h-9 text-xs bg-[#0B5CD6] hover:bg-[#094cb0] text-white">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Application
        </Button>
      </div>
    </div>
  );
}

function ViewBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
        active ? "bg-white shadow-sm text-[#1a1f2e]" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
