"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sparkles,
  X,
  Copy,
  Check,
  Loader2,
  ChevronDown,
  AlertTriangle,
  Zap,
  Clock,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useRiskContext } from "../RiskContext";
import { useWorkspace } from "@/hooks/useWorkspace";

// ── Types ──────────────────────────────────────────────────────────────────

type Tab = "narrative" | "radar" | "compliance";

interface RadarClassification {
  name: string;
  ring: "ADOPT" | "TRIAL" | "ASSESS" | "HOLD";
  quadrant:
    | "LANGUAGES_FRAMEWORKS"
    | "PLATFORMS_INFRASTRUCTURE"
    | "TOOLS_TECHNIQUES"
    | "DATA_STORAGE";
  rationale: string;
}

interface ComplianceGapResult {
  overallAssessment: string;
  criticalGaps: Array<{
    controlId: string;
    title: string;
    businessRisk: string;
    remediation: string;
    effort: "LOW" | "MEDIUM" | "HIGH";
  }>;
  quickWins: Array<{ controlId: string; title: string; action: string }>;
  estimatedTimeToCompliance: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const RING_COLORS: Record<string, string> = {
  ADOPT: "bg-green-100 text-green-700 border-green-200",
  TRIAL: "bg-blue-100 text-blue-700 border-blue-200",
  ASSESS: "bg-yellow-100 text-yellow-700 border-yellow-200",
  HOLD: "bg-red-100 text-red-700 border-red-200",
};

const EFFORT_COLORS: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  LOW: "bg-green-100 text-green-700",
};

const QUADRANT_LABELS: Record<string, string> = {
  LANGUAGES_FRAMEWORKS: "Languages & Frameworks",
  PLATFORMS_INFRASTRUCTURE: "Platforms & Infra",
  TOOLS_TECHNIQUES: "Tools & Techniques",
  DATA_STORAGE: "Data & Storage",
};

const FRAMEWORKS_DISPLAY: Record<string, string> = {
  SOC2_TYPE2: "SOC 2 Type II",
  ISO_27001: "ISO 27001",
  GDPR: "GDPR",
  PCI_DSS: "PCI DSS",
  HIPAA: "HIPAA",
  NIST_CSF: "NIST CSF",
  CIS_CONTROLS: "CIS Controls",
  SOX: "SOX",
  PIPEDA: "PIPEDA",
  CUSTOM: "Custom",
};

function useCopyText(text: string) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return { copied, copy };
}

// ── Sub-panels ─────────────────────────────────────────────────────────────

// Tab 1: Risk Narrative
function NarrativeTab({ workspaceId }: { workspaceId: string }) {
  const { stats, risks, eolList, scorecard } = useRiskContext();
  const [narrative, setNarrative] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { copied, copy } = useCopyText(narrative ?? "");

  async function handleGenerate() {
    if (!stats) return;
    setLoading(true);
    try {
      const topRisks = [...risks]
        .sort((a, b) => b.riskScore - a.riskScore)
        .slice(0, 5)
        .map((r) => ({ title: r.title, category: r.category, score: r.riskScore }));

      const expired = eolList.filter((e) => e.urgencyBand === "EXPIRED").length;
      const urgent = eolList.filter((e) => e.urgencyBand === "URGENT").length;
      const avgScore =
        scorecard.length
          ? Math.round(scorecard.reduce((s, f) => s + f.score, 0) / scorecard.length)
          : 0;

      const res = await fetch("/api/ai/risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "risk-narrative",
          workspaceId,
          payload: {
            stats: {
              total: stats.total,
              open: stats.open,
              critical: stats.critical,
              unmitigated: stats.unmitigated,
            },
            topRisks,
            eolSummary: { expired, urgent },
            complianceScore: avgScore,
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 429) throw new Error("Rate limit reached — please wait a moment");
        throw new Error(err.error ?? "Request failed");
      }
      const data = await res.json();
      setNarrative(data.narrative ?? "");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to generate narrative");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted-foreground">
        Generates a board-level technology risk briefing covering current posture, priority areas,
        risk trajectory, and recommended actions.
      </p>

      <Button
        size="sm"
        onClick={handleGenerate}
        disabled={loading || !stats}
        className="gap-2 bg-purple-600 hover:bg-purple-700 text-white self-start"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        {loading ? "Generating…" : "Generate Narrative"}
      </Button>

      {narrative && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide">
              Board Briefing
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={copy}
              className="gap-1.5 h-7 text-[12px] text-muted-foreground"
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-600" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4 text-[13px] leading-relaxed whitespace-pre-wrap">
            {narrative}
          </div>
        </div>
      )}
    </div>
  );
}

