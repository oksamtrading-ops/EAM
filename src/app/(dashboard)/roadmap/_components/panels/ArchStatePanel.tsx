"use client";

import { useState } from "react";
import { X, Camera, GitCompare, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

export function ArchStatePanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [asIsLabel, setAsIsLabel] = useState("");
  const [compareAsIsId, setCompareAsIsId] = useState("");
  const [compareToBeId, setCompareToBeId] = useState("");
  const [narrative, setNarrative] = useState<string | null>(null);
  const [generatingNarrative, setGeneratingNarrative] = useState(false);

  const utils = trpc.useUtils();
  const { data: states } = trpc.archState.list.useQuery(undefined, { enabled: open });

  const captureAsIs = trpc.archState.captureAsIs.useMutation({
    onSuccess: () => {
      toast.success("As-Is state captured");
      setAsIsLabel("");
      utils.archState.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
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

  if (!open) return null;

  const asIsStates = states?.filter((s) => s.stateType === "AS_IS") ?? [];
  const toBeStates = states?.filter((s) => s.stateType === "TO_BE") ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative bg-background border-l shadow-xl w-[480px] h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h2 className="font-semibold">Architecture States</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Capture As-Is */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Capture As-Is Snapshot
            </h3>
            <div className="flex gap-2">
              <input
                value={asIsLabel}
                onChange={(e) => setAsIsLabel(e.target.value)}
                placeholder="Label e.g. As-Is — April 2025"
                className="flex-1 text-sm border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#86BC25]"
              />
              <button
                onClick={() => captureAsIs.mutate({ label: asIsLabel })}
                disabled={!asIsLabel || captureAsIs.isPending}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#86BC25] text-white text-xs font-semibold rounded-md hover:bg-[#76a820] disabled:opacity-50"
              >
                <Camera className="h-3.5 w-3.5" />
                Capture
              </button>
            </div>
          </section>

          {/* Existing States */}
          {states && states.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Saved States ({states.length})
              </h3>
              <div className="space-y-2">
                {states.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <div>
                      <span className={`inline-block mr-2 text-[10px] font-bold uppercase px-1 rounded ${s.stateType === "AS_IS" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                        {s.stateType === "AS_IS" ? "As-Is" : "To-Be"}
                      </span>
                      {s.label}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {format(new Date(s.createdAt), "MMM d")}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Compare */}
          {asIsStates.length > 0 && toBeStates.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Compare States
              </h3>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">As-Is</label>
                  <select
                    value={compareAsIsId}
                    onChange={(e) => setCompareAsIsId(e.target.value)}
                    className="w-full text-sm border rounded-md px-2 py-1.5 focus:outline-none"
                  >
                    <option value="">Select…</option>
                    {asIsStates.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">To-Be</label>
                  <select
                    value={compareToBeId}
                    onChange={(e) => setCompareToBeId(e.target.value)}
                    className="w-full text-sm border rounded-md px-2 py-1.5 focus:outline-none"
                  >
                    <option value="">Select…</option>
                    {toBeStates.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {diff && (
                <div className="space-y-3 text-sm">
                  <div className="rounded-md border p-3 space-y-1">
                    <p className="text-[11px] font-semibold uppercase text-muted-foreground">Apps Retired</p>
                    {diff.appDiffs.retired.length > 0 ? (
                      diff.appDiffs.retired.map((n) => <p key={n} className="text-red-600">− {n}</p>)
                    ) : (
                      <p className="text-muted-foreground text-xs">None</p>
                    )}
                  </div>
                  <div className="rounded-md border p-3 space-y-1">
                    <p className="text-[11px] font-semibold uppercase text-muted-foreground">Apps Introduced</p>
                    {diff.appDiffs.introduced.length > 0 ? (
                      diff.appDiffs.introduced.map((n) => <p key={n} className="text-green-600">+ {n}</p>)
                    ) : (
                      <p className="text-muted-foreground text-xs">None</p>
                    )}
                  </div>
                  <div className="rounded-md border p-3 space-y-1">
                    <p className="text-[11px] font-semibold uppercase text-muted-foreground">Gaps Closed</p>
                    {diff.gapsClosed.length > 0 ? (
                      diff.gapsClosed.map((g) => <p key={g.capabilityId} className="text-green-600">✓ {g.capabilityName}</p>)
                    ) : (
                      <p className="text-muted-foreground text-xs">None</p>
                    )}
                  </div>

                  <button
                    onClick={handleGenerateNarrative}
                    disabled={generatingNarrative}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md border text-xs font-medium hover:bg-muted/50 transition-colors disabled:opacity-50"
                  >
                    {generatingNarrative ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <GitCompare className="h-3.5 w-3.5" />
                    )}
                    Generate Narrative
                  </button>

                  {narrative && (
                    <div className="rounded-md border p-3 text-sm leading-relaxed whitespace-pre-wrap bg-muted/20">
                      {narrative}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
