"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  return (
    <div className="shrink-0 border-b bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center">
            <ShieldAlert className="h-4 w-4 text-red-600" />
          </div>
          <div>
            <h1 className="font-semibold text-[15px]">Technology Risk & Compliance</h1>
            <p className="text-xs text-muted-foreground">Module 4</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setScanning(true); autoScan.mutate(); }}
            disabled={scanning}
            className="gap-1.5"
          >
            <ScanLine className="h-3.5 w-3.5" />
            {scanning ? "Scanning…" : "Auto-scan"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Export PPTX
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onAI}
            className="gap-1.5 border-purple-200 text-purple-700 hover:bg-purple-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI Assistant
          </Button>
          <Button size="sm" onClick={onNewRisk} className="gap-1.5 bg-[#86BC25] hover:bg-[#75a821] text-white">
            <Plus className="h-4 w-4" />
            New Risk
          </Button>
        </div>
      </div>

      {/* Stats strip */}
      {stats && (
        <div className="px-6 pb-3 grid grid-cols-5 gap-3">
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
      <div className="flex items-center gap-1 px-6 pb-0">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-[13px] font-medium border-b-2 transition-colors",
              view === v.id
                ? "border-[#86BC25] text-[#86BC25]"
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
