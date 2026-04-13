"use client";

import { useState, useEffect, useMemo } from "react";
import {
  X,
  Sparkles,
  Loader2,
  Check,
  XCircle,
  Pencil,
  RefreshCw,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Brain,
  Network,
  Info,
} from "lucide-react";
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
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  mode: "single" | "batch";
  applicationId?: string | null;
  apps?: any[];
};

type Suggestion = {
  capabilityId: string;
  capabilityName: string;
  confidence: number;
  relationshipType: "PRIMARY" | "SUPPORTING" | "ENABLING";
  rationale: string;
  evidenceFields: string[];
  confidenceCeiling?: string | null;
  // Local state
  status?: "pending" | "accepted" | "rejected" | "modified";
  finalCapabilityId?: string;
  finalRelationshipType?: "PRIMARY" | "SUPPORTING" | "ENABLING";
};

type SingleResult = {
  suggestions: Suggestion[];
  dataQualityNote: string | null;
  isSuite: boolean;
  meta: { model: string; promptVersion: string; tier: string };
};

type BatchResult = {
  results: Record<string, { suggestions: Suggestion[]; dataQualityNote: string | null; isSuite: boolean }>;
  meta: { model: string; promptVersion: string; tier: string; appsProcessed: number };
};

export function AppMappingPanel({ open, onClose, mode, applicationId, apps }: Props) {
  const { workspaceId } = useWorkspace();

  if (!open) return null;

  return (
    <aside className="fixed right-0 top-0 h-screen w-[480px] z-40 border-l bg-white flex flex-col shadow-xl">
      {/* Header */}
      <div className="px-5 py-4 border-b flex items-center justify-between bg-gradient-to-r from-[#7c3aed]/10 to-transparent">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-[#7c3aed]/15 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-[#7c3aed]" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-[#1a1f2e]">
              {mode === "single" ? "Capability Auto-Mapping" : "Batch Capability Mapping"}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {mode === "single"
                ? "AI suggests capabilities this app supports"
                : "AI maps capabilities across your portfolio"}
            </p>
          </div>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {mode === "single" && applicationId ? (
          <SingleMode applicationId={applicationId} workspaceId={workspaceId} />
        ) : (
          <BatchMode apps={apps ?? []} workspaceId={workspaceId} />
        )}
      </div>
    </aside>
  );
}

// ─── Single-app mode ─────────────────────────────────────

function SingleMode({ applicationId, workspaceId }: { applicationId: string; workspaceId: string }) {
  const utils = trpc.useUtils();
  const { data: context, isLoading: loadingContext } = trpc.application.getAIMappingContext.useQuery(
    { applicationId }
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SingleResult | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!context) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/application-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "suggest-single",
          workspaceId,
          payload: {
            application: context.application,
            capabilities: context.capabilities,
            existingCapabilityIds: context.existingCapabilityIds,
            recentlyRejectedCapabilityIds: context.recentlyRejectedCapabilityIds,
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "AI call failed");
      }
      const data: SingleResult = await res.json();
      setResult(data);
      setSuggestions(
        (data.suggestions ?? []).map((s) => ({
          ...s,
          status: "pending",
          finalCapabilityId: s.capabilityId,
          finalRelationshipType: s.relationshipType,
        }))
      );
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
      toast.error(err?.message ?? "Failed to generate suggestions");
    } finally {
      setLoading(false);
    }
  }

  // Completeness score for input data quality
  const completeness = useMemo(() => {
    if (!context?.application) return 0;
    const a = context.application as any;
    let score = 0;
    if (a.name) score += 10;
    if (a.description) score += 25;
    if (a.vendor) score += 20;
    if (a.applicationType && a.applicationType !== "CUSTOM") score += 10;
    if (a.businessOwnerName || a.itOwnerName) score += 15;
    if (a.businessValue && a.businessValue !== "BV_UNKNOWN") score += 10;
    if (a.technicalHealth && a.technicalHealth !== "TH_UNKNOWN") score += 10;
    return score;
  }, [context]);

  const acceptMutation = trpc.application.acceptAISuggestion.useMutation({
    onSuccess: () => {
      utils.application.list.invalidate();
      utils.application.getById.invalidate();
      utils.application.getAIMappingContext.invalidate();
    },
  });

  const rejectMutation = trpc.application.rejectAISuggestion.useMutation({
    onSuccess: () => {
      utils.application.getAIMappingContext.invalidate();
    },
  });

  const modifyMutation = trpc.application.modifyAISuggestion.useMutation({
    onSuccess: () => {
      utils.application.list.invalidate();
      utils.application.getById.invalidate();
      utils.application.getAIMappingContext.invalidate();
    },
  });

  async function handleAccept(s: Suggestion) {
    if (!result) return;
    await acceptMutation.mutateAsync({
      applicationId,
      capabilityId: s.capabilityId,
      aiConfidence: s.confidence,
      aiRationale: s.rationale,
      aiRelationshipType: s.relationshipType,
      promptVersion: result.meta.promptVersion,
      model: result.meta.model,
      tier: result.meta.tier,
    });
    setSuggestions((prev) =>
      prev.map((x) => (x.capabilityId === s.capabilityId ? { ...x, status: "accepted" } : x))
    );
    toast.success(`Accepted: ${s.capabilityName}`);
  }

  async function handleReject(s: Suggestion) {
    if (!result) return;
    await rejectMutation.mutateAsync({
      applicationId,
      capabilityId: s.capabilityId,
      aiConfidence: s.confidence,
      aiRationale: s.rationale,
      aiRelationshipType: s.relationshipType,
      promptVersion: result.meta.promptVersion,
      model: result.meta.model,
      tier: result.meta.tier,
    });
    setSuggestions((prev) =>
      prev.map((x) => (x.capabilityId === s.capabilityId ? { ...x, status: "rejected" } : x))
    );
  }

  async function handleModify(s: Suggestion) {
    if (!result) return;
    const finalCapId = s.finalCapabilityId ?? s.capabilityId;
    const finalRel = s.finalRelationshipType ?? s.relationshipType;
    await modifyMutation.mutateAsync({
      applicationId,
      originalCapabilityId: s.capabilityId,
      finalCapabilityId: finalCapId,
      aiConfidence: s.confidence,
      aiRationale: s.rationale,
      aiRelationshipType: s.relationshipType,
      userRelationshipType: finalRel,
      promptVersion: result.meta.promptVersion,
      model: result.meta.model,
      tier: result.meta.tier,
    });
    setSuggestions((prev) =>
      prev.map((x) => (x.capabilityId === s.capabilityId ? { ...x, status: "modified" } : x))
    );
    toast.success("Modified mapping saved");
  }

  async function handleAcceptAllHighConfidence() {
    const targets = suggestions.filter((s) => s.status === "pending" && s.confidence >= 80);
    for (const s of targets) {
      await handleAccept(s);
    }
    toast.success(`Accepted ${targets.length} high-confidence suggestions`);
  }

  if (loadingContext) {
    return (
      <div className="p-5 flex items-center justify-center h-64 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading context...
      </div>
    );
  }

  if (!context) {
    return <div className="p-5 text-sm text-muted-foreground">Application not found.</div>;
  }

  return (
    <div className="p-5 space-y-4">
      {/* App summary */}
      <div className="rounded-lg border bg-gradient-to-br from-[#f8f5ff] to-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
              Target Application
            </div>
            <h3 className="font-bold text-sm text-[#1a1f2e] truncate">{context.application.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {context.application.vendor ?? "No vendor"} • {context.application.applicationType}
            </p>
          </div>
          <CompletenessBadge score={completeness} />
        </div>
        {completeness < 50 && (
          <div className="mt-3 flex gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              Input data is sparse. Add a description and vendor for better results.
            </span>
          </div>
        )}
      </div>

      {!result && !loading && (
        <Button
          onClick={generate}
          disabled={loading}
          className="w-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white h-11"
        >
          <Brain className="h-4 w-4 mr-2" />
          Generate Capability Suggestions
        </Button>
      )}

      {loading && (
        <div className="rounded-lg border bg-gradient-to-br from-[#f8f5ff] to-white p-6 text-center">
          <div className="flex items-center justify-center gap-2 text-sm font-semibold text-[#7c3aed] mb-1">
            <Loader2 className="h-4 w-4 animate-spin" />
            Claude is thinking deeply...
          </div>
          <p className="text-xs text-muted-foreground">
            Extended thinking enabled • typically 15-25s
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {result && (
        <>
          {result.dataQualityNote && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex gap-2">
              <Info className="h-3.5 w-3.5 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900">
                <p className="font-semibold mb-0.5">Data quality note</p>
                <p>{result.dataQualityNote}</p>
              </div>
            </div>
          )}

          {result.isSuite && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900">
              <span className="font-semibold">Suite detected</span> — this application spans multiple capabilities.
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {suggestions.filter((s) => s.status === "pending").length} pending •{" "}
                {suggestions.filter((s) => s.status === "accepted" || s.status === "modified").length}{" "}
                accepted
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAcceptAllHighConfidence}
                disabled={!suggestions.some((s) => s.status === "pending" && s.confidence >= 80)}
                className="text-[11px] h-7"
              >
                <Check className="h-3 w-3 mr-1" />
                Accept all ≥80%
              </Button>
            </div>
          )}

          <div className="space-y-2.5">
            {suggestions.map((s) => (
              <SuggestionCard
                key={s.capabilityId}
                suggestion={s}
                capabilities={context.capabilities}
                onAccept={() => handleAccept(s)}
                onReject={() => handleReject(s)}
                onModify={(finalCapId, finalRel) => {
                  setSuggestions((prev) =>
                    prev.map((x) =>
                      x.capabilityId === s.capabilityId
                        ? { ...x, finalCapabilityId: finalCapId, finalRelationshipType: finalRel }
                        : x
                    )
                  );
                  handleModify({
                    ...s,
                    finalCapabilityId: finalCapId,
                    finalRelationshipType: finalRel,
                  });
                }}
              />
            ))}
          </div>

          {suggestions.length === 0 && (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No suggestions returned. Try adding more detail to the application.
            </div>
          )}

          <div className="pt-2 border-t">
            <Button
              size="sm"
              variant="ghost"
              onClick={generate}
              className="w-full text-xs text-muted-foreground"
            >
              <RefreshCw className="h-3 w-3 mr-1.5" />
              Regenerate
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Suggestion card ─────────────────────────────────────

function SuggestionCard({
  suggestion,
  capabilities,
  onAccept,
  onReject,
  onModify,
}: {
  suggestion: Suggestion;
  capabilities: any[];
  onAccept: () => void;
  onReject: () => void;
  onModify: (finalCapId: string, finalRel: "PRIMARY" | "SUPPORTING" | "ENABLING") => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingCap, setEditingCap] = useState(suggestion.capabilityId);
  const [editingRel, setEditingRel] = useState<"PRIMARY" | "SUPPORTING" | "ENABLING">(
    suggestion.relationshipType
  );

  const confColor =
    suggestion.confidence >= 90
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : suggestion.confidence >= 70
      ? "text-blue-700 bg-blue-50 border-blue-200"
      : "text-amber-700 bg-amber-50 border-amber-200";

  const relColor: Record<string, string> = {
    PRIMARY: "bg-[#7c3aed]/10 text-[#7c3aed] border-[#7c3aed]/20",
    SUPPORTING: "bg-blue-50 text-blue-700 border-blue-200",
    ENABLING: "bg-slate-50 text-slate-700 border-slate-200",
  };

  const isDone = suggestion.status && suggestion.status !== "pending";

  return (
    <div
      className={`rounded-lg border p-3 transition ${
        suggestion.status === "accepted" || suggestion.status === "modified"
          ? "bg-emerald-50/40 border-emerald-200"
          : suggestion.status === "rejected"
          ? "bg-slate-50/60 border-slate-200 opacity-60"
          : "bg-white border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-sm text-[#1a1f2e]">
              {suggestion.capabilityName}
            </span>
            {isDone && (
              <Badge
                className={`text-[9px] ${
                  suggestion.status === "rejected"
                    ? "bg-slate-100 text-slate-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {suggestion.status}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${confColor}`}
            >
              {suggestion.confidence}% confidence
            </span>
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${relColor[suggestion.relationshipType]}`}
            >
              {suggestion.relationshipType}
            </span>
          </div>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-muted-foreground shrink-0 p-0.5"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>

      <p className="text-xs text-[#3a3a3c] leading-relaxed">{suggestion.rationale}</p>

      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-2.5">
          {suggestion.evidenceFields?.length > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Network className="h-3 w-3" />
              Evidence: {suggestion.evidenceFields.join(", ")}
            </div>
          )}
          {suggestion.confidenceCeiling && (
            <div className="text-[10px] text-muted-foreground italic">
              To reach 100%: {suggestion.confidenceCeiling}
            </div>
          )}

          {!isDone && (
            <div className="space-y-2 pt-1">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Change capability
                </label>
                <Select value={editingCap} onValueChange={(v) => setEditingCap(v ?? editingCap)}>
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {capabilities.map((c: any) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.name} ({c.level})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Relationship type
                </label>
                <Select value={editingRel} onValueChange={(v) => setEditingRel(v as any)}>
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRIMARY" className="text-xs">PRIMARY</SelectItem>
                    <SelectItem value="SUPPORTING" className="text-xs">SUPPORTING</SelectItem>
                    <SelectItem value="ENABLING" className="text-xs">ENABLING</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onModify(editingCap, editingRel)}
                className="w-full h-7 text-[11px]"
              >
                <Pencil className="h-3 w-3 mr-1.5" />
                Save modification
              </Button>
            </div>
          )}
        </div>
      )}

      {!isDone && (
        <div className="flex gap-1.5 mt-2.5">
          <Button
            size="sm"
            onClick={onAccept}
            className="flex-1 h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Check className="h-3 w-3 mr-1" />
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onReject}
            className="flex-1 h-7 text-[11px]"
          >
            <XCircle className="h-3 w-3 mr-1" />
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Batch mode ──────────────────────────────────────────

function BatchMode({ apps, workspaceId }: { apps: any[]; workspaceId: string }) {
  const utils = trpc.useUtils();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [appStates, setAppStates] = useState<Record<string, Suggestion[]>>({});
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Default: select apps with no capability mappings (most valuable targets)
  useEffect(() => {
    const unmapped = apps
      .filter((a) => !a.capabilities || a.capabilities.length === 0)
      .slice(0, 30)
      .map((a) => a.id);
    setSelectedIds(new Set(unmapped));
  }, [apps]);

  const contextQuery = trpc.application.bulkGetAIMappingContext.useQuery(
    { applicationIds: Array.from(selectedIds) },
    { enabled: false }
  );

  async function runBatch() {
    if (selectedIds.size === 0) {
      toast.error("Select at least one application");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const ctx = await contextQuery.refetch();
      if (!ctx.data) throw new Error("Failed to load context");

      const res = await fetch("/api/ai/application-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "suggest-batch",
          workspaceId,
          payload: {
            applications: ctx.data.applications,
            capabilities: ctx.data.capabilities,
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Batch AI call failed");
      }
      const data: BatchResult = await res.json();
      setResult(data);
      const states: Record<string, Suggestion[]> = {};
      for (const [appId, r] of Object.entries(data.results)) {
        states[appId] = (r.suggestions ?? []).map((s) => ({
          ...s,
          status: "pending",
        }));
      }
      setAppStates(states);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
      toast.error(err?.message ?? "Batch failed");
    } finally {
      setLoading(false);
    }
  }

  const acceptMutation = trpc.application.acceptAISuggestion.useMutation({
    onSuccess: () => {
      utils.application.list.invalidate();
    },
  });

  async function acceptSuggestion(appId: string, s: Suggestion) {
    if (!result) return;
    await acceptMutation.mutateAsync({
      applicationId: appId,
      capabilityId: s.capabilityId,
      aiConfidence: s.confidence,
      aiRationale: s.rationale,
      aiRelationshipType: s.relationshipType,
      promptVersion: result.meta.promptVersion,
      model: result.meta.model,
      tier: result.meta.tier,
    });
    setAppStates((prev) => ({
      ...prev,
      [appId]: (prev[appId] ?? []).map((x) =>
        x.capabilityId === s.capabilityId ? { ...x, status: "accepted" } : x
      ),
    }));
  }

  async function acceptAllHighConfidence(threshold: number) {
    let count = 0;
    for (const [appId, sugs] of Object.entries(appStates)) {
      for (const s of sugs) {
        if (s.status === "pending" && s.confidence >= threshold) {
          await acceptSuggestion(appId, s);
          count++;
        }
      }
    }
    toast.success(`Accepted ${count} suggestions`);
  }

  const totalSuggestions = Object.values(appStates).reduce((n, s) => n + s.length, 0);
  const highConfCount = Object.values(appStates).reduce(
    (n, s) => n + s.filter((x) => x.status === "pending" && x.confidence >= 90).length,
    0
  );
  const medConfCount = Object.values(appStates).reduce(
    (n, s) => n + s.filter((x) => x.status === "pending" && x.confidence >= 80).length,
    0
  );

  return (
    <div className="p-5 space-y-4">
      {!result && !loading && (
        <>
          <div className="rounded-lg border bg-gradient-to-br from-[#f8f5ff] to-white p-4 text-xs text-[#1a1f2e]">
            <p className="font-semibold mb-1">Batch Capability Mapping</p>
            <p className="text-muted-foreground leading-relaxed">
              AI will suggest capability mappings for up to 30 applications at once.
              Fast tier (~2-3s per app). Rate-limited to 1 batch per 5 minutes.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold">
                Select applications ({selectedIds.size} / {Math.min(30, apps.length)})
              </div>
              <button
                onClick={() => {
                  if (selectedIds.size === 0) {
                    setSelectedIds(new Set(apps.slice(0, 30).map((a) => a.id)));
                  } else {
                    setSelectedIds(new Set());
                  }
                }}
                className="text-[11px] text-[#7c3aed] hover:underline"
              >
                {selectedIds.size === 0 ? "Select first 30" : "Clear"}
              </button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto border rounded-lg divide-y">
              {apps.map((a) => {
                const isSelected = selectedIds.has(a.id);
                const mappedCount = a.capabilities?.length ?? 0;
                const canSelect = isSelected || selectedIds.size < 30;
                return (
                  <label
                    key={a.id}
                    className={`flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-muted/40 ${
                      !canSelect ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={!canSelect}
                      onChange={(e) => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(a.id);
                          else next.delete(a.id);
                          return next;
                        });
                      }}
                      className="shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{a.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {a.vendor ?? "No vendor"} • {mappedCount} capabilities mapped
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <Button
            onClick={runBatch}
            disabled={selectedIds.size === 0}
            className="w-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white h-11"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Run Batch ({selectedIds.size} apps)
          </Button>
        </>
      )}

      {loading && (
        <div className="rounded-lg border bg-gradient-to-br from-[#f8f5ff] to-white p-6 text-center">
          <div className="flex items-center justify-center gap-2 text-sm font-semibold text-[#7c3aed] mb-1">
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing {selectedIds.size} apps...
          </div>
          <p className="text-xs text-muted-foreground">
            Estimated time: {Math.ceil(selectedIds.size * 3)}s
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {result && (
        <>
          <div className="rounded-lg bg-[#f8f5ff] border border-[#7c3aed]/20 p-4">
            <p className="text-sm font-semibold text-[#1a1f2e]">
              {result.meta.appsProcessed} apps processed • {totalSuggestions} suggestions
            </p>
            <div className="flex gap-2 mt-3">
              {highConfCount > 0 && (
                <Button
                  size="sm"
                  onClick={() => acceptAllHighConfidence(90)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] h-7"
                >
                  Accept all ≥90% ({highConfCount})
                </Button>
              )}
              {medConfCount > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => acceptAllHighConfidence(80)}
                  className="text-[11px] h-7"
                >
                  Accept all ≥80% ({medConfCount})
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {Object.entries(result.results).map(([appId, r]) => {
              const app = apps.find((a) => a.id === appId);
              const sugs = appStates[appId] ?? [];
              const isOpen = expandedApp === appId;
              return (
                <div key={appId} className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedApp(isOpen ? null : appId)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/40 text-left"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">{app?.name ?? appId}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {sugs.length} suggestions •{" "}
                        {sugs.filter((s) => s.status === "accepted").length} accepted
                      </div>
                    </div>
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                  {isOpen && (
                    <div className="p-2 space-y-1.5 bg-muted/20 border-t">
                      {r.dataQualityNote && (
                        <div className="text-[10px] text-amber-700 italic px-2">{r.dataQualityNote}</div>
                      )}
                      {sugs.map((s) => (
                        <div
                          key={s.capabilityId}
                          className={`flex items-center justify-between gap-2 p-2 rounded bg-white border text-xs ${
                            s.status === "accepted" ? "opacity-50" : ""
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{s.capabilityName}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {s.confidence}% • {s.relationshipType}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            disabled={s.status === "accepted"}
                            onClick={() => acceptSuggestion(appId, s)}
                            className="h-6 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            {s.status === "accepted" ? "✓" : "Accept"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Completeness badge ──────────────────────────────────

function CompletenessBadge({ score }: { score: number }) {
  const color =
    score >= 70 ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : score >= 40 ? "bg-amber-50 text-amber-700 border-amber-200"
    : "bg-red-50 text-red-700 border-red-200";
  return (
    <div className={`text-[10px] font-semibold px-2 py-1 rounded border ${color} shrink-0`}>
      {score}% complete
    </div>
  );
}
