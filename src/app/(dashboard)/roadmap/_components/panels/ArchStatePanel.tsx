"use client";

import { useState } from "react";
import { X, Camera, GitCompare, Loader2, Trash2, Plus, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

type Tab = "capture" | "tobe" | "compare";

export function ArchStatePanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("capture");

  // As-Is capture
  const [asIsLabel, setAsIsLabel] = useState("");

  // To-Be form
  const [toBeLabel, setToBeLabel] = useState("");
  const [toBeInitiativeId, setToBeInitiativeId] = useState("");
  const [capTargets, setCapTargets] = useState<{ capabilityId: string; targetMaturity: string }[]>([]);
  const [appChanges, setAppChanges] = useState<{ applicationId: string; changeType: string }[]>([]);

  // Compare
  const [compareAsIsId, setCompareAsIsId] = useState("");
  const [compareToBeId, setCompareToBeId] = useState("");
  const [narrative, setNarrative] = useState<string | null>(null);
  const [generatingNarrative, setGeneratingNarrative] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data: states } = trpc.archState.list.useQuery(undefined, { enabled: open });
  const { data: roadmap } = trpc.initiative.getRoadmapData.useQuery(undefined, { enabled: open });
  const { data: capabilities } = trpc.capability.getTree.useQuery(undefined, { enabled: open && tab === "tobe" });

  const captureAsIs = trpc.archState.captureAsIs.useMutation({
    onSuccess: () => {
      toast.success("As-Is state captured");
      setAsIsLabel("");
      utils.archState.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const defineToBe = trpc.archState.defineToBeState.useMutation({
    onSuccess: () => {
      toast.success("To-Be state saved");
      setToBeLabel("");
      setToBeInitiativeId("");
      setCapTargets([]);
      setAppChanges([]);
      utils.archState.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteState = trpc.archState.delete.useMutation({
    onSuccess: (_, vars) => {
      toast.success("State deleted");
      setDeletingId(null);
      if (compareAsIsId === vars.id) setCompareAsIsId("");
      if (compareToBeId === vars.id) setCompareToBeId("");
      utils.archState.list.invalidate();
    },
    onError: (e) => { toast.error(e.message); setDeletingId(null); },
  });

  const { data: diff } = trpc.archState.compare.useQuery(
    { asIsId: compareAsIsId, toBeId: compareToBeId },
    { enabled: !!(compareAsIsId && compareToBeId) }
  );

  async function handleGenerateNarrative() {
    if (!diff) return;
    setGeneratingNarrative(true);
    try {
      const res = await fetch("/api/ai/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "state-narrative",
          payload: {
            clientName: "Client",
            asIsLabel: states?.find((s) => s.id === compareAsIsId)?.label ?? "As-Is",
            toBeLabel: states?.find((s) => s.id === compareToBeId)?.label ?? "To-Be",
            diff,
          },
        }),
      });
      const data = await res.json();
      setNarrative(data.narrative ?? null);
    } catch {
      toast.error("Failed to generate narrative");
    } finally {
      setGeneratingNarrative(false);
    }
  }

  // Flatten capability tree
  function flattenCaps(nodes: any[]): { id: string; name: string }[] {
    return nodes.flatMap((n) => [{ id: n.id, name: n.name }, ...flattenCaps(n.children ?? [])]);
  }
  const flatCaps = flattenCaps(capabilities ?? []);

  // Applications from roadmap initiatives (distinct)
  const allApps: { id: string; name: string }[] = [];
  const seenApps = new Set<string>();
  (roadmap?.initiatives ?? []).forEach((i: any) => {
    (i.applications ?? []).forEach((a: any) => {
      if (!seenApps.has(a.applicationId)) {
        seenApps.add(a.applicationId);
        allApps.push({ id: a.applicationId, name: a.applicationId });
      }
    });
  });

  const MATURITIES = ["INITIAL", "DEVELOPING", "DEFINED", "MANAGED", "OPTIMISING"];
  const CHANGE_TYPES = ["KEEP", "RETIRE", "PHASE_OUT", "REPLACE"];

  if (!open) return null;

  const asIsStates = states?.filter((s) => s.stateType === "AS_IS") ?? [];
  const toBeStates = states?.filter((s) => s.stateType === "TO_BE") ?? [];

  const TABS: { id: Tab; label: string }[] = [
    { id: "capture", label: "As-Is" },
    { id: "tobe", label: "To-Be" },
    { id: "compare", label: "Compare" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative bg-background border-l shadow-xl w-[500px] h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h2 className="font-semibold">Architecture States</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                tab === t.id
                  ? "border-b-2 border-[#86BC25] text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">

          {/* ── AS-IS TAB ── */}
          {tab === "capture" && (
            <>
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Capture Current State
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Takes a snapshot of all active capabilities, applications, gaps, and redundancies at this moment.
                </p>
                <div className="flex gap-2">
                  <input
                    value={asIsLabel}
                    onChange={(e) => setAsIsLabel(e.target.value)}
                    placeholder="e.g. As-Is — April 2026"
                    className="flex-1 h-9 text-sm border rounded-md px-3 focus:outline-none focus:ring-1 focus:ring-[#86BC25]"
                  />
                  <button
                    onClick={() => captureAsIs.mutate({ label: asIsLabel })}
                    disabled={!asIsLabel.trim() || captureAsIs.isPending}
                    className="flex items-center gap-1.5 px-3 h-9 bg-[#86BC25] text-white text-xs font-semibold rounded-md hover:bg-[#76a820] disabled:opacity-50 transition-colors"
                  >
                    {captureAsIs.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                    Capture
                  </button>
                </div>
              </section>

              {states && states.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                    Saved States ({states.length})
                  </h3>
                  <div className="space-y-2">
                    {states.map((s) => (
                      <div key={s.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            s.stateType === "AS_IS" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                          }`}>
                            {s.stateType === "AS_IS" ? "As-Is" : "To-Be"}
                          </span>
                          <span className="truncate text-xs">{s.label}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-[11px] text-muted-foreground">
                            {format(new Date(s.createdAt), "MMM d")}
                          </span>
                          {deletingId === s.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => { deleteState.mutate({ id: s.id }); }}
                                disabled={deleteState.isPending}
                                className="text-[10px] px-2 py-0.5 bg-rose-500 text-white rounded hover:bg-rose-600 disabled:opacity-50"
                              >
                                Confirm
                              </button>
                              <button onClick={() => setDeletingId(null)} className="text-[10px] text-muted-foreground hover:text-foreground">
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeletingId(s.id)}
                              className="p-1 rounded hover:bg-rose-50 text-muted-foreground hover:text-rose-500 transition-colors"
                              title="Delete state"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {/* ── TO-BE TAB ── */}
          {tab === "tobe" && (
            <section className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Define a target architecture state tied to an initiative. Specify which capabilities to mature and which applications to change.
              </p>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Label *</label>
                <input
                  value={toBeLabel}
                  onChange={(e) => setToBeLabel(e.target.value)}
                  placeholder="e.g. To-Be — Post Digital Transformation"
                  className="w-full h-9 text-sm border rounded-md px-3 focus:outline-none focus:ring-1 focus:ring-[#86BC25]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Linked Initiative *</label>
                <select
                  value={toBeInitiativeId}
                  onChange={(e) => setToBeInitiativeId(e.target.value)}
                  className="w-full h-9 text-sm border rounded-md px-2 focus:outline-none"
                >
                  <option value="">Select initiative…</option>
                  {(roadmap?.initiatives ?? []).map((i: any) => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
              </div>

              {/* Capability targets */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-muted-foreground">Capability Maturity Targets</label>
                  <button
                    type="button"
                    onClick={() => setCapTargets((prev) => [...prev, { capabilityId: "", targetMaturity: "DEFINED" }])}
                    className="flex items-center gap-1 text-[11px] text-[#86BC25] hover:underline"
                  >
                    <Plus className="h-3 w-3" /> Add
                  </button>
                </div>
                {capTargets.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">No targets added yet</p>
                )}
                <div className="space-y-2">
                  {capTargets.map((ct, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select
                        value={ct.capabilityId}
                        onChange={(e) => setCapTargets((prev) => prev.map((c, i) => i === idx ? { ...c, capabilityId: e.target.value } : c))}
                        className="flex-1 h-8 text-xs border rounded-md px-2 focus:outline-none"
                      >
                        <option value="">Select capability…</option>
                        {flatCaps.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <select
                        value={ct.targetMaturity}
                        onChange={(e) => setCapTargets((prev) => prev.map((c, i) => i === idx ? { ...c, targetMaturity: e.target.value } : c))}
                        className="w-36 h-8 text-xs border rounded-md px-2 focus:outline-none"
                      >
                        {MATURITIES.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <button onClick={() => setCapTargets((prev) => prev.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-rose-500">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Application changes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-muted-foreground">Application Changes</label>
                  <button
                    type="button"
                    onClick={() => setAppChanges((prev) => [...prev, { applicationId: "", changeType: "KEEP" }])}
                    className="flex items-center gap-1 text-[11px] text-[#86BC25] hover:underline"
                  >
                    <Plus className="h-3 w-3" /> Add
                  </button>
                </div>
                {appChanges.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">No changes added yet</p>
                )}
                <div className="space-y-2">
                  {appChanges.map((ac, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        value={ac.applicationId}
                        onChange={(e) => setAppChanges((prev) => prev.map((a, i) => i === idx ? { ...a, applicationId: e.target.value } : a))}
                        placeholder="Application ID or name"
                        className="flex-1 h-8 text-xs border rounded-md px-2 focus:outline-none"
                      />
                      <select
                        value={ac.changeType}
                        onChange={(e) => setAppChanges((prev) => prev.map((a, i) => i === idx ? { ...a, changeType: e.target.value } : a))}
                        className="w-28 h-8 text-xs border rounded-md px-2 focus:outline-none"
                      >
                        {CHANGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <button onClick={() => setAppChanges((prev) => prev.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-rose-500">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => {
                  if (!toBeLabel.trim() || !toBeInitiativeId) {
                    toast.error("Label and initiative are required");
                    return;
                  }
                  defineToBe.mutate({
                    initiativeId: toBeInitiativeId,
                    label: toBeLabel,
                    capabilityTargets: capTargets.filter((c) => c.capabilityId),
                    applicationChanges: appChanges.filter((a) => a.applicationId),
                  });
                }}
                disabled={!toBeLabel.trim() || !toBeInitiativeId || defineToBe.isPending}
                className="w-full flex items-center justify-center gap-2 h-9 bg-[#86BC25] text-white text-xs font-semibold rounded-md hover:bg-[#76a820] disabled:opacity-50 transition-colors"
              >
                {defineToBe.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                Save To-Be State
              </button>
            </section>
          )}

          {/* ── COMPARE TAB ── */}
          {tab === "compare" && (
            <section className="space-y-4">
              {asIsStates.length === 0 || toBeStates.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    You need at least one <strong>As-Is</strong> and one <strong>To-Be</strong> state to compare.
                  </p>
                  <div className="flex gap-2 justify-center mt-3">
                    {asIsStates.length === 0 && (
                      <button onClick={() => setTab("capture")} className="text-xs text-[#86BC25] hover:underline">Capture As-Is →</button>
                    )}
                    {toBeStates.length === 0 && (
                      <button onClick={() => setTab("tobe")} className="text-xs text-[#86BC25] hover:underline">Define To-Be →</button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">As-Is State</label>
                      <select
                        value={compareAsIsId}
                        onChange={(e) => { setCompareAsIsId(e.target.value); setNarrative(null); }}
                        className="w-full h-9 text-sm border rounded-md px-2 focus:outline-none"
                      >
                        <option value="">Select…</option>
                        {asIsStates.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">To-Be State</label>
                      <select
                        value={compareToBeId}
                        onChange={(e) => { setCompareToBeId(e.target.value); setNarrative(null); }}
                        className="w-full h-9 text-sm border rounded-md px-2 focus:outline-none"
                      >
                        <option value="">Select…</option>
                        {toBeStates.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    </div>
                  </div>

                  {diff && (
                    <div className="space-y-3">
                      {/* Diff results */}
                      <div className="rounded-md border p-3 space-y-1">
                        <p className="text-[11px] font-semibold uppercase text-muted-foreground mb-1">Capability Maturity Changes</p>
                        {diff.capDiffs.filter((c: any) => c.maturityChange).length > 0 ? (
                          diff.capDiffs.filter((c: any) => c.maturityChange).map((c: any) => (
                            <p key={c.id} className="text-xs text-blue-700">
                              {c.name}: <span className="font-medium">{c.maturityChange.from} → {c.maturityChange.to}</span>
                            </p>
                          ))
                        ) : <p className="text-xs text-muted-foreground">No changes</p>}
                      </div>

                      <div className="rounded-md border p-3 space-y-1">
                        <p className="text-[11px] font-semibold uppercase text-muted-foreground mb-1">Applications Retired</p>
                        {diff.appDiffs.retired.length > 0
                          ? diff.appDiffs.retired.map((n: string) => <p key={n} className="text-xs text-rose-600">− {n}</p>)
                          : <p className="text-xs text-muted-foreground">None</p>}
                      </div>

                      <div className="rounded-md border p-3 space-y-1">
                        <p className="text-[11px] font-semibold uppercase text-muted-foreground mb-1">Applications Introduced</p>
                        {diff.appDiffs.introduced.length > 0
                          ? diff.appDiffs.introduced.map((n: string) => <p key={n} className="text-xs text-emerald-600">+ {n}</p>)
                          : <p className="text-xs text-muted-foreground">None</p>}
                      </div>

                      <div className="rounded-md border p-3 space-y-1">
                        <p className="text-[11px] font-semibold uppercase text-muted-foreground mb-1">Capability Gaps Closed</p>
                        {diff.gapsClosed.length > 0
                          ? diff.gapsClosed.map((g: any) => <p key={g.capabilityId} className="text-xs text-emerald-600">✓ {g.capabilityName}</p>)
                          : <p className="text-xs text-muted-foreground">None</p>}
                      </div>

                      {/* Generate Narrative */}
                      <div className="group relative">
                        <button
                          onClick={handleGenerateNarrative}
                          disabled={generatingNarrative}
                          className="w-full flex items-center justify-center gap-2 h-9 rounded-md border border-purple-200 bg-purple-50/50 text-purple-700 text-xs font-medium hover:bg-purple-100 disabled:opacity-50 transition-colors"
                        >
                          {generatingNarrative
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Sparkles className="h-3.5 w-3.5" />}
                          Generate Narrative
                          <span className="ml-1 text-[9px] font-semibold uppercase tracking-wide bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded-full">
                            AI
                          </span>
                        </button>

                        {/* Tooltip */}
                        <div className="absolute bottom-full left-0 right-0 mb-2 hidden group-hover:block z-50">
                          <div className="bg-[#1a1f2e] text-white text-[11px] rounded-lg px-3 py-2.5 shadow-lg leading-relaxed">
                            <p className="font-semibold text-purple-300 mb-1">AI-powered transformation narrative</p>
                            <p className="text-white/80">
                              Uses Claude AI to write a board-level prose summary of the transformation — covering capability improvements, portfolio rationalisation, and expected business outcomes.
                            </p>
                          </div>
                          <div className="w-3 h-3 bg-[#1a1f2e] rotate-45 mx-auto -mt-1.5" />
                        </div>
                      </div>

                      {narrative && (
                        <div className="rounded-md border p-3 text-xs leading-relaxed whitespace-pre-wrap bg-muted/20 text-foreground">
                          {narrative}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
