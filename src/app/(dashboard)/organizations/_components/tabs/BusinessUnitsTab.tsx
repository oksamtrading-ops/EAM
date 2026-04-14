"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Plus, Building2, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { OrgFormModal } from "../modals/OrgFormModal";

export function BusinessUnitsTab() {
  const { data: orgs, isLoading } = trpc.organization.list.useQuery();
  const utils = trpc.useUtils();

  const [showForm, setShowForm] = useState(false);
  const [editOrg, setEditOrg] = useState<any>(null);

  const deleteMutation = trpc.organization.delete.useMutation({
    onSuccess: () => {
      toast.success("Business unit deleted");
      utils.organization.list.invalidate();
      utils.capability.getTree.invalidate();
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

  const orgList = orgs ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {orgList.length} business unit{orgList.length !== 1 ? "s" : ""}
        </p>
        <Button
          onClick={() => {
            setEditOrg(null);
            setShowForm(true);
          }}
          className="bg-[#0B5CD6] hover:bg-[#094cb0] text-white"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add Business Unit
        </Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {orgList.length === 0 ? (
          <div className="p-8 text-center">
            <Building2 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-1">
              No business units defined yet.
            </p>
            <p className="text-xs text-muted-foreground">
              Create business units and assign them to capabilities to track
              ownership.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {orgList.map((org) => (
              <div
                key={org.id}
                className="flex items-center justify-between px-5 py-4 hover:bg-[#fafbfc] group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-[#1a1f2e]/5 flex items-center justify-center shrink-0">
                    <Building2 className="h-4 w-4 text-[#1a1f2e]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1a1f2e] truncate">
                      {org.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {org._count.capabilities} capabilities
                      {org.parent ? ` \u00B7 under ${org.parent.name}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => {
                      setEditOrg(org);
                      setShowForm(true);
                    }}
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (
                        org._count.capabilities > 0 &&
                        !confirm(
                          `"${org.name}" has ${org._count.capabilities} capabilities assigned. Delete anyway?`
                        )
                      )
                        return;
                      deleteMutation.mutate({ id: org.id });
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

      <OrgFormModal
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditOrg(null);
        }}
        org={editOrg ?? undefined}
      />
    </div>
  );
}
