"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  Plus,
  Play,
  Pencil,
  Trash2,
  Pause,
  PlayCircle,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type EditingState = {
  id?: string;
  name: string;
  prompt: string;
  cronExpression: string;
  enabled: boolean;
};

const EMPTY: EditingState = {
  name: "",
  prompt: "",
  cronExpression: "0 9 * * 1", // Monday 09:00 UTC
  enabled: true,
};

const CRON_PRESETS: Array<{ label: string; value: string }> = [
  { label: "Every Monday 09:00", value: "0 9 * * 1" },
  { label: "Every weekday 08:00", value: "0 8 * * 1-5" },
  { label: "First of month 09:00", value: "0 9 1 * *" },
  { label: "Hourly", value: "0 * * * *" },
];

export function ScheduledTasksClient() {
  const [editing, setEditing] = useState<EditingState | null>(null);
  const utils = trpc.useUtils();
  const { data: tasks, isLoading } = trpc.scheduledAgentTask.list.useQuery();

  const create = trpc.scheduledAgentTask.create.useMutation({
    onSuccess: () => {
      toast.success("Task scheduled");
      utils.scheduledAgentTask.list.invalidate();
      setEditing(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.scheduledAgentTask.update.useMutation({
    onSuccess: () => {
      utils.scheduledAgentTask.list.invalidate();
      setEditing(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.scheduledAgentTask.delete.useMutation({
    onSuccess: () => {
      toast.success("Deleted");
      utils.scheduledAgentTask.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const runNow = trpc.scheduledAgentTask.runNow.useMutation({
    onSuccess: () => {
      toast.success("Run complete — check trace in Agent Runs");
      utils.scheduledAgentTask.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  function save() {
    if (!editing) return;
    if (!editing.name.trim() || !editing.prompt.trim() || !editing.cronExpression.trim()) {
      toast.error("Name, prompt, and schedule are required");
      return;
    }
    const payload = {
      name: editing.name.trim(),
      prompt: editing.prompt.trim(),
      cronExpression: editing.cronExpression.trim(),
      enabled: editing.enabled,
    };
    if (editing.id) {
      update.mutate({ id: editing.id, ...payload });
    } else {
      create.mutate(payload);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="glass-toolbar border-b px-4 sm:px-5 py-2.5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-md font-semibold text-foreground tracking-tight flex items-center gap-2">
            <span className="h-6 w-6 rounded-md bg-[var(--ai)]/15 flex items-center justify-center">
              <CalendarClock className="h-3.5 w-3.5 text-[var(--ai)]" />
            </span>
            Scheduled Agents
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {tasks?.length ?? 0} task{tasks?.length === 1 ? "" : "s"} · Vercel
            Cron triggers the hourly check
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setEditing(EMPTY)}
          className="gap-1.5 bg-[var(--ai)] hover:bg-[var(--ai)]/90 text-white"
        >
          <Plus className="h-3.5 w-3.5" />
          New scheduled task
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center pt-8">
            Loading…
          </p>
        ) : !tasks || tasks.length === 0 ? (
          <EmptyState onAdd={() => setEditing(EMPTY)} />
        ) : (
          <div className="max-w-3xl mx-auto space-y-2">
            {tasks.map((t) => (
              <div
                key={t.id}
                className={cn(
                  "rounded-lg border bg-card p-3 space-y-2",
                  !t.enabled && "opacity-60"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {t.enabled ? (
                        <PlayCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <Pause className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                      <h3 className="text-sm font-medium text-foreground truncate">
                        {t.name}
                      </h3>
                      <code className="text-[10px] bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded font-mono">
                        {t.cronExpression}
                      </code>
                    </div>
                    <p className="text-[12px] text-muted-foreground mt-1 line-clamp-2">
                      {t.prompt}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1.5">
                      <span>
                        Next:{" "}
                        {t.nextRunAt
                          ? new Date(t.nextRunAt).toLocaleString()
                          : "—"}
                      </span>
                      {t.lastRunAt && (
                        <span>
                          Last:{" "}
                          {new Date(t.lastRunAt).toLocaleString()}
                        </span>
                      )}
                      {t.lastRun && (
                        <Link
                          href={`/agents/runs/${t.lastRun.id}`}
                          className="inline-flex items-center gap-1 text-[var(--ai)] hover:underline"
                        >
                          {t.lastRun.status === "SUCCEEDED" ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <AlertCircle className="h-3 w-3" />
                          )}
                          View last run
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => runNow.mutate({ id: t.id })}
                      disabled={runNow.isPending}
                      className="p-1.5 rounded text-muted-foreground hover:text-[var(--ai)] hover:bg-[var(--ai)]/10 disabled:opacity-50"
                      aria-label="Run now"
                      title="Run now"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() =>
                        update.mutate({ id: t.id, enabled: !t.enabled })
                      }
                      className="p-1.5 rounded text-muted-foreground hover:text-amber-600 hover:bg-amber-50"
                      aria-label={t.enabled ? "Disable" : "Enable"}
                      title={t.enabled ? "Disable" : "Enable"}
                    >
                      {t.enabled ? (
                        <Pause className="h-3.5 w-3.5" />
                      ) : (
                        <PlayCircle className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() =>
                        setEditing({
                          id: t.id,
                          name: t.name,
                          prompt: t.prompt,
                          cronExpression: t.cronExpression,
                          enabled: t.enabled,
                        })
                      }
                      className="p-1.5 rounded text-muted-foreground hover:text-[var(--ai)] hover:bg-[var(--ai)]/10"
                      aria-label="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (!window.confirm(`Delete "${t.name}"?`)) return;
                        del.mutate({ id: t.id });
                      }}
                      className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? "Edit scheduled task" : "New scheduled task"}
            </DialogTitle>
            <DialogDescription>
              The agent runs on the schedule with this prompt as the single
              user message. Results appear under Agent Runs.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Name
                </label>
                <Input
                  autoFocus={!editing.id}
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                  placeholder="e.g. Weekly EOL scan"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Prompt
                </label>
                <Textarea
                  value={editing.prompt}
                  onChange={(e) =>
                    setEditing({ ...editing, prompt: e.target.value })
                  }
                  rows={4}
                  placeholder="Check for new technology EOL risks and summarize any critical ones."
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Schedule (5-field cron, UTC)
                </label>
                <Input
                  value={editing.cronExpression}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      cronExpression: e.target.value,
                    })
                  }
                  className="font-mono text-sm"
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {CRON_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() =>
                        setEditing({ ...editing, cronExpression: p.value })
                      }
                      className="text-[10px] px-2 py-0.5 rounded-full border bg-background hover:bg-[var(--ai)]/5 hover:border-[var(--ai)]/40 transition-colors text-muted-foreground"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.enabled}
                  onChange={(e) =>
                    setEditing({ ...editing, enabled: e.target.checked })
                  }
                  className="h-3.5 w-3.5 accent-[var(--ai)]"
                />
                Enabled
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={save}
                  disabled={create.isPending || update.isPending}
                  className="bg-[var(--ai)] hover:bg-[var(--ai)]/90 text-white"
                >
                  {editing.id ? "Save" : "Schedule"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <div className="h-12 w-12 rounded-xl bg-[var(--ai)]/15 flex items-center justify-center mb-3">
        <CalendarClock className="h-6 w-6 text-[var(--ai)]" />
      </div>
      <p className="text-sm font-medium mb-1">No scheduled tasks yet</p>
      <p className="text-xs text-muted-foreground mb-4 max-w-md">
        Schedule recurring agent checks — e.g. "weekly EOL scan," "first-of-month
        rationalization review." Each run appears under Agent Runs with kind
        <code className="mx-1 text-[11px] bg-muted/60 px-1 rounded">
          scheduled:&lt;name&gt;
        </code>
        .
      </p>
      <Button onClick={onAdd} size="sm" className="gap-1.5">
        <Plus className="h-3.5 w-3.5" />
        Schedule your first task
      </Button>
    </div>
  );
}
