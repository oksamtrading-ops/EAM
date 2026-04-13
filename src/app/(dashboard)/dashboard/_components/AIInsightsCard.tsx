"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  AlertTriangle,
  TrendingUp,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Clock,
  RefreshCw,
  User,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";
import { formatDistanceToNow } from "date-fns";

// ── Types ──────────────────────────────────────────────────────────────────

interface RagByDomain {
  capabilities: "GREEN" | "AMBER" | "RED";
  applications: "GREEN" | "AMBER" | "RED";
  riskCompliance: "GREEN" | "AMBER" | "RED";
  transformation: "GREEN" | "AMBER" | "RED";
}

interface KeySignal {
  type: "RISK" | "OPPORTUNITY" | "WARNING";
  domain: string;
  signal: string;
  businessImpact: string;
}

interface RecommendedFocus {
  horizon: "30d" | "60d" | "90d";
  action: string;
  rationale: string;
  owner: string;
  estimatedImpact: string;
}

interface InsightsResult {
  architectureHealthScore: number;
  ragByDomain: RagByDomain;
  headline: string;
  executiveBrief: string;
  keySignals: KeySignal[];
  recommendedFocus: RecommendedFocus[];
  portfolioEconomicsInsight?: string;
  industryContext?: string;
  dataQualityNotes?: string[];
}

interface CachedInsights {
  result: InsightsResult;
  generatedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const RAG_COLORS: Record<string, string> = {
  GREEN: "bg-green-100 text-green-700 border-green-200",
  AMBER: "bg-amber-100 text-amber-700 border-amber-200",
  RED: "bg-red-100 text-red-700 border-red-200",
};

const RAG_DOT: Record<string, string> = {
  GREEN: "bg-green-500",
  AMBER: "bg-amber-500",
  RED: "bg-red-500",
};

const SIGNAL_STYLES: Record<string, { icon: typeof AlertTriangle; color: string; bg: string }> = {
  RISK: { icon: ShieldAlert, color: "text-red-600", bg: "bg-red-50 border-red-100" },
  WARNING: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
  OPPORTUNITY: { icon: TrendingUp, color: "text-green-600", bg: "bg-green-50 border-green-100" },
};

const HORIZON_LABELS: Record<string, string> = {
  "30d": "30 Days",
  "60d": "60 Days",
  "90d": "90 Days",
};

const DOMAIN_LABELS: Record<string, string> = {
  capabilities: "Capabilities",
  applications: "Applications",
  riskCompliance: "Risk & Compliance",
  transformation: "Transformation",
};

const CACHE_KEY = "eam-ai-insights";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCache(): CachedInsights | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedInsights = JSON.parse(raw);
    if (Date.now() - new Date(cached.generatedAt).getTime() > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

function setCache(result: InsightsResult) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ result, generatedAt: new Date().toISOString() }));
  } catch { /* quota exceeded — ignore */ }
}

