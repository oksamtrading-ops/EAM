"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { APP_TYPE_LABELS, LIFECYCLE_LABELS, DEPLOY_LABELS } from "@/lib/constants/application-colors";

type Props = {
  open: boolean;
  onClose: () => void;
  capTree: any[];
};

export function CreateApplicationDialog({ open, onClose, capTree }: Props) {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");
  const [appType, setAppType] = useState("CUSTOM");
  const [deployment, setDeployment] = useState("UNKNOWN");
  const [lifecycle, setLifecycle] = useState("ACTIVE");
  const [cost, setCost] = useState("");
  const [selectedCaps, setSelectedCaps] = useState<string[]>([]);

  const createMutation = trpc.application.create.useMutation({
    onSuccess: () => {
      utils.application.list.invalidate();
      toast.success("Application created");
      resetAndClose();
    },
    onError: (err) => toast.error(err.message),
  });

  function resetAndClose() {
    setName(""); setVendor(""); setDescription(""); setAppType("CUSTOM");
    setDeployment("UNKNOWN"); setLifecycle("ACTIVE"); setCost(""); setSelectedCaps([]);
    onClose();
  }

  // Flatten capabilities for selection
  const flatCaps: { id: string; name: string; level: string }[] = [];
  function walk(nodes: any[]) {
    for (const n of nodes) {
      flatCaps.push({ id: n.id, name: n.name, level: n.level });
      if (n.children) walk(n.children);
    }
  }
  walk(capTree);

  function toggleCap(id: string) {
    setSelectedCaps((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && resetAndClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Application</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Application Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Salesforce CRM" className="mt-1" />
            </div>
            <div>
              <Label>Vendor</Label>
              <Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="e.g. Salesforce" className="mt-1" />
            </div>
            <div>
              <Label>Annual Cost ($)</Label>
              <Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" className="mt-1" />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={appType} onValueChange={(v) => setAppType(v ?? "CUSTOM")}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(APP_TYPE_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Lifecycle</Label>
              <Select value={lifecycle} onValueChange={(v) => setLifecycle(v ?? "ACTIVE")}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LIFECYCLE_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this application do?" rows={2} className="mt-1" />
          </div>

          {/* Capability mapping */}
          <div>
            <Label>Link to Capabilities ({selectedCaps.length} selected)</Label>
            <div className="mt-2 max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
              {flatCaps.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2">Import capabilities first in Module 1.</p>
              ) : (
                flatCaps.map((cap) => (
                  <button
                    key={cap.id}
                    type="button"
                    onClick={() => toggleCap(cap.id)}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 transition-colors ${
                      selectedCaps.includes(cap.id) ? "bg-[#0B5CD6]/10 text-[#0B5CD6]" : "hover:bg-[#f1f3f5] text-muted-foreground"
                    }`}
                  >
                    <Badge variant="outline" className="text-[8px] shrink-0">{cap.level}</Badge>
                    <span className="truncate">{cap.name}</span>
                    {selectedCaps.includes(cap.id) && <span className="ml-auto text-[#0B5CD6]">✓</span>}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={resetAndClose}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate({
                name: name.trim(),
                vendor: vendor.trim() || undefined,
                description: description.trim() || undefined,
                applicationType: appType as any,
                deploymentModel: deployment as any,
                lifecycle: lifecycle as any,
                annualCostUsd: cost ? parseFloat(cost) : undefined,
                capabilityIds: selectedCaps.length > 0 ? selectedCaps : undefined,
              })}
              disabled={!name.trim() || createMutation.isPending}
              className="bg-[#0B5CD6] hover:bg-[#094cb0] text-white"
            >
              {createMutation.isPending ? "Creating..." : "Create Application"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
