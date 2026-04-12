"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { MilestoneRow } from "../shared/MilestoneRow";
import { MilestoneFormModal } from "../modals/MilestoneFormModal";

type MilestoneData = {
  id: string;
  name: string;
  description?: string | null;
  dueDate?: Date | null;
  isCritical: boolean;
  status: string;
};

export function MilestonePanel({ initiativeId }: { initiativeId: string }) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<MilestoneData | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const { data: initiative } = trpc.initiative.getById.useQuery({
    id: initiativeId,
  });

  const completeMutation = trpc.milestone.complete.useMutation({
    onSuccess: () => {
      utils.initiative.getById.invalidate({ id: initiativeId });
      utils.initiative.getRoadmapData.invalidate();
    },
  });

  const revertMutation = trpc.milestone.update.useMutation({
    onSuccess: () => {
      utils.initiative.getById.invalidate({ id: initiativeId });
      utils.initiative.getRoadmapData.invalidate();
    },
  });

  const deleteMutation = trpc.milestone.delete.useMutation({
    onSuccess: () => {
      toast.success("Milestone deleted");
      utils.initiative.getById.invalidate({ id: initiativeId });
      utils.initiative.getRoadmapData.invalidate();
      setDeletingId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const milestones = initiative?.milestones ?? [];

  function handleDeleteRequest(id: string) {
    setDeletingId(id);
  }

  function confirmDelete() {
    if (deletingId) deleteMutation.mutate({ id: deletingId });
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Milestones ({milestones.length})
        </h3>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>

      <div className="space-y-0.5">
        {milestones.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center">
            No milestones yet
          </p>
        ) : (
          milestones.map((m) => (
            <MilestoneRow
              key={m.id}
              milestone={m as any}
              onComplete={(id) => completeMutation.mutate({ id })}
              onRevert={(id) => revertMutation.mutate({ id, status: "NOT_STARTED" })}
              onEdit={(ms) => setEditingMilestone(ms as MilestoneData)}
              onDelete={handleDeleteRequest}
            />
          ))
        )}
      </div>

      {/* Delete confirmation */}
      {deletingId && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 flex items-center justify-between gap-2">
          <p className="text-xs text-rose-700">Delete this milestone?</p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="px-2.5 py-1 rounded-md bg-rose-500 hover:bg-rose-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
            >
              Delete
            </button>
            <button
              onClick={() => setDeletingId(null)}
              className="px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <MilestoneFormModal
        open={showCreate}
        initiativeId={initiativeId}
        onClose={() => setShowCreate(false)}
      />

      {editingMilestone && (
        <MilestoneFormModal
          open={!!editingMilestone}
          initiativeId={initiativeId}
          milestone={editingMilestone}
          onClose={() => setEditingMilestone(null)}
          onDelete={() => {
            setEditingMilestone(null);
            handleDeleteRequest(editingMilestone.id);
          }}
        />
      )}
    </div>
  );
}
