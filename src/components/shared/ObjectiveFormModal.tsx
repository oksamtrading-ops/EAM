"use client";

import { useState } from "react";
import { X, Loader2, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { DatePicker } from "@/app/(dashboard)/roadmap/_components/shared/DatePicker";

type Objective = {
  id: string;
  name: string;
  description?: string | null;
  targetDate?: Date | string | null;
  kpiDescription?: string | null;
  kpiTarget?: string | null;
};

export function ObjectiveFormModal({
  open,
  onClose,
  objective,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  objective?: Objective;
  onDeleted?: () => void;
}) {
  const isEdit = !!objective;
  const [form, setForm] = useState({
    name: objective?.name ?? "",
    description: objective?.description ?? "",
    targetDate: objective?.targetDate
      ? new Date(objective.targetDate).toISOString().split("T")[0]
      : "",
    kpiDescription: objective?.kpiDescription ?? "",
    kpiTarget: objective?.kpiTarget ?? "",
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  const update = trpc.objective.update.useMutation({
    onSuccess: () => {
      toast.success("Objective updated");
      utils.objective.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteObjective = trpc.objective.delete.useMutation({
    onSuccess: () => {
      toast.success("Objective deleted");
      utils.objective.list.invalidate();
      onClose();
      onDeleted?.();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isEdit && objective) {
      update.mutate({
        id: objective.id,
        name: form.name,
        description: form.description || null,
        targetDate: form.targetDate ? new Date(form.targetDate).toISOString() : null,
        kpiDescription: form.kpiDescription || null,
        kpiTarget: form.kpiTarget || null,
      });
    } else {
      create.mutate({
        name: form.name,
        description: form.description || undefined,
        targetDate: form.targetDate ? new Date(form.targetDate).toISOString() : undefined,
        kpiDescription: form.kpiDescription || undefined,
        kpiTarget: form.kpiTarget || undefined,
      });
    }
  }

  if (!open) return null;

  const isPending = create.isPending || update.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-background rounded-xl shadow-2xl w-[calc(100%-1.5rem)] sm:w-[440px] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-sm">
            {isEdit ? "Edit Strategic Objective" : "New Strategic Objective"}
          </h2>
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
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B5CD6]"
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
            <DatePicker
              value={form.targetDate}
              onChange={(v) => setForm((f) => ({ ...f, targetDate: v }))}
              placeholder="Select target date"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            {isEdit && (
              <div className="mr-auto">
                {confirmDelete ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Are you sure?</span>
                    <button
                      type="button"
                      onClick={() => deleteObjective.mutate({ id: objective!.id })}
                      disabled={deleteObjective.isPending}
                      className="text-xs text-white bg-rose-500 hover:bg-rose-600 px-2 py-1 rounded font-medium disabled:opacity-50"
                    >
                      {deleteObjective.isPending ? "..." : "Confirm Delete"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="text-xs text-muted-foreground hover:text-foreground px-1"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 px-2 py-1 rounded hover:bg-rose-50"
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
              className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !form.name}
              className="flex items-center gap-2 px-4 py-2 bg-[#0B5CD6] text-white text-sm font-semibold rounded-md hover:bg-[#094cb0] disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isEdit ? "Save Changes" : "Create Objective"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
