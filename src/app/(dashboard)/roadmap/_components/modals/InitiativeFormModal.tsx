"use client";

import { useState } from "react";
import { X, Loader2, Sparkles, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "sonner";
import { DatePicker } from "../shared/DatePicker";

const EMPTY_FORM = {
  name: "",
  description: "",
  category: "MODERNISATION",
  status: "DRAFT",
  priority: "MEDIUM",
  horizon: "H2_NEXT",
  startDate: "",
  endDate: "",
  budgetUsd: "",
  budgetCurrency: "CAD",
  businessSponsor: "",
  ragStatus: "GREEN",
  sourceType: "",
  sourceContext: "",
};

const CATEGORIES = [
  "MODERNISATION",
  "CONSOLIDATION",
  "DIGITALISATION",
  "COMPLIANCE",
  "OPTIMISATION",
  "INNOVATION",
  "DECOMMISSION",
];
const HORIZONS = ["H1_NOW", "H2_NEXT", "H3_LATER", "BEYOND"];
const PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const STATUSES = ["DRAFT", "PLANNED", "IN_PROGRESS", "ON_HOLD", "COMPLETE", "CANCELLED"];

type InitiativeData = {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  status: string;
  priority: string;
  horizon: string;
  startDate?: Date | null;
  endDate?: Date | null;
  budgetUsd?: any;
  businessSponsor?: string | null;
  ragStatus: string;
};

export type InitiativeFormDefaults = {
  name?: string;
  description?: string;
  category?: string;
  priority?: string;
  horizon?: string;
  sourceType?: string;
  sourceContext?: string;
};

export function InitiativeFormModal({
  open,
  onClose,
  onDeleted,
  initiative,
  initialValues,
  apps,
}: {
  open: boolean;
  onClose: () => void;
  onDeleted?: () => void;
  initiative?: InitiativeData;
  initialValues?: InitiativeFormDefaults;
  apps?: any[];
}) {
  const isEdit = !!initiative;
  const defaults = initialValues ?? {};
  const [form, setForm] = useState({
    name: initiative?.name ?? defaults.name ?? "",
    description: initiative?.description ?? defaults.description ?? "",
    category: initiative?.category ?? defaults.category ?? "MODERNISATION",
    status: initiative?.status ?? "DRAFT",
    priority: initiative?.priority ?? defaults.priority ?? "MEDIUM",
    horizon: initiative?.horizon ?? defaults.horizon ?? "H2_NEXT",
    startDate: initiative?.startDate
      ? new Date(initiative.startDate).toISOString().split("T")[0]
      : "",
    endDate: initiative?.endDate
      ? new Date(initiative.endDate).toISOString().split("T")[0]
      : "",
    budgetUsd: initiative?.budgetUsd ? String(Number(initiative.budgetUsd)) : "",
    budgetCurrency: "CAD",
    businessSponsor: initiative?.businessSponsor ?? "",
    ragStatus: initiative?.ragStatus ?? "GREEN",
    sourceType: defaults.sourceType ?? "",
    sourceContext: defaults.sourceContext ?? "",
  });
  const [loadingAI, setLoadingAI] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const utils = trpc.useUtils();
  const { data: roadmap } = trpc.initiative.getRoadmapData.useQuery();

  const create = trpc.initiative.create.useMutation({
    onSuccess: () => {
      toast.success("Initiative created");
      utils.initiative.getRoadmapData.invalidate();
      setForm(EMPTY_FORM);
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const update = trpc.initiative.update.useMutation({
    onSuccess: () => {
      toast.success("Initiative updated");
      utils.initiative.getRoadmapData.invalidate();
      utils.initiative.getById.invalidate({ id: initiative!.id });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteInitiative = trpc.initiative.delete.useMutation({
    onSuccess: () => {
      toast.success("Initiative deleted");
      utils.initiative.getRoadmapData.invalidate();
      onClose();
      onDeleted?.();
    },
    onError: (e) => toast.error(e.message),
  });

  const { data: capabilities } = trpc.capability.getTree.useQuery();
  const { data: objectives } = trpc.objective.list.useQuery();
  const { workspaceName, industry } = useWorkspace();

  async function handleAISuggest() {
    setLoadingAI(true);
    try {
      // Flatten capability tree into a flat list
      const flatCaps: any[] = [];
      function walkCaps(nodes: any[]) {
        for (const n of nodes) {
          flatCaps.push(n);
          if (n.children) walkCaps(n.children);
        }
      }
      if (capabilities) walkCaps(capabilities);

      // Build capability-app mapping for redundancy detection
      const capAppMap: Record<string, string[]> = {};
      for (const app of apps ?? []) {
        for (const mapping of app.capabilities ?? []) {
          const capId = mapping.capabilityId ?? mapping.capability?.id;
          if (!capId) continue;
          if (!capAppMap[capId]) capAppMap[capId] = [];
          capAppMap[capId].push(app.name);
        }
      }

      // Capabilities with maturity data
      const capsWithMaturity = flatCaps.map((c) => ({
        name: c.name,
        level: c.level ?? "?",
        currentMaturity: c.currentMaturity ?? "NOT_ASSESSED",
        targetMaturity: c.targetMaturity ?? "NOT_ASSESSED",
        strategicImportance: c.strategicImportance ?? "NOT_ASSESSED",
      }));

      const assessedCount = capsWithMaturity.filter(
        (c) => c.currentMaturity !== "NOT_ASSESSED"
      ).length;

      // Capability gaps: capabilities with no app support
      const capabilityGaps = flatCaps
        .filter((c) => !capAppMap[c.id] || capAppMap[c.id].length === 0)
        .filter((c) => c.strategicImportance && c.strategicImportance !== "NOT_ASSESSED")
        .map((c) => ({
          capabilityName: c.name,
          level: c.level ?? "?",
          strategicImportance: c.strategicImportance ?? "NOT_ASSESSED",
        }));

      // Retire candidates: apps with poor technical health or END_OF_LIFE lifecycle
      const retireCandidates = (apps ?? [])
        .filter((a: any) =>
          a.technicalHealth === "POOR" ||
          a.technicalHealth === "VERY_POOR" ||
          a.lifecycle === "END_OF_LIFE" ||
          a.lifecycle === "RETIREMENT"
        )
        .map((a: any) => ({
          name: a.name,
          annualCostUsd: a.annualCostUsd ? Number(a.annualCostUsd) : undefined,
          technicalHealth: a.technicalHealth ?? "NOT_ASSESSED",
          lifecycle: a.lifecycle ?? "UNKNOWN",
        }));

      // Redundancies: capabilities served by 2+ apps
      const redundancies = Object.entries(capAppMap)
        .filter(([, appNames]) => appNames.length >= 2)
        .map(([capId, appNames]) => {
          const cap = flatCaps.find((c) => c.id === capId);
          return {
            capabilityName: cap?.name ?? capId,
            appCount: appNames.length,
            apps: appNames,
          };
        });

      const res = await fetch("/api/ai/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "suggest-initiatives",
          payload: {
            clientName: workspaceName,
            industry,
            planningHorizon: "36 months",
            assessedCapCount: assessedCount,
            totalCapCount: flatCaps.length,
            appCount: (apps ?? []).length,
            capabilities: capsWithMaturity,
            retireCandidates,
            redundancies,
            capabilityGaps,
          },
        }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        return;
      }
      const first = data.initiatives?.[0];
      if (first) {
        setForm((f) => ({
          ...f,
          name: first.name ?? f.name,
          description: first.description ?? f.description,
          category: first.category ?? f.category,
          horizon: first.horizon ?? f.horizon,
          priority: first.priority ?? f.priority,
        }));
        toast.success(`AI suggested ${data.initiatives.length} initiatives — first one applied to form`);
      }
    } catch {
      toast.error("AI suggestion failed");
    } finally {
      setLoadingAI(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description.trim()) { toast.error("Description is required"); return; }
    if (!form.startDate) { toast.error("Start date is required"); return; }
    if (!form.endDate) { toast.error("End date is required"); return; }
    if (!form.budgetUsd) { toast.error("Budget is required"); return; }
    if (!form.businessSponsor.trim()) { toast.error("Business sponsor is required"); return; }

    const payload = {
      name: form.name,
      description: form.description,
      category: form.category as any,
      status: form.status as any,
      priority: form.priority as any,
      horizon: form.horizon as any,
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate).toISOString(),
      budgetUsd: Number(form.budgetUsd),
      budgetCurrency: "CAD",
      businessSponsor: form.businessSponsor,
    };
    if (isEdit) {
      update.mutate({ id: initiative!.id, ...payload, ragStatus: form.ragStatus as any });
    } else {
      create.mutate({
        ...payload,
        ...(form.sourceType ? { sourceType: form.sourceType } : {}),
        ...(form.sourceContext ? { sourceContext: form.sourceContext } : {}),
      });
    }
  }

  if (!open) return null;
  const isPending = create.isPending || update.isPending || deleteInitiative.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-background rounded-xl shadow-2xl w-[calc(100%-1.5rem)] sm:w-[560px] max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b shrink-0">
          <h2 className="font-semibold">
            {isEdit ? "Edit Initiative" : "New Initiative"}
          </h2>
          <div className="flex items-center gap-2">
            {!isEdit && (
              <button
                type="button"
                onClick={handleAISuggest}
                disabled={loadingAI}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium text-purple-600 border-purple-200 hover:bg-purple-50 disabled:opacity-50 transition-colors"
              >
                {loadingAI ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                AI Suggest
              </button>
            )}
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Name *
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full h-10 border rounded-md px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Initiative name"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Description *
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              placeholder="What does this initiative deliver?"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Category
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full h-10 border rounded-md px-2 text-sm focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0) + c.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Horizon
              </label>
              <select
                value={form.horizon}
                onChange={(e) => setForm((f) => ({ ...f, horizon: e.target.value }))}
                className="w-full h-10 border rounded-md px-2 text-sm focus:outline-none"
              >
                {HORIZONS.map((h) => (
                  <option key={h} value={h}>
                    {h.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Priority
              </label>
              <select
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                className="w-full h-10 border rounded-md px-2 text-sm focus:outline-none"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0) + p.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isEdit && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full h-10 border rounded-md px-2 text-sm focus:outline-none"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  RAG Status
                </label>
                <select
                  value={form.ragStatus}
                  onChange={(e) => setForm((f) => ({ ...f, ragStatus: e.target.value }))}
                  className="w-full h-10 border rounded-md px-2 text-sm focus:outline-none"
                >
                  {["GREEN", "AMBER", "RED"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Start Date *
              </label>
              <DatePicker
                value={form.startDate}
                onChange={(v) => setForm((f) => ({ ...f, startDate: v }))}
                placeholder="Select start date"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                End Date *
              </label>
              <DatePicker
                value={form.endDate}
                onChange={(v) => setForm((f) => ({ ...f, endDate: v }))}
                placeholder="Select end date"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Budget (CAD) *
              </label>
              <input
                type="number"
                min={0}
                value={form.budgetUsd}
                onChange={(e) => setForm((f) => ({ ...f, budgetUsd: e.target.value }))}
                className="w-full h-10 border rounded-md px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="e.g. 500000"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Business Sponsor *
              </label>
              <input
                value={form.businessSponsor}
                onChange={(e) => setForm((f) => ({ ...f, businessSponsor: e.target.value }))}
                className="w-full h-10 border rounded-md px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Sponsor name"
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t shrink-0">
          {isEdit && (
            <div className="mr-auto">
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-rose-600">Are you sure?</span>
                  <button
                    type="button"
                    onClick={() => deleteInitiative.mutate({ id: initiative!.id })}
                    disabled={deleteInitiative.isPending}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {deleteInitiative.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                    Confirm Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="initiative-form"
            onClick={handleSubmit}
            disabled={isPending || !form.name}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {(create.isPending || update.isPending) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isEdit ? "Save Changes" : "Create Initiative"}
          </button>
        </div>
      </div>
    </div>
  );
}
