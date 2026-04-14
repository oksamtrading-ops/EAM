"use client";

import { LayoutGrid, Flame, Plus, Download, Sparkles, GitBranch, FileDown, History, DollarSign, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ViewMode } from "./CapabilityPageClient";

type Props = {
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  onCreateNew: () => void;
  onImport: () => void;
  onExport: () => void;
  onBulkAssess: () => void;
  onAI: () => void;
  showAI: boolean;
  onVersions: () => void;
  showVersions: boolean;
  capabilityCount: number;
};

export function CapabilityToolbar({
  view,
  onViewChange,
  onCreateNew,
  onImport,
  onExport,
  onBulkAssess,
  onAI,
  showAI,
  onVersions,
  showVersions,
  capabilityCount,
}: Props) {
  return (
    <div className="bg-white border-b px-6 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#1a1f2e] tracking-tight">
            Business Capability Map
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {capabilityCount} capabilities mapped
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* View toggle */}
        <div className="flex bg-[#f1f3f5] rounded-lg p-0.5">
          <button
            onClick={() => onViewChange("grid")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              view === "grid"
                ? "bg-white shadow-sm text-[#1a1f2e]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Grid
          </button>
          <button
            onClick={() => onViewChange("tree")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              view === "tree"
                ? "bg-white shadow-sm text-[#1a1f2e]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <GitBranch className="h-3.5 w-3.5" />
            Tree
          </button>
          <button
            onClick={() => onViewChange("heatmap")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              view === "heatmap"
                ? "bg-white shadow-sm text-[#1a1f2e]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Flame className="h-3.5 w-3.5" />
            Heatmap
          </button>
          <button
            onClick={() => onViewChange("investment")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              view === "investment"
                ? "bg-white shadow-sm text-[#1a1f2e]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <DollarSign className="h-3.5 w-3.5" />
            Investment
          </button>
        </div>

        <div className="w-px h-6 bg-border mx-1" />

        <Button
          size="sm"
          variant={showAI ? "default" : "outline"}
          onClick={onAI}
          className={`h-9 text-xs border-[#7c3aed]/30 text-[#7c3aed] hover:bg-[#7c3aed]/5 hover:text-[#7c3aed] ${showAI ? "bg-[#7c3aed] hover:bg-[#6d28d9] text-white hover:text-white border-transparent" : ""}`}
        >
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          AI Assistant
        </Button>

        <Button
          size="sm"
          variant={showVersions ? "default" : "outline"}
          onClick={onVersions}
          className={`h-9 text-xs ${showVersions ? "bg-[#1a1f2e] hover:bg-[#2a2f3e] text-white" : ""}`}
        >
          <History className="h-3.5 w-3.5 mr-1.5" />
          Versions
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={onBulkAssess}
          className="h-9 text-xs"
        >
          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
          Bulk Assess
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={onImport}
          className="h-9 text-xs"
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Import
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={onExport}
          className="h-9 text-xs"
        >
          <FileDown className="h-3.5 w-3.5 mr-1.5" />
          Export PPTX
        </Button>

        <Button
          size="sm"
          onClick={onCreateNew}
          className="h-9 text-xs bg-[#0B5CD6] hover:bg-[#094cb0] text-white"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Capability
        </Button>
      </div>
    </div>
  );
}
