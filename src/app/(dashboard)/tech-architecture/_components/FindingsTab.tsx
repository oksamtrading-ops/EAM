"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ShieldCheck, Wand2, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/useWorkspace";
import { TabFilters } from "./TabFilters";
import { ToolbarActions } from "./ToolbarActions";

type EolAnalysis = {
  executiveSummary: string;
  perComponent: Array<{
    componentName: string;
    urgency: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    recommendation: string;
    replacementOptions: string[];
    timeline: string;
  }>;
  portfolioRisks: string[];
};

function urgencyColor(u: string) {
  switch (u) {
    case "CRITICAL":
      return "bg-rose-100 text-rose-700 border-rose-200";
    case "HIGH":
      return "bg-orange-100 text-orange-700 border-orange-200";
    case "MEDIUM":
      return "bg-amber-100 text-amber-700 border-amber-200";
    default:
      return "bg-sky-100 text-sky-700 border-sky-200";
  }
}

const SEVERITIES = ["HIGH", "MEDIUM", "LOW"] as const;
type Severity = (typeof SEVERITIES)[number];

function severityColor(s: string) {
  switch (s) {
    case "HIGH":
      return "bg-rose-100 text-rose-700 border-rose-200";
    case "MEDIUM":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "LOW":
      return "bg-sky-100 text-sky-700 border-sky-200";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function entityHref(entityType: string, entityId: string): string | null {
  switch (entityType) {
    case "Application":
      return `/applications?open=${entityId}`;
    default:
      return null;
  }
}

export function FindingsTab() {
  const { workspaceId } = useWorkspace();
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [kindFilter, setKindFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [eolLoading, setEolLoading] = useState(false);
  const [eol, setEol] = useState<EolAnalysis | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const { data: findings = [], isLoading } = trpc.techArchitecture.findings.useQuery();

  async function runEolAnalysis() {
    setEolLoading(true);
    try {
      const res = await fetch("/api/ai/tech-architecture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "eol-analysis", workspaceId, payload: {} }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "EOL analysis failed");
        return;
      }
      setEol({
        executiveSummary: json.executiveSummary ?? "",
        perComponent: Array.isArray(json.perComponent) ? json.perComponent : [],
        portfolioRisks: Array.isArray(json.portfolioRisks) ? json.portfolioRisks : [],
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "EOL analysis failed");
    } finally {
      setEolLoading(false);
    }
  }

  function toggleExpanded(i: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  const kinds = useMemo(() => {
    const set = new Set(findings.map((f) => f.kind));
    return Array.from(set).sort();
  }, [findings]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return findings.filter((f) => {
      if (severityFilter && f.severity !== severityFilter) return false;
      if (kindFilter && f.kind !== kindFilter) return false;
      if (s && !(
        f.entityName.toLowerCase().includes(s) ||
        f.description.toLowerCase().includes(s) ||
        (f.relatedName?.toLowerCase().includes(s) ?? false)
      )) return false;
      return true;
    });
  }, [findings, severityFilter, kindFilter, search]);

  const bySeverity = useMemo(() => ({
    HIGH: findings.filter((f) => f.severity === "HIGH").length,
    MEDIUM: findings.filter((f) => f.severity === "MEDIUM").length,
    LOW: findings.filter((f) => f.severity === "LOW").length,
  }), [findings]);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[var(--ai)]/20 bg-[var(--ai-subtle)] p-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-start gap-2">
            <Wand2 className="h-3.5 w-3.5 mt-0.5 text-[var(--ai)] shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">EOL risk narrative</p>
              <p className="text-xs text-muted-foreground">
                AI summary of end-of-life exposure across the component catalog, with per-component recommendations.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={runEolAnalysis}
            disabled={eolLoading}
            className={
              eolLoading
                ? "bg-[var(--ai)] text-white border-[var(--ai)] hover:bg-[var(--ai-hover)]"
                : "border-[var(--ai)]/30 text-[var(--ai)] hover:bg-[var(--ai-subtle)] hover:text-[var(--ai)]"
            }
          >
            <Wand2 className="h-3.5 w-3.5 mr-1" />
            {eolLoading ? "Analyzing…" : eol ? "Re-run" : "Generate analysis"}
          </Button>
        </div>
        {eol && (
          <div className="space-y-3 pt-2">
            {eol.executiveSummary && (
              <p className="text-xs leading-relaxed text-foreground">{eol.executiveSummary}</p>
            )}
            {eol.perComponent.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Per-component recommendations</p>
                <ul className="space-y-1">
                  {eol.perComponent.map((c, i) => {
                    const isOpen = expanded.has(i);
                    return (
                      <li key={`${c.componentName}-${i}`} className="rounded border border-border bg-card">
                        <button
                          onClick={() => toggleExpanded(i)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-muted/30"
                        >
                          {isOpen ? (
                            <ChevronDown className="h-3 w-3 shrink-0" />
                          ) : (
                            <ChevronRight className="h-3 w-3 shrink-0" />
                          )}
                          <span className="flex-1 truncate font-medium">{c.componentName}</span>
                          <Badge variant="outline" className={`text-[9px] ${urgencyColor(c.urgency)}`}>
                            {c.urgency}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground shrink-0">{c.timeline}</span>
                        </button>
                        {isOpen && (
                          <div className="px-2 pb-2 pt-1 text-xs space-y-1 border-t border-border">
                            <p className="text-foreground leading-snug">{c.recommendation}</p>
                            {c.replacementOptions?.length > 0 && (
                              <div>
                                <p className="text-[10px] uppercase text-muted-foreground">Replacement options</p>
                                <p className="text-muted-foreground">{c.replacementOptions.join(" · ")}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {eol.portfolioRisks.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Portfolio risks</p>
                <ul className="list-disc pl-4 space-y-0.5 text-xs text-muted-foreground">
                  {eol.portfolioRisks.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(["HIGH", "MEDIUM", "LOW"] as const).map((s) => (
          <div key={s} className="rounded-lg border border-border bg-card px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s}</p>
            <p className="text-xl font-semibold tabular-nums">{bySeverity[s]}</p>
          </div>
        ))}
      </div>

      <ToolbarActions>
        <TabFilters
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search findings…"
          groups={[
            { key: "severity", label: "Severity", options: SEVERITIES.map((s) => ({ value: s, label: s })) },
            { key: "kind", label: "Type", options: kinds.map((k) => ({ value: k, label: k.replace(/_/g, " ") })) },
          ]}
          values={{ severity: severityFilter, kind: kindFilter }}
          onValuesChange={(next) => {
            setSeverityFilter(next.severity);
            setKindFilter(next.kind);
          }}
        />
      </ToolbarActions>

      {isLoading ? (
        <div className="space-y-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center">
          <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-emerald-600" />
          <p className="text-sm font-medium">No findings match</p>
          <p className="text-xs text-muted-foreground mt-1">
            {findings.length === 0
              ? "Your technology architecture has no active findings."
              : "Adjust filters to see other findings."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-3 py-2">Severity</th>
                <th className="text-left font-medium px-3 py-2">Type</th>
                <th className="text-left font-medium px-3 py-2">Entity</th>
                <th className="text-left font-medium px-3 py-2">Description</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f, idx) => {
                const href = entityHref(f.entityType, f.entityId);
                return (
                  <tr key={`${f.kind}-${f.entityId}-${idx}`} className="border-t border-border">
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={`text-[10px] ${severityColor(f.severity as Severity)}`}>
                        <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                        {f.severity}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{f.kind.replace(/_/g, " ")}</td>
                    <td className="px-3 py-2">
                      {href ? (
                        <Link href={href} className="text-sm text-primary hover:underline">
                          {f.entityName}
                        </Link>
                      ) : (
                        <span className="text-sm">{f.entityName}</span>
                      )}
                      <span className="text-[10px] text-muted-foreground block">{f.entityType}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{f.description}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
