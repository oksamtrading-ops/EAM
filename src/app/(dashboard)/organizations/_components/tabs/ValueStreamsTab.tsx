"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Plus, Workflow, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ValueStreamFormModal } from "../modals/ValueStreamFormModal";

export function ValueStreamsTab() {
  const { data: streams, isLoading } =
    trpc.capability.listValueStreams.useQuery();
  const utils = trpc.useUtils();

  const [showForm, setShowForm] = useState(false);
  const [editStream, setEditStream] = useState<any>(null);

  const deleteMutation = trpc.capability.deleteValueStream.useMutation({
    onSuccess: () => {
      toast.success("Value stream deleted");
      utils.capability.listValueStreams.invalidate();
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

  const list = streams ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {list.length} value stream{list.length !== 1 ? "s" : ""}
        </p>
        <Button
          onClick={() => {
            setEditStream(null);
            setShowForm(true);
          }}
          className="bg-primary hover:bg-primary/90 text-white"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add Value Stream
        </Button>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        {list.length === 0 ? (
          <div className="p-8 text-center">
            <Workflow className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-1">
              No value streams defined yet.
            </p>
            <p className="text-xs text-muted-foreground">
              Value streams represent end-to-end business flows. Assign them to
              L1 capabilities.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {list.map((vs) => (
              <div
                key={vs.id}
                className="flex items-center justify-between px-5 py-4 hover:bg-muted/20 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="h-4 w-4 rounded-full shrink-0"
                    style={{ backgroundColor: vs.color }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {vs.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {vs._count.capabilities} capabilities
                      {vs.description ? ` \u00B7 ${vs.description}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => {
                      setEditStream(vs);
                      setShowForm(true);
                    }}
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (
                        vs._count.capabilities > 0 &&
                        !confirm(
                          `"${vs.name}" has ${vs._count.capabilities} capabilities assigned. Delete anyway?`
                        )
                      )
                        return;
                      deleteMutation.mutate({ id: vs.id });
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

      <ValueStreamFormModal
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditStream(null);
        }}
        valueStream={editStream ?? undefined}
      />
    </div>
  );
}
