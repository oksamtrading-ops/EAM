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

type Props = {
  open: boolean;
  onClose: () => void;
  parentOptions: any[];
};

export function CreateCapabilityDialog({ open, onClose, parentOptions }: Props) {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState<"L1" | "L2" | "L3">("L1");
  const [parentId, setParentId] = useState<string>("");

  const createMutation = trpc.capability.create.useMutation({
    onSuccess: () => {
      utils.capability.getTree.invalidate();
      toast.success("Capability created");
      resetAndClose();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  function resetAndClose() {
    setName("");
    setDescription("");
    setLevel("L1");
    setParentId("");
    onClose();
  }

  // Flatten tree to get parent options
  const flatParents = flattenForSelect(parentOptions, level);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && resetAndClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Business Capability</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Level</Label>
            <Select
              value={level}
              onValueChange={(v) => {
                setLevel(v as any);
                setParentId("");
              }}
            >
              <SelectTrigger>
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
                <SelectTrigger>
                  <SelectValue placeholder="Select parent..." />
                </SelectTrigger>
                <SelectContent>
                  {flatParents.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.indent}
                      {p.name} ({p.level})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Customer Relationship Management"
            />
          </div>

          <div>
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this capability represent?"
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end">
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
                })
              }
              disabled={!name.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create"}
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

  // L2 needs L1 parents, L3 needs L2 parents
  const parentLevel = childLevel === "L2" ? "L1" : childLevel === "L3" ? "L2" : null;

  function walk(nodes: any[], depth: number) {
    for (const node of nodes) {
      if (!parentLevel || node.level === parentLevel) {
        result.push({
          id: node.id,
          name: node.name,
          level: node.level,
          indent: "  ".repeat(depth),
        });
      }
      if (node.children) {
        walk(node.children, depth + 1);
      }
    }
  }

  walk(tree, 0);
  return result;
}
