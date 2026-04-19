"use client";

import { useState } from "react";
import {
  Check,
  X,
  Pencil,
  ChevronDown,
  ChevronRight,
  Network,
  AppWindow,
  ShieldAlert,
  Building2,
  Layers,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RouterOutputs } from "@/lib/trpc/client";

export type DraftStatusFilter =
  | "ALL"
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "MODIFIED";

type IntakeDraftsOutput = RouterOutputs["intake"]["listDrafts"];
type IntakeDraft = IntakeDraftsOutput[number];

type Props = {
  draft: IntakeDraft;
  onAccept: () => void;
  onReject: () => void;
  onEdit: () => void;
};

const ENTITY_META: Record<
  string,
  { icon: typeof Network; label: string; accent: string }
> = {
  CAPABILITY: {
    icon: Network,
    label: "Capability",
    accent: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  APPLICATION: {
    icon: AppWindow,
    label: "Application",
    accent: "bg-blue-50 text-blue-700 border-blue-200",
  },
  RISK: {
    icon: ShieldAlert,
    label: "Risk",
    accent: "bg-red-50 text-red-700 border-red-200",
  },
  VENDOR: {
    icon: Building2,
    label: "Vendor",
    accent: "bg-violet-50 text-violet-700 border-violet-200",
  },
  TECH_COMPONENT: {
    icon: Layers,
    label: "Tech Component",
    accent: "bg-slate-50 text-slate-700 border-slate-200",
  },
};

function confidenceColor(c: number): string {
  if (c >= 0.9) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (c >= 0.7) return "bg-blue-50 text-blue-700 border-blue-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

export function DraftCard({ draft, onAccept, onReject, onEdit }: Props) {
  const [expanded, setExpanded] = useState(false);
  const meta =
    ENTITY_META[draft.entityType] ?? {
      icon: FileText,
      label: draft.entityType,
      accent: "bg-muted",
    };
  const Icon = meta.icon;
  const payload = draft.payload as Record<string, unknown>;
  const evidence = Array.isArray(draft.evidence)
    ? (draft.evidence as Array<{
        excerpt?: string;
        page?: number | null;
      }>)
    : [];
  const isPending = draft.status === "PENDING" || draft.status === "MODIFIED";

  return (
    <div
      className={cn(
        "rounded-lg border bg-card/80 p-3 transition-all",
        draft.status === "ACCEPTED" && "opacity-60",
        draft.status === "REJECTED" && "opacity-50"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "h-8 w-8 rounded-lg border flex items-center justify-center shrink-0",
            meta.accent
          )}
        >
          <Icon className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-foreground truncate">
              {String(payload.name ?? payload.title ?? "(unnamed)")}
            </span>
            <Badge
              variant="outline"
              className={cn("text-[10px] font-medium", confidenceColor(draft.confidence))}
            >
              {Math.round(draft.confidence * 100)}%
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {meta.label}
            </Badge>
            {draft.status !== "PENDING" && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px]",
                  draft.status === "ACCEPTED" &&
                    "bg-emerald-50 text-emerald-700 border-emerald-200",
                  draft.status === "REJECTED" &&
                    "bg-red-50 text-red-700 border-red-200",
                  draft.status === "MODIFIED" &&
                    "bg-amber-50 text-amber-700 border-amber-200"
                )}
              >
                {draft.status}
              </Badge>
            )}
          </div>
          {typeof payload.description === "string" && payload.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {payload.description}
            </p>
          )}
        </div>

        {isPending && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-emerald-600 hover:bg-emerald-50"
              onClick={onAccept}
              title="Accept"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:bg-muted"
              onClick={onEdit}
              title="Modify"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-red-600 hover:bg-red-50"
              onClick={onReject}
              title="Reject"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="mt-2 text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        {evidence.length} evidence snippet{evidence.length === 1 ? "" : "s"}
      </button>

      {expanded && evidence.length > 0 && (
        <div className="mt-2 space-y-1.5 pl-4 border-l-2 border-[var(--ai)]/30">
          {evidence.map((e, i) => (
            <div key={i} className="text-[11px]">
              {e.page != null && (
                <span className="text-muted-foreground font-mono">
                  p.{e.page}{" "}
                </span>
              )}
              <span className="text-foreground/80 italic">&ldquo;{e.excerpt}&rdquo;</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
