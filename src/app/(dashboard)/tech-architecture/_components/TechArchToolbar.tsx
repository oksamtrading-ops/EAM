"use client";

import { Layers, FileSpreadsheet, Presentation } from "lucide-react";
import { OverflowMenu, type OverflowAction } from "@/components/shared/OverflowMenu";

type Props = {
  onExportXlsx: () => void;
  onExportPptx: () => void;
  exportingXlsx: boolean;
  exportingPptx: boolean;
};

export function TechArchToolbar({
  onExportXlsx,
  onExportPptx,
  exportingXlsx,
  exportingPptx,
}: Props) {
  const overflowActions: OverflowAction[] = [
    {
      label: exportingXlsx ? "Exporting XLSX…" : "Export XLSX",
      icon: <FileSpreadsheet className="h-4 w-4" />,
      onClick: onExportXlsx,
    },
    {
      label: exportingPptx ? "Exporting PPTX…" : "Export PPTX",
      icon: <Presentation className="h-4 w-4" />,
      onClick: onExportPptx,
    },
  ];

  return (
    <div className="glass-toolbar border-b px-4 sm:px-5 py-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
          <Layers className="h-4 w-4 text-indigo-600" />
        </div>
        <div className="min-w-0">
          <h1 className="text-md font-semibold text-foreground tracking-tight truncate">
            Technology Architecture
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="hidden lg:flex items-center gap-1">
          <button
            onClick={onExportXlsx}
            disabled={exportingXlsx}
            title="Export catalog to XLSX"
            className="relative group flex items-center justify-center w-8 h-8 rounded-lg border border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span className="absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 hidden group-hover:block bg-foreground text-background text-[11px] px-2 py-1 rounded-md whitespace-nowrap z-[100] pointer-events-none shadow-lg">
              {exportingXlsx ? "Exporting…" : "Export XLSX"}
            </span>
          </button>

          <button
            onClick={onExportPptx}
            disabled={exportingPptx}
            title="Export boardroom deck (PPTX)"
            className="relative group flex items-center justify-center w-8 h-8 rounded-lg border border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Presentation className="h-3.5 w-3.5" />
            <span className="absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 hidden group-hover:block bg-foreground text-background text-[11px] px-2 py-1 rounded-md whitespace-nowrap z-[100] pointer-events-none shadow-lg">
              {exportingPptx ? "Exporting…" : "Export PPTX"}
            </span>
          </button>
        </div>

        <OverflowMenu actions={overflowActions} className="lg:hidden" />
      </div>
    </div>
  );
}
