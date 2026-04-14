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
    <div className="flex items-center justify-between px-3 py-3 sm:px-4 border-b bg-background shrink-0 gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <h1 className="text-base font-semibold truncate">Architecture Roadmap</h1>
        <span className="text-xs text-muted-foreground hidden sm:inline whitespace-nowrap">
          Strategic initiatives and transformation timeline
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* View toggle */}
        <div className="flex items-center rounded-md border bg-muted/30 p-0.5 gap-0.5">
          {VIEW_OPTIONS.map(({ value, label, Icon }) => (
            <button
              key={value}
              onClick={() => onViewChange(value)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all",
                view === value
                  ? "bg-white shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Full buttons — hidden below lg */}
        <div className="hidden lg:flex items-center gap-2">
          <button
            onClick={onArchState}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            <Camera className="h-3.5 w-3.5" />
            Arch State
          </button>

          <button
            onClick={onNewInitiative}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#0B5CD6] hover:bg-[#094cb0] text-white text-xs font-semibold transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Initiative
          </button>
        </div>

        {/* Overflow menu — visible below lg */}
        <OverflowMenu actions={overflowActions} className="lg:hidden" />
      </div>
    </div>
  );
}
