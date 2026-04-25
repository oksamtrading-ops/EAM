"use client";

import { BarChart2, LayoutGrid, Columns3, Plus, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { OverflowMenu, type OverflowAction } from "@/components/shared/OverflowMenu";

export type ViewMode = "gantt" | "lanes" | "kanban";

const VIEW_OPTIONS: { value: ViewMode; label: string; Icon: React.ElementType }[] = [
  { value: "gantt", label: "Gantt", Icon: BarChart2 },
  { value: "lanes", label: "Lanes", Icon: LayoutGrid },
  { value: "kanban", label: "Kanban", Icon: Columns3 },
];

export function RoadmapToolbar({
  view,
  onViewChange,
  onNewInitiative,
  onArchState,
}: {
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  onNewInitiative: () => void;
  onArchState: () => void;
}) {
  const overflowActions: OverflowAction[] = [
    {
      label: "Arch State",
      icon: <Camera className="h-4 w-4" />,
      onClick: onArchState,
    },
    {
      label: "New Initiative",
      icon: <Plus className="h-4 w-4" />,
      onClick: onNewInitiative,
      primary: true,
    },
  ];

  return (
    <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 border-b glass-toolbar shrink-0 gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <h1 className="text-md font-semibold text-foreground truncate">Architecture Roadmap</h1>
        <span className="text-xs text-muted-foreground hidden sm:inline whitespace-nowrap">
          Strategic initiatives and transformation timeline
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* View toggle */}
        <div className="flex items-center rounded-lg bg-muted/40 p-0.5 gap-0.5">
          {VIEW_OPTIONS.map(({ value, label, Icon }) => (
            <button
              key={value}
              onClick={() => onViewChange(value)}
              title={label}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all",
                view === value
                  ? "bg-background dark:bg-zinc-700/80 shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Icon buttons — hidden below lg */}
        <div className="hidden lg:flex items-center gap-1">
          <button
            onClick={onArchState}
            title="Capture Architecture State"
            className="relative group flex items-center justify-center w-8 h-8 rounded-lg border border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all"
          >
            <Camera className="h-[15px] w-[15px]" />
            <span className="absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 hidden group-hover:block bg-foreground text-background text-[11px] px-2 py-1 rounded-md whitespace-nowrap z-[100] pointer-events-none shadow-lg">
              Arch State
            </span>
          </button>

          <button
            onClick={onNewInitiative}
            title="New Initiative"
            className="relative group flex items-center justify-center w-8 h-8 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span className="absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 hidden group-hover:block bg-foreground text-background text-[11px] px-2 py-1 rounded-md whitespace-nowrap z-[100] pointer-events-none shadow-lg">
              New Initiative
            </span>
          </button>
        </div>

        {/* Overflow menu — visible below lg */}
        <OverflowMenu actions={overflowActions} className="lg:hidden" />
      </div>
    </div>
  );
}
