"use client";

import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

const PRESET_COLORS = [
  "#0B5CD6",
  "#059669",
  "#D97706",
  "#DC2626",
  "#7c3aed",
  "#EC4899",
  "#0891B2",
  "#4B5563",
];

type ValueStreamData = {
  id: string;
  name: string;
  description?: string | null;
  color: string;
};

export function ValueStreamFormModal({
  open,
  onClose,
  valueStream,
}: {
  open: boolean;
  onClose: () => void;
  valueStream?: ValueStreamData;
}) {
  const isEdit = !!valueStream;
  const [name, setName] = useState(valueStream?.name ?? "");
  const [description, setDescription] = useState(
    valueStream?.description ?? ""
  );
  const [color, setColor] = useState(valueStream?.color ?? PRESET_COLORS[0]);

  const utils = trpc.useUtils();

  useEffect(() => {
    setName(valueStream?.name ?? "");
    setDescription(valueStream?.description ?? "");
    setColor(valueStream?.color ?? PRESET_COLORS[0]);
  }, [valueStream]);

  const create = trpc.capability.createValueStream.useMutation({
    onSuccess: () => {
      toast.success("Value stream created");
      utils.capability.listValueStreams.invalidate();
      onClose();
      setName("");
      setDescription("");
      setColor(PRESET_COLORS[0]);
    },
    onError: (e) => toast.error(e.message),
  });

  const update = trpc.capability.updateValueStream.useMutation({
    onSuccess: () => {
      toast.success("Value stream updated");
      utils.capability.listValueStreams.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isEdit && valueStream) {
      update.mutate({
        id: valueStream.id,
        name,
        description: description.trim() || null,
        color,
      });
    } else {
      create.mutate({
        name,
        description: description.trim() || undefined,
        color,
      });
    }
  }

  if (!open) return null;

  const isPending = create.isPending || update.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-background rounded-xl shadow-2xl w-[calc(100%-1.5rem)] sm:w-[440px] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-sm">
            {isEdit ? "Edit Value Stream" : "New Value Stream"}
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
              placeholder="e.g. Customer Onboarding"
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
              placeholder="What business value does this stream deliver?"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Color
            </label>
            <div className="flex items-center gap-2 mt-1">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="h-7 w-7 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? "#1a1f2e" : "transparent",
                    transform: color === c ? "scale(1.15)" : "scale(1)",
                  }}
                />
              ))}
            </div>
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
              {isEdit ? "Save Changes" : "Create Stream"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
