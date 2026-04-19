"use client";

import { useState } from "react";
import {
  Check,
  X,
  Pencil,
  ChevronDown,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { RouterOutputs } from "@/lib/trpc/client";

type Draft = RouterOutputs["knowledgeDraft"]["list"][number];

type Props = {
  draft: Draft;
  onAccept: (overrides?: {
    subject?: string;
    statement?: string;
    kind?: "FACT" | "DECISION" | "PATTERN";
  }) => void;
  onReject: () => void;
  onModify: (updates: {
    subject?: string;
    statement?: string;
    kind?: "FACT" | "DECISION" | "PATTERN";
  }) => void;
};

const KIND_META: Record<string, { label: string; color: string }> = {
  FACT: { label: "Fact", color: "bg-blue-50 text-blue-700 border-blue-200" },
  DECISION: {
    label: "Decision",
    color: "bg-violet-50 text-violet-700 border-violet-200",
  },
  PATTERN: {
    label: "Pattern",
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
};

function confidenceColor(c: number): string {
  if (c >= 0.9) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (c >= 0.7) return "bg-blue-50 text-blue-700 border-blue-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

export function KnowledgeDraftCard({ draft, onAccept, onReject, onModify }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(draft.subject);
  const [statement, setStatement] = useState(draft.statement);
  const [kind, setKind] = useState<"FACT" | "DECISION" | "PATTERN">(
    draft.kind as "FACT" | "DECISION" | "PATTERN"
  );

  const meta = KIND_META[draft.kind] ?? KIND_META.FACT;
  const evidence = Array.isArray(draft.evidence)
    ? (draft.evidence as Array<{
        excerpt?: string;
        page?: number | null;
        chunkOrdinal?: number;
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
            meta.color
          )}
        >
          <BookOpen className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                className="h-8 text-sm"
              />
              <Textarea
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
                rows={3}
                className="text-sm"
              />
              <div className="flex items-center gap-2">
                <Select
                  value={kind}
                  onValueChange={(v) =>
                    setKind(v as "FACT" | "DECISION" | "PATTERN")
                  }
                >
                  <SelectTrigger className="h-7 text-xs w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FACT">Fact</SelectItem>
                    <SelectItem value="DECISION">Decision</SelectItem>
                    <SelectItem value="PATTERN">Pattern</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs bg-[var(--ai)] hover:bg-[var(--ai)]/90 text-white"
                  onClick={() => {
                    onModify({
                      subject: subject.trim(),
                      statement: statement.trim(),
                      kind,
                    });
                    setEditing(false);
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm text-foreground truncate">
                  {draft.subject}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-medium",
                    confidenceColor(draft.confidence)
                  )}
                >
                  {Math.round(draft.confidence * 100)}%
                </Badge>
                <Badge variant="outline" className={cn("text-[10px]", meta.color)}>
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
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {draft.statement}
              </p>
            </>
          )}
        </div>

        {isPending && !editing && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-emerald-600 hover:bg-emerald-50"
              onClick={() => onAccept()}
              title="Accept"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:bg-muted"
              onClick={() => setEditing(true)}
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
