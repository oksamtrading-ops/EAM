"use client";

import { LayoutGrid, Flame, Plus, Download, Sparkles, GitBranch, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ViewMode } from "./CapabilityPageClient";

type Props = {
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  colorBy: "maturity" | "importance";
  onColorByChange: (v: "maturity" | "importance") => void;
  onCreateNew: () => void;
  onImport: () => void;
  onExport: () => void;
  onAI: () => void;
  showAI: boolean;
  capabilityCount: number;
};

export function CapabilityToolbar({
  view,
  onViewChange,
  colorBy,
  onColorByChange,
  onCreateNew,
  onImport,
  onExport,
  onAI,
  showAI,
  capabilityCount,
}: Props) {
  return (
    <div className="bg-white border-b px-6 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
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
        {/* Color mode */}
        <Select
          value={colorBy}
          onValueChange={(v) => onColorByChange(v as any)}
        >
          <SelectTrigger className="w-[160px] h-9 text-xs bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="maturity">Color by Maturity</SelectItem>
            <SelectItem value="importance">Color by Importance</SelectItem>
          </SelectContent>
        </Select>

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
        </div>

        <div className="w-px h-6 bg-border mx-1" />

        <Button
          size="sm"
          variant={showAI ? "default" : "outline"}
          onClick={onAI}
          className={`h-9 text-xs ${showAI ? "bg-[#86BC25] hover:bg-[#76a821] text-white" : ""}`}
        >
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          AI Assistant
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
          className="h-9 text-xs bg-[#86BC25] hover:bg-[#76a821] text-white"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Capability
        </Button>
      </div>
    </div>
  );
}
