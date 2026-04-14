"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Sparkles } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  parentOptions: any[];
};

export function CreateCapabilityDialog({ open, onClose, parentOptions }: Props) {
  const utils = trpc.useUtils();
  const { workspaceId } = useWorkspace();
  const { data: valueStreams } = trpc.capability.listValueStreams.useQuery();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState<"L1" | "L2" | "L3">("L1");
  const [parentId, setParentId] = useState<string>("");
  const [valueStreamId, setValueStreamId] = useState<string>("");
  const [suggestingDesc, setSuggestingDesc] = useState(false);

  const createMutation = trpc.capability.create.useMutation({
    onSuccess: () => {
      utils.capability.getTree.invalidate();
      toast.success("Capability created");
      resetAndClose();
    },
    onError: (err) => toast.error(err.message),
  });

  async function suggestDescription() {
    if (!name.trim()) { toast.error("Enter a name first"); return; }
    setSuggestingDesc(true);
    try {
      const parentName = parentId ? flattenForSelect(parentOptions, level).find((p) => p.id === parentId)?.name : undefined;
      const res = await fetch("/api/ai/capability-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, name: name.trim(), level, parentName }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      if (data.description) setDescription(data.description);
    } catch {
      toast.error("Failed to generate description");
    } finally {
      setSuggestingDesc(false);
    }
  }

  function resetAndClose() {
    setName("");
    setDescription("");
    setLevel("L1");
    setParentId("");
    setValueStreamId("");
    setSuggestingDesc(false);
    onClose();
  }

  const flatParents = flattenForSelect(parentOptions, level);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && resetAndClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Business Capability</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Level</Label>
              <Select
                value={level}
                onValueChange={(v) => {
                  setLevel(v as any);
                  setParentId("");
                }}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L1">L1 - Domain</SelectItem>
                  <SelectItem value="L2">L2 - Capability</SelectItem>
                  <SelectItem value="L3">L3 - Sub-capability</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {level !== "L1" && (
              <div>
                <Label>Parent Capability</Label>
                <Select value={parentId} onValueChange={(v) => setParentId(v ?? "")}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select parent..." />
                  </SelectTrigger>
                  <SelectContent>
                    {flatParents.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.indent}{p.name} ({p.level})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {level === "L1" && (
              <div>
                <Label>Value Stream</Label>
                <Select value={valueStreamId || "__none__"} onValueChange={(v) => setValueStreamId(v === "__none__" ? "" : (v ?? ""))}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Optional..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <span className="text-muted-foreground">None</span>
                    </SelectItem>
                    {valueStreams?.map((vs) => (
                      <SelectItem key={vs.id} value={vs.id}>
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: vs.color }} />
                          {vs.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div>
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Customer Relationship Management"
              className="mt-1.5"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Description (optional)</Label>
              <button
                type="button"
                onClick={suggestDescription}
                disabled={suggestingDesc || !name.trim()}
                className="inline-flex items-center gap-1 text-xs text-[#7c3aed] hover:text-[#6d28d9] disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <Sparkles className="h-3 w-3" />
                {suggestingDesc ? "Generating..." : "AI Suggest"}
              </button>
            </div>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this capability represent?"
              rows={3}
              className="mt-1.5"
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={resetAndClose}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                createMutation.mutate({
                  name: name.trim(),
                  description: description.trim() || undefined,
                  level,
                  parentId: parentId || undefined,
                  valueStreamId: valueStreamId || undefined,
                })
              }
              disabled={!name.trim() || createMutation.isPending}
              className="bg-[#0B5CD6] hover:bg-[#094cb0] text-white"
            >
              {createMutation.isPending ? "Creating..." : "Create Capability"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function flattenForSelect(
  tree: any[],
  childLevel: string
): { id: string; name: string; level: string; indent: string }[] {
  const result: { id: string; name: string; level: string; indent: string }[] = [];
  const parentLevel = childLevel === "L2" ? "L1" : childLevel === "L3" ? "L2" : null;

  function walk(nodes: any[], depth: number) {
    for (const node of nodes) {
      if (!parentLevel || node.level === parentLevel) {
        result.push({ id: node.id, name: node.name, level: node.level, indent: "  ".repeat(depth) });
      }
      if (node.children) walk(node.children, depth + 1);
    }
  }

  walk(tree, 0);
  return result;
}
