"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

export function MilestoneFormModal({
  open,
  initiativeId,
  onClose,
}: {
  open: boolean;
  initiativeId: string;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    dueDate: "",
    isCritical: false,
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate({
      initiativeId,
      name: form.name,
      description: form.description || undefined,
      dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
      isCritical: form.isCritical,
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-background rounded-xl shadow-2xl w-[400px] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-sm">Add Milestone</h2>
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
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#86BC25]"
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
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none"
              placeholder="Optional description"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Due Date
            </label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none"
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
              Add Milestone
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
