"use client";

import { useState, useRef, useEffect } from "react";
import {
  LayoutGrid,
  Flame,
  Plus,
  Download,
  Sparkles,
  GitBranch,
  FileDown,
  History,
  DollarSign,
  CheckCircle2,
  SlidersHorizontal,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OverflowMenu, type OverflowAction } from "@/components/shared/OverflowMenu";
import type { ViewMode, ColorByMode } from "./CapabilityPageClient";

const VIEW_OPTIONS: {
  value: ViewMode;
  label: string;
  Icon: React.ElementType;
}[] = [
  { value: "grid", label: "Grid View", Icon: LayoutGrid },
  { value: "tree", label: "Tree View", Icon: GitBranch },
  { value: "heatmap", label: "Heatmap", Icon: Flame },
  { value: "investment", label: "Investment", Icon: DollarSign },
];

const COLOR_BY_OPTIONS: { value: ColorByMode; label: string }[] = [
  { value: "maturity", label: "Maturity" },
  { value: "importance", label: "Importance" },
  { value: "gap", label: "Gap" },
  { value: "owner", label: "Owner" },
];

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
  // Filter state (lifted from CapabilityPageClient)
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filterLevel: string;
  onFilterLevelChange: (l: string) => void;
  filterMaturity: string;
  onFilterMaturityChange: (m: string) => void;
  colorBy: ColorByMode;
  onColorByChange: (c: ColorByMode) => void;
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
  searchQuery,
  onSearchChange,
  filterLevel,
  onFilterLevelChange,
  filterMaturity,
  onFilterMaturityChange,
  colorBy,
  onColorByChange,
}: Props) {
  const hasFilters = filterLevel !== "all" || filterMaturity !== "all";

  // Overflow actions for < lg screens
  const overflowActions: OverflowAction[] = [
    {
      label: "AI Assistant",
      icon: <Sparkles className="h-4 w-4" />,
      onClick: onAI,
      active: showAI,
    },
    {
      label: "Versions",
      icon: <History className="h-4 w-4" />,
      onClick: onVersions,
      active: showVersions,
    },
    {
      label: "Bulk Assess",
      icon: <CheckCircle2 className="h-4 w-4" />,
      onClick: onBulkAssess,
    },
    {
      label: "Import",
      icon: <Download className="h-4 w-4" />,
      onClick: onImport,
    },
    {
      label: "Export PPTX",
      icon: <FileDown className="h-4 w-4" />,
      onClick: onExport,
    },
    {
      label: "Add Capability",
      icon: <Plus className="h-4 w-4" />,
      onClick: onCreateNew,
      primary: true,
    },
  ];

  return (
    <div className="bg-white border-b px-3 sm:px-5 py-2.5 flex items-center gap-2 shrink-0">
      {/* Title */}
      <div className="flex items-center gap-2 shrink-0">
        <h1 className="text-[15px] font-bold text-[#1a1f2e] tracking-tight whitespace-nowrap">
          Capability Map
        </h1>
        <span className="text-[10px] font-medium text-muted-foreground bg-[#f1f3f5] px-2 py-0.5 rounded-full">
          {capabilityCount}
        </span>
      </div>

      <div className="w-px h-6 bg-border mx-1 shrink-0" />

      {/* View toggle (icon-only) */}
      <div className="flex bg-[#f1f3f5] rounded-lg p-0.5 gap-px shrink-0">
        {VIEW_OPTIONS.map(({ value, label, Icon }) => (
          <button
            key={value}
            onClick={() => onViewChange(value)}
            title={label}
            className={cn(
              "flex items-center justify-center w-8 h-7 rounded-md transition-all relative group",
              view === value
                ? "bg-white shadow-sm text-[#1a1f2e]"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-[15px] w-[15px]" />
            <Tooltip>{label}</Tooltip>
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-border mx-1 shrink-0 hidden sm:block" />

      {/* Search (compact) */}
      <div className="hidden sm:flex items-center gap-1.5 border rounded-lg px-2.5 h-8 bg-[#f9fafb] min-w-0 flex-1 max-w-[200px]">
        <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search..."
          className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Filter popover button */}
      <FilterPopover
        filterLevel={filterLevel}
        onFilterLevelChange={onFilterLevelChange}
        filterMaturity={filterMaturity}
        onFilterMaturityChange={onFilterMaturityChange}
        hasFilters={hasFilters}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
      />

      {/* Color-by selector (inline, hidden on small screens) */}
      <div className="hidden md:flex items-center gap-px bg-[#f1f3f5] rounded-lg p-0.5 shrink-0">
        {COLOR_BY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onColorByChange(opt.value)}
            className={cn(
              "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all whitespace-nowrap",
              colorBy === opt.value
                ? "bg-[#0B5CD6] text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1 min-w-0" />

      {/* Action buttons (icon-only) — hidden below lg */}
      <div className="hidden lg:flex items-center gap-1">
        <IconBtn
          icon={<Sparkles className="h-[15px] w-[15px]" />}
          tooltip="AI Assistant"
          onClick={onAI}
          active={showAI}
          variant="purple"
        />
        <IconBtn
          icon={<History className="h-[15px] w-[15px]" />}
          tooltip="Versions"
          onClick={onVersions}
          active={showVersions}
        />
        <IconBtn
          icon={<CheckCircle2 className="h-[15px] w-[15px]" />}
          tooltip="Bulk Assess"
          onClick={onBulkAssess}
        />
        <IconBtn
          icon={<Download className="h-[15px] w-[15px]" />}
          tooltip="Import"
          onClick={onImport}
        />
        <IconBtn
          icon={<FileDown className="h-[15px] w-[15px]" />}
          tooltip="Export PPTX"
          onClick={onExport}
        />

        <div className="w-px h-6 bg-border mx-1" />

        <button
          onClick={onCreateNew}
          title="Add Capability"
          className="relative group flex items-center justify-center w-8 h-8 rounded-lg bg-[#0B5CD6] hover:bg-[#094cb0] text-white transition-colors"
        >
          <Plus className="h-4 w-4" />
          <Tooltip>Add Capability</Tooltip>
        </button>
      </div>

      {/* Overflow menu — visible below lg */}
      <OverflowMenu actions={overflowActions} className="lg:hidden" />
    </div>
  );
}

/* ─── Icon Button ─── */
function IconBtn({
  icon,
  tooltip,
  onClick,
  active,
  variant,
}: {
  icon: React.ReactNode;
  tooltip: string;
  onClick: () => void;
  active?: boolean;
  variant?: "purple";
}) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={cn(
        "relative group flex items-center justify-center w-8 h-8 rounded-lg border transition-all",
        variant === "purple"
          ? active
            ? "bg-[#7c3aed] text-white border-[#7c3aed]"
            : "border-[#7c3aed]/30 text-[#7c3aed] hover:bg-[#7c3aed]/5"
          : active
          ? "bg-[#1a1f2e] text-white border-[#1a1f2e]"
          : "border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      )}
    >
      {icon}
      <Tooltip>{tooltip}</Tooltip>
    </button>
  );
}

/* ─── Tooltip ─── */
function Tooltip({ children }: { children: React.ReactNode }) {
  return (
    <span className="absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 hidden group-hover:block bg-[#1a1f2e] text-white text-[11px] px-2 py-1 rounded-md whitespace-nowrap z-[100] pointer-events-none shadow-lg">
      {children}
    </span>
  );
}

/* ─── Filter Popover ─── */
function FilterPopover({
  filterLevel,
  onFilterLevelChange,
  filterMaturity,
  onFilterMaturityChange,
  hasFilters,
  searchQuery,
  onSearchChange,
}: {
  filterLevel: string;
  onFilterLevelChange: (l: string) => void;
  filterMaturity: string;
  onFilterMaturityChange: (m: string) => void;
  hasFilters: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-medium transition-all",
          hasFilters
            ? "border-[#0B5CD6] text-[#0B5CD6] bg-[#eff6ff]"
            : "border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        )}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Filters</span>
        {hasFilters && (
          <span className="w-1.5 h-1.5 rounded-full bg-[#0B5CD6]" />
        )}
      </button>

      {open && (
        <div className="absolute top-[calc(100%+6px)] left-0 bg-white border rounded-xl shadow-lg p-3 min-w-[240px] z-[100]">
          {/* Mobile search (shown inside popover on sm) */}
          <div className="sm:hidden mb-3">
            <div className="flex items-center gap-1.5 border rounded-lg px-2.5 h-8 bg-[#f9fafb]">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search..."
                className="w-full bg-transparent text-xs outline-none"
              />
            </div>
          </div>

          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Level
          </p>
          <div className="flex gap-1 mb-3">
            {["all", "L1", "L2", "L3"].map((lvl) => (
              <button
                key={lvl}
                onClick={() => onFilterLevelChange(lvl)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
                  filterLevel === lvl
                    ? "bg-[#1a1f2e] text-white"
                    : "bg-[#f1f3f5] text-muted-foreground hover:text-foreground"
                )}
              >
                {lvl === "all" ? "All" : lvl}
              </button>
            ))}
          </div>

          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Maturity
          </p>
          <div className="flex gap-1 mb-3">
            {[
              { value: "all", label: "Any" },
              { value: "not_assessed", label: "Unassessed" },
              { value: "assessed", label: "Assessed" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => onFilterMaturityChange(opt.value)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
                  filterMaturity === opt.value
                    ? "bg-[#0B5CD6] text-white"
                    : "bg-[#f1f3f5] text-muted-foreground hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {(hasFilters || searchQuery) && (
            <div className="border-t pt-2">
              <button
                onClick={() => {
                  onFilterLevelChange("all");
                  onFilterMaturityChange("all");
                  onSearchChange("");
                }}
                className="text-[11px] text-[#0B5CD6] hover:underline font-medium"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
