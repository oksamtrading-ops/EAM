"use client";

import { Table2, LayoutGrid, ScatterChart, Plus, FileUp, Sparkles, Network } from "lucide-react";
import { OverflowMenu, type OverflowAction } from "@/components/shared/OverflowMenu";
import type { AppViewMode } from "./ApplicationPageClient";

type Props = {
  view: AppViewMode;
  onViewChange: (v: AppViewMode) => void;
  onCreateNew: () => void;
  onImport: () => void;
  onExport: () => void;
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
  onAI,
  showAI,
  onAutoMap,
  showAutoMap,
  appCount,
}: Props) {
  const overflowActions: OverflowAction[] = [
    {
      label: "AI Auto-Map",
      icon: <Network className="h-4 w-4" />,
      onClick: onAutoMap,
      active: showAutoMap,
    },
    {
      label: "AI Assistant",
      icon: <Sparkles className="h-4 w-4" />,
      onClick: onAI,
      active: showAI,
    },
    {
      label: "Import / Export",
      icon: <FileUp className="h-4 w-4" />,
      onClick: onImport,
    },
    {
      label: "Add Application",
      icon: <Plus className="h-4 w-4" />,
      onClick: onCreateNew,
      primary: true,
    },
  ];

  return (
    <div className="glass-toolbar border-b px-4 sm:px-5 py-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <h1 className="text-md font-semibold text-foreground tracking-tight truncate">
            Application Portfolio
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {appCount} applications catalogued
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* View toggle */}
        <div className="flex bg-muted/40 rounded-lg p-0.5">
          <ViewBtn active={view === "table"} onClick={() => onViewChange("table")} icon={<Table2 className="h-3.5 w-3.5" />} label="Table" />
          <ViewBtn active={view === "landscape"} onClick={() => onViewChange("landscape")} icon={<LayoutGrid className="h-3.5 w-3.5" />} label="Landscape" />
          <ViewBtn active={view === "matrix"} onClick={() => onViewChange("matrix")} icon={<ScatterChart className="h-3.5 w-3.5" />} label="Matrix" />
        </div>

        {/* Icon buttons — hidden below lg */}
        <div className="hidden lg:flex items-center gap-1">
          <div className="w-px h-6 bg-border mx-1" />

          <button
            onClick={onAutoMap}
            title="AI Auto-Map"
            className={`relative group flex items-center justify-center w-8 h-8 rounded-lg border transition-all ${
              showAutoMap
                ? "bg-[var(--ai)] text-white border-[var(--ai)]"
                : "border-[var(--ai)]/30 text-[var(--ai)] hover:bg-[var(--ai-subtle)]"
            }`}
          >
            <Network className="h-[15px] w-[15px]" />
            <span className="absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 hidden group-hover:block bg-foreground text-background text-[11px] px-2 py-1 rounded-md whitespace-nowrap z-[100] pointer-events-none shadow-lg">
              AI Auto-Map
            </span>
          </button>

          <button
            onClick={onAI}
            title="AI Assistant"
            className={`relative group flex items-center justify-center w-8 h-8 rounded-lg border transition-all ${
              showAI
                ? "bg-[var(--ai)] text-white border-[var(--ai)]"
                : "border-[var(--ai)]/30 text-[var(--ai)] hover:bg-[var(--ai-subtle)]"
            }`}
          >
            <Sparkles className="h-[15px] w-[15px]" />
            <span className="absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 hidden group-hover:block bg-foreground text-background text-[11px] px-2 py-1 rounded-md whitespace-nowrap z-[100] pointer-events-none shadow-lg">
              AI Assistant
            </span>
          </button>

          <button
            onClick={onImport}
            title="Import / Export"
            className="relative group flex items-center justify-center w-8 h-8 rounded-lg border border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all"
          >
            <FileUp className="h-[15px] w-[15px]" />
            <span className="absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 hidden group-hover:block bg-foreground text-background text-[11px] px-2 py-1 rounded-md whitespace-nowrap z-[100] pointer-events-none shadow-lg">
              Import / Export
            </span>
          </button>

          <button
            onClick={onCreateNew}
            title="Add Application"
            className="relative group flex items-center justify-center w-8 h-8 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span className="absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 hidden group-hover:block bg-foreground text-background text-[11px] px-2 py-1 rounded-md whitespace-nowrap z-[100] pointer-events-none shadow-lg">
              Add Application
            </span>
          </button>
        </div>

        {/* Overflow menu — visible below lg */}
        <OverflowMenu actions={overflowActions} className="lg:hidden" />
      </div>
    </div>
  );
}

function ViewBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
        active ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
