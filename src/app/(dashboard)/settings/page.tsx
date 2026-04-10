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
import { Save } from "lucide-react";

const INDUSTRIES = [
  { value: "BANKING", label: "Banking & Financial Services" },
  { value: "RETAIL", label: "Retail & Consumer" },
  { value: "LOGISTICS", label: "Logistics & Supply Chain" },
  { value: "MANUFACTURING", label: "Manufacturing" },
  { value: "HEALTHCARE", label: "Healthcare" },
  { value: "GENERIC", label: "Generic / Cross-Industry" },
];

export default function SettingsPage() {
  const { workspaceId } = useWorkspace();
  const { data: workspace, isLoading } = trpc.workspace.getOrCreate.useQuery();
  const utils = trpc.useUtils();

  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState("GENERIC");

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

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl p-6 space-y-8">
      <div>
        <h1 className="text-xl font-bold text-[#1a1f2e] tracking-tight">
          Workspace Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your workspace details and industry context.
        </p>
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-5">
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
          <Select value={industry} onValueChange={(v) => setIndustry(v ?? "GENERIC")}>
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
          className="bg-[#86BC25] hover:bg-[#76a821] text-white"
        >
          <Save className="h-4 w-4 mr-2" />
          {updateMutation.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
