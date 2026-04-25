"use client";

import Link from "next/link";
import {
  Inbox,
  FileText,
  BookOpen,
  Clock,
  Copy,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";

const ENTITY_TYPE_LABEL: Record<string, string> = {
  CAPABILITY: "Capability",
  APPLICATION: "Application",
  RISK: "Risk",
  VENDOR: "Vendor",
  TECH_COMPONENT: "Tech component",
  INITIATIVE: "Initiative",
};

const ENTITY_TYPE_DOT: Record<string, string> = {
  CAPABILITY: "bg-blue-500",
  APPLICATION: "bg-emerald-500",
  RISK: "bg-red-500",
  VENDOR: "bg-amber-500",
  TECH_COMPONENT: "bg-violet-500",
  INITIATIVE: "bg-blue-500",
};

/**
 * Inbox column — every "needs your review" surface in one place.
 * Each card has at most one inline action that calls the existing
 * mutation; longer flows link out to the dedicated surface.
 */
export function InboxColumn() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.dashboardV2.pendingReviews.useQuery();

  const bulkAccept = trpc.knowledgeDraft.bulkAcceptByConfidence.useMutation({
    onSuccess: (r) => {
      toast.success(
        `Accepted ${r.accepted}${r.failed > 0 ? ` (${r.failed} failed)` : ""}`
      );
      utils.dashboardV2.pendingReviews.invalidate();
      utils.knowledgeDraft.list.invalidate();
      utils.workspaceKnowledge.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const markReviewed = trpc.workspaceKnowledge.markReviewed.useMutation({
    onSuccess: () => {
      toast.success("Marked reviewed");
      utils.dashboardV2.pendingReviews.invalidate();
      utils.workspaceKnowledge.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const supersede = trpc.knowledgeDraft.supersede.useMutation({
    onSuccess: () => {
      toast.success("Fact superseded — old version archived");
      utils.dashboardV2.pendingReviews.invalidate();
      utils.knowledgeDraft.list.invalidate();
      utils.workspaceKnowledge.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const accept = trpc.knowledgeDraft.accept.useMutation({
    onSuccess: () => {
      toast.success("Draft accepted — both kept");
      utils.dashboardV2.pendingReviews.invalidate();
      utils.knowledgeDraft.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="rounded-2xl glass p-5 sm:p-6">
      <header className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            Pending reviews
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isLoading
              ? "Loading…"
              : (data?.total ?? 0) === 0
                ? "Nothing waiting on you"
                : `${data!.total} item${data!.total === 1 ? "" : "s"} across ${[
                    data!.intake.count > 0,
                    data!.knowledge.count > 0,
                    data!.stale.count > 0,
                    data!.dedup.count > 0,
                  ].filter(Boolean).length} categor${
                    [
                      data!.intake.count > 0,
                      data!.knowledge.count > 0,
                      data!.stale.count > 0,
                      data!.dedup.count > 0,
                    ].filter(Boolean).length === 1
                      ? "y"
                      : "ies"
                  }`}
          </p>
        </div>
        {(data?.total ?? 0) > 0 && (
          <Badge tone="ai" className="text-[10px] font-mono gap-1">
            <Inbox className="h-3 w-3" />
            {data!.total}
          </Badge>
        )}
      </header>

      {isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-xl bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      ) : !data || data.total === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Inbox zero"
          body="No drafts, stale facts, or dedup proposals waiting on you. Nice."
          size="sm"
        />
      ) : (
        <div className="space-y-2.5">
          {/* Intake drafts */}
          {data.intake.count > 0 && (
            <div className="rounded-xl border border-border p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-[var(--ai)] shrink-0" />
                    <span className="text-sm font-medium">Intake drafts</span>
                    <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 h-4">
                      {data.intake.count}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                    {data.intake.byEntityType.map((t) => (
                      <span key={t.entityType} className="flex items-center gap-1">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${ENTITY_TYPE_DOT[t.entityType] ?? "bg-zinc-400"}`}
                        />
                        {ENTITY_TYPE_LABEL[t.entityType] ?? t.entityType} ×{t.count}
                      </span>
                    ))}
                  </div>
                </div>
                <Link
                  href="/intake"
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                >
                  Review
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          )}

          {/* Knowledge drafts */}
          {data.knowledge.count > 0 && (
            <div className="rounded-xl border border-border p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-3.5 w-3.5 text-[var(--ai)] shrink-0" />
                    <span className="text-sm font-medium">Knowledge drafts</span>
                    <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 h-4">
                      {data.knowledge.count}
                    </Badge>
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    {[
                      data.knowledge.fromDocuments > 0 &&
                        `From documents ×${data.knowledge.fromDocuments}`,
                      data.knowledge.fromRuns > 0 &&
                        `Mined from runs ×${data.knowledge.fromRuns}`,
                      data.knowledge.fromAgent > 0 &&
                        `Agent-originated ×${data.knowledge.fromAgent}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  <div className="mt-1 text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                    Avg {Math.round(data.knowledge.avgConfidence * 100)}% confidence
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => bulkAccept.mutate({ threshold: 0.9 })}
                  disabled={bulkAccept.isPending}
                  className="text-[11px] bg-[var(--ai)] hover:bg-[var(--ai)]/90 text-white gap-1"
                >
                  {bulkAccept.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                  Accept ≥90%
                </Button>
              </div>
            </div>
          )}

          {/* Stale facts */}
          {data.stale.count > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="text-sm font-medium">Stale facts</span>
                    <Badge tone="warn" className="text-[10px] font-mono px-1.5 py-0 h-4">
                      {data.stale.count}
                    </Badge>
                  </div>
                  {data.stale.topItems[0] && (
                    <div className="mt-2 text-[11px]">
                      <span className="font-medium">
                        &ldquo;{data.stale.topItems[0].subject}&rdquo;
                      </span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {data.stale.topItems[0].daysSinceTouch} days since review
                      </span>
                    </div>
                  )}
                </div>
                {data.stale.topItems[0] && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      markReviewed.mutate({ id: data.stale.topItems[0]!.id })
                    }
                    disabled={markReviewed.isPending}
                    className="text-[11px] border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                  >
                    {markReviewed.isPending && (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    )}
                    Mark reviewed
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Dedup proposals */}
          {data.dedup.count > 0 && data.dedup.items[0] && (
            <div className="rounded-xl border border-border p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Copy className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium">Dedup proposal</span>
                    <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 h-4">
                      {data.dedup.count}
                    </Badge>
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    New draft <span className="font-medium text-foreground">&ldquo;{data.dedup.items[0].draftSubject}&rdquo;</span>{" "}
                    looks similar to existing fact{" "}
                    <span className="font-medium text-foreground">&ldquo;{data.dedup.items[0].existingSubject}&rdquo;</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      supersede.mutate({
                        draftId: data.dedup.items[0]!.draftId,
                        existingKnowledgeId: data.dedup.items[0]!.existingId,
                      })
                    }
                    disabled={supersede.isPending}
                    className="text-[11px]"
                  >
                    Supersede
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => accept.mutate({ id: data.dedup.items[0]!.draftId })}
                    disabled={accept.isPending}
                    className="text-[11px]"
                  >
                    Keep both
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
