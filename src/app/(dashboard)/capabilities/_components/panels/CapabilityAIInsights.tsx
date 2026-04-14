"use client";

import { useState, useEffect } from "react";
import { Sparkles, Loader2, ChevronDown, ChevronUp, AlertCircle, RefreshCw } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";

type Insights = {
  healthVerdict: "HEALTHY" | "AT_RISK" | "UNDERSERVED" | "INSUFFICIENT_DATA";
  headline: string;
  strengths: string[];
  concerns: string[];
  recommendations: {
    action: string;
    effort: "LOW" | "MED" | "HIGH";
    impact: "LOW" | "MED" | "HIGH";
  }[];
  benchmark: string | null;
};

const VERDICT_META: Record<Insights["healthVerdict"], { label: string; bg: string; text: string; dot: string }> = {
  HEALTHY:           { label: "Healthy",           bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  AT_RISK:           { label: "At risk",           bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-500" },
  UNDERSERVED:       { label: "Underserved",       bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-500" },
  INSUFFICIENT_DATA: { label: "Insufficient data", bg: "bg-muted",  text: "text-muted-foreground",   dot: "bg-muted-foreground/40" },
};

const BADGE: Record<"LOW" | "MED" | "HIGH", string> = {
  LOW:  "bg-muted text-muted-foreground",
  MED:  "bg-blue-50 text-blue-700",
  HIGH: "bg-purple-50 text-purple-700",
};

export function CapabilityAIInsights({
  capabilityId,
  autoOpen,
}: {
  capabilityId: string;
  autoOpen?: boolean;
}) {
  const { workspaceId } = useWorkspace();
  const [open, setOpen] = useState(!!autoOpen);
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runKey, setRunKey] = useState(0);

  useEffect(() => {
    if (!open || !capabilityId) return;
    if (data && runKey === 0) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/ai/capability-insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, capabilityId }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error ?? "Request failed");
        }
        return r.json();
      })
      .then((j) => {
        if (cancelled) return;
        setData(j.insights);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, capabilityId, workspaceId, runKey]);

  // Reset on capability change
  useEffect(() => {
    setData(null);
    setError(null);
  }, [capabilityId]);

  const verdict = data ? VERDICT_META[data.healthVerdict] : null;

  return (
    <div className="rounded-xl border border-[var(--ai)]/25 bg-[var(--ai)]/[0.04] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-[var(--ai)]/[0.08] transition"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--ai)]" />
          <span className="text-[13px] font-semibold text-[var(--ai)]">AI Insights</span>
          {verdict && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${verdict.bg} ${verdict.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${verdict.dot}`} />
              {verdict.label}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-border space-y-3">
          {loading && (
            <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Claude is analyzing…
            </div>
          )}
          {error && !loading && (
            <div className="flex flex-col gap-2 py-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-[12.5px] text-foreground">{error}</p>
              </div>
              <button
                onClick={() => setRunKey((k) => k + 1)}
                className="self-start inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium bg-[var(--ai)] text-white hover:bg-[var(--ai)]/90 transition"
              >
                <RefreshCw className="h-3 w-3" />
                Try again
              </button>
            </div>
          )}
          {data && !loading && (
            <>
              <p className="text-[13.5px] text-foreground leading-relaxed font-medium">
                {data.headline}
              </p>

              {data.strengths.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Strengths</p>
                  <ul className="space-y-1 text-[12.5px] text-foreground">
                    {data.strengths.map((s, i) => (
                      <li key={i} className="flex gap-2"><span className="text-emerald-600">•</span>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {data.concerns.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Concerns</p>
                  <ul className="space-y-1 text-[12.5px] text-foreground">
                    {data.concerns.map((s, i) => (
                      <li key={i} className="flex gap-2"><span className="text-amber-600">•</span>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {data.recommendations.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Recommendations</p>
                  <ul className="space-y-1.5">
                    {data.recommendations.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-[12.5px]">
                        <span className="text-[var(--ai)] mt-0.5">→</span>
                        <div className="flex-1">
                          <div className="text-foreground">{r.action}</div>
                          <div className="flex gap-1.5 mt-1">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${BADGE[r.effort]}`}>
                              {r.effort} effort
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${BADGE[r.impact]}`}>
                              {r.impact} impact
                            </span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data.benchmark && (
                <p className="text-[11.5px] italic text-muted-foreground border-t border-border pt-2">
                  {data.benchmark}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
