"use client";

import { useState } from "react";
import { X, BarChart3, AlertTriangle, DollarSign, Loader2, FileText } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RAT_LABELS, RAT_COLORS } from "@/lib/constants/application-colors";

type Props = {
  open: boolean;
  onClose: () => void;
  apps: any[];
};

export function RationalizationPanel({ open, onClose, apps }: Props) {
  const { workspaceId } = useWorkspace();
  const { data: matrix } = trpc.application.getRationalizationMatrix.useQuery(
    undefined,
    { enabled: open }
  );
  const { data: stats } = trpc.application.getStats.useQuery(
    undefined,
    { enabled: open }
  );

  const [narrative, setNarrative] = useState("");
  const [loading, setLoading] = useState(false);

  async function generateNarrative() {
    setLoading(true);
    setNarrative("");
    try {
      const res = await fetch("/api/ai/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rationalization-narrative",
          workspaceId,
          payload: {
            apps: apps.map((a) => ({
              name: a.name,
              vendor: a.vendor,
              lifecycle: a.lifecycle,
              businessValue: a.businessValue,
              technicalHealth: a.technicalHealth,
              rationalizationStatus: a.rationalizationStatus,
              annualCostUsd: a.annualCostUsd ? Number(a.annualCostUsd) : null,
              capabilityCount: a.capabilities?.length ?? 0,
            })),
          },
        }),
      });
      const data = await res.json();
      setNarrative(data.narrative ?? "Failed to generate narrative.");
    } catch {
      toast.error("AI request failed");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const totalCost = stats?.totalCost ?? 0;
  const retireCount = matrix?.retireCandidates?.length ?? 0;
  const retireCost = (matrix?.retireCandidates ?? []).reduce(
    (sum: number, a: any) => sum + Number(a.annualCostUsd ?? 0), 0
  );

  return (
    <aside className="fixed right-0 top-0 h-screen w-[400px] z-40 border-l bg-white flex flex-col shadow-xl">
      <div className="px-5 py-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-[#1a1f2e]/5 flex items-center justify-center">
            <BarChart3 className="h-4 w-4 text-[#1a1f2e]" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-[#1a1f2e]">Rationalization</h2>
            <p className="text-[11px] text-muted-foreground">Portfolio analysis</p>
          </div>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-5 space-y-5">
          {/* Stats cards */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total Apps" value={String(stats?.totalApps ?? 0)} />
            <StatCard label="Total Annual Cost" value={`$${totalCost.toLocaleString()}`} icon={<DollarSign className="h-3.5 w-3.5" />} />
            <StatCard label="Retire Candidates" value={String(retireCount)} accent="red" icon={<AlertTriangle className="h-3.5 w-3.5" />} />
            <StatCard label="Potential Savings" value={`$${retireCost.toLocaleString()}`} accent="green" />
          </div>

          {/* Rationalization breakdown */}
          {stats && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                By Rationalization Status
              </h3>
              {Object.entries(stats.byRationalization).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: RAT_COLORS[status] ?? "#cbd5e1" }} />
                    <span className="text-[#1a1f2e]">{RAT_LABELS[status] ?? status}</span>
                  </div>
                  <span className="font-medium text-[#1a1f2e]">{count as number}</span>
                </div>
              ))}
            </div>
          )}

          {/* Redundancies */}
          {matrix && matrix.redundancies.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Redundancies ({matrix.redundancies.length})
              </h3>
              <p className="text-xs text-muted-foreground">
                Capabilities supported by multiple applications.
              </p>
              {matrix.redundancies.slice(0, 5).map((r: any) => (
                <div key={r.capabilityId} className="text-xs p-2 bg-orange-50 rounded border border-orange-100">
                  <span className="font-medium text-orange-800">{r.count} apps</span>
                  <span className="text-orange-600"> share this capability</span>
                </div>
              ))}
            </div>
          )}

          {/* Orphaned apps */}
          {matrix && matrix.orphanedApps.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Unmapped Apps ({matrix.orphanedApps.length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {matrix.orphanedApps.map((a: any) => (
                  <Badge key={a.id} variant="outline" className="text-[10px]">{a.name}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* AI Narrative */}
          <div className="space-y-3 pt-2">
            <Button
              onClick={generateNarrative}
              disabled={loading}
              className="w-full bg-[#86BC25] hover:bg-[#76a821] text-white"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</>
              ) : (
                <><FileText className="h-4 w-4 mr-2" />Generate AI Narrative</>
              )}
            </Button>

            {narrative && (
              <div className="p-4 rounded-lg bg-[#fafbfc] border text-sm leading-relaxed text-[#1a1f2e] whitespace-pre-wrap">
                {narrative}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}

function StatCard({ label, value, accent, icon }: { label: string; value: string; accent?: string; icon?: React.ReactNode }) {
  const bg = accent === "red" ? "bg-red-50" : accent === "green" ? "bg-green-50" : "bg-[#fafbfc]";
  const textColor = accent === "red" ? "text-red-700" : accent === "green" ? "text-green-700" : "text-[#1a1f2e]";

  return (
    <div className={`rounded-lg border p-3 ${bg}`}>
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-[10px] font-medium">{label}</span>
      </div>
      <p className={`text-lg font-bold ${textColor}`}>{value}</p>
    </div>
  );
}
