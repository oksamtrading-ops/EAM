"use client";

import { useState, useEffect, useRef } from "react";
import { X, Pencil, AlertTriangle, Loader2 } from "lucide-react";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { format } from "date-fns";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { HorizonBadge } from "../shared/HorizonBadge";
import { RAGStatusDot } from "../shared/RAGStatusDot";
import { ProgressBar } from "../shared/ProgressBar";
import { MilestonePanel } from "./MilestonePanel";
import { DependencyPanel } from "./DependencyPanel";
import { InitiativeFormModal } from "../modals/InitiativeFormModal";

const TAB_OPTIONS = ["overview", "milestones", "dependencies"] as const;
type Tab = (typeof TAB_OPTIONS)[number];

export function InitiativeDetailPanel({
  initiativeId,
  onClose,
  autoOpenAI,
}: {
  initiativeId: string;
  onClose: () => void;
  autoOpenAI?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [showEdit, setShowEdit] = useState(false);
  const [loadingRisk, setLoadingRisk] = useState(false);
  const [riskResult, setRiskResult] = useState<any>(null);
  const autoTriggeredRef = useRef(false);

  const { data: initiative, isLoading } = trpc.initiative.getById.useQuery({
    id: initiativeId,
  });

  // Auto-trigger AI risk assessment when ?ai=1 and initiative is loaded
  useEffect(() => {
    if (autoOpenAI && initiative && !autoTriggeredRef.current && !loadingRisk && !riskResult) {
      autoTriggeredRef.current = true;
      setTab("overview");
      void handleAssessRisks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenAI, initiative]);

  async function handleAssessRisks() {
    if (!initiative) return;
    setLoadingRisk(true);
    try {
      const res = await fetch("/api/ai/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "risk-assessment",
          payload: {
            initiativeName: initiative.name,
            description: initiative.description ?? "",
            category: initiative.category,
            startDate: initiative.startDate
              ? format(new Date(initiative.startDate), "yyyy-MM-dd")
              : undefined,
            endDate: initiative.endDate
              ? format(new Date(initiative.endDate), "yyyy-MM-dd")
              : undefined,
            budgetUsd: initiative.budgetUsd
              ? Number(initiative.budgetUsd)
              : undefined,
            milestones: initiative.milestones.map((m) => ({
              name: m.name,
              dueDate: m.dueDate
                ? format(new Date(m.dueDate), "yyyy-MM-dd")
                : undefined,
              isCritical: m.isCritical,
            })),
            dependencies: initiative.dependsOn.map((d) => ({
              name: (d.blocking as any)?.name ?? d.blockingId,
              status: (d.blocking as any)?.status ?? "UNKNOWN",
            })),
            capabilitiesAffected: initiative.capabilities.length,
            applicationsAffected: initiative.applications.length,
          },
        }),
      });
      const data = await res.json();
      setRiskResult(data);
    } catch {
      toast.error("Risk assessment failed");
    } finally {
      setLoadingRisk(false);
    }
  }

  return (
    <>
      <aside className="fixed right-0 top-0 h-screen w-full sm:w-[480px] z-40 border-l bg-background flex flex-col overflow-hidden shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {initiative && <RAGStatusDot status={initiative.ragStatus} />}
            <h2 className="font-semibold text-sm truncate">
              {isLoading ? "Loading…" : initiative?.name ?? "Initiative"}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowEdit(true)}
              className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b shrink-0">
          {TAB_OPTIONS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${
                tab === t
                  ? "border-b-2 border-[#0B5CD6] text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {initiative && (
            <>
              {tab === "overview" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <HorizonBadge horizon={initiative.horizon} />
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">
                      {initiative.category}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {initiative.priority} priority
                    </span>
                  </div>

                  {initiative.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {initiative.description}
                    </p>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">Progress</span>
                      <span className="text-xs font-medium">{initiative.progressPct}%</span>
                    </div>
                    <ProgressBar value={initiative.progressPct} />
                  </div>

                  <CollapsibleSection title="Details" defaultOpen>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {initiative.startDate && (
                        <div>
                          <p className="text-[11px] text-muted-foreground mb-0.5">Start</p>
                          <p className="font-medium text-xs">
                            {format(new Date(initiative.startDate), "MMM d, yyyy")}
                          </p>
                        </div>
                      )}
                      {initiative.endDate && (
                        <div>
                          <p className="text-[11px] text-muted-foreground mb-0.5">End</p>
                          <p className="font-medium text-xs">
                            {format(new Date(initiative.endDate), "MMM d, yyyy")}
                          </p>
                        </div>
                      )}
                      {initiative.budgetUsd && (
                        <div>
                          <p className="text-[11px] text-muted-foreground mb-0.5">Budget</p>
                          <p className="font-medium text-xs">
                            ${Number(initiative.budgetUsd).toLocaleString()}
                          </p>
                        </div>
                      )}
                      {initiative.businessSponsor && (
                        <div>
                          <p className="text-[11px] text-muted-foreground mb-0.5">Sponsor</p>
                          <p className="font-medium text-xs">{initiative.businessSponsor}</p>
                        </div>
                      )}
                    </div>
                  </CollapsibleSection>

                  <CollapsibleSection title="Linked Capabilities" count={initiative.capabilities.length}>
                    {initiative.capabilities.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {initiative.capabilities.map((c) => (
                          <span
                            key={c.capabilityId}
                            className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5"
                          >
                            {c.impactType}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No capabilities linked.</p>
                    )}
                  </CollapsibleSection>

                  {/* AI Risk Assessment */}
                  <div className="border-t pt-4">
                    <div className="group relative">
                      <button
                        onClick={handleAssessRisks}
                        disabled={loadingRisk}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-purple-200 bg-purple-50/50 text-purple-700 text-xs font-medium hover:bg-purple-100 disabled:opacity-50 transition-colors"
                      >
                        {loadingRisk ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5" />
                        )}
                        Assess Risks
                        <span className="ml-1 text-[9px] font-semibold uppercase tracking-wide bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded-full">
                          AI
                        </span>
                      </button>

                      {/* Hover tooltip */}
                      <div className="absolute bottom-full left-0 right-0 mb-2 hidden group-hover:block z-50">
                        <div className="bg-[#1a1f2e] text-white text-[11px] rounded-lg px-3 py-2.5 shadow-lg leading-relaxed">
                          <p className="font-semibold text-purple-300 mb-1">AI-powered risk assessment</p>
                          <p className="text-white/80">
                            Analyses this initiative's timeline, budget, milestones, and dependencies using Claude AI to identify schedule, budget, scope, and change-management risks — each with likelihood, impact, and a recommended mitigation action.
                          </p>
                        </div>
                        <div className="w-3 h-3 bg-[#1a1f2e] rotate-45 mx-auto -mt-1.5" />
                      </div>
                    </div>

                    {riskResult && (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold">Risk Level:</span>
                          <span
                            className={`text-xs font-bold ${
                              riskResult.overallRiskLevel === "CRITICAL"
                                ? "text-red-600"
                                : riskResult.overallRiskLevel === "HIGH"
                                ? "text-orange-500"
                                : riskResult.overallRiskLevel === "MEDIUM"
                                ? "text-amber-500"
                                : "text-green-600"
                            }`}
                          >
                            {riskResult.overallRiskLevel}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {riskResult.summary}
                        </p>
                        {riskResult.risks?.slice(0, 3).map((r: any, i: number) => (
                          <div key={i} className="rounded border p-2 text-xs">
                            <p className="font-medium">{r.category}: {r.description}</p>
                            <p className="text-muted-foreground mt-0.5">→ {r.mitigation}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tab === "milestones" && (
                <MilestonePanel initiativeId={initiativeId} />
              )}

              {tab === "dependencies" && <DependencyPanel />}
            </>
          )}
        </div>
      </aside>

      {initiative && showEdit && (
        <InitiativeFormModal
          open={showEdit}
          initiative={initiative as any}
          onClose={() => setShowEdit(false)}
          onDeleted={onClose}
        />
      )}
    </>
  );
}
