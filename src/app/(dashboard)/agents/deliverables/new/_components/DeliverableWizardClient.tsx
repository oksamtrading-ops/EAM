"use client";

import { useState } from "react";
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
  TrendingUp,
  Layers,
  Lock,
  Check,
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
type EngagementType =
  | "rationalization"
  | "capability-maturity"
  | "architecture-roadmap"
  | "generic"
  | null;

export function DeliverableWizardClient() {
  const { workspaceId } = useWorkspace();
  const [engagementType, setEngagementType] = useState<EngagementType>(null);
  const [step, setStep] = useState<Step>(1);
  const [runIds, setRunIds] = useState<Set<string>>(new Set());
  const [knowledgeIds, setKnowledgeIds] = useState<Set<string>>(new Set());
  const [initiativeIds, setInitiativeIds] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [generating, setGenerating] = useState(false);
  const [clientNameOverride, setClientNameOverride] = useState("");

  const { data: runs } = trpc.agentRun.list.useQuery({
    limit: 100,
    hideSubRuns: true,
    // Skip runs whose conversation was deleted — they'd show as
    // anonymous "console" rows without a title.
    hideOrphanConsole: true,
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

  async function generateTyped(
    type: "rationalization" | "capability-maturity" | "architecture-roadmap",
    successLabel: string,
    fallbackFilename: string
  ) {
    setGenerating(true);
    try {
      const res = await fetch("/api/export/deliverable-docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          type,
          clientNameOverride: clientNameOverride.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? `Build failed: ${res.status}`);
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") ?? "";
      const fnMatch = cd.match(/filename="([^"]+)"/);
      const filename = fnMatch?.[1] ?? fallbackFilename;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(successLabel);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Build failed");
    } finally {
      setGenerating(false);
    }
  }

  function generateRationalization() {
    return generateTyped(
      "rationalization",
      "Rationalization plan downloaded",
      "rationalization.docx"
    );
  }

  function generateCapabilityMaturity() {
    return generateTyped(
      "capability-maturity",
      "Capability maturity assessment downloaded",
      "capability-maturity.docx"
    );
  }

  function generateArchitectureRoadmap() {
    return generateTyped(
      "architecture-roadmap",
      "Architecture roadmap downloaded",
      "architecture-roadmap.docx"
    );
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

  // ─── Engagement-type picker (shown first, before any step) ────
  if (engagementType === null) {
    return (
      <div className="flex h-full flex-col">
        <div className="glass-toolbar border-b px-4 sm:px-5 py-2.5">
          <h1 className="text-md font-semibold text-foreground tracking-tight flex items-center gap-2">
            <span className="h-6 w-6 rounded-md bg-[var(--ai)]/15 flex items-center justify-center">
              <Package className="h-3.5 w-3.5 text-[var(--ai)]" />
            </span>
            New deliverable
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pick the engagement type. Each template produces a
            client-ready Word document with workspace branding.
          </p>
        </div>
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="max-w-3xl mx-auto space-y-3">
            <EngagementCard
              icon={<TrendingUp className="h-5 w-5" />}
              title="Application Rationalization Plan"
              description="TIME analysis, redundancy map, decommission roadmap, and projected savings. Drawn directly from the workspace's classified applications."
              available
              onSelect={() => setEngagementType("rationalization")}
            />
            <EngagementCard
              icon={<Layers className="h-5 w-5" />}
              title="Capability Maturity Assessment"
              description="Strategic-importance × current-maturity matrix, action-class bands (Lift / Sustain / Invest Beyond / Reassess), per-capability deep dives, and a NOW / NEXT / LATER investment roadmap. Drawn from this workspace's capability assessments + linked applications."
              available
              onSelect={() => setEngagementType("capability-maturity")}
            />
            <EngagementCard
              icon={<MapIcon className="h-5 w-5" />}
              title="Architecture Roadmap"
              description="NOW / NEXT / LATER wave plan with Gantt swim-lane, dependency keystones, per-initiative deep dives, benefits curve, risk heatmap. Cross-references rationalization + maturity outputs as a structural bridge."
              available
              onSelect={() => setEngagementType("architecture-roadmap")}
            />

            <div className="pt-4 border-t">
              <button
                type="button"
                onClick={() => setEngagementType("generic")}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Or build a generic deliverable from selected runs, facts, and initiatives →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Rationalization confirmation step ────────────────────────
  if (engagementType === "rationalization") {
    return (
      <div className="flex h-full flex-col">
        <div className="glass-toolbar border-b px-4 sm:px-5 py-2.5 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-md font-semibold text-foreground tracking-tight flex items-center gap-2">
              <span className="h-6 w-6 rounded-md bg-[var(--ai)]/15 flex items-center justify-center">
                <TrendingUp className="h-3.5 w-3.5 text-[var(--ai)]" />
              </span>
              Application Rationalization Plan
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Generates from this workspace&apos;s classified applications.
              No selection required.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEngagementType(null)}
            className="text-xs"
          >
            <ChevronLeft className="h-3.5 w-3.5 mr-1" />
            Change type
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="max-w-2xl mx-auto space-y-5">
            <div className="rounded-lg border bg-card p-4">
              <h2 className="text-sm font-semibold mb-2">
                What&apos;s included
              </h2>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-[var(--ai)] mt-0.5 shrink-0" />
                  Branded cover page (workspace clientName + brand color)
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-[var(--ai)] mt-0.5 shrink-0" />
                  Executive summary (deterministic facts, LLM-glued prose)
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-[var(--ai)] mt-0.5 shrink-0" />
                  Methodology + assumptions callout
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-[var(--ai)] mt-0.5 shrink-0" />
                  Portfolio snapshot (TIME counts and costs)
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-[var(--ai)] mt-0.5 shrink-0" />
                  TIME quadrant analysis (BV × technical health 2×2)
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-[var(--ai)] mt-0.5 shrink-0" />
                  Top elimination + migration candidates (top 10 by cost)
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-[var(--ai)] mt-0.5 shrink-0" />
                  Redundancy map (capabilities served by ≥2 apps)
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-[var(--ai)] mt-0.5 shrink-0" />
                  Decommission roadmap (NOW / NEXT / LATER horizons)
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-[var(--ai)] mt-0.5 shrink-0" />
                  Projected 3-year savings
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-[var(--ai)] mt-0.5 shrink-0" />
                  Appendices: full classified app list + methodology
                </li>
              </ul>
            </div>

            <div>
              <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Client name override (optional)
              </Label>
              <Input
                value={clientNameOverride}
                onChange={(e) => setClientNameOverride(e.target.value)}
                placeholder="Defaults to the workspace's clientName"
                className="mt-1"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Leave blank to use this workspace&apos;s configured client name.
              </p>
            </div>

            <Button
              onClick={generateRationalization}
              disabled={generating}
              className="w-full gap-1.5 bg-[var(--ai)] hover:bg-[var(--ai)]/90 text-white"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Computing metrics + assembling DOCX…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Generate Rationalization Plan
                </>
              )}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              ~5–15 seconds. The exec summary is grounded against the
              deterministic facts; numbers in the summary always match
              the body sections.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Capability Maturity confirmation step ────────────────────
  if (engagementType === "capability-maturity") {
    return (
      <div className="flex h-full flex-col">
        <div className="glass-toolbar border-b px-4 sm:px-5 py-2.5 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-md font-semibold text-foreground tracking-tight flex items-center gap-2">
              <span className="h-6 w-6 rounded-md bg-[var(--ai)]/15 flex items-center justify-center">
                <Layers className="h-3.5 w-3.5 text-[var(--ai)]" />
              </span>
              Capability Maturity Assessment
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Generates from this workspace&apos;s capabilities, current
              and target maturity, and linked applications.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEngagementType(null)}
            className="text-xs"
          >
            <ChevronLeft className="h-3.5 w-3.5 mr-1" />
            Change type
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="max-w-2xl mx-auto space-y-5">
            <div className="rounded-lg border bg-card p-4">
              <h2 className="text-sm font-semibold mb-2">
                What&apos;s included
              </h2>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-[var(--ai)] mt-0.5 shrink-0" />
                  Branded cover, inside-cover disclaimer, deterministic TOC
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-[var(--ai)] mt-0.5 shrink-0" />
                  Synthesis layer: KPI hero row, CRITICAL maturity bar, Five Key Findings, Maturity Dashboard
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-[var(--ai)] mt-0.5 shrink-0" />
                  Strategic-importance × current-maturity matrix
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-[var(--ai)] mt-0.5 shrink-0" />
                  L1-domain maturity heatmap with current → target progression
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-[var(--ai)] mt-0.5 shrink-0" />
                  Capability-Application coverage bridge (linked apps + TIME dispositions)
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-[var(--ai)] mt-0.5 shrink-0" />
                  Action-class bands: Lift / Sustain / Invest Beyond / Reassess + NOT_ASSESSED callout
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-[var(--ai)] mt-0.5 shrink-0" />
                  Top-5 capability deep dives with gap-type classification + wave assignment
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-[var(--ai)] mt-0.5 shrink-0" />
                  Investment Roadmap (NOW / NEXT / LATER), workspace-specific risks, 30-day Next Steps
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-[var(--ai)] mt-0.5 shrink-0" />
                  Appendices: full capability listing, methodology, glossary
                </li>
              </ul>
              <p className="text-[11px] text-muted-foreground mt-3 pt-3 border-t">
                The deliverable&apos;s currency is gap-levels and
                sequencing; investment cost is intentionally not
                computed in v1 (the methodology callout makes the
                trade-off explicit).
              </p>
            </div>

            <div>
              <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Client name override (optional)
              </Label>
              <Input
                value={clientNameOverride}
                onChange={(e) => setClientNameOverride(e.target.value)}
                placeholder="Defaults to the workspace's clientName"
                className="mt-1"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Leave blank to use this workspace&apos;s configured client name.
              </p>
            </div>

            <Button
              onClick={generateCapabilityMaturity}
              disabled={generating}
              className="w-full gap-1.5 bg-[var(--ai)] hover:bg-[var(--ai)]/90 text-white"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Computing maturity metrics + assembling DOCX…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Generate Capability Maturity Assessment
                </>
              )}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              ~10–25 seconds. Four LLM calls run in parallel; counts and
              percentages in the prose are exact-match-grounded against
              the metrics.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Architecture Roadmap confirmation step ──────────────────
  if (engagementType === "architecture-roadmap") {
    return (
      <div className="flex h-full flex-col">
        <div className="glass-toolbar border-b px-4 sm:px-5 py-2.5 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-md font-semibold text-foreground tracking-tight flex items-center gap-2">
              <span className="h-6 w-6 rounded-md bg-[var(--ai)]/15 flex items-center justify-center">
                <MapIcon className="h-3.5 w-3.5 text-[var(--ai)]" />
              </span>
              Architecture Roadmap
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Generates from this workspace&apos;s active initiatives, dependencies,
              and cross-references to applications + capabilities.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEngagementType(null)}
            className="text-xs"
          >
            <ChevronLeft className="h-3.5 w-3.5 mr-1" />
            Change type
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="max-w-2xl mx-auto space-y-5">
            <div className="rounded-lg border bg-card p-4">
              <h2 className="text-sm font-semibold mb-2">
                What&apos;s included
              </h2>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-[var(--ai)] mt-0.5 shrink-0" />
                  Branded cover, inside-cover disclaimer, deterministic TOC
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-[var(--ai)] mt-0.5 shrink-0" />
                  Synthesis: KPI hero row, NOW / NEXT / LATER Gantt swim-lane (hero chart), Five Key Findings, Wave Dashboard
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-[var(--ai)] mt-0.5 shrink-0" />
                  Current State: executive summary, initiative inventory, dependency network with keystone identification, cross-deliverable coverage
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-[var(--ai)] mt-0.5 shrink-0" />
                  Wave Plans: NOW / NEXT / LATER narratives with counterfactual blocks
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-[var(--ai)] mt-0.5 shrink-0" />
                  Top-7 initiative deep dives with linked apps + capabilities + risk profile + wave assignment
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-[var(--ai)] mt-0.5 shrink-0" />
                  Roadmap & Risks: benefits delivery curve, risk heatmap, workspace-specific risks, 30-day Next Steps
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-[var(--ai)] mt-0.5 shrink-0" />
                  Appendices: full initiative listing, methodology, glossary
                </li>
              </ul>
              <p className="text-[11px] text-muted-foreground mt-3 pt-3 border-t">
                The deliverable&apos;s currency is initiative count × wave ×
                dependency coverage; per-initiative budgets are not
                aggregated in v1 (the methodology callout makes the
                trade-off explicit). At &lt;8 initiatives the workspace
                routes to the Architecture Roadmap Baseline Report
                instead — definition priorities + cross-deliverable
                bridge gaps + 30-day plan.
              </p>
            </div>

            <div>
              <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Client name override (optional)
              </Label>
              <Input
                value={clientNameOverride}
                onChange={(e) => setClientNameOverride(e.target.value)}
                placeholder="Defaults to the workspace's clientName"
                className="mt-1"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Leave blank to use this workspace&apos;s configured client name.
              </p>
            </div>

            <Button
              onClick={generateArchitectureRoadmap}
              disabled={generating}
              className="w-full gap-1.5 bg-[var(--ai)] hover:bg-[var(--ai)]/90 text-white"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Computing roadmap metrics + assembling DOCX…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Generate Architecture Roadmap
                </>
              )}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              ~10–25 seconds. Four LLM calls run in parallel; counts and
              percentages in the prose are exact-match-grounded against
              the metrics.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Generic deliverable (legacy 4-step flow) ─────────────────
  return (
    <div className="flex h-full flex-col">
      <div className="glass-toolbar border-b px-4 sm:px-5 py-2.5 flex items-start justify-between gap-3">
        <div>
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setEngagementType(null)}
          className="text-xs"
        >
          <ChevronLeft className="h-3.5 w-3.5 mr-1" />
          Change type
        </Button>
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
                {(runs?.items ?? []).map((r) => {
                  // Prefer the conversation title (e.g. "Which apps
                  // are candidates to retire?") over the raw kind
                  // ("console"), which is identical for every
                  // Agent Console run and uselessly ambiguous here.
                  const primary =
                    r.conversation?.title?.trim() || r.kind;
                  const secondary = r.conversation
                    ? `${r.kind} · ${r.status} · ${new Date(r.startedAt).toLocaleDateString()} · ${r._count.steps} steps`
                    : `${r.status} · ${new Date(r.startedAt).toLocaleDateString()} · ${r._count.steps} steps`;
                  return (
                    <CheckboxRow
                      key={r.id}
                      checked={runIds.has(r.id)}
                      onChange={() => setRunIds((s) => toggle(s, r.id))}
                      primary={primary}
                      secondary={secondary}
                    />
                  );
                })}
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

      {/*
        Right-pad the footer by the launcher footprint (48px button + 24px
        right edge = ~72px clearance) so the Next button never sits
        under the global AgentConsoleLauncher.
      */}
      <div className="border-t px-4 sm:px-5 py-3 bg-background/60 flex items-center justify-between sm:pr-24">
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

function EngagementCard({
  icon,
  title,
  description,
  available,
  comingSoonNote,
  onSelect,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  available: boolean;
  comingSoonNote?: string;
  onSelect?: () => void;
}) {
  const Comp = available ? "button" : "div";
  return (
    <Comp
      type={available ? "button" : undefined}
      onClick={available ? onSelect : undefined}
      className={cn(
        "w-full rounded-lg border bg-card p-4 text-left transition-colors",
        available
          ? "hover:border-[var(--ai)] hover:bg-[var(--ai)]/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ai)]/50 cursor-pointer"
          : "opacity-60"
      )}
      title={!available ? comingSoonNote : undefined}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
            available
              ? "bg-[var(--ai)]/15 text-[var(--ai)]"
              : "bg-muted/40 text-muted-foreground"
          )}
        >
          {available ? icon : <Lock className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold">{title}</h3>
            {!available && (
              <Badge variant="outline" className="text-[10px]">
                Coming soon
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
        {available && (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
        )}
      </div>
    </Comp>
  );
}
