"use client";

import { useMemo, useState } from "react";
import {
  Package,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Download,
  Sparkles,
  BookOpen,
  Map as MapIcon,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3 | 4;

export function DeliverableWizardClient() {
  const { workspaceId } = useWorkspace();
  const [step, setStep] = useState<Step>(1);
  const [runIds, setRunIds] = useState<Set<string>>(new Set());
  const [knowledgeIds, setKnowledgeIds] = useState<Set<string>>(new Set());
  const [initiativeIds, setInitiativeIds] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [generating, setGenerating] = useState(false);

  const { data: runs } = trpc.agentRun.list.useQuery({
    limit: 100,
    hideSubRuns: true,
  });
  const { data: facts } = trpc.workspaceKnowledge.list.useQuery({
    limit: 200,
  });
  const { data: initiatives } = trpc.initiative.list.useQuery();

  const selectionCount =
    runIds.size + knowledgeIds.size + initiativeIds.size;

  function toggle(set: Set<string>, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }

  async function generate() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (selectionCount === 0) {
      toast.error("Select at least one run, fact, or initiative");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/export/deliverable-docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          title: title.trim(),
          runIds: [...runIds],
          knowledgeIds: [...knowledgeIds],
          initiativeIds: [...initiativeIds],
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? `Build failed: ${res.status}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slugify(title)}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Deliverable downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Build failed");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="glass-toolbar border-b px-4 sm:px-5 py-2.5">
        <h1 className="text-md font-semibold text-foreground tracking-tight flex items-center gap-2">
          <span className="h-6 w-6 rounded-md bg-[var(--ai)]/15 flex items-center justify-center">
            <Package className="h-3.5 w-3.5 text-[var(--ai)]" />
          </span>
          Bundle deliverable
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Pick runs, facts, and initiatives to compile into a Word document
          with an AI-generated executive summary.
        </p>
      </div>

      <div className="border-b px-4 sm:px-5 py-2 bg-background/60">
        <StepIndicator step={step} />
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="max-w-3xl mx-auto">
          {step === 1 && (
            <StepPanel
              icon={<Activity className="h-4 w-4 text-[var(--ai)]" />}
              title="Findings (Agent Runs)"
              subtitle="Final text from these runs becomes the Findings section."
              empty={!runs || runs.items.length === 0 ? "No runs yet" : null}
            >
              <div className="rounded-lg border bg-card divide-y">
                {(runs?.items ?? []).map((r) => (
                  <CheckboxRow
                    key={r.id}
                    checked={runIds.has(r.id)}
                    onChange={() => setRunIds((s) => toggle(s, r.id))}
                    primary={r.kind}
                    secondary={`${r.status} · ${new Date(r.startedAt).toLocaleDateString()} · ${r._count.steps} steps`}
                  />
                ))}
              </div>
            </StepPanel>
          )}

          {step === 2 && (
            <StepPanel
              icon={<BookOpen className="h-4 w-4 text-[var(--ai)]" />}
              title="Curated Knowledge"
              subtitle="Facts become a table in the deliverable."
              empty={!facts || facts.length === 0 ? "No facts yet" : null}
            >
              <div className="rounded-lg border bg-card divide-y max-h-[60vh] overflow-auto">
                {(facts ?? []).map((f) => (
                  <CheckboxRow
                    key={f.id}
                    checked={knowledgeIds.has(f.id)}
                    onChange={() =>
                      setKnowledgeIds((s) => toggle(s, f.id))
                    }
                    primary={f.subject}
                    secondary={f.statement}
                    rightBadge={`${f.kind} · ${Math.round(f.confidence * 100)}%`}
                  />
                ))}
              </div>
            </StepPanel>
          )}

          {step === 3 && (
            <StepPanel
              icon={<MapIcon className="h-4 w-4 text-[var(--ai)]" />}
              title="Recommended Initiatives"
              subtitle="Initiatives become a table with rationale."
              empty={
                !initiatives || initiatives.length === 0
                  ? "No initiatives yet"
                  : null
              }
            >
              <div className="rounded-lg border bg-card divide-y max-h-[60vh] overflow-auto">
                {(initiatives ?? []).map((i) => (
                  <CheckboxRow
                    key={i.id}
                    checked={initiativeIds.has(i.id)}
                    onChange={() =>
                      setInitiativeIds((s) => toggle(s, i.id))
                    }
                    primary={i.name}
                    secondary={i.description ?? ""}
                    rightBadge={`${i.category} · ${i.horizon}`}
                  />
                ))}
              </div>
            </StepPanel>
          )}

          {step === 4 && (
            <StepPanel
              icon={<Sparkles className="h-4 w-4 text-[var(--ai)]" />}
              title="Title & generate"
              subtitle={`${selectionCount} item${selectionCount === 1 ? "" : "s"} selected · ${runIds.size} runs · ${knowledgeIds.size} facts · ${initiativeIds.size} initiatives`}
            >
              <div className="space-y-3">
                <div>
                  <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Document title
                  </Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Acme Retail — Architecture Review Q2 2026"
                    className="mt-1"
                  />
                </div>
                <Button
                  onClick={generate}
                  disabled={generating || selectionCount === 0}
                  className="w-full gap-1.5 bg-[var(--ai)] hover:bg-[var(--ai)]/90 text-white"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating executive summary + assembling DOCX…
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Generate &amp; download
                    </>
                  )}
                </Button>
                <p className="text-[11px] text-muted-foreground text-center">
                  Uses Claude Sonnet for the exec summary. ~15–30s for
                  moderate bundles; larger selections take longer.
                </p>
              </div>
            </StepPanel>
          )}
        </div>
      </div>

      <div className="border-t px-4 sm:px-5 py-3 bg-background/60 flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
          disabled={step === 1}
          className="gap-1"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back
        </Button>
        <span className="text-xs text-muted-foreground">
          {selectionCount} selected
        </span>
        {step < 4 ? (
          <Button
            size="sm"
            onClick={() => setStep((s) => ((s + 1) as Step))}
            className="gap-1 bg-[var(--ai)] hover:bg-[var(--ai)]/90 text-white"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <span className="w-[68px]" />
        )}
      </div>
    </div>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps = [
    { n: 1, label: "Runs" },
    { n: 2, label: "Knowledge" },
    { n: 3, label: "Initiatives" },
    { n: 4, label: "Title" },
  ];
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center gap-2">
          <div
            className={cn(
              "h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-medium border",
              step === s.n
                ? "bg-[var(--ai)] text-white border-[var(--ai)]"
                : step > s.n
                  ? "bg-[var(--ai)]/15 text-[var(--ai)] border-[var(--ai)]/30"
                  : "bg-muted/40 text-muted-foreground border-border"
            )}
          >
            {s.n}
          </div>
          <span
            className={cn(
              "text-xs",
              step === s.n
                ? "text-foreground font-medium"
                : "text-muted-foreground"
            )}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
      ))}
    </div>
  );
}

function StepPanel({
  icon,
  title,
  subtitle,
  empty,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  empty?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
      {empty ? (
        <p className="text-xs text-muted-foreground text-center py-8">
          {empty}
        </p>
      ) : (
        children
      )}
    </div>
  );
}

function CheckboxRow({
  checked,
  onChange,
  primary,
  secondary,
  rightBadge,
}: {
  checked: boolean;
  onChange: () => void;
  primary: string;
  secondary: string;
  rightBadge?: string;
}) {
  return (
    <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 accent-[var(--ai)] shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{primary}</div>
        {secondary && (
          <div className="text-[11px] text-muted-foreground line-clamp-2">
            {secondary}
          </div>
        )}
      </div>
      {rightBadge && (
        <Badge variant="outline" className="text-[10px] shrink-0">
          {rightBadge}
        </Badge>
      )}
    </label>
  );
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "deliverable"
  );
}