function formatCopyText(r: InsightsResult): string {
  return [
    `EXECUTIVE ARCHITECTURE HEALTH BRIEF`,
    `Architecture Health Score: ${r.architectureHealthScore}/100`,
    ``,
    `DOMAIN RAG STATUS`,
    ...Object.entries(r.ragByDomain).map(([k, v]) => `  ${DOMAIN_LABELS[k] ?? k}: ${v}`),
    ``,
    `HEADLINE`,
    r.headline,
    ``,
    `EXECUTIVE BRIEF`,
    r.executiveBrief,
    ``,
    r.portfolioEconomicsInsight ? `PORTFOLIO ECONOMICS\n${r.portfolioEconomicsInsight}\n` : "",
    r.industryContext ? `INDUSTRY CONTEXT\n${r.industryContext}\n` : "",
    `KEY SIGNALS (${r.keySignals.length})`,
    ...r.keySignals.map((s) => `  [${s.type}] ${s.signal}\n    Impact: ${s.businessImpact}`),
    ``,
    `RECOMMENDED FOCUS`,
    ...r.recommendedFocus.map(
      (f) =>
        `  ${HORIZON_LABELS[f.horizon] ?? f.horizon} — ${f.action}\n    Owner: ${f.owner}\n    Rationale: ${f.rationale}\n    Impact: ${f.estimatedImpact}`
    ),
    r.dataQualityNotes?.length ? `\nDATA QUALITY NOTES\n${r.dataQualityNotes.map((n) => `  - ${n}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// ── Health Score Ring ──────────────────────────────────────────────────────

function HealthScoreRing({ score }: { score: number }) {
  const radius = 36;
  const stroke = 6;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 70 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg viewBox="0 0 84 84" className="w-full h-full -rotate-90">
        <circle cx="42" cy="42" r={radius} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
        <circle
          cx="42"
          cy="42"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold" style={{ color }}>{score}</span>
        <span className="text-[10px] text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function AIInsightsCard() {
  const { workspaceId } = useWorkspace();
  const [result, setResult] = useState<InsightsResult | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [briefExpanded, setBriefExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: aiContext, isLoading: contextLoading } = trpc.dashboard.getAIContext.useQuery(
    undefined,
    { enabled: !!workspaceId }
  );

  // Load cache on mount
  useEffect(() => {
    const cached = getCache();
    if (cached) {
      setResult(cached.result);
      setGeneratedAt(cached.generatedAt);
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!workspaceId || !aiContext) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "executive-insights",
          workspaceId,
          payload: aiContext,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 429) throw new Error("Rate limit reached — please wait a moment");
        throw new Error(err.error ?? "Request failed");
      }
      const data: InsightsResult = await res.json();
      setResult(data);
      const now = new Date().toISOString();
      setGeneratedAt(now);
      setCache(data);
      setBriefExpanded(false);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to generate insights");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, aiContext]);

  function handleCopy() {
    if (!result) return;
    navigator.clipboard.writeText(formatCopyText(result)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!workspaceId) return null;

  // ── Empty state ──────────────────────────────────────────────────────
  if (!result) {
    return (
      <div className="rounded-xl border bg-gradient-to-r from-purple-50 to-indigo-50 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="font-semibold text-[15px]">AI Executive Brief</h2>
              <p className="text-[13px] text-muted-foreground mt-0.5 max-w-xl">
                Generate a board-level architecture health assessment covering portfolio economics,
                capability maturity, application health, risk & compliance posture, and
                transformation progress — grounded in TOGAF, COBIT, and Gartner frameworks.
              </p>
            </div>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={loading || contextLoading || !aiContext}
            className="gap-2 bg-purple-600 hover:bg-purple-700 text-white shrink-0"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {loading ? "Generating…" : "Generate Brief"}
          </Button>
        </div>
      </div>
    );
  }

  // ── Result view ──────────────────────────────────────────────────────
  const briefLines = result.executiveBrief.split("\n").filter(Boolean);
  const showBriefPreview = !briefExpanded && briefLines.length > 2;

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* Header bar */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-white" />
          <span className="text-white font-semibold text-[14px]">AI Executive Brief</span>
          {generatedAt && (
            <span className="text-white/60 text-[11px] ml-2">
              Generated {formatDistanceToNow(new Date(generatedAt), { addSuffix: true })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="text-white/80 hover:text-white hover:bg-white/10 gap-1.5 h-7 text-[12px]"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy to text"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGenerate}
            disabled={loading || contextLoading}
            className="text-white/80 hover:text-white hover:bg-white/10 gap-1.5 h-7 text-[12px]"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Refresh
          </Button>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Score + Headline + Domain RAGs */}
        <div className="flex items-start gap-5">
          <HealthScoreRing score={result.architectureHealthScore} />
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold leading-snug mb-3">{result.headline}</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(result.ragByDomain).map(([domain, rag]) => (
                <div
                  key={domain}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                    RAG_COLORS[rag]
                  )}
                >
                  <div className={cn("h-1.5 w-1.5 rounded-full", RAG_DOT[rag])} />
                  {DOMAIN_LABELS[domain] ?? domain}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Executive Brief */}
        <div className="rounded-lg border bg-muted/20 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
              Executive Brief
            </span>
            {briefLines.length > 2 && (
              <button
                onClick={() => setBriefExpanded(!briefExpanded)}
                className="text-[12px] text-purple-600 hover:text-purple-700 flex items-center gap-0.5"
              >
                {briefExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {briefExpanded ? "Collapse" : "Expand"}
              </button>
            )}
          </div>
          <div
            className={cn(
              "text-[13px] leading-relaxed whitespace-pre-wrap transition-all",
              showBriefPreview && "line-clamp-6"
            )}
          >
            {result.executiveBrief}
          </div>
        </div>

        {/* Portfolio Economics + Industry Context */}
        {(result.portfolioEconomicsInsight || result.industryContext) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {result.portfolioEconomicsInsight && (
              <div className="rounded-lg border bg-blue-50/50 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-blue-700 mb-1">
                  Portfolio Economics
                </p>
                <p className="text-[12px] leading-relaxed text-blue-900">
                  {result.portfolioEconomicsInsight}
                </p>
              </div>
            )}
            {result.industryContext && (
              <div className="rounded-lg border bg-indigo-50/50 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-indigo-700 mb-1">
                  Industry Context
                </p>
                <p className="text-[12px] leading-relaxed text-indigo-900">
                  {result.industryContext}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Key Signals */}
        {result.keySignals.length > 0 && (
          <div>
            <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
              Key Signals ({result.keySignals.length})
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {result.keySignals.map((s, i) => {
                const style = SIGNAL_STYLES[s.type] ?? SIGNAL_STYLES.WARNING;
                const Icon = style.icon;
                return (
                  <div key={i} className={cn("rounded-lg border p-3 flex flex-col gap-1", style.bg)}>
                    <div className="flex items-start gap-2">
                      <Icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", style.color)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                            {s.domain?.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <p className="text-[12px] font-medium">{s.signal}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{s.businessImpact}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recommended Focus */}
        {result.recommendedFocus.length > 0 && (
          <div>
            <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
              Recommended Focus
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {result.recommendedFocus.map((f, i) => (
                <div key={i} className="rounded-lg border p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-purple-600" />
                      <span className="text-[12px] font-bold text-purple-700">
                        {HORIZON_LABELS[f.horizon] ?? f.horizon}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5">
                      <User className="h-2.5 w-2.5 text-gray-500" />
                      <span className="text-[10px] font-medium text-gray-600">{f.owner}</span>
                    </div>
                  </div>
                  <p className="text-[13px] font-medium leading-snug">{f.action}</p>
                  <p className="text-[11px] text-muted-foreground">{f.rationale}</p>
                  <div className="rounded bg-green-50 border border-green-100 px-2 py-1">
                    <p className="text-[10px] font-medium text-green-700">Expected Impact</p>
                    <p className="text-[11px] text-green-800">{f.estimatedImpact}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Data Quality Notes */}
        {result.dataQualityNotes && result.dataQualityNotes.length > 0 && (
          <div className="rounded-lg border border-dashed bg-muted/20 px-3 py-2">
            <p className="text-[11px] font-medium text-muted-foreground mb-1">Data Quality Notes</p>
            {result.dataQualityNotes.map((n, i) => (
              <p key={i} className="text-[11px] text-muted-foreground">• {n}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
