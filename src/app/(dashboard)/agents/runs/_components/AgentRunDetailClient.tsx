"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  Wrench,
  MessageSquare,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

type Props = { runId: string };

export function AgentRunDetailClient({ runId }: Props) {
  const { data: run, isLoading, error } = trpc.agentRun.getById.useQuery({
    id: runId,
  });

  if (isLoading) {
    return (
      <div className="p-8 text-sm text-muted-foreground text-center">
        Loading run…
      </div>
    );
  }
  if (error || !run) {
    return (
      <div className="p-8 text-sm text-red-600 text-center">
        {error?.message ?? "Run not found"}
      </div>
    );
  }

  const duration =
    run.endedAt != null
      ? new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime()
      : null;

  return (
    <div className="flex h-full flex-col">
      <div className="glass-toolbar border-b px-4 sm:px-5 py-2.5 flex items-center gap-3">
        <Link
          href="/agents/runs"
          className="p-1.5 rounded-md hover:bg-muted/50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-md font-semibold text-foreground tracking-tight flex items-center gap-2">
            <span className="h-6 w-6 rounded-md bg-[var(--ai)]/15 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-[var(--ai)]" />
            </span>
            Run {run.id.slice(0, 8)}…
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {run.kind} · {run.status} · {run.steps.length} step
            {run.steps.length === 1 ? "" : "s"}
            {duration != null && ` · ${(duration / 1000).toFixed(1)}s`}
          </p>
        </div>
        <div className="text-right text-[11px] text-muted-foreground tabular-nums">
          <div>
            {run.totalTokensIn.toLocaleString()} in /{" "}
            {run.totalTokensOut.toLocaleString()} out
          </div>
          <div className="font-mono">{run.model ?? "—"}</div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="max-w-3xl mx-auto space-y-2">
          {run.errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex gap-2 text-sm text-red-900">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Run failed</p>
                <p className="text-xs">{run.errorMessage}</p>
              </div>
            </div>
          )}

          {run.steps.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center pt-8">
              No steps recorded.
            </p>
          ) : (
            run.steps.map((step) => <StepRow key={step.id} step={step} />)
          )}
        </div>
      </div>
    </div>
  );
}

type Step = {
  id: string;
  ordinal: number;
  kind: string;
  toolName: string | null;
  payload: unknown;
  latencyMs: number | null;
  createdAt: Date;
};

function StepRow({ step }: { step: Step }) {
  const [expanded, setExpanded] = useState(false);
  const isTool = step.kind === "tool_result" || step.kind === "error";
  const Icon = isTool ? Wrench : MessageSquare;

  const accent = isTool
    ? "border-[var(--ai)]/30 bg-[var(--ai)]/5"
    : step.kind === "error"
      ? "border-red-200 bg-red-50"
      : "border-border bg-card";

  return (
    <div className={cn("rounded-lg border p-3", accent)}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 text-left"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className="font-mono text-[11px] text-muted-foreground w-6 text-right">
          #{step.ordinal}
        </span>
        <Icon
          className={cn(
            "h-3.5 w-3.5",
            isTool ? "text-[var(--ai)]" : "text-muted-foreground"
          )}
        />
        <span className="text-xs font-medium">
          {step.toolName ? (
            <span className="font-mono text-[var(--ai)]">{step.toolName}</span>
          ) : (
            step.kind
          )}
        </span>
        {step.latencyMs != null && (
          <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
            {step.latencyMs}ms
          </span>
        )}
      </button>

      {expanded && (
        <pre className="mt-2 text-[10px] bg-background/60 rounded p-2 overflow-x-auto max-h-96">
{JSON.stringify(step.payload, null, 2)}
        </pre>
      )}
    </div>
  );
}
