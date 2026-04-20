"use client";

import { useEffect, useState } from "react";
import { Sparkles, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

type FormState = {
  maxToolIterations: number;
  subAgentBudget: number;
  llmMaxTokens: number;
  autoAcceptEnabled: boolean;
  autoAcceptConfidence: number;
  criticEnabled: boolean;
  staleKnowledgeDays: number;
};

const DEFAULTS: FormState = {
  maxToolIterations: 6,
  subAgentBudget: 3,
  llmMaxTokens: 1500,
  autoAcceptEnabled: false,
  autoAcceptConfidence: 0.9,
  criticEnabled: true,
  staleKnowledgeDays: 90,
};

export function AgentSettingsClient() {
  const { data, isLoading } = trpc.workspaceAgentSettings.get.useQuery();
  const [form, setForm] = useState<FormState>(DEFAULTS);
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!data) return;
    setForm({
      maxToolIterations: data.maxToolIterations,
      subAgentBudget: data.subAgentBudget,
      llmMaxTokens: data.llmMaxTokens,
      autoAcceptEnabled: data.autoAcceptConfidence != null,
      autoAcceptConfidence: data.autoAcceptConfidence ?? 0.9,
      criticEnabled: data.criticEnabled,
      staleKnowledgeDays: data.staleKnowledgeDays ?? 90,
    });
  }, [data]);

  const updateMutation = trpc.workspaceAgentSettings.update.useMutation({
    onSuccess: () => {
      toast.success("Agent settings saved");
      utils.workspaceAgentSettings.get.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const resetMutation = trpc.workspaceAgentSettings.reset.useMutation({
    onSuccess: () => {
      toast.success("Reset to defaults");
      setForm(DEFAULTS);
      utils.workspaceAgentSettings.get.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  function save() {
    updateMutation.mutate({
      maxToolIterations: form.maxToolIterations,
      subAgentBudget: form.subAgentBudget,
      llmMaxTokens: form.llmMaxTokens,
      autoAcceptConfidence: form.autoAcceptEnabled
        ? form.autoAcceptConfidence
        : null,
      criticEnabled: form.criticEnabled,
      staleKnowledgeDays: form.staleKnowledgeDays,
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="glass-toolbar border-b px-4 sm:px-5 py-2.5">
        <h1 className="text-md font-semibold text-foreground tracking-tight flex items-center gap-2">
          <span className="h-6 w-6 rounded-md bg-[var(--ai)]/15 flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-[var(--ai)]" />
          </span>
          Agent Settings
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Per-workspace tuning. Applies to every agent run in this workspace.
        </p>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center pt-8">
              Loading…
            </p>
          ) : (
            <>
              <div className="rounded-lg border bg-card p-5 space-y-5">
                <SettingRow
                  label="Max tool iterations"
                  help="How many tool-use rounds the agent can run in a single user turn. Lower = faster but may give up early; higher = can solve more complex queries. Default 6."
                >
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={form.maxToolIterations}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        maxToolIterations: Math.max(
                          1,
                          Math.min(20, parseInt(e.target.value) || 1)
                        ),
                      })
                    }
                    className="w-24"
                  />
                </SettingRow>

                <SettingRow
                  label="Sub-agent budget"
                  help="How many sub-agent calls (rationalize, impact, coverage) the parent can fan out per turn. Default 3."
                >
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    value={form.subAgentBudget}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        subAgentBudget: Math.max(
                          0,
                          Math.min(10, parseInt(e.target.value) || 0)
                        ),
                      })
                    }
                    className="w-24"
                  />
                </SettingRow>

                <SettingRow
                  label="LLM max tokens"
                  help="Upper bound on the completion size for each agent LLM call. Higher = more room for verbose answers; lower = cheaper, tighter responses. Default 1500."
                >
                  <Input
                    type="number"
                    min={256}
                    max={8000}
                    step={100}
                    value={form.llmMaxTokens}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        llmMaxTokens: Math.max(
                          256,
                          Math.min(8000, parseInt(e.target.value) || 1500)
                        ),
                      })
                    }
                    className="w-28"
                  />
                </SettingRow>

                <div className="border-t pt-5 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <Label className="text-sm font-medium">
                        Auto-accept knowledge drafts
                      </Label>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        When on, knowledge-draft proposals at or above the
                        threshold skip the approval queue and commit directly.
                        Off = every draft reviewed manually.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={form.autoAcceptEnabled}
                      onChange={(e) =>
                        setForm({ ...form, autoAcceptEnabled: e.target.checked })
                      }
                      className="h-4 w-4 accent-[var(--ai)] mt-1 shrink-0"
                    />
                  </div>
                  {form.autoAcceptEnabled && (
                    <div className="pl-1">
                      <Label className="text-[11px] text-muted-foreground">
                        Confidence threshold:{" "}
                        <span className="font-mono text-foreground">
                          {Math.round(form.autoAcceptConfidence * 100)}%
                        </span>
                      </Label>
                      <input
                        type="range"
                        min={0.5}
                        max={1}
                        step={0.05}
                        value={form.autoAcceptConfidence}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            autoAcceptConfidence: parseFloat(e.target.value),
                          })
                        }
                        className="w-full accent-[var(--ai)] mt-1"
                      />
                    </div>
                  )}
                </div>

                <SettingRow
                  label="Stale knowledge threshold (days)"
                  help="Workspace facts older than this get a Stale badge in the UI and their retrieval rank decays. Review flow: click Mark reviewed on the fact to re-anchor. Default 90 days."
                >
                  <Input
                    type="number"
                    min={7}
                    max={365}
                    step={1}
                    value={form.staleKnowledgeDays}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        staleKnowledgeDays: Math.max(
                          7,
                          Math.min(365, parseInt(e.target.value) || 90)
                        ),
                      })
                    }
                    className="w-24"
                  />
                </SettingRow>

                <div className="border-t pt-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <Label className="text-sm font-medium">
                        Rationalization critic
                      </Label>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Whether the &ldquo;Refine with critic&rdquo; button is
                        enabled on TIME recommendations. Off disables the
                        critic evaluator-optimizer loop.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={form.criticEnabled}
                      onChange={(e) =>
                        setForm({ ...form, criticEnabled: e.target.checked })
                      }
                      className="h-4 w-4 accent-[var(--ai)] mt-1 shrink-0"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => resetMutation.mutate()}
                  disabled={resetMutation.isPending}
                  className="gap-1.5 text-muted-foreground"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset to defaults
                </Button>
                <Button
                  size="sm"
                  onClick={save}
                  disabled={updateMutation.isPending}
                  className="gap-1.5 bg-[var(--ai)] hover:bg-[var(--ai)]/90 text-white"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingRow({
  label,
  help,
  children,
}: {
  label: string;
  help: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-[11px] text-muted-foreground mt-0.5">{help}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
