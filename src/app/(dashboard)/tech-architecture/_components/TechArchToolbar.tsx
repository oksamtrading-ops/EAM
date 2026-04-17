"use client";

import { useState } from "react";
import {
  Layers,
  FileSpreadsheet,
  Presentation,
  Building2,
  Package,
  History,
  Boxes,
  ShieldCheck,
  BookOpen,
  AlertTriangle,
} from "lucide-react";
import { OverflowMenu, type OverflowAction } from "@/components/shared/OverflowMenu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TechArchToolbarContext } from "./TechArchToolbarContext";

export const TECH_ARCH_TABS = [
  { value: "vendors", label: "Vendors", icon: Building2 },
  { value: "products", label: "Products", icon: Package },
  { value: "versions", label: "Versions & Lifecycle", icon: History },
  { value: "components", label: "Components", icon: Boxes },
  { value: "standards", label: "Standards", icon: ShieldCheck },
  { value: "reference", label: "Reference Architectures", icon: BookOpen },
  { value: "findings", label: "Findings", icon: AlertTriangle },
] as const;

export type TechArchTabValue = (typeof TECH_ARCH_TABS)[number]["value"];

type Props = {
  activeTab: TechArchTabValue;
  onTabChange: (v: TechArchTabValue) => void;
  onExportXlsx: () => void;
  onExportPptx: () => void;
  exportingXlsx: boolean;
  exportingPptx: boolean;
  children: React.ReactNode;
};

export function TechArchToolbar({
  activeTab,
  onTabChange,
  onExportXlsx,
  onExportPptx,
  exportingXlsx,
  exportingPptx,
  children,
}: Props) {
  const [actionsEl, setActionsEl] = useState<HTMLElement | null>(null);

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
    <TechArchToolbarContext.Provider value={{ actionsEl }}>
      <div className="glass-toolbar border-b px-4 sm:px-5 py-2.5 flex items-center gap-3">
        {/* Identity — hidden on narrow screens to make room for the tab picker */}
        <div className="hidden sm:flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
            <Layers className="h-4 w-4 text-indigo-600" />
          </div>
          <h1 className="text-md font-semibold text-foreground tracking-tight truncate">
            Technology Architecture
          </h1>
        </div>

        {/* Mobile tab picker — replaces the secondary tab row below lg */}
        <div className="lg:hidden flex-1 min-w-0 max-w-[220px] sm:ml-2">
          <Select value={activeTab} onValueChange={(v) => onTabChange(v as TechArchTabValue)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TECH_ARCH_TABS.map((t) => {
                const Icon = t.icon;
                return (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5" />
                      {t.label}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          {/* Slot populated by the active tab via createPortal */}
          <div
            ref={setActionsEl}
            className="flex items-center gap-2 empty:hidden"
          />

          {/* Exports — icon buttons on desktop, overflow menu below lg */}
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
      {children}
    </TechArchToolbarContext.Provider>
  );
}
