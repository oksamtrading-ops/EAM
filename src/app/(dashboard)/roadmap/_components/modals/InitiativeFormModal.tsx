"use client";

import { useState } from "react";
import { X, Loader2, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
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
  budgetCurrency: "USD",
  businessSponsor: "",
  ragStatus: "GREEN",
};

const CURRENCIES = [
  { code: "USD", label: "USD — US Dollar" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "JPY", label: "JPY — Japanese Yen" },
  { code: "CAD", label: "CAD — Canadian Dollar" },
];

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

export function InitiativeFormModal({
  open,
  onClose,
  initiative,
}: {
  open: boolean;
  onClose: () => void;
  initiative?: InitiativeData;
}) {
  const isEdit = !!initiative;
  const [form, setForm] = useState({
    name: initiative?.name ?? "",
    description: initiative?.description ?? "",
    category: initiative?.category ?? "MODERNISATION",
    status: initiative?.status ?? "DRAFT",
    priority: initiative?.priority ?? "MEDIUM",
    horizon: initiative?.horizon ?? "H2_NEXT",
    startDate: initiative?.startDate
      ? new Date(initiative.startDate).toISOString().split("T")[0]
      : "",
    endDate: initiative?.endDate
      ? new Date(initiative.endDate).toISOString().split("T")[0]
      : "",
    budgetUsd: initiative?.budgetUsd ? String(Number(initiative.budgetUsd)) : "",
    budgetCurrency: (initiative as any)?.budgetCurrency ?? "USD",
    businessSponsor: initiative?.businessSponsor ?? "",
    ragStatus: initiative?.ragStatus ?? "GREEN",
  });
  const [loadingAI, setLoadingAI] = useState(false);

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

  const { data: capabilities } = trpc.capability.getTree.useQuery();
  const { data: objectives } = trpc.objective.list.useQuery();

  async function handleAISuggest() {
    setLoadingAI(true);
    try {
      const res = await fetch("/api/ai/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "suggest-initiatives",
          payload: {
            clientName: "Client",
            industry: "Enterprise",
            planningHorizon: "36 months",
            capabilities: [],
            retireCandidates: [],
            redundancies: [],
            capabilityGaps: [],
          },
        }),
      });
      const data = await res.json();
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
        toast.success("AI suggestion applied");
      }
    } catch {
      toast.error("AI suggestion failed");
    } finally {
      setLoadingAI(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name,
      description: form.description || undefined,
      category: form.category as any,
      status: form.status as any,
      priority: form.priority as any,
      horizon: form.horizon as any,
      startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
      endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
      budgetUsd: form.budgetUsd ? Number(form.budgetUsd) : undefined,
      budgetCurrency: form.budgetCurrency,
      businessSponsor: form.businessSponsor || undefined,
    };
    if (isEdit) {
      update.mutate({ id: initiative!.id, ...payload, ragStatus: form.ragStatus as any });
    } else {
      create.mutate(payload);
    }
  }

  if (!open) return null;
  const isPending = create.isPending || update.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-background rounded-xl shadow-2xl w-[560px] max-h-[90vh] flex flex-col overflow-hidden">
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
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#86BC25]"
              placeholder="Initiative name"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#86BC25] resize-none"
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
                className="w-full border rounded-md px-2 py-2 text-sm focus:outline-none"
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
                className="w-full border rounded-md px-2 py-2 text-sm focus:outline-none"
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
                className="w-full border rounded-md px-2 py-2 text-sm focus:outline-none"
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
                  className="w-full border rounded-md px-2 py-2 text-sm focus:outline-none"
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
                  className="w-full border rounded-md px-2 py-2 text-sm focus:outline-none"
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
                Start Date
              </label>
              <DatePicker
                value={form.startDate}
                onChange={(v) => setForm((f) => ({ ...f, startDate: v }))}
                placeholder="Select start date"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                End Date
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
                Budget
              </label>
              <div className="flex gap-1.5">
                <select
                  value={form.budgetCurrency}
                  onChange={(e) => setForm((f) => ({ ...f, budgetCurrency: e.target.value }))}
                  className="border rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#86BC25] w-24 shrink-0"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.code}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  value={form.budgetUsd}
                  onChange={(e) => setForm((f) => ({ ...f, budgetUsd: e.target.value }))}
                  className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#86BC25]"
                  placeholder="e.g. 500000"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Business Sponsor
              </label>
              <input
                value={form.businessSponsor}
                onChange={(e) => setForm((f) => ({ ...f, businessSponsor: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none"
                placeholder="Sponsor name"
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t shrink-0">
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
            className="flex items-center gap-2 px-4 py-2 bg-[#86BC25] text-white text-sm font-semibold rounded-md hover:bg-[#76a820] disabled:opacity-50 transition-colors"
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isEdit ? "Save Changes" : "Create Initiative"}
          </button>
        </div>
      </div>
    </div>
  );
}
