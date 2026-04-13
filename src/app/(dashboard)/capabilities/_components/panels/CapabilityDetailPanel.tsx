"use client";

import { useState } from "react";
import { X, Trash2, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  MATURITY_LABELS,
  MATURITY_COLORS,
  IMPORTANCE_LABELS,
  MATURITY_NUMERIC,
} from "@/lib/constants/maturity-colors";
import { toast } from "sonner";
import { CapabilityAIInsights } from "./CapabilityAIInsights";

type Props = {
  capabilityId: string;
  onClose: () => void;
  autoOpenAI?: boolean;
};

const MATURITY_OPTIONS = [
  "NOT_ASSESSED",
  "INITIAL",
  "DEVELOPING",
  "DEFINED",
  "MANAGED",
  "OPTIMIZING",
] as const;

const IMPORTANCE_OPTIONS = [
  "NOT_ASSESSED",
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
] as const;

export function CapabilityDetailPanel({ capabilityId, onClose, autoOpenAI }: Props) {
  const utils = trpc.useUtils();
  const { data: cap, isLoading } = trpc.capability.getById.useQuery({
    id: capabilityId,
  });

  const updateMutation = trpc.capability.update.useMutation({
    onSuccess: () => {
      utils.capability.getTree.invalidate();
      utils.capability.getById.invalidate({ id: capabilityId });
      toast.success("Capability updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.capability.delete.useMutation({
    onSuccess: () => {
      utils.capability.getTree.invalidate();
      onClose();
      toast.success("Capability deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const assessMutation = trpc.capability.assess.useMutation({
    onSuccess: () => {
      utils.capability.getTree.invalidate();
      utils.capability.getById.invalidate({ id: capabilityId });
      toast.success("Assessment saved");
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading || !cap) {
    return (
      <aside className="fixed right-0 top-0 h-screen w-96 z-40 border-l bg-background p-4 shadow-xl">
        <div className="animate-pulse">Loading...</div>
      </aside>
    );
  }

  const gap =
    MATURITY_NUMERIC[cap.targetMaturity] - MATURITY_NUMERIC[cap.currentMaturity];

  return (
    <aside className="fixed right-0 top-0 h-screen w-96 z-40 border-l bg-background flex flex-col overflow-hidden shadow-xl">
      {/* Header */}
      <div className="p-4 border-b flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-[10px]">
              {cap.level}
            </Badge>
            {cap.parent && (
              <>
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground truncate">
                  {cap.parent.name}
                </span>
              </>
            )}
          </div>
          <EditableField
            value={cap.name}
            onSave={(name) => updateMutation.mutate({ id: cap.id, name })}
            className="font-semibold text-lg"
          />
        </div>
        <Button size="icon" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Description */}
        <section>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Description
          </label>
          <Textarea
            defaultValue={cap.description ?? ""}
            placeholder="Add a description..."
            rows={3}
            onBlur={(e) => {
              if (e.target.value !== (cap.description ?? "")) {
                updateMutation.mutate({
                  id: cap.id,
                  description: e.target.value || null,
                });
              }
            }}
          />
        </section>

        <Separator />

        {/* Assessment */}
        <section className="space-y-3">
          <h3 className="text-sm font-medium">Assessment</h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Current Maturity
              </label>
              <Select
                value={cap.currentMaturity}
                onValueChange={(v) =>
                  assessMutation.mutate({
                    capabilityId: cap.id,
                    currentMaturity: v as any,
                    targetMaturity: cap.targetMaturity as any,
                    strategicImportance: cap.strategicImportance as any,
                  })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MATURITY_OPTIONS.map((m) => (
                    <SelectItem key={m} value={m}>
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: MATURITY_COLORS[m] }}
                        />
                        {MATURITY_LABELS[m]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Target Maturity
              </label>
              <Select
                value={cap.targetMaturity}
                onValueChange={(v) =>
                  assessMutation.mutate({
                    capabilityId: cap.id,
                    currentMaturity: cap.currentMaturity as any,
                    targetMaturity: v as any,
                    strategicImportance: cap.strategicImportance as any,
                  })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MATURITY_OPTIONS.map((m) => (
                    <SelectItem key={m} value={m}>
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: MATURITY_COLORS[m] }}
                        />
                        {MATURITY_LABELS[m]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Gap indicator */}
          {gap !== 0 && cap.currentMaturity !== "NOT_ASSESSED" && (
            <div className="text-xs p-2 rounded bg-muted">
              Maturity gap:{" "}
              <span className={gap > 0 ? "text-orange-600 font-medium" : "text-green-600 font-medium"}>
                {gap > 0 ? `+${gap} levels to close` : "Target reached"}
              </span>
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Strategic Importance
            </label>
            <Select
              value={cap.strategicImportance}
              onValueChange={(v) =>
                assessMutation.mutate({
                  capabilityId: cap.id,
                  currentMaturity: cap.currentMaturity as any,
                  targetMaturity: cap.targetMaturity as any,
                  strategicImportance: v as any,
                })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IMPORTANCE_OPTIONS.map((i) => (
                  <SelectItem key={i} value={i}>
                    {IMPORTANCE_LABELS[i]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        <Separator />

        {/* AI Insights */}
        <section>
          <CapabilityAIInsights capabilityId={cap.id} autoOpen={autoOpenAI} />
        </section>

        <Separator />

        {/* Sub-capabilities */}
        {cap.children && cap.children.length > 0 && (
          <section>
            <h3 className="text-sm font-medium mb-2">
              Sub-capabilities ({cap.children.length})
            </h3>
            <div className="space-y-1">
              {cap.children.map((child: any) => (
                <div
                  key={child.id}
                  className="text-sm p-2 rounded hover:bg-muted cursor-pointer"
                >
                  <Badge variant="outline" className="text-[10px] mr-2">
                    {child.level}
                  </Badge>
                  {child.name}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Tags */}
        {cap.tags && cap.tags.length > 0 && (
          <section>
            <h3 className="text-sm font-medium mb-2">Tags</h3>
            <div className="flex flex-wrap gap-1">
              {cap.tags.map((t: any) => (
                <Badge
                  key={t.tag.id}
                  variant="secondary"
                  style={{ borderColor: t.tag.color }}
                >
                  {t.tag.name}
                </Badge>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t">
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={() => {
            if (confirm("Delete this capability?")) {
              deleteMutation.mutate({
                id: cap.id,
                cascade: (cap.children?.length ?? 0) > 0,
              });
            }
          }}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          Delete
        </Button>
      </div>
    </aside>
  );
}

function EditableField({
  value,
  onSave,
  className,
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft !== value && draft.trim()) {
            onSave(draft.trim());
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={className}
      />
    );
  }

  return (
    <h2
      className={`cursor-pointer hover:text-primary ${className}`}
      tabIndex={0}
      role="button"
      aria-label={`Edit ${value}. Press Enter or double-click to edit.`}
      onDoubleClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setEditing(true);
        }
      }}
      title="Press Enter or double-click to edit"
    >
      {value}
    </h2>
  );
}
