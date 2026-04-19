"use client";

import { useState, useEffect } from "react";
import { X, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import type { RouterOutputs } from "@/lib/trpc/client";

type IntakeDraft = RouterOutputs["intake"]["listDrafts"][number];

type Props = {
  draft: IntakeDraft;
  onClose: () => void;
};

export function IntakeDraftPanel({ draft, onClose }: Props) {
  const [payload, setPayload] = useState<Record<string, string>>(() =>
    flatten(draft.payload as Record<string, unknown>)
  );
  const utils = trpc.useUtils();

  useEffect(() => {
    setPayload(flatten(draft.payload as Record<string, unknown>));
  }, [draft.id, draft.payload]);

  const modify = trpc.intake.modifyDraft.useMutation({
    onSuccess: () => {
      toast.success("Draft updated");
      utils.intake.listDrafts.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const accept = trpc.intake.acceptDraft.useMutation({
    onSuccess: () => {
      toast.success("Draft accepted and committed");
      utils.intake.listDrafts.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const fields = Object.keys(payload);

  return (
    <aside className="fixed right-0 top-0 h-screen w-full sm:w-[440px] z-50 border-l bg-card flex flex-col shadow-xl">
      <div className="px-5 py-4 border-b flex items-center justify-between bg-gradient-to-r from-[var(--ai)]/10 to-transparent">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-[var(--ai)]/15 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-[var(--ai)]" />
          </div>
          <div>
            <h2 className="font-bold text-sm">Edit Draft</h2>
            <p className="text-[11px] text-muted-foreground">
              {draft.entityType} · {Math.round(draft.confidence * 100)}% confidence
            </p>
          </div>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {fields.map((key) => (
          <div key={key} className="space-y-1">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {key}
            </label>
            {key === "description" ? (
              <textarea
                value={payload[key] ?? ""}
                onChange={(e) =>
                  setPayload((p) => ({ ...p, [key]: e.target.value }))
                }
                rows={4}
                className="w-full text-sm rounded-md border px-2 py-1.5 bg-background"
              />
            ) : (
              <Input
                value={payload[key] ?? ""}
                onChange={(e) =>
                  setPayload((p) => ({ ...p, [key]: e.target.value }))
                }
              />
            )}
          </div>
        ))}
      </div>

      <div className="border-t px-5 py-3 flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            modify.mutate({ id: draft.id, payload: unflatten(payload) })
          }
          disabled={modify.isPending}
        >
          <Save className="h-3.5 w-3.5 mr-1.5" />
          Save changes
        </Button>
        <Button
          size="sm"
          onClick={() =>
            accept.mutate({ id: draft.id, overrides: unflatten(payload) })
          }
          disabled={accept.isPending}
          className="bg-[var(--ai)] hover:bg-[var(--ai)]/90 text-white"
        >
          Accept &amp; Commit
        </Button>
      </div>
    </aside>
  );
}

function flatten(obj: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) {
      out[k] = "";
    } else if (typeof v === "object") {
      out[k] = JSON.stringify(v);
    } else {
      out[k] = String(v);
    }
  }
  return out;
}

function unflatten(obj: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const trimmed = v.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        out[k] = JSON.parse(trimmed);
        continue;
      } catch {
        // fallthrough
      }
    }
    out[k] = trimmed;
  }
  return out;
}
