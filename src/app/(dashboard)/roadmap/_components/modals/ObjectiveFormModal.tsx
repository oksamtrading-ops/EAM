"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

export function ObjectiveFormModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    targetDate: "",
    kpiDescription: "",
    kpiTarget: "",
  });

  const utils = trpc.useUtils();
  const create = trpc.objective.create.useMutation({
    onSuccess: () => {
      toast.success("Objective created");
      utils.objective.list.invalidate();
      onClose();
      setForm({ name: "", description: "", targetDate: "", kpiDescription: "", kpiTarget: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate({
      name: form.name,
      description: form.description || undefined,
      targetDate: form.targetDate ? new Date(form.targetDate).toISOString() : undefined,
      kpiDescription: form.kpiDescription || undefined,
      kpiTarget: form.kpiTarget || undefined,
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-background rounded-xl shadow-2xl w-[440px] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-sm">New Strategic Objective</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Objective *
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#86BC25]"
              placeholder="e.g. Reduce IT cost by 20% by 2026"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                KPI
              </label>
              <input
                value={form.kpiDescription}
                onChange={(e) => setForm((f) => ({ ...f, kpiDescription: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none"
                placeholder="e.g. IT spend ratio"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                KPI Target
              </label>
              <input
                value={form.kpiTarget}
                onChange={(e) => setForm((f) => ({ ...f, kpiTarget: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none"
                placeholder="e.g. 20% reduction"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Target Date
            </label>
            <input
              type="date"
              value={form.targetDate}
              onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={create.isPending || !form.name}
              className="flex items-center gap-2 px-4 py-2 bg-[#86BC25] text-white text-sm font-semibold rounded-md hover:bg-[#76a820] disabled:opacity-50"
            >
              {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create Objective
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
