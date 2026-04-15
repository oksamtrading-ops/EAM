"use client";

import { Plus, Database, Layers, Table2, GitBranch, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import { useDataContext, type DataViewMode } from "./DataContext";

const VIEWS: { id: DataViewMode; label: string; icon: React.ElementType }[] = [
  { id: "domains", label: "Domains", icon: Layers },
  { id: "entities", label: "Data Entities", icon: Table2 },
  { id: "crud", label: "CRUD Matrix", icon: GitBranch },
];

interface Props {
  onNewDomain: () => void;
  onNewEntity: () => void;
  onImport: () => void;
}

export function DataToolbar({ onNewDomain, onNewEntity, onImport }: Props) {
  const { view, setView } = useDataContext();
  const { data: stats } = trpc.dataEntity.stats.useQuery();

  return (
    <div className="shrink-0 border-b glass-toolbar">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
            <Database className="h-4 w-4 text-blue-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-md font-semibold text-foreground truncate">Data Architecture</h1>
            <p className="text-xs text-muted-foreground">Module 6</p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onImport}
            title="Import / Export Excel"
            className="relative group hidden sm:inline-flex items-center gap-1.5 px-3 h-8 rounded-lg border border-border text-[12px] font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Excel
          </button>
          <button
            onClick={onNewDomain}
            title="New Domain"
            className="relative group hidden sm:inline-flex items-center gap-1.5 px-3 h-8 rounded-lg border border-border text-[12px] font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            Domain
          </button>
          <button
            onClick={onNewEntity}
            title="New Data Entity"
            className="relative group inline-flex items-center gap-1.5 px-3 h-8 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-[12px] font-medium transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Entity
          </button>
        </div>
      </div>

      {/* Stats strip */}
      {stats && (
        <div className="px-4 pb-3 sm:px-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: "Total Entities", value: stats.total, color: "text-foreground" },
            { label: "Sensitive", value: stats.sensitive, color: "text-orange-500" },
            { label: "Unclassified", value: stats.unclassified, color: "text-red-500" },
            { label: "No Steward", value: stats.withoutSteward, color: "text-amber-500" },
            { label: "No Golden Src", value: stats.withoutGoldenSource, color: "text-blue-500" },
          ].map((s) => (
            <div key={s.label} className="bg-card rounded-lg border border-border px-4 py-2.5 shadow-sm">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* View tabs */}
      <div className="flex items-center gap-1 px-4 sm:px-5 pb-0 overflow-x-auto">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap",
              view === v.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <v.icon className="h-3.5 w-3.5" />
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
