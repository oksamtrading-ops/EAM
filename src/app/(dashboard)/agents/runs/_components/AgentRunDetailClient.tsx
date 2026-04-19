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
          {run.parent && (
            <Link
              href={`/agents/runs/${run.parent.id}`}
              className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-[var(--ai)] transition-colors mb-1"
            >
              <ArrowLeft className="h-3 w-3" />
              Parent run · {run.parent.kind} ({run.parent.status.toLowerCase()})
            </Link>
          )}

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

          {run.subRuns && run.subRuns.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
                Sub-runs ({run.subRuns.length})
              </p>
              <div className="space-y-1.5">
                {run.subRuns.map((sub) => (
                  <SubRunRow key={sub.id} sub={sub} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type SubRun = {
  id: string;
  kind: string;
  status: string;
  startedAt: Date;
  endedAt: Date | null;
  totalTokensIn: number;
  totalTokensOut: number;
  errorMessage: string | null;
};

function SubRunRow({ sub }: { sub: SubRun }) {
  const duration =
    sub.endedAt != null
      ? new Date(sub.endedAt).getTime() - new Date(sub.startedAt).getTime()
      : null;
  return (
    <Link
      href={`/agents/runs/${sub.id}`}
      className="rounded-lg border border-[var(--ai)]/30 bg-[var(--ai)]/5 p-2.5 flex items-center gap-2 hover:bg-[var(--ai)]/10 transition-colors"
    >
      <Sparkles className="h-3.5 w-3.5 text-[var(--ai)] shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="font-mono text-xs text-[var(--ai)] truncate">
          {sub.kind}
        </div>
        {sub.errorMessage && (
          <div className="text-[10px] text-red-600 truncate">
            {sub.errorMessage}
          </div>
        )}
      </div>
      <div className="text-right text-[10px] text-muted-foreground tabular-nums shrink-0">
        <div>{sub.status.toLowerCase()}</div>
        <div>
          {(sub.totalTokensIn + sub.totalTokensOut).toLocaleString()} tok
          {duration != null && ` · ${(duration / 1000).toFixed(1)}s`}
        </div>
      </div>
    </Link>
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
