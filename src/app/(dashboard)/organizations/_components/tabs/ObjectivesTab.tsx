"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Plus, Target, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ObjectiveFormModal } from "@/components/shared/ObjectiveFormModal";
import { format } from "date-fns";

export function ObjectivesTab() {
  const { data: objectives, isLoading } = trpc.objective.list.useQuery();
  const utils = trpc.useUtils();

  const [showForm, setShowForm] = useState(false);
  const [editObj, setEditObj] = useState<any>(null);

  const deleteMutation = trpc.objective.delete.useMutation({
    onSuccess: () => {
      toast.success("Objective deleted");
      utils.objective.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="animate-pulse text-muted-foreground text-sm">
        Loading...
      </div>
    );
  }

  const list = objectives ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {list.length} strategic objective{list.length !== 1 ? "s" : ""}
        </p>
        <Button
          onClick={() => {
            setEditObj(null);
            setShowForm(true);
          }}
          className="bg-[#0B5CD6] hover:bg-[#094cb0] text-white"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add Objective
        </Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {list.length === 0 ? (
          <div className="p-8 text-center">
            <Target className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-1">
              No strategic objectives defined yet.
            </p>
            <p className="text-xs text-muted-foreground">
              Define objectives and link them to capabilities and initiatives to
              track strategic alignment.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {list.map((obj) => (
              <div
                key={obj.id}
                className="flex items-center justify-between px-5 py-4 hover:bg-[#fafbfc] group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-[#0B5CD6]/5 flex items-center justify-center shrink-0">
                    <Target className="h-4 w-4 text-[#0B5CD6]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1a1f2e] truncate">
                      {obj.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {obj.targetDate && (
                        <span>
                          Target:{" "}
                          {format(new Date(obj.targetDate), "MMM yyyy")}
                        </span>
                      )}
                      {obj.kpiDescription && (
                        <span>
                          {obj.targetDate ? "\u00B7 " : ""}KPI:{" "}
                          {obj.kpiDescription}
                          {obj.kpiTarget ? ` (${obj.kpiTarget})` : ""}
                        </span>
                      )}
                      {obj.initiatives.length > 0 && (
                        <span>
                          {obj.targetDate || obj.kpiDescription
                            ? "\u00B7 "
                            : ""}
                          {obj.initiatives.length} initiative
                          {obj.initiatives.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => {
                      setEditObj(obj);
                      setShowForm(true);
                    }}
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (
                        !confirm(
                          `Delete objective "${obj.name}"? This will unlink it from all capabilities and initiatives.`
                        )
                      )
                        return;
                      deleteMutation.mutate({ id: obj.id });
                    }}
                    className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ObjectiveFormModal
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditObj(null);
        }}
        objective={editObj ?? undefined}
        onDeleted={() => setEditObj(null)}
      />
    </div>
  );
}
