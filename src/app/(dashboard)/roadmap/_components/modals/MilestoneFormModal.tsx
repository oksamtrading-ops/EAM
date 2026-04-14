"use client";

import { useState } from "react";
import { X, Loader2, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { DatePicker } from "../shared/DatePicker";

type MilestoneData = {
  id: string;
  name: string;
  description?: string | null;
  dueDate?: Date | null;
  isCritical: boolean;
  status: string;
};

export function MilestoneFormModal({
  open,
  initiativeId,
  milestone,
  onClose,
  onDelete,
}: {
  open: boolean;
  initiativeId: string;
  milestone?: MilestoneData;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const isEdit = !!milestone;
  const [form, setForm] = useState({
    name: milestone?.name ?? "",
    description: milestone?.description ?? "",
    dueDate: milestone?.dueDate
      ? new Date(milestone.dueDate).toISOString().split("T")[0]
      : "",
    isCritical: milestone?.isCritical ?? false,
  });

  const utils = trpc.useUtils();

  const create = trpc.milestone.create.useMutation({
    onSuccess: () => {
      toast.success("Milestone added");
      utils.initiative.getById.invalidate({ id: initiativeId });
      utils.initiative.getRoadmapData.invalidate();
      onClose();
      setForm({ name: "", description: "", dueDate: "", isCritical: false });
    },
    onError: (e) => toast.error(e.message),
  });

  const update = trpc.milestone.update.useMutation({
    onSuccess: () => {
      toast.success("Milestone updated");
      utils.initiative.getById.invalidate({ id: initiativeId });
      utils.initiative.getRoadmapData.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const dueDateIso = form.dueDate ? new Date(form.dueDate).toISOString() : undefined;
    if (isEdit) {
      update.mutate({
        id: milestone!.id,
        name: form.name,
        description: form.description || undefined,
        dueDate: dueDateIso,
        isCritical: form.isCritical,
      });
    } else {
      create.mutate({
        initiativeId,
        name: form.name,
        description: form.description || undefined,
        dueDate: dueDateIso,
        isCritical: form.isCritical,
      });
    }
  }

  if (!open) return null;
  const isPending = create.isPending || update.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-background rounded-xl shadow-2xl w-[calc(100%-1.5rem)] sm:w-[400px] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-sm">
            {isEdit ? "Edit Milestone" : "Add Milestone"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Name *
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full h-10 border rounded-md px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Milestone name"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Description
            </label>
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full h-10 border rounded-md px-3 text-sm focus:outline-none"
              placeholder="Optional description"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Due Date
            </label>
            <DatePicker
              value={form.dueDate}
              onChange={(v) => setForm((f) => ({ ...f, dueDate: v }))}
              placeholder="Select due date"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isCritical}
              onChange={(e) => setForm((f) => ({ ...f, isCritical: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm">Critical path milestone</span>
          </label>

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            {isEdit && onDelete && (
              <button
                type="button"
                onClick={() => { onDelete(); onClose(); }}
                className="mr-auto flex items-center gap-1.5 px-3 py-2 text-sm text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
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
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isEdit ? "Save Changes" : "Add Milestone"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
