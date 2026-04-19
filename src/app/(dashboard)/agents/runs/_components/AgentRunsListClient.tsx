"use client";

import Link from "next/link";
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  XCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const STATUS_META: Record<
  string,
  { icon: typeof CheckCircle2; color: string; label: string }
> = {
  SUCCEEDED: {
    icon: CheckCircle2,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    label: "Succeeded",
  },
  FAILED: {
    icon: AlertCircle,
    color: "text-red-600 bg-red-50 border-red-200",
    label: "Failed",
  },
  RUNNING: {
    icon: Loader2,
    color: "text-blue-600 bg-blue-50 border-blue-200",
    label: "Running",
  },
  CANCELLED: {
    icon: XCircle,
    color: "text-muted-foreground bg-muted border-border",
    label: "Cancelled",
  },
};

export function AgentRunsListClient() {
  const { data: runs, isLoading } = trpc.agentRun.list.useQuery({ limit: 100 });

  return (
    <div className="flex h-full flex-col">
      <div className="glass-toolbar border-b px-4 sm:px-5 py-2.5">
        <h1 className="text-md font-semibold text-foreground tracking-tight flex items-center gap-2">
          <span className="h-6 w-6 rounded-md bg-[var(--ai)]/15 flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-[var(--ai)]" />
          </span>
          Agent Runs
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {runs?.length ?? 0} runs · click one to inspect the trace
        </p>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center pt-8">
            Loading runs…
          </p>
        ) : !runs || runs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center pt-8">
            No agent runs yet. Try the Agent Console or a Rationalization critic.
          </p>
        ) : (
          <div className="max-w-4xl mx-auto">
            <div className="rounded-lg border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Status</th>
                    <th className="text-left px-3 py-2 font-medium">Kind</th>
                    <th className="text-left px-3 py-2 font-medium">Started</th>
                    <th className="text-right px-3 py-2 font-medium">Steps</th>
                    <th className="text-right px-3 py-2 font-medium">Tokens</th>
                    <th className="text-right px-3 py-2 font-medium">Model</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {runs.map((run) => {
                    const meta = STATUS_META[run.status] ?? STATUS_META.RUNNING;
                    const Icon = meta.icon;
                    return (
                      <tr
                        key={run.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-3 py-2">
                          <Link
                            href={`/agents/runs/${run.id}`}
                            className="inline-flex items-center gap-1.5"
                          >
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                                meta.color
                              )}
                            >
                              <Icon
                                className={cn(
                                  "h-3 w-3",
                                  run.status === "RUNNING" && "animate-spin"
                                )}
                              />
                              {meta.label}
                            </span>
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          <Link
                            href={`/agents/runs/${run.id}`}
                            className="font-mono text-xs text-[var(--ai)] hover:underline"
                          >
                            {run.kind}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">
                          <Clock className="inline h-3 w-3 mr-1 align-[-2px]" />
                          {formatTime(run.startedAt)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {run._count.steps}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                          {(run.totalTokensIn + run.totalTokensOut).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right text-[11px] text-muted-foreground font-mono">
                          {run.model ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const now = Date.now();
  const diff = now - date.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return date.toLocaleDateString();
}
