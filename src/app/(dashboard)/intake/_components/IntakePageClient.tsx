"use client";

import { useState, useMemo } from "react";
import {
  Upload,
  Inbox,
  Sparkles,
  CheckCircle,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { EmptyState } from "@/components/ui/empty-state";
import { OverflowMenu, type OverflowAction } from "@/components/shared/OverflowMenu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc, type RouterOutputs } from "@/lib/trpc/client";
import { toast } from "sonner";
import { UploadDialog } from "./UploadDialog";
import { DraftCard, type DraftStatusFilter } from "./DraftCard";
import { IntakeDraftPanel } from "./IntakeDraftPanel";
import { IntakeSourceThumbnail } from "./IntakeSourceThumbnail";

type EntityTypeFilter =
  | "ALL"
  | "CAPABILITY"
  | "APPLICATION"
  | "RISK"
  | "VENDOR"
  | "TECH_COMPONENT"
  | "INITIATIVE";

export function IntakePageClient() {
  const [showUpload, setShowUpload] = useState(false);
  const [statusFilter, setStatusFilter] = useState<DraftStatusFilter>("PENDING");
  const [entityFilter, setEntityFilter] = useState<EntityTypeFilter>("ALL");
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data: drafts, isLoading } = trpc.intake.listDrafts.useQuery({
    status: statusFilter === "ALL" ? undefined : statusFilter,
    entityType: entityFilter === "ALL" ? undefined : entityFilter,
  });
  const { data: documents } = trpc.intake.listDocuments.useQuery();

  const acceptMutation = trpc.intake.acceptDraft.useMutation({
    onSuccess: () => {
      toast.success("Draft accepted");
      utils.intake.listDrafts.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const rejectMutation = trpc.intake.rejectDraft.useMutation({
    onSuccess: () => {
      toast.success("Draft rejected");
      utils.intake.listDrafts.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const bulkAccept = trpc.intake.bulkAcceptByConfidence.useMutation({
    onSuccess: (r) => {
      toast.success(
        `Accepted ${r.accepted}${r.failed > 0 ? ` (${r.failed} failed)` : ""}`
      );
      utils.intake.listDrafts.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const g: Record<
      string,
      {
        filename: string;
        documentId: string | null;
        hasThumbnail: boolean;
        drafts: NonNullable<typeof drafts>;
      }
    > = {};
    for (const d of drafts ?? []) {
      const key = d.documentId ?? "__manual__";
      if (!g[key]) {
        g[key] = {
          filename: d.document?.filename ?? "Manual / Unknown",
          documentId: d.documentId,
          hasThumbnail: !!d.document?.hasThumbnail,
          drafts: [] as never,
        };
      }
      g[key].drafts.push(d as never);
    }
    return g;
  }, [drafts]);

  const selectedDraft =
    drafts?.find((d) => d.id === selectedDraftId) ?? null;

  const overflowActions: OverflowAction[] = [
    {
      label: "Accept all ≥90%",
      icon: <Sparkles className="h-4 w-4" />,
      onClick: () => bulkAccept.mutate({ threshold: 0.9 }),
    },
    {
      label: "Accept all ≥80%",
      icon: <Sparkles className="h-4 w-4" />,
      onClick: () => bulkAccept.mutate({ threshold: 0.8 }),
    },
    {
      label: "Upload document",
      icon: <Upload className="h-4 w-4" />,
      onClick: () => setShowUpload(true),
      primary: true,
    },
  ];

  const pendingCount = drafts?.filter((d) => d.status === "PENDING").length ?? 0;

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="glass-toolbar border-b px-4 sm:px-5 py-2.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-md font-semibold text-foreground tracking-tight truncate flex items-center gap-2">
              <span className="h-6 w-6 rounded-md bg-[var(--ai)]/15 flex items-center justify-center">
                <Inbox className="h-3.5 w-3.5 text-[var(--ai)]" />
              </span>
              Intake
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {documents?.length ?? 0} documents · {pendingCount} drafts pending review
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => setShowUpload(true)}
              className="gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload
            </Button>
            <OverflowMenu actions={overflowActions} />
          </div>
        </div>

        {/* Filters */}
        <div className="border-b px-4 sm:px-5 py-2 flex items-center gap-3 bg-background/60">
          <Tabs
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as DraftStatusFilter)}
          >
            <TabsList>
              <TabsTrigger value="PENDING">Pending</TabsTrigger>
              <TabsTrigger value="MODIFIED">Modified</TabsTrigger>
              <TabsTrigger value="ACCEPTED">Accepted</TabsTrigger>
              <TabsTrigger value="REJECTED">Rejected</TabsTrigger>
              <TabsTrigger value="ALL">All</TabsTrigger>
            </TabsList>
          </Tabs>
          <select
            value={entityFilter}
            onChange={(e) =>
              setEntityFilter(e.target.value as EntityTypeFilter)
            }
            className="text-xs border rounded-md px-2 py-1 bg-background"
          >
            <option value="ALL">All entity types</option>
            <option value="CAPABILITY">Capabilities</option>
            <option value="APPLICATION">Applications</option>
            <option value="RISK">Risks</option>
            <option value="VENDOR">Vendors</option>
            <option value="TECH_COMPONENT">Tech Components</option>
            <option value="INITIATIVE">Initiatives</option>
          </select>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
              Loading drafts...
            </div>
          ) : !drafts || drafts.length === 0 ? (
            <IntakeEmptyState onUpload={() => setShowUpload(true)} />
          ) : (
            <div className="space-y-8 max-w-3xl mx-auto">
              {Object.entries(grouped).map(([docId, group]) => (
                <section key={docId} className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.filename}
                      <span className="ml-2 text-muted-foreground/70">
                        ({group.drafts.length})
                      </span>
                    </h2>
                  </div>
                  {group.hasThumbnail && group.documentId && (
                    <IntakeSourceThumbnail
                      documentId={group.documentId}
                      filename={group.filename}
                    />
                  )}
                  <ConfidenceGroups
                    drafts={group.drafts}
                    onAccept={(id) => acceptMutation.mutate({ id })}
                    onReject={(id) => rejectMutation.mutate({ id })}
                    onEdit={(id) => setSelectedDraftId(id)}
                  />
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedDraft && (
        <IntakeDraftPanel
          draft={selectedDraft}
          onClose={() => setSelectedDraftId(null)}
        />
      )}

      <UploadDialog
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onUploaded={() => {
          utils.intake.listDrafts.invalidate();
          utils.intake.listDocuments.invalidate();
        }}
      />
    </div>
  );
}

function IntakeEmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <EmptyState
      icon={Inbox}
      title="No drafts yet"
      body={
        <>
          Upload a current-state review, strategy deck, application inventory,
          or architecture diagram. Claude will extract draft capability,
          application, risk, and vendor records for your review.
        </>
      }
      action={
        <Button onClick={onUpload} size="sm" className="gap-1.5">
          <Upload className="h-3.5 w-3.5" />
          Upload Document
        </Button>
      }
    />
  );
}

type Draft = RouterOutputs["intake"]["listDrafts"][number];

/** Confidence triage — Detected (≥0.7) / Uncertain (0.4–0.7) /
 *  Inferred (<0.4). Three parallel-grammar buckets, each with an
 *  icon (color-only signaling fails WCAG 1.4.1). Uncertain is
 *  expanded by default — those are the drafts a consultant earns
 *  their fee editing. Inferred is collapsed with a callout warning. */
function ConfidenceGroups({
  drafts,
  onAccept,
  onReject,
  onEdit,
}: {
  drafts: Draft[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (id: string) => void;
}) {
  const detected = drafts.filter((d) => d.confidence >= 0.7);
  const uncertain = drafts.filter(
    (d) => d.confidence >= 0.4 && d.confidence < 0.7
  );
  const inferred = drafts.filter((d) => d.confidence < 0.4);

  return (
    <div className="space-y-3">
      {detected.length > 0 && (
        <ConfidenceSection
          tone="success"
          icon={CheckCircle}
          label="Detected"
          drafts={detected}
          defaultOpen
          onAccept={onAccept}
          onReject={onReject}
          onEdit={onEdit}
        />
      )}
      {uncertain.length > 0 && (
        <ConfidenceSection
          tone="warn"
          icon={AlertCircle}
          label="Uncertain"
          drafts={uncertain}
          defaultOpen
          onAccept={onAccept}
          onReject={onReject}
          onEdit={onEdit}
        />
      )}
      {inferred.length > 0 && (
        <div className="space-y-2">
          <Callout tone="warn">
            We weren&apos;t sure about these. Open to verify or dismiss.
          </Callout>
          <ConfidenceSection
            tone="danger"
            icon={HelpCircle}
            label="Inferred"
            drafts={inferred}
            defaultOpen={false}
            onAccept={onAccept}
            onReject={onReject}
            onEdit={onEdit}
          />
        </div>
      )}
    </div>
  );
}

function ConfidenceSection({
  tone,
  icon: Icon,
  label,
  drafts,
  defaultOpen,
  onAccept,
  onReject,
  onEdit,
}: {
  tone: "success" | "warn" | "danger";
  icon: typeof CheckCircle;
  label: string;
  drafts: Draft[];
  defaultOpen: boolean;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (id: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 text-xs font-medium text-foreground hover:text-foreground/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ai)]/50 rounded px-1 -mx-1 py-0.5"
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{label}</span>
        <Badge tone={tone} variant="outline" className="text-[10px] tabular-nums">
          {drafts.length}
        </Badge>
        <span className="text-[10px] text-muted-foreground ml-1">
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open && (
        <div className="space-y-2">
          {drafts.map((d) => (
            <DraftCard
              key={d.id}
              draft={d}
              onAccept={() => onAccept(d.id)}
              onReject={() => onReject(d.id)}
              onEdit={() => onEdit(d.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
