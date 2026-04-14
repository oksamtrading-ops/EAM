"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Tags as TagsIcon, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#1a1f2e", "#0B5CD6", "#64748b",
];

type EditState = { name: string; color: string };

export default function TagsPage() {
  const { data: tags, isLoading } = trpc.tag.list.useQuery();
  const utils = trpc.useUtils();

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#0B5CD6");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ name: "", color: "" });
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const createMutation = trpc.tag.create.useMutation({
    onSuccess: () => {
      utils.tag.list.invalidate();
      setNewName("");
      toast.success("Tag created");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.tag.update.useMutation({
    onSuccess: () => {
      utils.tag.list.invalidate();
      setEditingId(null);
      toast.success("Tag updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.tag.delete.useMutation({
    onSuccess: () => {
      utils.tag.list.invalidate();
      setPendingDeleteId(null);
      toast.success("Tag deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  function startEdit(tag: { id: string; name: string; color: string }) {
    setEditingId(tag.id);
    setEditState({ name: tag.name, color: tag.color });
    setPendingDeleteId(null);
  }

  function saveEdit(id: string) {
    if (!editState.name.trim()) return;
    updateMutation.mutate({ id, name: editState.name.trim(), color: editState.color });
  }

  return (
    <div className="max-w-2xl p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#1a1f2e] tracking-tight">
            Capability Tags
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create tags to classify and filter capabilities across your map.
          </p>
        </div>
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
            className="bg-[#0B5CD6] hover:bg-[#094cb0] text-white shrink-0"
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
                className="flex items-center justify-between px-5 py-3 hover:bg-[#fafbfc] group"
              >
                {editingId === tag.id ? (
                  /* Inline edit row */
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex gap-1">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setEditState((s) => ({ ...s, color: c }))}
                          className={`w-5 h-5 rounded-full transition-all ${
                            editState.color === c
                              ? "ring-2 ring-offset-1 ring-[#1a1f2e] scale-110"
                              : "hover:scale-110"
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <Input
                      value={editState.name}
                      onChange={(e) => setEditState((s) => ({ ...s, name: e.target.value }))}
                      className="h-8 text-sm flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(tag.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      autoFocus
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => saveEdit(tag.id)}
                        disabled={updateMutation.isPending || !editState.name.trim()}
                        className="p-1.5 rounded text-[#0B5CD6] hover:bg-[#0B5CD6]/10 disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1.5 rounded text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Normal row */
                  <>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="text-sm font-medium text-[#1a1f2e]">
                        {tag.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-[#0B5CD6] h-8 w-8 p-0"
                        onClick={() => startEdit(tag)}
                        title="Edit tag"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {pendingDeleteId === tag.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => deleteMutation.mutate({ id: tag.id })}
                            disabled={deleteMutation.isPending}
                            className="text-xs text-white bg-rose-500 hover:bg-rose-600 px-2 py-1 rounded font-medium disabled:opacity-50"
                          >
                            {deleteMutation.isPending ? "…" : "Delete"}
                          </button>
                          <button
                            onClick={() => setPendingDeleteId(null)}
                            className="text-xs text-muted-foreground hover:text-foreground px-1"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-600 h-8 w-8 p-0"
                          onClick={() => setPendingDeleteId(tag.id)}
                          title="Delete tag"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
