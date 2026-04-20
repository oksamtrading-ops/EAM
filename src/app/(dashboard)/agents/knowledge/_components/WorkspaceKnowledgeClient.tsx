"use client";

import { useMemo, useState } from "react";
import {
  BookOpen,
  Plus,
  Search,
  Trash2,
  Pencil,
  Archive,
  ArchiveRestore,
  Upload,
  Sparkles,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverflowMenu, type OverflowAction } from "@/components/shared/OverflowMenu";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { KnowledgeUploadDialog } from "./KnowledgeUploadDialog";
import { KnowledgeDraftCard } from "./KnowledgeDraftCard";

const KIND_META: Record<
  string,
  { label: string; color: string }
> = {
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

type EditingState = {
  id?: string;
  subject: string;
  statement: string;
  kind: "FACT" | "DECISION" | "PATTERN";
  confidence: number;
};

const EMPTY: EditingState = {
  subject: "",
  statement: "",
  kind: "FACT",
  confidence: 0.9,
};

type Tab = "knowledge" | "drafts" | "documents";

export function WorkspaceKnowledgeClient() {
  const [tab, setTab] = useState<Tab>("knowledge");
  const [search, setSearch] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const utils = trpc.useUtils();
  const { data: items, isLoading } = trpc.workspaceKnowledge.list.useQuery({
    search: search.trim() || undefined,
    includeArchived,
    limit: 200,
  });
  const { data: drafts, isLoading: draftsLoading } =
    trpc.knowledgeDraft.list.useQuery({ status: undefined });
  const { data: documents, isLoading: documentsLoading } =
    trpc.intake.listDocuments.useQuery(undefined, {
      enabled: tab === "documents",
    });
  const { workspaceId } = useWorkspace();
  const [distillingId, setDistillingId] = useState<string | null>(null);

  const deleteDocument = trpc.intake.deleteDocument.useMutation({
    onSuccess: () => {
      toast.success("Document deleted");
      utils.intake.listDocuments.invalidate();
      utils.knowledgeDraft.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  async function distillNow(documentId: string, filename: string) {
    setDistillingId(documentId);
    try {
      const res = await fetch("/api/ai/knowledge/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, documentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Distillation failed");
        return;
      }
      toast.success(
        `Extracted ${data.draftsCreated} fact${data.draftsCreated === 1 ? "" : "s"} from ${filename}`
      );
      utils.knowledgeDraft.list.invalidate();
      setTab("drafts");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Distillation failed");
    } finally {
      setDistillingId(null);
    }
  }
  const pendingDrafts = useMemo(
    () =>
      (drafts ?? []).filter(
        (d) => d.status === "PENDING" || d.status === "MODIFIED"
      ),
    [drafts]
  );

  const acceptDraft = trpc.knowledgeDraft.accept.useMutation({
    onSuccess: () => {
      toast.success("Fact accepted — now active in the knowledge base");
      utils.knowledgeDraft.list.invalidate();
      utils.workspaceKnowledge.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const rejectDraft = trpc.knowledgeDraft.reject.useMutation({
    onSuccess: () => {
      toast.success("Draft rejected");
      utils.knowledgeDraft.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const modifyDraft = trpc.knowledgeDraft.modify.useMutation({
    onSuccess: () => {
      utils.knowledgeDraft.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const supersedeDraft = trpc.knowledgeDraft.supersede.useMutation({
    onSuccess: () => {
      toast.success("Fact superseded — old version archived");
      utils.knowledgeDraft.list.invalidate();
      utils.workspaceKnowledge.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const bulkAcceptDrafts = trpc.knowledgeDraft.bulkAcceptByConfidence.useMutation(
    {
      onSuccess: (r) => {
        toast.success(
          `Accepted ${r.accepted}${r.failed > 0 ? ` (${r.failed} failed)` : ""}`
        );
        utils.knowledgeDraft.list.invalidate();
        utils.workspaceKnowledge.list.invalidate();
      },
      onError: (e) => toast.error(e.message),
    }
  );

  const draftsByDocument = useMemo(() => {
    const g: Record<
      string,
      { filename: string; drafts: typeof drafts }
    > = {};
    for (const d of drafts ?? []) {
      const key = d.sourceDocumentId ?? "__manual__";
      if (!g[key]) {
        g[key] = {
          filename: d.sourceDocument?.filename ?? "Agent-originated",
          drafts: [] as never,
        };
      }
      (g[key].drafts as unknown as typeof drafts)!.push(d);
    }
    return g;
  }, [drafts]);

  const overflowActions: OverflowAction[] = [
    {
      label: "Accept all ≥90%",
      icon: <Sparkles className="h-4 w-4" />,
      onClick: () => bulkAcceptDrafts.mutate({ threshold: 0.9 }),
    },
    {
      label: "Accept all ≥80%",
      icon: <Sparkles className="h-4 w-4" />,
      onClick: () => bulkAcceptDrafts.mutate({ threshold: 0.8 }),
    },
    {
      label: "Upload document",
      icon: <Upload className="h-4 w-4" />,
      onClick: () => setShowUpload(true),
    },
    {
      label: "Add fact",
      icon: <Plus className="h-4 w-4" />,
      onClick: () => setEditing(EMPTY),
      primary: true,
    },
  ];

  const create = trpc.workspaceKnowledge.create.useMutation({
    onSuccess: () => {
      toast.success("Saved to knowledge base");
      utils.workspaceKnowledge.list.invalidate();
      setEditing(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.workspaceKnowledge.update.useMutation({
    onSuccess: () => {
      utils.workspaceKnowledge.list.invalidate();
      setEditing(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.workspaceKnowledge.delete.useMutation({
    onSuccess: () => {
      toast.success("Deleted");
      utils.workspaceKnowledge.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  function save() {
    if (!editing) return;
    if (!editing.subject.trim() || !editing.statement.trim()) {
      toast.error("Subject and statement are required");
      return;
    }
    if (editing.id) {
      update.mutate({
        id: editing.id,
        subject: editing.subject.trim(),
        statement: editing.statement.trim(),
        kind: editing.kind,
        confidence: editing.confidence,
      });
    } else {
      create.mutate({
        subject: editing.subject.trim(),
        statement: editing.statement.trim(),
        kind: editing.kind,
        confidence: editing.confidence,
      });
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="glass-toolbar border-b px-4 sm:px-5 py-2.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-md font-semibold text-foreground tracking-tight flex items-center gap-2">
            <span className="h-6 w-6 rounded-md bg-[var(--ai)]/15 flex items-center justify-center">
              <BookOpen className="h-3.5 w-3.5 text-[var(--ai)]" />
            </span>
            Workspace Knowledge
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {items?.length ?? 0} active · {pendingDrafts.length} draft
            {pendingDrafts.length === 1 ? "" : "s"} pending review
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowUpload(true)}
            className="gap-1.5"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload
          </Button>
          <Button
            size="sm"
            onClick={() => setEditing(EMPTY)}
            className="gap-1.5 bg-[var(--ai)] hover:bg-[var(--ai)]/90 text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            Add fact
          </Button>
          <OverflowMenu actions={overflowActions} />
        </div>
      </div>

      <div className="border-b px-4 sm:px-5 py-2 flex items-center gap-3 bg-background/60">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
            <TabsTrigger value="drafts" className="gap-1.5">
              Drafts
              {pendingDrafts.length > 0 && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1 py-0 bg-[var(--ai)]/10 text-[var(--ai)] border-[var(--ai)]/30"
                >
                  {pendingDrafts.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>
        </Tabs>
        {tab === "knowledge" && (
          <>
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search subject or statement…"
                className="pl-8 h-8 text-sm"
              />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground select-none cursor-pointer">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
                className="h-3 w-3 accent-[var(--ai)]"
              />
              Include archived
            </label>
          </>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {tab === "documents" ? (
          documentsLoading ? (
            <p className="text-sm text-muted-foreground text-center pt-8">
              Loading documents…
            </p>
          ) : !documents || documents.length === 0 ? (
            <DocumentsEmpty onUpload={() => setShowUpload(true)} />
          ) : (
            <div className="max-w-4xl mx-auto">
              <div className="rounded-lg border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">File</th>
                      <th className="text-left px-3 py-2 font-medium">Status</th>
                      <th className="text-right px-3 py-2 font-medium">Chunks</th>
                      <th className="text-right px-3 py-2 font-medium">
                        Drafts
                      </th>
                      <th className="text-right px-3 py-2 font-medium">
                        Uploaded
                      </th>
                      <th className="text-right px-3 py-2 font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {documents.map((d) => {
                      const totalDrafts =
                        d._count.drafts + d._count.knowledgeDrafts;
                      const isDistilling = distillingId === d.id;
                      return (
                        <tr
                          key={d.id}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="h-3.5 w-3.5 text-[var(--ai)] shrink-0" />
                              <span className="truncate font-medium text-foreground">
                                {d.filename}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <StatusBadge status={d.status} />
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                            {d._count.chunks}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                            {totalDrafts > 0 ? totalDrafts : "—"}
                          </td>
                          <td className="px-3 py-2 text-right text-[11px] text-muted-foreground tabular-nums">
                            {formatRelative(d.uploadedAt)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="inline-flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1 text-[11px]"
                                disabled={
                                  isDistilling ||
                                  d.status === "PROCESSING"
                                }
                                onClick={() => distillNow(d.id, d.filename)}
                              >
                                {isDistilling ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Sparkles className="h-3 w-3" />
                                )}
                                {d._count.knowledgeDrafts > 0
                                  ? "Re-distill"
                                  : "Distill"}
                              </Button>
                              <button
                                onClick={() => {
                                  if (
                                    !window.confirm(
                                      `Delete "${d.filename}"? Any accepted entities or knowledge already committed will remain.`
                                    )
                                  )
                                    return;
                                  deleteDocument.mutate({ id: d.id });
                                }}
                                className="p-1 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50"
                                aria-label="Delete document"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : tab === "drafts" ? (
          draftsLoading ? (
            <p className="text-sm text-muted-foreground text-center pt-8">
              Loading drafts…
            </p>
          ) : !drafts || drafts.length === 0 ? (
            <DraftsEmpty onUpload={() => setShowUpload(true)} />
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {Object.entries(draftsByDocument).map(([docId, group]) => (
                <section key={docId} className="space-y-2">
                  <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.filename}
                    <span className="ml-2 text-muted-foreground/70">
                      ({group.drafts?.length ?? 0})
                    </span>
                  </h2>
                  <div className="space-y-2">
                    {(group.drafts ?? []).map((d) => (
                      <KnowledgeDraftCard
                        key={d.id}
                        draft={d}
                        onAccept={(overrides) =>
                          acceptDraft.mutate({ id: d.id, overrides })
                        }
                        onReject={() => rejectDraft.mutate({ id: d.id })}
                        onModify={(updates) =>
                          modifyDraft.mutate({ id: d.id, ...updates })
                        }
                        onSupersede={(existingKnowledgeId) =>
                          supersedeDraft.mutate({
                            draftId: d.id,
                            existingKnowledgeId,
                          })
                        }
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground text-center pt-8">
            Loading…
          </p>
        ) : !items || items.length === 0 ? (
          <EmptyState onAdd={() => setEditing(EMPTY)} />
        ) : (
          <div className="max-w-3xl mx-auto space-y-2">
            {items.map((item) => {
              const meta = KIND_META[item.kind] ?? KIND_META.FACT;
              return (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-lg border bg-card p-3 flex items-start gap-3 group",
                    !item.isActive && "opacity-60"
                  )}
                >
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] shrink-0 mt-0.5", meta.color)}
                  >
                    {meta.label}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {item.subject}
                    </p>
                    <p className="text-[13px] text-muted-foreground leading-relaxed mt-0.5">
                      {item.statement}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Confidence {Math.round(item.confidence * 100)}% · Updated{" "}
                      {new Date(item.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() =>
                        setEditing({
                          id: item.id,
                          subject: item.subject,
                          statement: item.statement,
                          kind: item.kind as "FACT" | "DECISION" | "PATTERN",
                          confidence: item.confidence,
                        })
                      }
                      className="p-1 rounded text-muted-foreground hover:text-[var(--ai)] hover:bg-[var(--ai)]/10"
                      aria-label="Edit"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() =>
                        update.mutate({
                          id: item.id,
                          isActive: !item.isActive,
                        })
                      }
                      className="p-1 rounded text-muted-foreground hover:text-amber-600 hover:bg-amber-50"
                      aria-label={item.isActive ? "Archive" : "Restore"}
                    >
                      {item.isActive ? (
                        <Archive className="h-3 w-3" />
                      ) : (
                        <ArchiveRestore className="h-3 w-3" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        if (!window.confirm(`Delete "${item.subject}"?`)) return;
                        del.mutate({ id: item.id });
                      }}
                      className="p-1 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={editing !== null} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? "Edit fact" : "Add workspace fact"}
            </DialogTitle>
            <DialogDescription>
              Stable, non-obvious facts used as high-confidence context on every
              agent run.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Kind
                </label>
                <Select
                  value={editing.kind}
                  onValueChange={(v) =>
                    setEditing({ ...editing, kind: v as EditingState["kind"] })
                  }
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FACT">Fact</SelectItem>
                    <SelectItem value="DECISION">Decision</SelectItem>
                    <SelectItem value="PATTERN">Pattern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Subject
                </label>
                <Input
                  autoFocus={!editing.id}
                  value={editing.subject}
                  onChange={(e) =>
                    setEditing({ ...editing, subject: e.target.value })
                  }
                  placeholder="e.g. Salesforce Sales Cloud"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Statement
                </label>
                <Textarea
                  value={editing.statement}
                  onChange={(e) =>
                    setEditing({ ...editing, statement: e.target.value })
                  }
                  placeholder="One to three sentences, declarative."
                  rows={4}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Confidence ({Math.round(editing.confidence * 100)}%)
                </label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={editing.confidence}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      confidence: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-[var(--ai)]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={save}
                  disabled={create.isPending || update.isPending}
                  className="bg-[var(--ai)] hover:bg-[var(--ai)]/90 text-white"
                >
                  {editing.id ? "Save" : "Add"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <KnowledgeUploadDialog
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onExtracted={() => {
          utils.knowledgeDraft.list.invalidate();
          setTab("drafts");
        }}
      />
    </div>
  );
}

function DraftsEmpty({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <div className="h-12 w-12 rounded-xl bg-[var(--ai)]/15 flex items-center justify-center mb-3">
        <Upload className="h-6 w-6 text-[var(--ai)]" />
      </div>
      <p className="text-sm font-medium mb-1">No drafts yet</p>
      <p className="text-xs text-muted-foreground mb-4 max-w-md">
        Upload a strategy deck, current-state review, or interview notes, and
        Claude will distill it into proposed facts for your review.
      </p>
      <Button onClick={onUpload} size="sm" className="gap-1.5">
        <Upload className="h-3.5 w-3.5" />
        Upload document
      </Button>
    </div>
  );
}

function DocumentsEmpty({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <div className="h-12 w-12 rounded-xl bg-[var(--ai)]/15 flex items-center justify-center mb-3">
        <FileText className="h-6 w-6 text-[var(--ai)]" />
      </div>
      <p className="text-sm font-medium mb-1">No documents uploaded yet</p>
      <p className="text-xs text-muted-foreground mb-4 max-w-md">
        Uploaded documents are stored with chunked text and, when distilled,
        produce fact drafts for your review.
      </p>
      <Button onClick={onUpload} size="sm" className="gap-1.5">
        <Upload className="h-3.5 w-3.5" />
        Upload document
      </Button>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "EXTRACTED") {
    return (
      <Badge
        variant="outline"
        className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 gap-1"
      >
        <CheckCircle2 className="h-2.5 w-2.5" />
        Ready
      </Badge>
    );
  }
  if (status === "PROCESSING") {
    return (
      <Badge
        variant="outline"
        className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 gap-1"
      >
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
        Processing
      </Badge>
    );
  }
  if (status === "FAILED") {
    return (
      <Badge
        variant="outline"
        className="text-[10px] bg-red-50 text-red-700 border-red-200 gap-1"
      >
        <AlertCircle className="h-2.5 w-2.5" />
        Failed
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px]">
      {status}
    </Badge>
  );
}

function formatRelative(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return date.toLocaleDateString();
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <div className="h-12 w-12 rounded-xl bg-[var(--ai)]/15 flex items-center justify-center mb-3">
        <BookOpen className="h-6 w-6 text-[var(--ai)]" />
      </div>
      <p className="text-sm font-medium mb-1">No workspace facts yet</p>
      <p className="text-xs text-muted-foreground mb-4 max-w-md">
        Add curated facts about this workspace — or let the agent propose them
        during a conversation. Stored facts are injected into every agent run
        automatically.
      </p>
      <Button onClick={onAdd} size="sm" className="gap-1.5">
        <Plus className="h-3.5 w-3.5" />
        Add your first fact
      </Button>
    </div>
  );
}
