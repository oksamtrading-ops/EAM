"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Tags as TagsIcon } from "lucide-react";
import { toast } from "sonner";

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#1a1f2e", "#86BC25", "#64748b",
];

export default function TagsPage() {
  const { data: tags, isLoading } = trpc.tag.list.useQuery();
  const utils = trpc.useUtils();

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#86BC25");

  const createMutation = trpc.tag.create.useMutation({
    onSuccess: () => {
      utils.tag.list.invalidate();
      setNewName("");
      toast.success("Tag created");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.tag.delete.useMutation({
    onSuccess: () => {
      utils.tag.list.invalidate();
      toast.success("Tag deleted");
    },
  });

  return (
    <div className="max-w-2xl p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#1a1f2e] tracking-tight">
          Capability Tags
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create tags to classify and filter capabilities across your map.
        </p>
      </div>

      {/* Create new tag */}
      <div className="bg-white rounded-xl border p-5">
        <h2 className="text-sm font-semibold mb-3">Create New Tag</h2>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">
              Tag Name
            </label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Digital, Core Banking, Regulatory"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) {
                  createMutation.mutate({ name: newName.trim(), color: newColor });
                }
              }}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Color
            </label>
            <div className="flex gap-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={`w-6 h-6 rounded-full transition-all ${
                    newColor === c
                      ? "ring-2 ring-offset-2 ring-[#1a1f2e] scale-110"
                      : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <Button
            onClick={() =>
              createMutation.mutate({ name: newName.trim(), color: newColor })
            }
            disabled={!newName.trim() || createMutation.isPending}
            className="bg-[#86BC25] hover:bg-[#76a821] text-white shrink-0"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add
          </Button>
        </div>
      </div>

      {/* Tag list */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : !tags || tags.length === 0 ? (
          <div className="p-8 text-center">
            <TagsIcon className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No tags created yet. Add your first tag above.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center justify-between px-5 py-3 hover:bg-[#fafbfc]"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-sm font-medium text-[#1a1f2e]">
                    {tag.name}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-red-600 h-8"
                  onClick={() => {
                    if (confirm(`Delete tag "${tag.name}"?`)) {
                      deleteMutation.mutate({ id: tag.id });
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
