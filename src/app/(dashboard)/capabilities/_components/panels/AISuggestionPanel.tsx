"use client";

import { useState } from "react";
import { X, Sparkles, FileText, TrendingUp, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "sonner";
import { IMPORTANCE_LABELS, MATURITY_LABELS } from "@/lib/constants/maturity-colors";

type Props = {
  open: boolean;
  onClose: () => void;
  tree: any[];
};

type AITab = "suggest" | "gap-analysis" | "investment";

type Suggestion = {
  name: string;
  level: string;
  suggestedParent: string | null;
  domain?: string;
  rationale: string;
  strategicImportance: string;
  confidence: string;
};

export function AISuggestionPanel({ open, onClose, tree }: Props) {
  const [tab, setTab] = useState<AITab>("suggest");
  const { workspaceId, industry, workspaceName } = useWorkspace();

  if (!open) return null;

  return (
    <aside className="fixed right-0 top-0 h-screen w-[420px] z-40 border-l bg-white flex flex-col shadow-xl">
      {/* Header */}
      <div className="px-5 py-4 border-b flex items-center justify-between bg-gradient-to-r from-[#7c3aed]/5 to-transparent">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-[#7c3aed]/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-[#7c3aed]" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-[#1a1f2e]">AI Assistant</h2>
            <p className="text-[11px] text-muted-foreground">
              Powered by Claude
            </p>
          </div>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b px-2">
        <TabButton
          active={tab === "suggest"}
          onClick={() => setTab("suggest")}
          icon={<Sparkles className="h-3.5 w-3.5" />}
          label="Suggestions"
        />
        <TabButton
          active={tab === "gap-analysis"}
          onClick={() => setTab("gap-analysis")}
          icon={<FileText className="h-3.5 w-3.5" />}
          label="Gap Analysis"
        />
        <TabButton
          active={tab === "investment"}
          onClick={() => setTab("investment")}
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Priorities"
        />
      </div>

      {/* Content — min-h-0 lets flex child shrink; overflow-y-auto enables scroll */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === "suggest" && (
          <SuggestTab tree={tree} workspaceId={workspaceId} industry={industry} workspaceName={workspaceName} />
        )}
        {tab === "gap-analysis" && (
          <GapAnalysisTab tree={tree} workspaceId={workspaceId} />
        )}
        {tab === "investment" && (
          <InvestmentTab tree={tree} workspaceId={workspaceId} />
        )}
      </div>
    </aside>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
        active
          ? "border-[#7c3aed] text-[#7c3aed]"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Suggest Tab ─────────────────────────────────────────

function SuggestTab({
  tree,
  workspaceId,
  industry,
  workspaceName,
}: {
  tree: any[];
  workspaceId: string;
  industry: string;
  workspaceName: string;
}) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [frameworks, setFrameworks] = useState<string[]>([]);
  const [addedNames, setAddedNames] = useState<Set<string>>(new Set());
  const utils = trpc.useUtils();
  const createMutation = trpc.capability.create.useMutation({
    onSuccess: () => utils.capability.getTree.invalidate(),
  });

  // Build a structured capability list for the AI prompt
  const existingCapabilities = tree.length === 0
    ? "None"
    : tree
        .map((l1: any) => {
          const l2List = (l1.children ?? [])
            .map((c: any) => `    - L2: ${c.name}`)
            .join("\n");
          return `  - L1: ${l1.name}${l2List ? "\n" + l2List : ""}`;
        })
        .join("\n");

  async function runSuggestion() {
    setLoading(true);
    setSuggestions([]);
    try {
      const res = await fetch("/api/ai/capabilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "suggest",
          workspaceId,
          payload: {
            industry,
            existingCapabilities,
            organizationContext: `Client: ${workspaceName}`,
          },
        }),
      });
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
      setFrameworks(data.referenceFrameworks ?? []);
    } catch (err) {
      toast.error("AI request failed");
    } finally {
      setLoading(false);
    }
  }

  function addToMap(s: Suggestion) {
    // Resolve the parent by name so L2/L3 suggestions nest correctly
    let parentId: string | undefined;
    if (s.suggestedParent) {
      const matchL1 = tree.find(
        (n: any) => n.name.toLowerCase() === s.suggestedParent!.toLowerCase()
      );
      if (matchL1) {
        parentId = matchL1.id;
      } else {
        // Search in L2 children
        for (const l1 of tree) {
          const matchL2 = (l1.children ?? []).find(
            (c: any) =>
              c.name.toLowerCase() === s.suggestedParent!.toLowerCase()
          );
          if (matchL2) {
            parentId = matchL2.id;
            break;
          }
        }
      }
    }

    createMutation.mutate(
      {
        name: s.name,
        level: s.level as any,
        strategicImportance: s.strategicImportance as any,
        ...(parentId ? { parentId } : {}),
      },
      {
        onSuccess: () => {
          setAddedNames((prev) => new Set(prev).add(s.name));
          toast.success(`Added "${s.name}" to map`);
        },
      }
    );
  }

  return (
    <div className="p-5">
      <p className="text-sm text-muted-foreground mb-4">
        Claude will analyze your current capability map and suggest missing
        capabilities based on {industry.toLowerCase()} industry best practices.
      </p>

      <Button
        onClick={runSuggestion}
        disabled={loading}
        className="w-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white mb-5"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Analyzing...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            Suggest Missing Capabilities
          </>
        )}
      </Button>

      {suggestions.length > 0 && (
        <div className="space-y-3">
          {frameworks.length > 0 && (
            <div className="p-2.5 rounded-lg bg-[#f8f9fa] border border-[#e9ecef]">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Reference Frameworks Used
              </p>
              <div className="flex flex-wrap gap-1.5">
                {frameworks.map((f, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-[#dee2e6] text-[#495057] font-medium"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {suggestions.length} suggestions
          </p>
          {suggestions.map((s, i) => (
            <div
              key={i}
              className="p-3.5 rounded-lg border border-[#e9ecef] hover:border-[#7c3aed]/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="text-[10px] font-bold shrink-0"
                  >
                    {s.level}
                  </Badge>
                  <h4 className="text-sm font-semibold text-[#1a1f2e]">
                    {s.name}
                  </h4>
                </div>
                <ConfidenceDot confidence={s.confidence} />
              </div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {s.domain && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#7c3aed]/10 text-[#7c3aed] font-medium">
                    {s.domain}
                  </span>
                )}
                {s.suggestedParent && (
                  <p className="text-[11px] text-muted-foreground">
                    Under: {s.suggestedParent}
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                {s.rationale}
              </p>
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-[10px]">
                  {IMPORTANCE_LABELS[s.strategicImportance] ?? s.strategicImportance}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={addedNames.has(s.name)}
                  onClick={() => addToMap(s)}
                >
                  {addedNames.has(s.name) ? (
                    "Added"
                  ) : (
                    <>
                      <Plus className="h-3 w-3 mr-1" />
                      Add to Map
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Gap Analysis Tab ────────────────────────────────────

type GapItem = {
  capabilityName: string;
  level: string;
  category: string;
  currentMaturity: string;
  targetMaturity: string;
  gapSize: number;
  strategicImportance: string;
  analysis: string;
  recommendation: string;
};

type StrengthItem = {
  capabilityName: string;
  level: string;
  currentMaturity: string;
  note: string;
};

type TransformationTheme = {
  theme: string;
  description: string;
  relatedCapabilities: string[];
};

type GapAnalysisResult = {
  referenceFrameworks: string[];
  executiveSummary: string;
  maturityDistribution: Record<string, number>;
  gaps: GapItem[];
  strengths: StrengthItem[];
  notAssessed: string[];
  transformationThemes: TransformationTheme[];
};

const GAP_CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  CRITICAL_GAP: { label: "Critical", color: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
  HIGH_GAP: { label: "High", color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" },
  MODERATE_GAP: { label: "Moderate", color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200" },
  LOW_GAP: { label: "Low", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
};

const MATURITY_BAR_COLORS: Record<string, string> = {
  INITIAL: "#ef4444",
  DEVELOPING: "#f97316",
  DEFINED: "#eab308",
  MANAGED: "#22c55e",
  OPTIMIZING: "#7c3aed",
  NOT_ASSESSED: "#cbd5e1",
};

function GapAnalysisTab({
  tree,
  workspaceId,
}: {
  tree: any[];
  workspaceId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GapAnalysisResult | null>(null);

  function flattenCapabilities(nodes: any[]): any[] {
    const flat: any[] = [];
    for (const n of nodes) {
      flat.push({
        name: n.name,
        level: n.level,
        currentMaturity: n.currentMaturity,
        targetMaturity: n.targetMaturity,
        strategicImportance: n.strategicImportance,
      });
      if (n.children) flat.push(...flattenCapabilities(n.children));
    }
    return flat;
  }

  async function runAnalysis() {
    setLoading(true);
    setResult(null);
    try {
      const capabilities = flattenCapabilities(tree);
      const res = await fetch("/api/ai/capabilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "gap-analysis",
          workspaceId,
          payload: { capabilities },
        }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        setResult(data);
      }
    } catch {
      toast.error("AI request failed");
    } finally {
      setLoading(false);
    }
  }

  const allCaps = flattenCapabilities(tree);
  const assessedCount = allCaps.filter(
    (c) => c.currentMaturity !== "NOT_ASSESSED"
  ).length;

  // Group gaps by category for rendering
  const gapsByCategory = result
    ? (["CRITICAL_GAP", "HIGH_GAP", "MODERATE_GAP", "LOW_GAP"] as const).map((cat) => ({
        category: cat,
        items: result.gaps.filter((g) => g.category === cat),
      })).filter((g) => g.items.length > 0)
    : [];

  return (
    <div className="p-5">
      <p className="text-sm text-muted-foreground mb-2">
        Generate a comprehensive, framework-grounded gap analysis covering every
        capability maturity gap.
      </p>
      <p className="text-xs text-muted-foreground mb-4">
        {assessedCount} of {allCaps.length} capabilities assessed.{" "}
        {assessedCount === 0 && (
          <span className="text-orange-600">
            Assess some capabilities first for better results.
          </span>
        )}
      </p>

      <Button
        onClick={runAnalysis}
        disabled={loading}
        className="w-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white mb-5"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Analyzing all capabilities...
          </>
        ) : (
          <>
            <FileText className="h-4 w-4 mr-2" />
            Generate Gap Analysis
          </>
        )}
      </Button>

      {result && (
        <div className="space-y-4">
          {/* Reference Frameworks */}
          {result.referenceFrameworks?.length > 0 && (
            <div className="p-2.5 rounded-lg bg-[#f8f9fa] border border-[#e9ecef]">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Reference Frameworks
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.referenceFrameworks.map((f, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-[#dee2e6] text-[#495057] font-medium"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Executive Summary */}
          <div className="p-3.5 rounded-lg bg-[#1a1f2e] text-white">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1.5">
              Executive Summary
            </p>
            <p className="text-xs leading-relaxed text-white/90">
              {result.executiveSummary}
            </p>
          </div>

          {/* Maturity Distribution */}
          {result.maturityDistribution && (
            <div className="p-3 rounded-lg border border-[#e9ecef]">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Maturity Distribution
              </p>
              <div className="flex gap-0.5 h-5 rounded-md overflow-hidden mb-2">
                {Object.entries(result.maturityDistribution)
                  .filter(([, count]) => count > 0)
                  .map(([level, count]) => (
                    <div
                      key={level}
                      className="flex items-center justify-center text-[8px] font-bold text-white"
                      style={{
                        backgroundColor: MATURITY_BAR_COLORS[level] ?? "#94a3b8",
                        width: `${(count / allCaps.length) * 100}%`,
                        minWidth: count > 0 ? "16px" : "0",
                      }}
                      title={`${level}: ${count}`}
                    >
                      {count}
                    </div>
                  ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {Object.entries(result.maturityDistribution)
                  .filter(([, count]) => count > 0)
                  .map(([level, count]) => (
                    <div key={level} className="flex items-center gap-1">
                      <span
                        className="w-2 h-2 rounded-sm"
                        style={{ backgroundColor: MATURITY_BAR_COLORS[level] ?? "#94a3b8" }}
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {level === "NOT_ASSESSED" ? "N/A" : level.charAt(0) + level.slice(1).toLowerCase()}: {count}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Gap Summary Stats */}
          {result.gaps.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {(["CRITICAL_GAP", "HIGH_GAP", "MODERATE_GAP", "LOW_GAP"] as const).map((cat) => {
                const conf = GAP_CATEGORY_CONFIG[cat];
                const count = result.gaps.filter((g) => g.category === cat).length;
                return (
                  <div
                    key={cat}
                    className={`p-2 rounded-lg border text-center ${conf.bg} ${conf.border}`}
                  >
                    <p className={`text-lg font-bold ${conf.color}`}>{count}</p>
                    <p className={`text-[9px] font-medium ${conf.color}`}>{conf.label}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Gaps by Category */}
          {gapsByCategory.map(({ category, items }) => {
            const conf = GAP_CATEGORY_CONFIG[category];
            return (
              <div key={category}>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${conf.bg} ${conf.color} ${conf.border} border`}
                  >
                    {conf.label} Gaps ({items.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map((gap, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg border ${conf.border} ${conf.bg}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[9px] font-bold shrink-0">
                            {gap.level}
                          </Badge>
                          <h4 className="text-xs font-semibold text-[#1a1f2e]">
                            {gap.capabilityName}
                          </h4>
                        </div>
                        <span className={`text-[10px] font-bold ${conf.color} shrink-0`}>
                          Gap: +{gap.gapSize}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] text-muted-foreground">
                          {MATURITY_LABELS[gap.currentMaturity] ?? gap.currentMaturity} → {MATURITY_LABELS[gap.targetMaturity] ?? gap.targetMaturity}
                        </span>
                        <Badge variant="secondary" className="text-[9px]">
                          {IMPORTANCE_LABELS[gap.strategicImportance] ?? gap.strategicImportance}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-[#495057] leading-relaxed mb-1">
                        {gap.analysis}
                      </p>
                      <p className="text-[11px] text-[#7c3aed] font-medium leading-relaxed">
                        → {gap.recommendation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Strengths */}
          {result.strengths?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-green-700 mb-2 px-2 py-0.5 rounded bg-green-50 border border-green-200 inline-block">
                Strengths ({result.strengths.length})
              </p>
              <div className="space-y-1.5">
                {result.strengths.map((s, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg border border-green-200 bg-green-50/50 flex items-start gap-2"
                  >
                    <Badge variant="outline" className="text-[9px] font-bold shrink-0 mt-0.5">
                      {s.level}
                    </Badge>
                    <div>
                      <p className="text-xs font-medium text-[#1a1f2e]">{s.capabilityName}</p>
                      <p className="text-[10px] text-green-700">
                        {MATURITY_LABELS[s.currentMaturity] ?? s.currentMaturity} — {s.note}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Not Assessed Warning */}
          {result.notAssessed?.length > 0 && (
            <div className="p-3 rounded-lg border border-orange-200 bg-orange-50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-orange-700 mb-1.5">
                Not Assessed ({result.notAssessed.length})
              </p>
              <p className="text-[11px] text-orange-600 mb-2">
                These capabilities have no maturity assessment and were excluded from the analysis.
              </p>
              <div className="flex flex-wrap gap-1">
                {result.notAssessed.map((name, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-orange-200 text-orange-700"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Transformation Themes */}
          {result.transformationThemes?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#7c3aed] mb-2">
                Transformation Themes
              </p>
              <div className="space-y-2">
                {result.transformationThemes.map((t, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg border border-[#7c3aed]/20 bg-[#7c3aed]/5"
                  >
                    <h4 className="text-xs font-semibold text-[#1a1f2e] mb-1">
                      {t.theme}
                    </h4>
                    <p className="text-[11px] text-[#495057] leading-relaxed mb-2">
                      {t.description}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {t.relatedCapabilities.map((cap, j) => (
                        <span
                          key={j}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-white border border-[#7c3aed]/30 text-[#495057]"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Copy Full Analysis */}
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              navigator.clipboard.writeText(formatGapAnalysisAsText(result));
              toast.success("Analysis copied — paste into Word or email");
            }}
          >
            Copy Full Analysis
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Gap Analysis Text Formatter ─────────────────────────

function formatGapAnalysisAsText(r: GapAnalysisResult): string {
  const lines: string[] = [];
  const divider = "─".repeat(60);

  lines.push("CAPABILITY GAP ANALYSIS");
  lines.push(divider);
  lines.push("");

  if (r.referenceFrameworks?.length > 0) {
    lines.push(`Reference Frameworks: ${r.referenceFrameworks.join(", ")}`);
    lines.push("");
  }

  lines.push("EXECUTIVE SUMMARY");
  lines.push(divider);
  lines.push(r.executiveSummary);
  lines.push("");

  // Maturity distribution
  if (r.maturityDistribution) {
    lines.push("MATURITY DISTRIBUTION");
    lines.push(divider);
    for (const [level, count] of Object.entries(r.maturityDistribution)) {
      if (count > 0) {
        const label = level === "NOT_ASSESSED" ? "Not Assessed" : level.charAt(0) + level.slice(1).toLowerCase();
        lines.push(`  ${label}: ${count}`);
      }
    }
    lines.push("");
  }

  // Gaps by category
  const categoryOrder = ["CRITICAL_GAP", "HIGH_GAP", "MODERATE_GAP", "LOW_GAP"] as const;
  for (const cat of categoryOrder) {
    const items = r.gaps.filter((g) => g.category === cat);
    if (items.length === 0) continue;

    const label = GAP_CATEGORY_CONFIG[cat].label.toUpperCase();
    lines.push(`${label} GAPS (${items.length})`);
    lines.push(divider);

    for (const gap of items) {
      const matFrom = MATURITY_LABELS[gap.currentMaturity] ?? gap.currentMaturity;
      const matTo = MATURITY_LABELS[gap.targetMaturity] ?? gap.targetMaturity;
      const importance = IMPORTANCE_LABELS[gap.strategicImportance] ?? gap.strategicImportance;

      lines.push(`  ${gap.capabilityName} (${gap.level})`);
      lines.push(`    Maturity: ${matFrom} → ${matTo}  |  Gap: +${gap.gapSize}  |  Importance: ${importance}`);
      lines.push(`    ${gap.analysis}`);
      lines.push(`    Recommendation: ${gap.recommendation}`);
      lines.push("");
    }
  }

  // Strengths
  if (r.strengths?.length > 0) {
    lines.push("STRENGTHS");
    lines.push(divider);
    for (const s of r.strengths) {
      const mat = MATURITY_LABELS[s.currentMaturity] ?? s.currentMaturity;
      lines.push(`  ${s.capabilityName} (${s.level}) — ${mat}`);
      lines.push(`    ${s.note}`);
    }
    lines.push("");
  }

  // Not assessed
  if (r.notAssessed?.length > 0) {
    lines.push("NOT ASSESSED");
    lines.push(divider);
    lines.push(`  ${r.notAssessed.join(", ")}`);
    lines.push("");
  }

  // Transformation themes
  if (r.transformationThemes?.length > 0) {
    lines.push("TRANSFORMATION THEMES");
    lines.push(divider);
    for (const t of r.transformationThemes) {
      lines.push(`  ${t.theme}`);
      lines.push(`    ${t.description}`);
      lines.push(`    Related: ${t.relatedCapabilities.join(", ")}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

// ─── Investment Priorities Tab ───────────────────────────

type InvestmentInitiative = {
  priority: number;
  capabilityName: string;
  level: string;
  currentMaturity: string;
  targetMaturity: string;
  gapSize: number;
  strategicImportance: string;
  investmentRationale: string;
  implementationApproach: string;
  estimatedEffort: string;
  riskIfDeferred: string;
  dependencies: string[];
};

type InvestmentWave = {
  wave: number;
  name: string;
  timeline: string;
  theme: string;
  initiatives: InvestmentInitiative[];
};

type DeferredItem = {
  capabilityName: string;
  level: string;
  strategicImportance: string;
  gapSize: number;
  deferralReason: string;
  prerequisiteWave: string | null;
};

type InvestmentResult = {
  referenceFrameworks: string[];
  executiveSummary: string;
  totalInvestmentGaps: number;
  fundedCount: number;
  deferredCount: number;
  waves: InvestmentWave[];
  deferred: DeferredItem[];
  notAssessed: string[];
  budgetGuidance: string;
};

const EFFORT_CONFIG: Record<string, { color: string; bg: string }> = {
  LOW: { color: "text-green-700", bg: "bg-green-50 border-green-200" },
  MEDIUM: { color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" },
  HIGH: { color: "text-red-700", bg: "bg-red-50 border-red-200" },
};

const WAVE_COLORS = [
  "border-[#7c3aed]/40 bg-[#7c3aed]/5",
  "border-blue-300 bg-blue-50/50",
  "border-purple-300 bg-purple-50/50",
  "border-amber-300 bg-amber-50/50",
];

function InvestmentTab({
  tree,
  workspaceId,
}: {
  tree: any[];
  workspaceId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [budget, setBudget] = useState<string>("MODERATE");
  const [horizon, setHorizon] = useState<string>("1_YEAR");
  const [result, setResult] = useState<InvestmentResult | null>(null);

  function flattenCapabilities(nodes: any[]): any[] {
    const flat: any[] = [];
    for (const n of nodes) {
      flat.push({
        name: n.name,
        level: n.level,
        strategicImportance: n.strategicImportance,
        currentMaturity: n.currentMaturity,
        targetMaturity: n.targetMaturity,
      });
      if (n.children) flat.push(...flattenCapabilities(n.children));
    }
    return flat;
  }

  async function runPriorities() {
    setLoading(true);
    setResult(null);
    try {
      const capabilities = flattenCapabilities(tree);
      const res = await fetch("/api/ai/capabilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "investment-priorities",
          workspaceId,
          payload: { budget, timeHorizon: horizon, capabilities },
        }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        setResult(data);
      }
    } catch {
      toast.error("AI request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-5">
      <p className="text-sm text-muted-foreground mb-4">
        Generate a wave-based investment roadmap that sequences capability
        improvements by strategic value, dependencies, and budget constraints.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Budget
          </label>
          <Select value={budget} onValueChange={(v) => setBudget(v ?? "MODERATE")}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CONSTRAINED">Constrained</SelectItem>
              <SelectItem value="MODERATE">Moderate</SelectItem>
              <SelectItem value="EXPANSIVE">Expansive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Time Horizon
          </label>
          <Select value={horizon} onValueChange={(v) => setHorizon(v ?? "1_YEAR")}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6_MONTHS">6 Months</SelectItem>
              <SelectItem value="1_YEAR">1 Year</SelectItem>
              <SelectItem value="2_YEARS">2 Years</SelectItem>
              <SelectItem value="3_PLUS_YEARS">3+ Years</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        onClick={runPriorities}
        disabled={loading}
        className="w-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white mb-5"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Building roadmap...
          </>
        ) : (
          <>
            <TrendingUp className="h-4 w-4 mr-2" />
            Generate Investment Roadmap
          </>
        )}
      </Button>

      {result && (
        <div className="space-y-4">
          {/* Reference Frameworks */}
          {result.referenceFrameworks?.length > 0 && (
            <div className="p-2.5 rounded-lg bg-[#f8f9fa] border border-[#e9ecef]">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Reference Frameworks
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.referenceFrameworks.map((f, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-[#dee2e6] text-[#495057] font-medium"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Executive Summary */}
          <div className="p-3.5 rounded-lg bg-[#1a1f2e] text-white">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1.5">
              Executive Summary
            </p>
            <p className="text-xs leading-relaxed text-white/90">
              {result.executiveSummary}
            </p>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 rounded-lg border text-center bg-[#f8f9fa]">
              <p className="text-lg font-bold text-[#1a1f2e]">{result.totalInvestmentGaps ?? 0}</p>
              <p className="text-[9px] font-medium text-muted-foreground">Total Gaps</p>
            </div>
            <div className="p-2.5 rounded-lg border text-center bg-green-50 border-green-200">
              <p className="text-lg font-bold text-green-700">{result.fundedCount ?? 0}</p>
              <p className="text-[9px] font-medium text-green-700">Funded</p>
            </div>
            <div className="p-2.5 rounded-lg border text-center bg-orange-50 border-orange-200">
              <p className="text-lg font-bold text-orange-700">{result.deferredCount ?? 0}</p>
              <p className="text-[9px] font-medium text-orange-700">Deferred</p>
            </div>
          </div>

          {/* Waves */}
          {(result.waves ?? []).map((wave, wi) => (
            <div key={wi}>
              <div className="flex items-center gap-2 mb-2">
                <div className="h-6 w-6 rounded-full bg-[#1a1f2e] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                  {wave.wave}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[#1a1f2e]">{wave.name}</p>
                  <p className="text-[10px] text-muted-foreground">{wave.timeline}</p>
                </div>
              </div>
              {wave.theme && (
                <p className="text-[11px] text-[#495057] italic mb-2 ml-8">
                  {wave.theme}
                </p>
              )}
              <div className="space-y-2 ml-3 border-l-2 border-[#e9ecef] pl-5">
                {wave.initiatives.map((init, ii) => {
                  const effortConf = EFFORT_CONFIG[init.estimatedEffort] ?? EFFORT_CONFIG.MEDIUM;
                  return (
                    <div
                      key={ii}
                      className={`p-3 rounded-lg border ${WAVE_COLORS[wi % WAVE_COLORS.length]}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-white bg-[#1a1f2e] rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                            {init.priority}
                          </span>
                          <Badge variant="outline" className="text-[9px] font-bold shrink-0">
                            {init.level}
                          </Badge>
                          <h4 className="text-xs font-semibold text-[#1a1f2e]">
                            {init.capabilityName}
                          </h4>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-[10px] text-muted-foreground">
                          {MATURITY_LABELS[init.currentMaturity] ?? init.currentMaturity} → {MATURITY_LABELS[init.targetMaturity] ?? init.targetMaturity}
                        </span>
                        <Badge variant="secondary" className="text-[9px]">
                          {IMPORTANCE_LABELS[init.strategicImportance] ?? init.strategicImportance}
                        </Badge>
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded border ${effortConf.bg} ${effortConf.color}`}>
                          {init.estimatedEffort} effort
                        </span>
                      </div>
                      <p className="text-[11px] text-[#495057] leading-relaxed mb-1">
                        {init.investmentRationale}
                      </p>
                      <p className="text-[11px] text-[#7c3aed] font-medium leading-relaxed mb-1">
                        → {init.implementationApproach}
                      </p>
                      <p className="text-[10px] text-red-600/70 italic">
                        Risk if deferred: {init.riskIfDeferred}
                      </p>
                      {init.dependencies?.length > 0 && (
                        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                          <span className="text-[9px] text-muted-foreground">Depends on:</span>
                          {init.dependencies.map((dep, di) => (
                            <span
                              key={di}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-white border border-[#e9ecef] text-[#495057]"
                            >
                              {dep}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Deferred */}
          {result.deferred?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-orange-700 mb-2 px-2 py-0.5 rounded bg-orange-50 border border-orange-200 inline-block">
                Deferred ({result.deferred.length})
              </p>
              <div className="space-y-1.5">
                {result.deferred.map((d, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg border border-orange-200 bg-orange-50/50"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Badge variant="outline" className="text-[9px] font-bold shrink-0">
                        {d.level}
                      </Badge>
                      <p className="text-xs font-medium text-[#1a1f2e]">{d.capabilityName}</p>
                      <span className="text-[10px] text-orange-600 ml-auto shrink-0">
                        Gap: +{d.gapSize}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#495057]">{d.deferralReason}</p>
                    {d.prerequisiteWave && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Revisit after: {d.prerequisiteWave}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Not Assessed */}
          {result.notAssessed?.length > 0 && (
            <div className="p-3 rounded-lg border border-orange-200 bg-orange-50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-orange-700 mb-1.5">
                Not Assessed ({result.notAssessed.length})
              </p>
              <p className="text-[11px] text-orange-600 mb-2">
                These capabilities have no maturity assessment and could not be prioritized.
              </p>
              <div className="flex flex-wrap gap-1">
                {result.notAssessed.map((name, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-orange-200 text-orange-700"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Budget Guidance */}
          {result.budgetGuidance && (
            <div className="p-3 rounded-lg border border-[#7c3aed]/20 bg-[#7c3aed]/5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#7c3aed] mb-1">
                Budget Guidance
              </p>
              <p className="text-[11px] text-[#495057] leading-relaxed">
                {result.budgetGuidance}
              </p>
            </div>
          )}

          {/* Copy */}
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              navigator.clipboard.writeText(formatInvestmentAsText(result));
              toast.success("Roadmap copied — paste into Word or email");
            }}
          >
            Copy Full Roadmap
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Investment Text Formatter ───────────────────────────

function formatInvestmentAsText(r: InvestmentResult): string {
  const lines: string[] = [];
  const divider = "─".repeat(60);

  lines.push("INVESTMENT PRIORITIZATION ROADMAP");
  lines.push(divider);
  lines.push("");

  if (r.referenceFrameworks?.length > 0) {
    lines.push(`Reference Frameworks: ${r.referenceFrameworks.join(", ")}`);
    lines.push("");
  }

  lines.push("EXECUTIVE SUMMARY");
  lines.push(divider);
  lines.push(r.executiveSummary);
  lines.push("");

  lines.push(`Total Gaps: ${r.totalInvestmentGaps}  |  Funded: ${r.fundedCount}  |  Deferred: ${r.deferredCount}`);
  lines.push("");

  for (const wave of r.waves ?? []) {
    lines.push(`WAVE ${wave.wave}: ${wave.name.toUpperCase()}`);
    lines.push(`Timeline: ${wave.timeline}`);
    lines.push(divider);
    if (wave.theme) lines.push(`  ${wave.theme}`);
    lines.push("");

    for (const init of wave.initiatives) {
      const matFrom = MATURITY_LABELS[init.currentMaturity] ?? init.currentMaturity;
      const matTo = MATURITY_LABELS[init.targetMaturity] ?? init.targetMaturity;
      const importance = IMPORTANCE_LABELS[init.strategicImportance] ?? init.strategicImportance;

      lines.push(`  #${init.priority}  ${init.capabilityName} (${init.level})`);
      lines.push(`    Maturity: ${matFrom} → ${matTo}  |  Gap: +${init.gapSize}  |  Importance: ${importance}  |  Effort: ${init.estimatedEffort}`);
      lines.push(`    ${init.investmentRationale}`);
      lines.push(`    Approach: ${init.implementationApproach}`);
      lines.push(`    Risk if deferred: ${init.riskIfDeferred}`);
      if (init.dependencies?.length > 0) {
        lines.push(`    Dependencies: ${init.dependencies.join(", ")}`);
      }
      lines.push("");
    }
  }

  if (r.deferred?.length > 0) {
    lines.push("DEFERRED ITEMS");
    lines.push(divider);
    for (const d of r.deferred) {
      lines.push(`  ${d.capabilityName} (${d.level}) — Gap: +${d.gapSize}, ${d.strategicImportance}`);
      lines.push(`    ${d.deferralReason}`);
      if (d.prerequisiteWave) lines.push(`    Revisit after: ${d.prerequisiteWave}`);
    }
    lines.push("");
  }

  if (r.notAssessed?.length > 0) {
    lines.push("NOT ASSESSED");
    lines.push(divider);
    lines.push(`  ${r.notAssessed.join(", ")}`);
    lines.push("");
  }

  if (r.budgetGuidance) {
    lines.push("BUDGET GUIDANCE");
    lines.push(divider);
    lines.push(r.budgetGuidance);
    lines.push("");
  }

  return lines.join("\n");
}

function ConfidenceDot({ confidence }: { confidence: string }) {
  const colors: Record<string, string> = {
    HIGH: "bg-green-500",
    MEDIUM: "bg-yellow-500",
    LOW: "bg-red-500",
  };
  return (
    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
      <span
        className={`w-2 h-2 rounded-full ${colors[confidence] ?? "bg-gray-400"}`}
      />
      {confidence}
    </span>
  );
}
