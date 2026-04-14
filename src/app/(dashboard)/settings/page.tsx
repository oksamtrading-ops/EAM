"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Save,
  AlertTriangle,
  Power,
  PowerOff,
  Trash2,
  Star,
} from "lucide-react";
import { PageSearchTrigger } from "@/app/(dashboard)/_components/PageSearchTrigger";

const INDUSTRIES = [
  { value: "BANKING", label: "Banking & Financial Services" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "RETAIL", label: "Retail & Consumer" },
  { value: "LOGISTICS", label: "Logistics & Supply Chain" },
  { value: "MANUFACTURING", label: "Manufacturing" },
  { value: "HEALTHCARE", label: "Healthcare" },
  { value: "PHARMA_LIFESCIENCES", label: "Pharma & Life Sciences" },
  { value: "TELECOM", label: "Telecommunications" },
  { value: "ENERGY_UTILITIES", label: "Energy & Utilities" },
  { value: "PUBLIC_SECTOR", label: "Public Sector" },
  { value: "GENERIC", label: "Generic / Cross-Industry" },
  { value: "ENTERPRISE_BCM", label: "Enterprise BCM" },
];

export default function SettingsPage() {
  const { workspaceId, workspaces, switchWorkspace } = useWorkspace();
  const { data: workspace, isLoading } = trpc.workspace.getOrCreate.useQuery();
  const utils = trpc.useUtils();

  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState("GENERIC");

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

  useEffect(() => {
    if (workspace) {
      setName(workspace.name);
      setClientName(workspace.clientName ?? "");
      setDescription(workspace.description ?? "");
      setIndustry(workspace.industry);
    }
  }, [workspace]);

  const updateMutation = trpc.workspace.update.useMutation({
    onSuccess: () => {
      utils.workspace.getOrCreate.invalidate();
      toast.success("Settings saved");
    },
    onError: (err) => toast.error(err.message),
  });

  const setDefaultMutation = trpc.workspace.setDefault.useMutation({
    onSuccess: () => {
      toast.success("Set as default workspace");
      utils.workspace.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deactivateMutation = trpc.workspace.deactivate.useMutation({
    onSuccess: () => {
      toast.success("Workspace deactivated");
      // Switch to another active workspace
      const next = workspaces.find(
        (w) => w.id !== workspaceId && w.isActive
      );
      if (next) {
        switchWorkspace(next.id);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.workspace.delete.useMutation({
    onSuccess: () => {
      toast.success("Workspace permanently deleted");
      // Switch to another workspace
      const next = workspaces.find(
        (w) => w.id !== workspaceId && w.isActive
      );
      if (next) {
        switchWorkspace(next.id);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const isOnlyWorkspace = workspaces.filter((w) => w.isActive).length <= 1;
  const currentWs = workspaces.find((w) => w.id === workspaceId);

  return (
    <div className="max-w-2xl p-6 space-y-8">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#1a1f2e] tracking-tight">
            Workspace Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure your workspace details and industry context.
          </p>
        </div>
        <PageSearchTrigger />
      </div>

      {/* General settings */}
      <div className="bg-white rounded-xl border p-6 space-y-5">
        <h2 className="text-sm font-semibold text-[#1a1f2e]">General</h2>

        <div>
          <Label className="text-sm font-medium">Workspace Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. ACME Corp Engagement"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label className="text-sm font-medium">Client Name</Label>
          <Input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="e.g. ACME Corporation"
            className="mt-1.5"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Used in AI-generated reports and exports.
          </p>
        </div>

        <div>
          <Label className="text-sm font-medium">Industry</Label>
          <Select
            value={industry}
            onValueChange={(v) => setIndustry(v ?? "GENERIC")}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRIES.map((ind) => (
                <SelectItem key={ind.value} value={ind.value}>
                  {ind.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            Determines which templates and AI suggestions are most relevant.
          </p>
        </div>

        <div>
          <Label className="text-sm font-medium">Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this engagement..."
            rows={3}
            className="mt-1.5"
          />
        </div>

        <Button
          onClick={() =>
            updateMutation.mutate({
              id: workspaceId,
              name: name.trim(),
              clientName: clientName.trim() || undefined,
              description: description.trim() || undefined,
              industry: industry as any,
            })
          }
          disabled={updateMutation.isPending || !name.trim()}
          className="bg-[#0B5CD6] hover:bg-[#094cb0] text-white"
        >
          <Save className="h-4 w-4 mr-2" />
          {updateMutation.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>

      {/* Workspace actions */}
      <div className="bg-white rounded-xl border p-6 space-y-5">
        <h2 className="text-sm font-semibold text-[#1a1f2e]">
          Workspace Actions
        </h2>

        {/* Set as default */}
        {currentWs && !currentWs.isDefault && (
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="text-sm font-medium text-[#1a1f2e]">
                Set as Default Workspace
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                This workspace will open automatically when you sign in.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDefaultMutation.mutate({ id: workspaceId })}
              disabled={setDefaultMutation.isPending}
            >
              <Star className="h-3.5 w-3.5 mr-1.5" />
              Set Default
            </Button>
          </div>
        )}

        {currentWs?.isDefault && (
          <div className="flex items-center gap-2 py-3 border-b text-sm text-muted-foreground">
            <Star className="h-4 w-4 text-[#0B5CD6]" />
            This is your default workspace.
          </div>
        )}

        {/* Deactivate */}
        <div className="flex items-center justify-between py-3 border-b">
          <div>
            <p className="text-sm font-medium text-[#1a1f2e]">
              Deactivate Workspace
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Hide this workspace from the switcher. Data is preserved and can
              be reactivated later.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => deactivateMutation.mutate({ id: workspaceId })}
            disabled={deactivateMutation.isPending || isOnlyWorkspace}
            className="text-amber-600 border-amber-200 hover:bg-amber-50"
          >
            <PowerOff className="h-3.5 w-3.5 mr-1.5" />
            {deactivateMutation.isPending ? "Deactivating..." : "Deactivate"}
          </Button>
        </div>
        {isOnlyWorkspace && (
          <p className="text-xs text-amber-600">
            You cannot deactivate your only active workspace. Create another
            workspace first.
          </p>
        )}
      </div>

      {/* Danger zone */}
      <div className="bg-white rounded-xl border border-red-200 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <h2 className="text-sm font-semibold text-red-600">Danger Zone</h2>
        </div>

        <div>
          <p className="text-sm font-medium text-[#1a1f2e]">
            Delete Workspace
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Permanently delete this workspace and all its data. This action
            cannot be undone.
          </p>
        </div>

        {!showDeleteConfirm ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isOnlyWorkspace}
            className="text-red-600 border-red-200 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Delete this workspace
          </Button>
        ) : (
          <div className="border border-red-200 rounded-lg p-4 bg-red-50/50 space-y-3">
            <p className="text-sm text-red-700">
              To confirm, type{" "}
              <strong className="font-mono bg-red-100 px-1.5 py-0.5 rounded">
                {workspace?.name}
              </strong>{" "}
              below:
            </p>
            <input
              type="text"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder="Type workspace name to confirm"
              className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmName("");
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={
                  deleteConfirmName !== workspace?.name ||
                  deleteMutation.isPending
                }
                onClick={() =>
                  deleteMutation.mutate({
                    id: workspaceId,
                    confirmName: deleteConfirmName,
                  })
                }
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleteMutation.isPending
                  ? "Deleting..."
                  : "I understand, delete this workspace"}
              </Button>
            </div>
          </div>
        )}

        {isOnlyWorkspace && !showDeleteConfirm && (
          <p className="text-xs text-red-500">
            You cannot delete your only workspace. Create another workspace
            first.
          </p>
        )}
      </div>
    </div>
  );
}
