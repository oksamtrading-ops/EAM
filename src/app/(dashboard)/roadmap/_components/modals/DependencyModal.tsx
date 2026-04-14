"use client";

import { useState } from "react";
import { X, Loader2, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { useRoadmapContext } from "../RoadmapContext";

export function DependencyModal({
  open,
  defaultDependentId,
  onClose,
}: {
  open: boolean;
  defaultDependentId?: string;
  onClose: () => void;
}) {
  const { roadmap } = useRoadmapContext();
  const initiatives = roadmap?.initiatives ?? [];

  const [dependentId, setDependentId] = useState(defaultDependentId ?? "");
  const [blockingId, setBlockingId] = useState("");
  const [dependencyType, setDependencyType] = useState("FINISH_TO_START");
  const [lagDays, setLagDays] = useState(0);
  const [notes, setNotes] = useState("");

  const utils = trpc.useUtils();
  const addDep = trpc.initiative.addDependency.useMutation({
    onSuccess: () => {
      toast.success("Dependency added");
      utils.initiative.getRoadmapData.invalidate();
      onClose();
    },
    onError: (e) => {
      toast.error(e.message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dependentId || !blockingId) return;
    addDep.mutate({
      dependentId,
      blockingId,
      dependencyType: dependencyType as any,
      lagDays,
      notes: notes || undefined,
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-background rounded-xl shadow-2xl w-[calc(100%-1.5rem)] sm:w-[440px] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-sm">Add Dependency</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 flex gap-2 text-xs text-amber-700">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Circular dependencies are automatically detected and blocked.</span>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Dependent Initiative (this one needs the other to complete first)
            </label>
            <select
              required
              value={dependentId}
              onChange={(e) => setDependentId(e.target.value)}
              className="w-full border rounded-md px-2 py-2 text-sm focus:outline-none"
            >
              <option value="">Select…</option>
              {initiatives.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Blocking Initiative (must complete / start first)
            </label>
            <select
              required
              value={blockingId}
              onChange={(e) => setBlockingId(e.target.value)}
              className="w-full border rounded-md px-2 py-2 text-sm focus:outline-none"
            >
              <option value="">Select…</option>
              {initiatives
                .filter((i) => i.id !== dependentId)
                .map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Dependency Type
              </label>
              <select
                value={dependencyType}
                onChange={(e) => setDependencyType(e.target.value)}
                className="w-full border rounded-md px-2 py-2 text-sm focus:outline-none"
              >
                <option value="FINISH_TO_START">Finish → Start</option>
                <option value="FINISH_TO_FINISH">Finish → Finish</option>
                <option value="START_TO_START">Start → Start</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Lag Days
              </label>
              <input
                type="number"
                min={0}
                value={lagDays}
                onChange={(e) => setLagDays(Number(e.target.value))}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Notes
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none"
              placeholder="Optional explanation"
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
              disabled={addDep.isPending || !dependentId || !blockingId}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {addDep.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Add Dependency
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
