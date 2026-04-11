"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { MilestoneRow } from "../shared/MilestoneRow";
import { MilestoneFormModal } from "../modals/MilestoneFormModal";

export function MilestonePanel({ initiativeId }: { initiativeId: string }) {
  const [showCreate, setShowCreate] = useState(false);
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

  const milestones = initiative?.milestones ?? [];

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
            />
          ))
        )}
      </div>

      <MilestoneFormModal
        open={showCreate}
        initiativeId={initiativeId}
        onClose={() => setShowCreate(false)}
      />
    </div>
  );
}
