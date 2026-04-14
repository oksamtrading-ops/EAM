"use client";

import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

type Org = {
  id: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
};

export function OrgFormModal({
  open,
  onClose,
  org,
}: {
  open: boolean;
  onClose: () => void;
  org?: Org;
}) {
  const isEdit = !!org;
  const [name, setName] = useState(org?.name ?? "");
  const [description, setDescription] = useState(org?.description ?? "");
  const [parentId, setParentId] = useState<string>(org?.parentId ?? "");

  const utils = trpc.useUtils();
  const { data: orgs } = trpc.organization.list.useQuery();

  // Reset form when org changes
  useEffect(() => {
    setName(org?.name ?? "");
    setDescription(org?.description ?? "");
    setParentId(org?.parentId ?? "");
  }, [org]);

  const create = trpc.organization.create.useMutation({
    onSuccess: () => {
      toast.success("Business unit created");
      utils.organization.list.invalidate();
      onClose();
      setName("");
      setDescription("");
      setParentId("");
    },
    onError: (e) => toast.error(e.message),
  });

  const update = trpc.organization.update.useMutation({
    onSuccess: () => {
      toast.success("Business unit updated");
      utils.organization.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isEdit && org) {
      update.mutate({
        id: org.id,
        name,
        description: description.trim() || null,
        parentId: parentId || null,
      });
    } else {
      create.mutate({
        name,
        description: description.trim() || undefined,
        parentId: parentId || undefined,
      });
    }
  }

  if (!open) return null;

  const isPending = create.isPending || update.isPending;

  // Exclude self from parent list to prevent circular reference
  const parentOptions = (orgs ?? []).filter((o) => o.id !== org?.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-background rounded-xl shadow-2xl w-[calc(100%-1.5rem)] sm:w-[440px] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-sm">
            {isEdit ? "Edit Business Unit" : "New Business Unit"}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Name *
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="e.g. Retail Banking Division"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none resize-none"
              placeholder="Brief description of this unit..."
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Parent Unit
            </label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-background"
            >
              <option value="">None (top-level)</option>
              {parentOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isEdit ? "Save Changes" : "Create Unit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
