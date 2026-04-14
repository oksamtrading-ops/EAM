"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "sonner";

const INDUSTRIES = [
  { value: "GENERIC", label: "Generic" },
  { value: "BANKING", label: "Banking" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "RETAIL", label: "Retail" },
  { value: "LOGISTICS", label: "Logistics" },
  { value: "MANUFACTURING", label: "Manufacturing" },
  { value: "HEALTHCARE", label: "Healthcare" },
  { value: "PHARMA_LIFESCIENCES", label: "Pharma & Life Sciences" },
  { value: "TELECOM", label: "Telecommunications" },
  { value: "ENERGY_UTILITIES", label: "Energy & Utilities" },
  { value: "PUBLIC_SECTOR", label: "Public Sector" },
  { value: "ENTERPRISE_BCM", label: "Enterprise BCM" },
] as const;

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreateWorkspaceDialog({ open, onClose }: Props) {
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState<string>("GENERIC");
  const { switchWorkspace } = useWorkspace();

  const createMutation = trpc.workspace.create.useMutation({
    onSuccess: (ws) => {
      toast.success(`Workspace "${ws.name}" created`);
      handleClose();
      // Switch to the new workspace
      switchWorkspace(ws.id);
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to create workspace");
    },
  });

  function handleClose() {
    setName("");
    setClientName("");
    setDescription("");
    setIndustry("GENERIC");
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({
      name: name.trim(),
      clientName: clientName.trim() || undefined,
      description: description.trim() || undefined,
      industry: industry as any,
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Workspace</DialogTitle>
          <DialogDescription>
            Each workspace is an isolated environment for a client or project.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Workspace name */}
          <div>
            <label className="text-xs font-medium text-foreground">
              Workspace Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. ACME Corp EA Engagement"
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              autoFocus
              maxLength={100}
            />
          </div>

          {/* Client name */}
          <div>
            <label className="text-xs font-medium text-foreground">
              Client Name
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. ACME Corporation"
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              maxLength={100}
            />
          </div>

          {/* Industry */}
          <div>
            <label className="text-xs font-medium text-foreground">
              Industry
            </label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary bg-card"
            >
              {INDUSTRIES.map((ind) => (
                <option key={ind.value} value={ind.value}>
                  {ind.label}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-foreground">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this workspace..."
              rows={2}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-none"
              maxLength={500}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!name.trim() || createMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Workspace"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
