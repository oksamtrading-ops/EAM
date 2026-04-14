"use client";

import { useState } from "react";
import {
  Plus,
  ShieldAlert,
  Radar,
  BarChart2,
  Clock,
  CheckSquare,
  ScanLine,
  Download,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRiskContext, type ViewMode } from "./RiskContext";
import { OverflowMenu, type OverflowAction } from "@/components/shared/OverflowMenu";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { useWorkspace } from "@/hooks/useWorkspace";

const VIEWS: { id: ViewMode; label: string; icon: React.ElementType }[] = [
  { id: "radar", label: "Tech Radar", icon: Radar },
  { id: "heatmap", label: "Risk Heat Map", icon: BarChart2 },
  { id: "eol", label: "EOL Timeline", icon: Clock },
  { id: "compliance", label: "Compliance", icon: CheckSquare },
];

interface Props {
  onNewRisk: () => void;
  onAI: () => void;
}

export function RiskToolbar({ onNewRisk, onAI }: Props) {
  const { view, setView, stats } = useRiskContext();
  const { workspaceId } = useWorkspace();
  const [scanning, setScanning] = useState(false);

  const utils = trpc.useUtils();
  const autoScan = trpc.risk.runAutoScan.useMutation({
    onSuccess: (res) => {
      toast.success(`Auto-scan complete: ${res.created} new risk(s) identified`);
      utils.risk.list.invalidate();
      utils.risk.getStats.invalidate();
    },
    onError: () => toast.error("Auto-scan failed"),
    onSettled: () => setScanning(false),
  });

  function handleExport() {
    if (!workspaceId) return;
    const url = `/api/export/risk-pptx`;
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "risk-compliance.pptx";
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => toast.error("Export failed"));
  }

  const overflowActions: OverflowAction[] = [
    {
      label: scanning ? "Scanning..." : "Auto-scan",
      icon: <ScanLine className="h-4 w-4" />,
      onClick: () => { setScanning(true); autoScan.mutate(); },
    },
    {
      label: "Export PPTX",
      icon: <Download className="h-4 w-4" />,
      onClick: handleExport,
    },
    {
      label: "AI Assistant",
      icon: <Sparkles className="h-4 w-4" />,
      onClick: onAI,
    },
    {
      label: "New Risk",
      icon: <Plus className="h-4 w-4" />,
      onClick: onNewRisk,
      primary: true,
    },
  ];

  return (
    <div className="shrink-0 border-b bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-3 sm:px-6 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
            <ShieldAlert className="h-4 w-4 text-red-600" />
          </div>
          <div className="min-w-0">
            <h1 className="font-semibold text-[15px] truncate">Technology Risk & Compliance</h1>
            <p className="text-xs text-muted-foreground">Module 4</p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Icon buttons — hidden below lg */}
          <div className="hidden lg:flex items-center gap-1">
            <button
              onClick={() => { setScanning(true); autoScan.mutate(); }}
              disabled={scanning}
              title={scanning ? "Scanning..." : "Auto-scan Risks"}
              className="relative group flex items-center justify-center w-8 h-8 rounded-lg border border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all disabled:opacity-50"
            >
              <ScanLine className="h-[15px] w-[15px]" />
              <span className="absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 hidden group-hover:block bg-[#1a1f2e] text-white text-[11px] px-2 py-1 rounded-md whitespace-nowrap z-[100] pointer-events-none shadow-lg">
                {scanning ? "Scanning..." : "Auto-scan"}
              </span>
            </button>
            <button
              onClick={handleExport}
              title="Export PPTX"
              className="relative group flex items-center justify-center w-8 h-8 rounded-lg border border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all"
            >
              <Download className="h-[15px] w-[15px]" />
              <span className="absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 hidden group-hover:block bg-[#1a1f2e] text-white text-[11px] px-2 py-1 rounded-md whitespace-nowrap z-[100] pointer-events-none shadow-lg">
                Export PPTX
              </span>
            </button>
            <button
              onClick={onAI}
              title="AI Assistant"
              className="relative group flex items-center justify-center w-8 h-8 rounded-lg border border-purple-200 text-purple-700 hover:bg-purple-50 transition-all"
            >
              <Sparkles className="h-[15px] w-[15px]" />
              <span className="absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 hidden group-hover:block bg-[#1a1f2e] text-white text-[11px] px-2 py-1 rounded-md whitespace-nowrap z-[100] pointer-events-none shadow-lg">
                AI Assistant
              </span>
            </button>
            <button
              onClick={onNewRisk}
              title="New Risk"
              className="relative group flex items-center justify-center w-8 h-8 rounded-lg bg-[#0B5CD6] hover:bg-[#094cb0] text-white transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span className="absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 hidden group-hover:block bg-[#1a1f2e] text-white text-[11px] px-2 py-1 rounded-md whitespace-nowrap z-[100] pointer-events-none shadow-lg">
                New Risk
              </span>
            </button>
          </div>

          {/* Overflow menu — visible below lg */}
          <OverflowMenu actions={overflowActions} className="lg:hidden" />
        </div>
      </div>

      {/* Stats strip */}
      {stats && (
        <div className="px-3 pb-3 sm:px-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: "Total Risks", value: stats.total, color: "text-foreground" },
            { label: "Open", value: stats.open, color: "text-red-500" },
            { label: "Critical", value: stats.critical, color: "text-purple-600" },
            { label: "Unmitigated", value: stats.unmitigated, color: "text-orange-500" },
            { label: "In Progress", value: stats.inProgress, color: "text-blue-500" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-lg border px-4 py-2.5 shadow-sm">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* View tabs */}
      <div className="flex items-center gap-1 px-3 sm:px-6 pb-0 overflow-x-auto">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap",
              view === v.id
                ? "border-[#0B5CD6] text-[#0B5CD6]"
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
