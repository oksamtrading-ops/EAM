"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Building2, Edit } from "lucide-react";
import { toast } from "sonner";
import { PageSearchTrigger } from "@/app/(dashboard)/_components/PageSearchTrigger";

// We need an org router — let's add inline fetch for now
// using the capability router's workspace context

export default function OrganizationsPage() {
  const { workspaceId } = useWorkspace();
  const [showCreate, setShowCreate] = useState(false);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch orgs directly since we don't have an org tRPC router yet
  // For POC, we'll use a simple fetch approach
  const { data: tree } = trpc.capability.getTree.useQuery();

  // Extract unique organizations from capabilities
  const orgMap = new Map<string, { id: string; name: string; capCount: number }>();
  function walkTree(nodes: any[]) {
    for (const node of nodes) {
      if (node.organization) {
        const existing = orgMap.get(node.organization.id);
        orgMap.set(node.organization.id, {
          id: node.organization.id,
          name: node.organization.name,
          capCount: (existing?.capCount ?? 0) + 1,
        });
      }
      if (node.children) walkTree(node.children);
    }
  }
  if (tree) walkTree(tree);
  const orgList = Array.from(orgMap.values());

  return (
    <div className="max-w-2xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-[#1a1f2e] tracking-tight">
              Business Units
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage organizational units that own capabilities.
            </p>
          </div>
          <PageSearchTrigger />
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-[#0B5CD6] hover:bg-[#094cb0] text-white"
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
              Business units are assigned to capabilities to track ownership.
              Create one and assign it via the capability detail panel.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {orgList.map((org) => (
              <div
                key={org.id}
                className="flex items-center justify-between px-5 py-4 hover:bg-[#fafbfc]"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-[#1a1f2e]/5 flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-[#1a1f2e]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1a1f2e]">
                      {org.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {org.capCount} capabilities assigned
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-[#fafbfc] rounded-xl border border-dashed p-5">
        <h3 className="text-sm font-medium text-[#1a1f2e] mb-2">
          How to assign business units
        </h3>
        <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Go to the Capabilities page</li>
          <li>Click on any capability to open the detail panel</li>
          <li>Use the "Organization" dropdown to assign a business unit</li>
        </ol>
      </div>

      <CreateOrgDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        workspaceId={workspaceId}
      />
    </div>
  );
}

function CreateOrgDialog({
  open,
  onClose,
  workspaceId,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      // Direct DB call via API route would be ideal, but for POC
      // we'll show a toast guiding the user
      toast.info(
        "Business unit creation via the Organizations page is coming soon. For now, business units are created automatically when assigned to capabilities."
      );
      onClose();
    } finally {
      setSaving(false);
      setName("");
      setDescription("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Business Unit</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Retail Banking Division"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this unit..."
              rows={2}
              className="mt-1.5"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || saving}
              className="bg-[#0B5CD6] hover:bg-[#094cb0] text-white"
            >
              Create
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