// Tab 2: Radar Classify
function RadarClassifyTab({ workspaceId }: { workspaceId: string }) {
  const { radar } = useRiskContext();
  const [classifications, setClassifications] = useState<RadarClassification[]>([]);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const utils = trpc.useUtils();

  const { data: allApps = [] } = trpc.application.list.useQuery();

  const existingNames = new Set(
    (radar?.entries ?? []).map((e) => e.name.toLowerCase())
  );
  const existingTechIds = new Set(
    (radar?.entries ?? []).map((e) => e.techComponentId).filter(Boolean)
  );

  const unclassified = allApps.filter(
    (a) => !existingTechIds.has(a.id) && !existingNames.has(a.name.toLowerCase())
  );

  const upsertMutation = trpc.techRadar.upsert.useMutation({
    onSuccess: () => utils.techRadar.getRadar.invalidate(),
    onError: () => toast.error("Failed to apply to radar"),
  });

  async function handleClassify() {
    if (!unclassified.length) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai/risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "radar-classify",
          workspaceId,
          payload: {
            components: unclassified.map((a) => ({
              name: a.name,
              vendor: a.vendor ?? undefined,
              lifecycle: a.lifecycle,
              technicalHealth: a.technicalHealth,
              appCount: 1,
            })),
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 429) throw new Error("Rate limit reached — please wait a moment");
        throw new Error(err.error ?? "Request failed");
      }
      const data = await res.json();
      setClassifications(data.classifications ?? []);
      setApplied(new Set());
    } catch (e: any) {
      toast.error(e.message ?? "Failed to classify technologies");
    } finally {
      setLoading(false);
    }
  }

  function applyOne(c: RadarClassification) {
    const app = unclassified.find(
      (a) => a.name.toLowerCase() === c.name.toLowerCase()
    );
    upsertMutation.mutate(
      {
        name: c.name,
        ring: c.ring,
        quadrant: c.quadrant,
        rationale: c.rationale,
        isNew: true,
        techComponentId: app?.id,
      },
      {
        onSuccess: () => {
          setApplied((prev) => new Set([...prev, c.name]));
          toast.success(`${c.name} added to Tech Radar`);
        },
      }
    );
  }

  function applyAll() {
    classifications
      .filter((c) => !applied.has(c.name))
      .forEach(applyOne);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted-foreground">
        Analyses applications not yet on the Tech Radar and suggests which ring and quadrant each
        belongs in based on lifecycle, health, and architecture best practice.
      </p>

      {unclassified.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-[13px] text-muted-foreground">
          All applications are already on the Tech Radar.
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleClassify}
            disabled={loading}
            className="gap-2 bg-purple-600 hover:bg-purple-700 text-white"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {loading ? "Classifying…" : `Classify ${unclassified.length} Technologies`}
          </Button>
          {classifications.length > 0 && applied.size < classifications.length && (
            <Button
              variant="outline"
              size="sm"
              onClick={applyAll}
              className="gap-1.5"
            >
              Apply All
            </Button>
          )}
        </div>
      )}

      {classifications.length > 0 && (
        <div className="flex flex-col gap-2">
          {classifications.map((c) => {
            const isApplied = applied.has(c.name);
            return (
              <div
                key={c.name}
                className={cn(
                  "rounded-lg border p-3 flex flex-col gap-2 transition-opacity",
                  isApplied && "opacity-50"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[13px] font-medium">{c.name}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge
                      variant="outline"
                      className={cn("text-[11px] px-1.5 py-0", RING_COLORS[c.ring])}
                    >
                      {c.ring}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[11px] px-2 gap-1"
                      disabled={isApplied || upsertMutation.isPending}
                      onClick={() => applyOne(c)}
                    >
                      {isApplied ? (
                        <>
                          <Check className="h-3 w-3 text-green-600" /> Applied
                        </>
                      ) : (
                        "Apply to Radar"
                      )}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary" className="text-[10px] px-1.5">
                    {QUADRANT_LABELS[c.quadrant] ?? c.quadrant}
                  </Badge>
                </div>
                <p className="text-[12px] text-muted-foreground">{c.rationale}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Tab 3: Compliance Gap
type Framework = "SOC2_TYPE2" | "ISO_27001" | "GDPR" | "PCI_DSS" | "HIPAA" | "NIST_CSF" | "CIS_CONTROLS" | "SOX" | "PIPEDA" | "CUSTOM";

function ComplianceGapTab({ workspaceId }: { workspaceId: string }) {
  const { scorecard } = useRiskContext();
  const [selectedFramework, setSelectedFramework] = useState<Framework | "">("");
  const [result, setResult] = useState<ComplianceGapResult | null>(null);
  const [loading, setLoading] = useState(false);

  const availableFrameworks = scorecard.filter((f) => f.total > 0);

  // Fetch requirements only when framework is selected
  const { data: requirements = [] } = trpc.compliance.listRequirements.useQuery(
    { framework: selectedFramework as Framework },
    { enabled: !!selectedFramework }
  );

  const copyText = result
    ? `COMPLIANCE GAP ANALYSIS — ${FRAMEWORKS_DISPLAY[selectedFramework] ?? selectedFramework}\n\n` +
      `ESTIMATED TIME TO COMPLIANCE: ${result.estimatedTimeToCompliance}\n\n` +
      `OVERALL ASSESSMENT\n${result.overallAssessment}\n\n` +
      `CRITICAL GAPS (${result.criticalGaps.length})\n` +
      result.criticalGaps
        .map(
          (g) =>
            `[${g.controlId}] ${g.title} (Effort: ${g.effort})\n  Risk: ${g.businessRisk}\n  Remediation: ${g.remediation}`
        )
        .join("\n\n") +
      `\n\nQUICK WINS (${result.quickWins.length})\n` +
      result.quickWins.map((w) => `[${w.controlId}] ${w.title}\n  Action: ${w.action}`).join("\n\n")
    : "";

  const { copied, copy } = useCopyText(copyText);

  async function handleAnalyse() {
    if (!selectedFramework) return;
    setLoading(true);
    try {
      const fw = scorecard.find((f) => f.framework === selectedFramework);
      if (!fw) throw new Error("Framework not found");

      const gaps = requirements.map((r) => ({
        controlId: r.controlId,
        title: r.title,
        status: r.mappings[0]?.status ?? "NOT_ASSESSED",
        category: r.category ?? undefined,
      }));

      const res = await fetch("/api/ai/risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "compliance-gap",
          workspaceId,
          payload: {
            framework: FRAMEWORKS_DISPLAY[selectedFramework] ?? selectedFramework,
            score: fw.score,
            compliant: fw.compliant,
            partial: fw.partial,
            nonCompliant: fw.nonCompliant,
            notAssessed: fw.notAssessed,
            total: fw.total,
            gaps,
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 429) throw new Error("Rate limit reached — please wait a moment");
        throw new Error(err.error ?? "Request failed");
      }
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to run compliance gap analysis");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted-foreground">
        Identifies critical gaps and quick wins for a compliance framework, with business risk
        context and remediation guidance.
      </p>

      {availableFrameworks.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-[13px] text-muted-foreground">
          No compliance frameworks imported yet. Import a framework from the Compliance view first.
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <select
            value={selectedFramework}
            onChange={(e) => { setSelectedFramework(e.target.value as Framework | ""); setResult(null); }}
            className="h-8 rounded-md border bg-background px-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            <option value="">Select framework…</option>
            {availableFrameworks.map((f) => (
              <option key={f.framework} value={f.framework}>
                {FRAMEWORKS_DISPLAY[f.framework] ?? f.framework} ({f.score}%)
              </option>
            ))}
          </select>
          <Button
            size="sm"
            onClick={handleAnalyse}
            disabled={!selectedFramework || loading || requirements.length === 0}
            className="gap-2 bg-purple-600 hover:bg-purple-700 text-white"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {loading ? "Analysing…" : "Analyse"}
          </Button>
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-4">
          {/* Header: estimated time + copy */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 rounded-full bg-purple-50 border border-purple-200 px-3 py-1">
              <Clock className="h-3.5 w-3.5 text-purple-600" />
              <span className="text-[12px] font-medium text-purple-700">
                {result.estimatedTimeToCompliance}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={copy}
              className="gap-1.5 h-7 text-[12px] text-muted-foreground"
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-600" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {copied ? "Copied" : "Copy to text"}
            </Button>
          </div>

          {/* Overall Assessment */}
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
              Overall Assessment
            </p>
            <p className="text-[13px] leading-relaxed">{result.overallAssessment}</p>
          </div>

          {/* Critical Gaps */}
          {result.criticalGaps.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                <span className="text-[13px] font-semibold">
                  Critical Gaps ({result.criticalGaps.length})
                </span>
              </div>
              {result.criticalGaps.map((g) => (
                <div key={g.controlId} className="rounded-lg border p-3 flex flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-mono text-muted-foreground">{g.controlId}</span>
                      <p className="text-[13px] font-medium">{g.title}</p>
                    </div>
                    <Badge
                      className={cn("text-[10px] px-1.5 shrink-0", EFFORT_COLORS[g.effort])}
                    >
                      {g.effort} effort
                    </Badge>
                  </div>
                  <div className="rounded bg-red-50 border border-red-100 px-2 py-1.5">
                    <p className="text-[11px] font-medium text-red-700 mb-0.5">Business Risk</p>
                    <p className="text-[12px] text-red-800">{g.businessRisk}</p>
                  </div>
                  <div className="rounded bg-blue-50 border border-blue-100 px-2 py-1.5">
                    <p className="text-[11px] font-medium text-blue-700 mb-0.5">Remediation</p>
                    <p className="text-[12px] text-blue-800">{g.remediation}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Wins */}
          {result.quickWins.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-yellow-500" />
                <span className="text-[13px] font-semibold">
                  Quick Wins ({result.quickWins.length})
                </span>
              </div>
              {result.quickWins.map((w) => (
                <div
                  key={w.controlId}
                  className="rounded-lg border bg-yellow-50/50 px-3 py-2.5 flex flex-col gap-0.5"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-mono text-muted-foreground">{w.controlId}</span>
                    <span className="text-[13px] font-medium">{w.title}</span>
                  </div>
                  <p className="text-[12px] text-muted-foreground">{w.action}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: "narrative", label: "Risk Narrative" },
  { id: "radar", label: "Radar Classify" },
  { id: "compliance", label: "Compliance Gap" },
];

interface Props {
  onClose: () => void;
}

export function RiskAIPanel({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>("narrative");
  const { workspaceId } = useWorkspace();

  if (!workspaceId) return null;

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        className="w-[520px] max-w-full p-0 flex flex-col gap-0 overflow-hidden"
      >
        {/* Purple gradient header */}
        <SheetHeader className="shrink-0 bg-gradient-to-r from-purple-600 to-indigo-600 px-5 pt-4 pb-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-white" />
              <SheetTitle className="text-white text-[15px] font-semibold">
                AI Assistant
              </SheetTitle>
            </div>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {/* Tab bar */}
          <div className="flex items-center gap-0">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "px-4 py-2 text-[13px] font-medium border-b-2 transition-colors",
                  tab === t.id
                    ? "border-white text-white"
                    : "border-transparent text-white/60 hover:text-white/90"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-5">
            {tab === "narrative" && <NarrativeTab workspaceId={workspaceId} />}
            {tab === "radar" && <RadarClassifyTab workspaceId={workspaceId} />}
            {tab === "compliance" && <ComplianceGapTab workspaceId={workspaceId} />}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
