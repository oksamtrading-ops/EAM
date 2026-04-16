"use client";

import {
  MousePointer2,
  Square,
  StickyNote,
  Circle,
  Cylinder,
  Cloud,
  Minus,
  ArrowRight,
  BoxSelect,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type DiagramTool =
  | "select"
  | "container"
  | "note"
  | "shape:rectangle"
  | "shape:circle"
  | "shape:cylinder"
  | "shape:cloud"
  | "line"
  | "arrow";

type ToolDef = {
  tool: DiagramTool;
  label: string;
  shortcut: string;
  icon: React.ReactNode;
};

const TOOLS: ToolDef[] = [
  { tool: "select", label: "Select", shortcut: "V", icon: <MousePointer2 className="h-4 w-4" /> },
  { tool: "container", label: "Container", shortcut: "C", icon: <BoxSelect className="h-4 w-4" /> },
  { tool: "note", label: "Note", shortcut: "N", icon: <StickyNote className="h-4 w-4" /> },
  { tool: "shape:rectangle", label: "Rectangle", shortcut: "R", icon: <Square className="h-4 w-4" /> },
  { tool: "shape:circle", label: "Circle", shortcut: "O", icon: <Circle className="h-4 w-4" /> },
  { tool: "shape:cylinder", label: "Cylinder / DB", shortcut: "D", icon: <Cylinder className="h-4 w-4" /> },
  { tool: "shape:cloud", label: "Cloud", shortcut: "K", icon: <Cloud className="h-4 w-4" /> },
  { tool: "line", label: "Line", shortcut: "L", icon: <Minus className="h-4 w-4" /> },
  { tool: "arrow", label: "Arrow", shortcut: "A", icon: <ArrowRight className="h-4 w-4" /> },
];

export function DiagramToolRail({
  activeTool,
  onSelectTool,
}: {
  activeTool: DiagramTool;
  onSelectTool: (tool: DiagramTool) => void;
}) {
  return (
    <div className="shrink-0 w-11 border-r bg-background/60 backdrop-blur-sm flex flex-col items-center py-2 gap-1">
      {TOOLS.map((t, i) => {
        const isGroupStart = t.tool === "container" || t.tool === "shape:rectangle" || t.tool === "line";
        const active = activeTool === t.tool;
        return (
          <div key={t.tool} className="contents">
            {isGroupStart && i !== 0 && <div className="w-6 h-px bg-border my-1" />}
            <button
              onClick={() => onSelectTool(t.tool)}
              title={`${t.label} (${t.shortcut})`}
              className={cn(
                "relative group flex items-center justify-center w-8 h-8 rounded-md border transition-all",
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              {t.icon}
              <span className="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 hidden group-hover:flex bg-foreground text-background text-[11px] px-2 py-1 rounded-md whitespace-nowrap z-[100] pointer-events-none shadow-lg items-center gap-1.5">
                {t.label}
                <kbd className="text-[9px] opacity-70 bg-background/15 px-1 rounded">{t.shortcut}</kbd>
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
