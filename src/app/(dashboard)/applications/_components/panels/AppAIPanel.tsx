"use client";

import { useState } from "react";
import { X, Sparkles, Target, Cpu, Loader2, AlertTriangle, CalendarPlus, DollarSign, BarChart3 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "sonner";
import {
  BV_LABELS,
  TH_LABELS,
  RAT_LABELS,
  RAT_COLORS,
  LIFECYCLE_LABELS,
  APP_TYPE_LABELS,
} from "@/lib/constants/application-colors";
import { InitiativeFormModal, type InitiativeFormDefaults } from "@/app/(dashboard)/roadmap/_components/modals/InitiativeFormModal";

type Props = {
  open: boolean;
  onClose: () => void;
  apps: any[];
  capTree: any[];
  defaultTab?: AITab;
};

type AITab = "rationalization" | "impact" | "tech-recs";

export function AppAIPanel({ open, onClose, apps, capTree, defaultTab }: Props) {
  const [tab, setTab] = useState<AITab>(defaultTab ?? "rationalization");

  // Sync when defaultTab changes from parent (e.g. toolbar Rationalize vs AI Assistant)
  const [prevDefaultTab, setPrevDefaultTab] = useState(defaultTab);
  if (defaultTab !== prevDefaultTab) {
    setPrevDefaultTab(defaultTab);
    if (defaultTab) setTab(defaultTab);
  }
  const [roadmapDefaults, setRoadmapDefaults] = useState<InitiativeFormDefaults | null>(null);
  const { workspaceId } = useWorkspace();

  function handleAddToRoadmap(defaults: InitiativeFormDefaults) {
    setRoadmapDefaults(defaults);
  }

  if (!open) return null;

  return (
    <aside className="fixed right-0 top-0 h-screen w-full sm:w-[480px] z-40 border-l bg-white flex flex-col shadow-xl">
      {/* Header */}
      <div className="px-5 py-4 border-b flex items-center justify-between bg-gradient-to-r from-[#7c3aed]/5 to-transparent">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-[#7c3aed]/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-[#7c3aed]" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-[#1a1f2e]">AI Assistant</h2>
            <p className="text-[11px] text-muted-foreground">Application Portfolio</p>
          </div>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b px-2">
        <TabBtn active={tab === "rationalization"} onClick={() => setTab("rationalization")} icon={<Sparkles className="h-3.5 w-3.5" />} label="Rationalize" />
        <TabBtn active={tab === "impact"} onClick={() => setTab("impact")} icon={<Target className="h-3.5 w-3.5" />} label="Impact" />
        <TabBtn active={tab === "tech-recs"} onClick={() => setTab("tech-recs")} icon={<Cpu className="h-3.5 w-3.5" />} label="Tech Recommendations" />
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === "rationalization" && <RationalizationTab apps={apps} workspaceId={workspaceId} onAddToRoadmap={handleAddToRoadmap} />}
        {tab === "impact" && <ImpactTab apps={apps} workspaceId={workspaceId} onAddToRoadmap={handleAddToRoadmap} />}
        {tab === "tech-recs" && <TechRecsTab apps={apps} capTree={capTree} workspaceId={workspaceId} onAddToRoadmap={handleAddToRoadmap} />}
      </div>

      {/* Roadmap Initiative Modal */}
      <InitiativeFormModal
        open={!!roadmapDefaults}
        onClose={() => setRoadmapDefaults(null)}
        initialValues={roadmapDefaults ?? undefined}
      />
    </aside>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
        active ? "border-[#7c3aed] text-[#7c3aed]" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Rationalization Tab ─────────────────────────────────

type RatResult = {
  referenceFrameworks: string[];
  executiveSummary: string;
  portfolioStats: Record<string, number>;
  estimatedAnnualSavings: number;
  recommendations: any[];
  redundancies: any[];
  requiresAssessment: string[];
  lifecycleRisks: any[];
  assumptions: string[];
  dataQualityNotes: string[];
};

const TIME_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  INVEST: { label: "Invest", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
  TOLERATE: { label: "Tolerate", color: "text-green-700", bg: "bg-green-50", border: "border-green-200" },
  MIGRATE: { label: "Migrate", color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" },
  ELIMINATE: { label: "Eliminate", color: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
  CONSOLIDATE: { label: "Consolidate", color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200" },
};

function RationalizationTab({ apps, workspaceId, onAddToRoadmap }: { apps: any[]; workspaceId: string; onAddToRoadmap: (d: InitiativeFormDefaults) => void }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RatResult | null>(null);
  const { data: stats } = trpc.application.getStats.useQuery();
  const { data: matrix } = trpc.application.getRationalizationMatrix.useQuery();
  const { data: aiContext } = trpc.application.getAIRationalizationContext.useQuery();

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/ai/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rationalization",
          workspaceId,
          payload: {
            apps: aiContext?.apps ?? apps.map((a) => ({
              name: a.name,
              vendor: a.vendor,
              applicationType: a.applicationType,
              deploymentModel: a.deploymentModel,
              lifecycle: a.lifecycle,
              businessValue: a.businessValue,
              technicalHealth: a.technicalHealth,
              functionalFit: a.functionalFit ?? "FF_UNKNOWN",
              dataClassification: a.dataClassification ?? "DC_UNKNOWN",
              rationalizationStatus: a.rationalizationStatus,
              annualCostUsd: a.annualCostUsd ? Number(a.annualCostUsd) : null,
              costModel: a.costModel,
              licensedUsers: a.licensedUsers,
              actualUsers: a.actualUsers,
              adoptionRate: null,
              capabilityCount: a.capabilities?.length ?? 0,
              interfaceCount: { inbound: 0, outbound: 0, total: 0, critical: 0 },
              techStack: [],
              replacementApp: null,
            })),
          },
        }),
      });
      const data = await res.json();
      if (data.error) toast.error(data.error);
      else setResult(data);
    } catch { toast.error("AI request failed"); }
    finally { setLoading(false); }
  }

  const timeOrder = ["INVEST", "TOLERATE", "MIGRATE", "ELIMINATE", "CONSOLIDATE"];

  const totalCost = stats?.totalCost ?? 0;
  const eliminateCandidates = matrix?.retireCandidates ?? [];
  const eliminateCost = eliminateCandidates.reduce((sum: number, a: any) => sum + Number(a.annualCostUsd ?? 0), 0);
  const redundancyCount = matrix?.redundancies?.length ?? 0;
  const orphanCount = matrix?.orphanedApps?.length ?? 0;

  return (
    <div className="p-5">
      {/* Portfolio Overview */}
      <div className="mb-5 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border bg-[#fafbfc] p-2.5">
            <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
              <BarChart3 className="h-3 w-3" />
              <span className="text-[10px] font-medium">Total Apps</span>
            </div>
            <p className="text-lg font-bold text-[#1a1f2e]">{stats?.totalApps ?? apps.length}</p>
          </div>
          <div className="rounded-lg border bg-[#fafbfc] p-2.5">
            <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
              <DollarSign className="h-3 w-3" />
              <span className="text-[10px] font-medium">Annual Spend</span>
            </div>
            <p className="text-lg font-bold text-[#1a1f2e]">${totalCost.toLocaleString()}</p>
          </div>
        </div>

        {/* Current TIME breakdown */}
        {stats && Object.keys(stats.byRationalization).length > 0 && (
          <div className="rounded-lg border bg-[#fafbfc] p-3 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Current Rationalization</p>
            {Object.entries(stats.byRationalization).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: RAT_COLORS[status] ?? "#cbd5e1" }} />
                  <span className="text-[#1a1f2e]">{RAT_LABELS[status] ?? status}</span>
                </div>
                <span className="font-medium text-[#1a1f2e] tabular-nums">{count as number}</span>
              </div>
            ))}
          </div>
        )}

        {/* Quick insights row */}
        {(eliminateCandidates.length > 0 || redundancyCount > 0 || orphanCount > 0) && (
          <div className="flex gap-2 text-[10px]">
            {eliminateCandidates.length > 0 && (
              <div className="flex-1 rounded-md border border-red-200 bg-red-50 p-2 text-center">
                <p className="font-bold text-red-700">{eliminateCandidates.length}</p>
                <p className="text-red-600">Eliminate candidates</p>
                {eliminateCost > 0 && <p className="text-red-500 mt-0.5">${eliminateCost.toLocaleString()} potential savings</p>}
              </div>
            )}
            {redundancyCount > 0 && (
              <div className="flex-1 rounded-md border border-orange-200 bg-orange-50 p-2 text-center">
                <p className="font-bold text-orange-700">{redundancyCount}</p>
                <p className="text-orange-600">Redundancies</p>
              </div>
            )}
            {orphanCount > 0 && (
              <div className="flex-1 rounded-md border border-amber-200 bg-amber-50 p-2 text-center">
                <p className="font-bold text-amber-700">{orphanCount}</p>
                <p className="text-amber-600">Unmapped apps</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Run AI */}
      <Button onClick={run} disabled={loading} className="w-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white mb-5">
        {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing portfolio...</> : <><Sparkles className="h-4 w-4 mr-2" />Run TIME Analysis</>}
      </Button>

      {result && (
        <div className="space-y-4">
          <FrameworkPills frameworks={result.referenceFrameworks} />
          <ExecSummary text={result.executiveSummary} />

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            {timeOrder.map((cat) => {
              const conf = TIME_CONFIG[cat];
              const count = result.portfolioStats?.[cat.toLowerCase()] ?? result.recommendations.filter((r) => r.timeCategory === cat).length;
              return (
                <div key={cat} className={`p-2 rounded-lg border text-center ${conf.bg} ${conf.border}`}>
                  <p className={`text-lg font-bold ${conf.color}`}>{count}</p>
                  <p className={`text-[9px] font-medium ${conf.color}`}>{conf.label}</p>
                </div>
              );
            })}
            <div className="p-2 rounded-lg border text-center bg-green-50 border-green-200">
              <p className="text-lg font-bold text-green-700">${(result.estimatedAnnualSavings ?? 0).toLocaleString()}</p>
              <p className="text-[9px] font-medium text-green-700">Est. Savings</p>
            </div>
          </div>

          {/* Recommendations by TIME category */}
          {timeOrder.map((cat) => {
            const items = result.recommendations.filter((r) => r.timeCategory === cat);
            if (items.length === 0) return null;
            const conf = TIME_CONFIG[cat];
            return (
              <div key={cat}>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${conf.bg} ${conf.color} ${conf.border} border inline-block mb-2`}>
                  {conf.label} ({items.length})
                </span>
                <div className="space-y-2">
                  {items.map((rec, i) => (
                    <div key={i} className={`p-3 rounded-lg border ${conf.border} ${conf.bg}`}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="text-xs font-semibold text-[#1a1f2e]">{rec.applicationName}</h4>
                        <ConfidenceDot confidence={rec.confidence} />
                      </div>
                      {rec.vendor && <p className="text-[10px] text-muted-foreground mb-1">{rec.vendor}</p>}
                      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                        <Badge variant="secondary" className="text-[9px]">BV: {BV_LABELS[rec.businessValue] ?? rec.businessValue}</Badge>
                        <Badge variant="secondary" className="text-[9px]">TH: {TH_LABELS[rec.technicalHealth] ?? rec.technicalHealth}</Badge>
                        {rec.functionalFit && rec.functionalFit !== "FF_UNKNOWN" && (
                          <Badge variant="secondary" className="text-[9px]">FF: {rec.functionalFit}</Badge>
                        )}
                        {rec.integrationRisk && rec.integrationRisk !== "LOW" && (
                          <Badge variant="outline" className={`text-[9px] ${rec.integrationRisk === "HIGH" ? "border-red-300 text-red-600" : "border-orange-300 text-orange-600"}`}>
                            {rec.integrationCount ?? 0} ifaces ({rec.integrationRisk})
                          </Badge>
                        )}
                        {rec.annualCost > 0 && <Badge variant="outline" className="text-[9px]">${Number(rec.annualCost).toLocaleString()}/yr</Badge>}
                      </div>
                      <p className="text-[11px] text-[#495057] leading-relaxed mb-1">{rec.rationale}</p>
                      <p className="text-[11px] text-[#7c3aed] font-medium leading-relaxed">→ {rec.action}</p>
                      {rec.savingsIfActioned > 0 && (
                        <p className="text-[10px] text-green-600 mt-1">Potential savings: ${Number(rec.savingsIfActioned).toLocaleString()}/yr</p>
                      )}
                      {(rec.timeCategory === "MIGRATE" || rec.timeCategory === "ELIMINATE" || rec.timeCategory === "CONSOLIDATE") && (
                        <AddToRoadmapBtn onClick={() => onAddToRoadmap({
                          name: `${rec.timeCategory === "ELIMINATE" ? "Decommission" : rec.timeCategory === "MIGRATE" ? "Migrate" : "Consolidate"} ${rec.applicationName}`,
                          description: `${rec.rationale}\n\nRecommended Action: ${rec.action}${rec.savingsIfActioned > 0 ? `\nEstimated savings: $${Number(rec.savingsIfActioned).toLocaleString()}/yr` : ""}`,
                          category: rec.timeCategory === "ELIMINATE" ? "DECOMMISSION" : "CONSOLIDATION",
                          priority: rec.confidence === "HIGH" ? "HIGH" : rec.confidence === "MEDIUM" ? "MEDIUM" : "LOW",
                          horizon: rec.timeCategory === "ELIMINATE" ? "H1_NOW" : "H2_NEXT",
                          sourceType: "AI_RATIONALIZATION",
                          sourceContext: `TIME Category: ${rec.timeCategory} | App: ${rec.applicationName} | Confidence: ${rec.confidence}`,
                        })} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Redundancies */}
          {result.redundancies?.length > 0 && (
            <Section title="Redundancies" count={result.redundancies.length} color="orange">
              {result.redundancies.map((r, i) => (
                <div key={i} className="p-2.5 rounded-lg border border-orange-200 bg-orange-50/50">
                  <p className="text-xs font-medium text-[#1a1f2e] mb-1">{r.capabilityName}</p>
                  <div className="flex flex-wrap gap-1 mb-1">
                    {r.applications.map((a: string, j: number) => (
                      <span key={j} className="text-[9px] px-1.5 py-0.5 rounded bg-white border border-orange-200 text-orange-700">{a}</span>
                    ))}
                  </div>
                  <p className="text-[11px] text-[#495057]">{r.recommendation}</p>
                </div>
              ))}
            </Section>
          )}

          <AssumptionsAndNotes assumptions={result.assumptions} dataQualityNotes={result.dataQualityNotes} requiresAssessment={result.requiresAssessment} />

          <CopyButton label="Copy Full Analysis" onClick={() => {
            navigator.clipboard.writeText(formatRationalizationText(result));
            toast.success("Analysis copied — paste into Word or email");
          }} />
        </div>
      )}
    </div>
  );
}

// ─── Impact Analysis Tab ─────────────────────────────────

type ImpactResult = {
  referenceFrameworks: string[];
  targetApplication: string;
  overallRiskLevel: string;
  overallConfidence: string;
  executiveSummary: string;
  affectedCapabilities: any[];
  uncoveredCapabilities: string[];
  migrationConsiderations: any[];
  costImpact: any;
  recommendation: string;
  transitionPlan: any[];
  assumptions: string[];
  unknowns: string[];
  dataQualityNotes: string[];
};

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  CRITICAL_RISK: { label: "Critical", color: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
  CRITICAL: { label: "Critical", color: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
  HIGH_RISK: { label: "High", color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" },
  HIGH: { label: "High", color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" },
  MODERATE_RISK: { label: "Moderate", color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200" },
  MODERATE: { label: "Moderate", color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200" },
  LOW_RISK: { label: "Low", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
  LOW: { label: "Low", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
};

function ImpactTab({ apps, workspaceId, onAddToRoadmap }: { apps: any[]; workspaceId: string; onAddToRoadmap: (d: InitiativeFormDefaults) => void }) {
  const [selectedAppId, setSelectedAppId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImpactResult | null>(null);
  const { data: aiContext } = trpc.application.getAIRationalizationContext.useQuery();

  async function run() {
    if (!selectedAppId) { toast.error("Select an application first"); return; }
    setLoading(true);
    setResult(null);
    const targetApp = apps.find((a) => a.id === selectedAppId);
    if (!targetApp) return;

    // Use enriched data from AI context endpoint when available
    const enrichedTarget = aiContext?.apps?.find((a: any) => a.id === selectedAppId);

    try {
      const res = await fetch("/api/ai/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "impact-analysis",
          workspaceId,
          payload: {
            targetApp: {
              id: targetApp.id,
              name: targetApp.name,
              vendor: targetApp.vendor,
              applicationType: targetApp.applicationType,
              deploymentModel: targetApp.deploymentModel,
              lifecycle: targetApp.lifecycle,
              businessValue: targetApp.businessValue,
              technicalHealth: targetApp.technicalHealth,
              functionalFit: targetApp.functionalFit ?? "FF_UNKNOWN",
              dataClassification: targetApp.dataClassification ?? "DC_UNKNOWN",
              annualCostUsd: targetApp.annualCostUsd ? Number(targetApp.annualCostUsd) : null,
              licensedUsers: targetApp.licensedUsers,
              actualUsers: targetApp.actualUsers,
              adoptionRate: enrichedTarget?.adoptionRate ?? (targetApp.actualUsers != null && targetApp.licensedUsers != null && targetApp.licensedUsers > 0
                ? targetApp.actualUsers / targetApp.licensedUsers : null),
              costModel: targetApp.costModel,
              interfaces: enrichedTarget?.interfaces ?? [],
              techStack: enrichedTarget?.techStack ?? [],
              replacementApp: enrichedTarget?.replacementApp ?? null,
              capabilities: (targetApp.capabilities ?? []).map((c: any) => ({
                capabilityName: c.capability?.name ?? c.capabilityName ?? "Unknown",
                level: c.capability?.level ?? c.level ?? "?",
                strategicImportance: c.capability?.strategicImportance ?? c.strategicImportance ?? "NOT_ASSESSED",
                supportType: c.supportType ?? "SUPPORTS",
              })),
            },
            allApps: apps.map((a) => ({
              id: a.id,
              name: a.name,
              vendor: a.vendor,
              applicationType: a.applicationType,
              lifecycle: a.lifecycle,
              businessValue: a.businessValue,
              technicalHealth: a.technicalHealth,
              capabilities: (a.capabilities ?? []).map((c: any) => ({
                capabilityName: c.capability?.name ?? c.capabilityName ?? "Unknown",
              })),
            })),
          },
        }),
      });
      const data = await res.json();
      if (data.error) toast.error(data.error);
      else setResult(data);
    } catch { toast.error("AI request failed"); }
    finally { setLoading(false); }
  }

  const riskConf = RISK_CONFIG[result?.overallRiskLevel ?? ""] ?? RISK_CONFIG.MODERATE;

  return (
    <div className="p-5">
      <p className="text-sm text-muted-foreground mb-3">
        Select an application to analyze the impact of retiring or replacing it.
      </p>
      <Select value={selectedAppId} onValueChange={(v) => v && setSelectedAppId(v)}>
        <SelectTrigger className="h-9 text-xs mb-3">
          <SelectValue placeholder="Select application..." />
        </SelectTrigger>
        <SelectContent>
          {apps.map((a) => (
            <SelectItem key={a.id} value={a.id} className="text-xs">{a.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button onClick={run} disabled={loading || !selectedAppId} className="w-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white mb-5">
        {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing impact...</> : <><Target className="h-4 w-4 mr-2" />Analyze Impact</>}
      </Button>

      {result && (
        <div className="space-y-4">
          <FrameworkPills frameworks={result.referenceFrameworks} />

          {/* Risk banner */}
          <div className={`p-3 rounded-lg border ${riskConf.border} ${riskConf.bg} flex items-center justify-between`}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Overall Risk</p>
              <p className={`text-sm font-bold ${riskConf.color}`}>{riskConf.label}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Recommendation</p>
              <p className="text-sm font-bold text-[#1a1f2e]">{result.recommendation}</p>
            </div>
          </div>

          <ExecSummary text={result.executiveSummary} />

          {/* Affected Capabilities */}
          {result.affectedCapabilities?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Affected Capabilities ({result.affectedCapabilities.length})
              </p>
              <div className="space-y-2">
                {result.affectedCapabilities.map((cap, i) => {
                  const rc = RISK_CONFIG[cap.riskLevel] ?? RISK_CONFIG.MODERATE_RISK;
                  return (
                    <div key={i} className={`p-2.5 rounded-lg border ${rc.border} ${rc.bg}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[9px] font-bold">{cap.level}</Badge>
                          <span className="text-xs font-medium text-[#1a1f2e]">{cap.capabilityName}</span>
                        </div>
                        <span className={`text-[9px] font-bold ${rc.color}`}>{rc.label}</span>
                      </div>
                      <p className="text-[10px] text-[#495057] mb-1">{cap.riskNote}</p>
                      {cap.alternativeApps?.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-[9px] text-muted-foreground">Alternatives:</span>
                          {cap.alternativeApps.map((a: string, j: number) => (
                            <span key={j} className="text-[9px] px-1.5 py-0.5 rounded bg-white border text-[#495057]">{a}</span>
                          ))}
                        </div>
                      )}
                      {cap.coverageAfterRetirement === "UNCOVERED" && (
                        <p className="text-[10px] text-red-600 font-medium mt-1">No alternative — capability will be unsupported</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Migration Considerations */}
          {result.migrationConsiderations?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Migration Considerations</p>
              <div className="space-y-1.5">
                {result.migrationConsiderations.map((m, i) => (
                  <div key={i} className="p-2.5 rounded-lg border border-[#e9ecef] flex items-start gap-2">
                    <Badge variant={m.complexity === "HIGH" ? "destructive" : "secondary"} className="text-[9px] shrink-0 mt-0.5">{m.complexity}</Badge>
                    <div>
                      <p className="text-xs font-medium text-[#1a1f2e]">{m.factor}</p>
                      <p className="text-[11px] text-[#495057]">{m.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cost Impact */}
          {result.costImpact && (
            <div className="p-3 rounded-lg border border-[#e9ecef] bg-[#fafbfc]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Cost Impact</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Annual Savings:</span> <span className="font-medium text-green-700">${(result.costImpact.annualSavings ?? 0).toLocaleString()}</span></div>
                <div><span className="text-muted-foreground">Transition Cost:</span> <span className="font-medium">{result.costImpact.estimatedTransitionCost}</span></div>
                <div><span className="text-muted-foreground">Payback:</span> <span className="font-medium">{result.costImpact.paybackPeriod}</span></div>
              </div>
              <p className="text-[11px] text-[#495057] mt-2">{result.costImpact.netAssessment}</p>
            </div>
          )}

          {/* Transition Plan */}
          {result.transitionPlan?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Transition Plan</p>
              <div className="space-y-2 border-l-2 border-[#e9ecef] ml-2 pl-4">
                {result.transitionPlan.map((phase, i) => (
                  <div key={i} className="p-2.5 rounded-lg border border-[#e9ecef]">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-white bg-[#1a1f2e] rounded-full w-5 h-5 flex items-center justify-center shrink-0">{phase.phase}</span>
                      <span className="text-xs font-semibold text-[#1a1f2e]">{phase.name}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{phase.timeline}</span>
                    </div>
                    <ul className="text-[11px] text-[#495057] space-y-0.5 ml-7">
                      {(phase.actions ?? []).map((a: string, j: number) => <li key={j}>• {a}</li>)}
                    </ul>
                    <AddToRoadmapBtn onClick={() => onAddToRoadmap({
                      name: `${result.targetApplication}: ${phase.name}`,
                      description: `Transition Phase ${phase.phase} — ${phase.name}\nTimeline: ${phase.timeline}\n\nActions:\n${(phase.actions ?? []).map((a: string) => `• ${a}`).join("\n")}`,
                      category: "MODERNISATION",
                      priority: i === 0 ? "HIGH" : "MEDIUM",
                      horizon: i === 0 ? "H1_NOW" : i === 1 ? "H2_NEXT" : "H3_LATER",
                      sourceType: "AI_IMPACT_ANALYSIS",
                      sourceContext: `App: ${result.targetApplication} | Phase: ${phase.phase} — ${phase.name} | Risk: ${result.overallRiskLevel}`,
                    })} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <AssumptionsAndNotes assumptions={result.assumptions} dataQualityNotes={result.dataQualityNotes} unknowns={result.unknowns} />

          <CopyButton label="Copy Impact Analysis" onClick={() => {
            navigator.clipboard.writeText(formatImpactText(result));
            toast.success("Impact analysis copied — paste into Word or email");
          }} />
        </div>
      )}
    </div>
  );
}

// ─── Tech Recommendations Tab ────────────────────────────

type TechResult = {
  referenceFrameworks: string[];
  executiveSummary: string;
  stackProfile: any;
  capabilities: any[];
  platformConsolidation: any[];
  assumptions: string[];
  dataQualityNotes: string[];
};

const COVERAGE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  WELL_SERVED: { label: "Well Served", color: "text-green-700", bg: "bg-green-50", border: "border-green-200" },
  UNDERSERVED: { label: "Underserved", color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" },
  UNSERVED: { label: "Unserved", color: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
};

function TechRecsTab({ apps, capTree, workspaceId, onAddToRoadmap }: { apps: any[]; capTree: any[]; workspaceId: string; onAddToRoadmap: (d: InitiativeFormDefaults) => void }) {
  const [loading, setLoading] = useState(false);
  const [budget, setBudget] = useState("MODERATE");
  const [result, setResult] = useState<TechResult | null>(null);

  function buildCapabilitiesWithApps() {
    const capAppMap: Record<string, any[]> = {};
    for (const app of apps) {
      for (const mapping of app.capabilities ?? []) {
        const capId = mapping.capabilityId ?? mapping.capability?.id;
        if (!capId) continue;
        if (!capAppMap[capId]) capAppMap[capId] = [];
        capAppMap[capId].push({
          name: app.name,
          vendor: app.vendor,
          applicationType: app.applicationType,
          deploymentModel: app.deploymentModel,
          lifecycle: app.lifecycle,
          businessValue: app.businessValue,
          technicalHealth: app.technicalHealth,
          annualCostUsd: app.annualCostUsd ? Number(app.annualCostUsd) : null,
        });
      }
    }

    const result: any[] = [];
    function walk(nodes: any[]) {
      for (const n of nodes) {
        result.push({
          name: n.name,
          level: n.level,
          strategicImportance: n.strategicImportance,
          currentMaturity: n.currentMaturity,
          targetMaturity: n.targetMaturity,
          currentApps: capAppMap[n.id] ?? [],
        });
        if (n.children) walk(n.children);
      }
    }
    walk(capTree);
    return result;
  }

  function buildStackProfile() {
    const vendorCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};
    const deployCounts: Record<string, number> = {};
    for (const app of apps) {
      if (app.vendor) vendorCounts[app.vendor] = (vendorCounts[app.vendor] ?? 0) + 1;
      typeCounts[app.applicationType] = (typeCounts[app.applicationType] ?? 0) + 1;
      deployCounts[app.deploymentModel] = (deployCounts[app.deploymentModel] ?? 0) + 1;
    }
    const dominantDeployment = Object.entries(deployCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "UNKNOWN";
    return { vendorCounts, typeCounts, dominantDeployment };
  }

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/ai/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "tech-recommendations",
          workspaceId,
          payload: {
            capabilities: buildCapabilitiesWithApps(),
            stackProfile: buildStackProfile(),
            budgetPosture: budget,
          },
        }),
      });
      const data = await res.json();
      if (data.error) toast.error(data.error);
      else setResult(data);
    } catch { toast.error("AI request failed"); }
    finally { setLoading(false); }
  }

  return (
    <div className="p-5">
      <p className="text-sm text-muted-foreground mb-3">
        AI recommends technology solutions for each capability, considering your existing stack and industry context.
      </p>
      <div className="mb-3">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Budget Posture</label>
        <Select value={budget} onValueChange={(v) => v && setBudget(v)}>
          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="CONSTRAINED">Constrained</SelectItem>
            <SelectItem value="MODERATE">Moderate</SelectItem>
            <SelectItem value="EXPANSIVE">Expansive</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button onClick={run} disabled={loading} className="w-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white mb-5">
        {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Researching solutions...</> : <><Cpu className="h-4 w-4 mr-2" />Get Recommendations</>}
      </Button>

      {result && (
        <div className="space-y-4">
          <FrameworkPills frameworks={result.referenceFrameworks} />
          <ExecSummary text={result.executiveSummary} />

          {/* Coverage stats */}
          {result.capabilities?.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {(["WELL_SERVED", "UNDERSERVED", "UNSERVED"] as const).map((status) => {
                const conf = COVERAGE_CONFIG[status];
                const count = result.capabilities.filter((c) => c.coverageStatus === status).length;
                return (
                  <div key={status} className={`p-2 rounded-lg border text-center ${conf.bg} ${conf.border}`}>
                    <p className={`text-lg font-bold ${conf.color}`}>{count}</p>
                    <p className={`text-[9px] font-medium ${conf.color}`}>{conf.label}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Capabilities */}
          {(result.capabilities ?? []).map((cap, i) => {
            const covConf = COVERAGE_CONFIG[cap.coverageStatus] ?? COVERAGE_CONFIG.UNSERVED;
            return (
              <div key={i} className={`p-3 rounded-lg border ${covConf.border}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[9px] font-bold">{cap.level}</Badge>
                    <h4 className="text-xs font-semibold text-[#1a1f2e]">{cap.capabilityName}</h4>
                  </div>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${covConf.bg} ${covConf.color}`}>{covConf.label}</span>
                </div>

                {cap.currentApp?.name && (
                  <p className="text-[10px] text-muted-foreground mb-1">
                    Current: {cap.currentApp.name} ({cap.currentApp.vendor ?? "N/A"}) — {cap.currentApp.assessment}
                  </p>
                )}

                {(cap.recommendations ?? []).map((rec: any, j: number) => (
                  <div key={j} className="mt-2 p-2.5 rounded-md border border-[#e9ecef] bg-white">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-white bg-[#1a1f2e] rounded-full w-4 h-4 flex items-center justify-center">{rec.rank}</span>
                        <span className="text-xs font-semibold text-[#1a1f2e]">{rec.vendorName} {rec.productName}</span>
                      </div>
                      <ConfidenceDot confidence={rec.confidence} />
                    </div>
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#f1f3f5] text-[#495057]">{rec.category}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#f1f3f5] text-[#495057]">{rec.deploymentModel}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#f1f3f5] text-[#495057]">{rec.costTier}</span>
                      {rec.existingVendorExtension && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">Existing vendor</span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#495057] leading-relaxed">{rec.fitRationale}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Integration: {rec.integrationNotes}</p>
                    <AddToRoadmapBtn onClick={() => onAddToRoadmap({
                      name: `Implement ${rec.vendorName} ${rec.productName} for ${cap.capabilityName}`,
                      description: `Deploy ${rec.vendorName} ${rec.productName} to support ${cap.capabilityName} (${cap.level}).\n\nFit: ${rec.fitRationale}\nIntegration: ${rec.integrationNotes}\nCost Tier: ${rec.costTier} | Deployment: ${rec.deploymentModel}${rec.existingVendorExtension ? " | Existing Vendor Extension" : ""}`,
                      category: cap.coverageStatus === "UNSERVED" ? "INNOVATION" : "MODERNISATION",
                      priority: rec.confidence === "HIGH" ? "HIGH" : "MEDIUM",
                      horizon: rec.rank === 1 ? "H1_NOW" : "H2_NEXT",
                      sourceType: "AI_TECH_RECOMMENDATION",
                      sourceContext: `Vendor: ${rec.vendorName} ${rec.productName} | Capability: ${cap.capabilityName} | Coverage: ${cap.coverageStatus} | Confidence: ${rec.confidence}`,
                    })} />
                  </div>
                ))}
              </div>
            );
          })}

          {/* Platform Consolidation */}
          {result.platformConsolidation?.length > 0 && (
            <Section title="Platform Consolidation" count={result.platformConsolidation.length} color="blue">
              {result.platformConsolidation.map((p, i) => (
                <div key={i} className="p-3 rounded-lg border border-blue-200 bg-blue-50/50">
                  <h4 className="text-xs font-semibold text-[#1a1f2e] mb-1">{p.vendorPlatform}</h4>
                  <p className="text-[11px] text-[#495057] mb-2">{p.rationale}</p>
                  <div className="flex flex-wrap gap-1">
                    {(p.capabilitiesServed ?? []).map((c: string, j: number) => (
                      <span key={j} className="text-[9px] px-1.5 py-0.5 rounded bg-white border border-blue-200 text-[#495057]">{c}</span>
                    ))}
                  </div>
                  {p.estimatedCostTier && <p className="text-[10px] text-blue-700 mt-1">Cost tier: {p.estimatedCostTier}</p>}
                </div>
              ))}
            </Section>
          )}

          <AssumptionsAndNotes assumptions={result.assumptions} dataQualityNotes={result.dataQualityNotes} />

          <CopyButton label="Copy Tech Recommendations" onClick={() => {
            navigator.clipboard.writeText(formatTechRecsText(result));
            toast.success("Recommendations copied — paste into Word or email");
          }} />
        </div>
      )}
    </div>
  );
}

// ─── Shared Components ───────────────────────────────────

function FrameworkPills({ frameworks }: { frameworks?: string[] }) {
  if (!frameworks?.length) return null;
  return (
    <div className="p-2.5 rounded-lg bg-[#f8f9fa] border border-[#e9ecef]">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Reference Frameworks</p>
      <div className="flex flex-wrap gap-1.5">
        {frameworks.map((f, i) => (
          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-[#dee2e6] text-[#495057] font-medium">{f}</span>
        ))}
      </div>
    </div>
  );
}

function ExecSummary({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="p-3.5 rounded-lg bg-[#1a1f2e] text-white">
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1.5">Executive Summary</p>
      <p className="text-xs leading-relaxed text-white/90">{text}</p>
    </div>
  );
}

function Section({ title, count, color, children }: { title: string; count: number; color: string; children: React.ReactNode }) {
  const colorMap: Record<string, string> = {
    orange: "text-orange-700 bg-orange-50 border-orange-200",
    blue: "text-blue-700 bg-blue-50 border-blue-200",
    red: "text-red-700 bg-red-50 border-red-200",
    green: "text-green-700 bg-green-50 border-green-200",
  };
  return (
    <div>
      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border inline-block mb-2 ${colorMap[color] ?? colorMap.blue}`}>
        {title} ({count})
      </span>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function AssumptionsAndNotes({ assumptions, dataQualityNotes, requiresAssessment, unknowns }: { assumptions?: string[]; dataQualityNotes?: string[]; requiresAssessment?: string[]; unknowns?: string[] }) {
  const hasContent = (assumptions?.length ?? 0) > 0 || (dataQualityNotes?.length ?? 0) > 0 || (requiresAssessment?.length ?? 0) > 0 || (unknowns?.length ?? 0) > 0;
  if (!hasContent) return null;
  return (
    <div className="space-y-3">
      {assumptions && assumptions.length > 0 && (
        <div className="p-3 rounded-lg border border-[#e9ecef] bg-[#fafbfc]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Assumptions</p>
          <ul className="text-[11px] text-[#495057] space-y-0.5">
            {assumptions.map((a, i) => <li key={i}>• {a}</li>)}
          </ul>
        </div>
      )}
      {dataQualityNotes && dataQualityNotes.length > 0 && (
        <div className="p-3 rounded-lg border border-orange-200 bg-orange-50">
          <p className="text-[10px] font-bold uppercase tracking-wider text-orange-700 mb-1.5">
            <AlertTriangle className="h-3 w-3 inline mr-1" />Data Quality Notes
          </p>
          <ul className="text-[11px] text-orange-600 space-y-0.5">
            {dataQualityNotes.map((n, i) => <li key={i}>• {n}</li>)}
          </ul>
        </div>
      )}
      {requiresAssessment && requiresAssessment.length > 0 && (
        <div className="p-3 rounded-lg border border-orange-200 bg-orange-50">
          <p className="text-[10px] font-bold uppercase tracking-wider text-orange-700 mb-1.5">Requires Assessment ({requiresAssessment.length})</p>
          <div className="flex flex-wrap gap-1">
            {requiresAssessment.map((n, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-orange-200 text-orange-700">{n}</span>
            ))}
          </div>
        </div>
      )}
      {unknowns && unknowns.length > 0 && (
        <div className="p-3 rounded-lg border border-[#e9ecef] bg-[#fafbfc]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Unknowns</p>
          <ul className="text-[11px] text-[#495057] space-y-0.5">
            {unknowns.map((u, i) => <li key={i}>• {u}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function ConfidenceDot({ confidence }: { confidence?: string }) {
  if (!confidence) return null;
  const colors: Record<string, string> = { HIGH: "bg-green-500", MEDIUM: "bg-yellow-500", LOW: "bg-red-500" };
  return (
    <span className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
      <span className={`w-2 h-2 rounded-full ${colors[confidence] ?? "bg-gray-400"}`} />
      {confidence}
    </span>
  );
}

function AddToRoadmapBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 mt-2 px-2 py-1 rounded-md text-[10px] font-medium text-[#7c3aed] bg-[#7c3aed]/5 border border-[#7c3aed]/20 hover:bg-[#7c3aed]/10 transition-colors"
    >
      <CalendarPlus className="h-3 w-3" />
      Add to Roadmap
    </button>
  );
}

function CopyButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" className="w-full text-xs" onClick={onClick}>
      {label}
    </Button>
  );
}

// ─── Text Formatters ─────────────────────────────────────

const DIV = "─".repeat(60);

function formatRationalizationText(r: RatResult): string {
  const l: string[] = [];
  l.push("APPLICATION PORTFOLIO RATIONALIZATION ANALYSIS", DIV, "");
  if (r.referenceFrameworks?.length) l.push(`Reference Frameworks: ${r.referenceFrameworks.join(", ")}`, "");
  l.push("EXECUTIVE SUMMARY", DIV, r.executiveSummary, "");
  l.push(`Estimated Annual Savings: $${(r.estimatedAnnualSavings ?? 0).toLocaleString()}`, "");

  for (const cat of ["INVEST", "TOLERATE", "MIGRATE", "ELIMINATE", "CONSOLIDATE"]) {
    const items = r.recommendations.filter((x) => x.timeCategory === cat);
    if (!items.length) continue;
    l.push(`${cat} (${items.length})`, DIV);
    for (const rec of items) {
      l.push(`  ${rec.applicationName}${rec.vendor ? ` — ${rec.vendor}` : ""}`);
      l.push(`    BV: ${BV_LABELS[rec.businessValue] ?? rec.businessValue} | TH: ${TH_LABELS[rec.technicalHealth] ?? rec.technicalHealth} | Cost: $${Number(rec.annualCost || 0).toLocaleString()}/yr | Confidence: ${rec.confidence}`);
      l.push(`    ${rec.rationale}`);
      l.push(`    Action: ${rec.action}`);
      if (rec.savingsIfActioned > 0) l.push(`    Potential savings: $${Number(rec.savingsIfActioned).toLocaleString()}/yr`);
      l.push("");
    }
  }

  if (r.redundancies?.length) {
    l.push("REDUNDANCIES", DIV);
    for (const red of r.redundancies) {
      l.push(`  ${red.capabilityName}: ${red.applications.join(", ")}`);
      l.push(`    ${red.recommendation}`, "");
    }
  }
  if (r.assumptions?.length) { l.push("ASSUMPTIONS", DIV); r.assumptions.forEach((a) => l.push(`  • ${a}`)); l.push(""); }
  if (r.dataQualityNotes?.length) { l.push("DATA QUALITY NOTES", DIV); r.dataQualityNotes.forEach((n) => l.push(`  • ${n}`)); l.push(""); }
  return l.join("\n");
}

function formatImpactText(r: ImpactResult): string {
  const l: string[] = [];
  l.push(`IMPACT ANALYSIS: ${r.targetApplication}`, DIV, "");
  if (r.referenceFrameworks?.length) l.push(`Reference Frameworks: ${r.referenceFrameworks.join(", ")}`, "");
  l.push(`Overall Risk: ${r.overallRiskLevel} | Recommendation: ${r.recommendation}`, "");
  l.push("EXECUTIVE SUMMARY", DIV, r.executiveSummary, "");

  if (r.affectedCapabilities?.length) {
    l.push("AFFECTED CAPABILITIES", DIV);
    for (const cap of r.affectedCapabilities) {
      l.push(`  ${cap.capabilityName} (${cap.level}) — Risk: ${cap.riskLevel}`);
      l.push(`    ${cap.riskNote}`);
      if (cap.alternativeApps?.length) l.push(`    Alternatives: ${cap.alternativeApps.join(", ")}`);
      l.push(`    Coverage after retirement: ${cap.coverageAfterRetirement}`, "");
    }
  }

  if (r.costImpact) {
    l.push("COST IMPACT", DIV);
    l.push(`  Annual Savings: $${(r.costImpact.annualSavings ?? 0).toLocaleString()}`);
    l.push(`  Transition Cost: ${r.costImpact.estimatedTransitionCost}`);
    l.push(`  Payback: ${r.costImpact.paybackPeriod}`);
    l.push(`  ${r.costImpact.netAssessment}`, "");
  }

  if (r.transitionPlan?.length) {
    l.push("TRANSITION PLAN", DIV);
    for (const p of r.transitionPlan) {
      l.push(`  Phase ${p.phase}: ${p.name} (${p.timeline})`);
      (p.actions ?? []).forEach((a: string) => l.push(`    • ${a}`));
      l.push("");
    }
  }
  if (r.assumptions?.length) { l.push("ASSUMPTIONS", DIV); r.assumptions.forEach((a) => l.push(`  • ${a}`)); l.push(""); }
  if (r.unknowns?.length) { l.push("UNKNOWNS", DIV); r.unknowns.forEach((u) => l.push(`  • ${u}`)); l.push(""); }
  if (r.dataQualityNotes?.length) { l.push("DATA QUALITY NOTES", DIV); r.dataQualityNotes.forEach((n) => l.push(`  • ${n}`)); l.push(""); }
  return l.join("\n");
}

function formatTechRecsText(r: TechResult): string {
  const l: string[] = [];
  l.push("TECHNOLOGY RECOMMENDATIONS", DIV, "");
  if (r.referenceFrameworks?.length) l.push(`Reference Frameworks: ${r.referenceFrameworks.join(", ")}`, "");
  l.push("EXECUTIVE SUMMARY", DIV, r.executiveSummary, "");

  const served = r.capabilities?.filter((c) => c.coverageStatus === "WELL_SERVED").length ?? 0;
  const under = r.capabilities?.filter((c) => c.coverageStatus === "UNDERSERVED").length ?? 0;
  const un = r.capabilities?.filter((c) => c.coverageStatus === "UNSERVED").length ?? 0;
  l.push(`Coverage: Well Served: ${served} | Underserved: ${under} | Unserved: ${un}`, "");

  for (const cap of r.capabilities ?? []) {
    l.push(`${cap.capabilityName} (${cap.level}) — ${cap.coverageStatus}`, DIV);
    if (cap.currentApp?.name) l.push(`  Current: ${cap.currentApp.name} (${cap.currentApp.vendor ?? "N/A"}) — ${cap.currentApp.assessment}`);
    for (const rec of cap.recommendations ?? []) {
      l.push(`  #${rec.rank} ${rec.vendorName} ${rec.productName} [${rec.category}]`);
      l.push(`    Confidence: ${rec.confidence} | Cost: ${rec.costTier} | Deployment: ${rec.deploymentModel}${rec.existingVendorExtension ? " | Existing Vendor" : ""}`);
      l.push(`    ${rec.fitRationale}`);
      l.push(`    Integration: ${rec.integrationNotes}`);
    }
    l.push("");
  }

  if (r.platformConsolidation?.length) {
    l.push("PLATFORM CONSOLIDATION OPPORTUNITIES", DIV);
    for (const p of r.platformConsolidation) {
      l.push(`  ${p.vendorPlatform} (${p.estimatedCostTier})`);
      l.push(`    Capabilities: ${p.capabilitiesServed.join(", ")}`);
      l.push(`    ${p.rationale}`, "");
    }
  }
  if (r.assumptions?.length) { l.push("ASSUMPTIONS", DIV); r.assumptions.forEach((a) => l.push(`  • ${a}`)); l.push(""); }
  if (r.dataQualityNotes?.length) { l.push("DATA QUALITY NOTES", DIV); r.dataQualityNotes.forEach((n) => l.push(`  • ${n}`)); l.push(""); }
  return l.join("\n");
}
