"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Send,
  Loader2,
  ChevronDown,
  ChevronRight,
  X,
  Wrench,
  CheckCircle2,
  AlertCircle,
  Plus,
  MessageSquare,
  Trash2,
  Pencil,
  Check,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import { renderMarkdown } from "@/lib/utils/markdown";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

type ToolCall = {
  id: string;
  name: string;
  input: unknown;
  status: "running" | "ok" | "error";
  output?: unknown;
};

type Turn = {
  id: string;
  role: "user" | "assistant";
  text: string;
  toolCalls: ToolCall[];
  done: boolean;
  error?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the console loads this thread on mount. */
  conversationId?: string | null;
  /** Called when a conversation id becomes known (created server-side on first send, or switched via picker). */
  onConversationChange?: (id: string | null) => void;
  /** If set while the console is open, auto-sends this prompt once then consumes it. */
  pendingPrompt?: string | null;
  /** Called after the pending prompt has been dispatched. */
  onPendingPromptConsumed?: () => void;
};

export function AgentConsole({
  open,
  onOpenChange,
  conversationId: externalConversationId,
  onConversationChange,
  pendingPrompt,
  onPendingPromptConsumed,
}: Props) {
  const { workspaceId } = useWorkspace();
  const [conversationId, setConversationId] = useState<string | null>(
    externalConversationId ?? null
  );
  const [conversationTitle, setConversationTitle] = useState<string>("New thread");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const utils = trpc.useUtils();
  const convoList = trpc.agentConversation.list.useQuery(
    { limit: 30 },
    { enabled: open }
  );
  const loadedConvo = trpc.agentConversation.getById.useQuery(
    { id: conversationId ?? "" },
    { enabled: !!conversationId && open }
  );
  const deleteConvo = trpc.agentConversation.delete.useMutation({
    onSuccess: () => {
      utils.agentConversation.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const renameConvo = trpc.agentConversation.rename.useMutation({
    onSuccess: () => {
      utils.agentConversation.list.invalidate();
      utils.agentConversation.getById.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  function startRename(id: string, current: string) {
    setEditingId(id);
    setEditingTitle(current);
  }
  function commitRename() {
    if (!editingId || !editingTitle.trim()) {
      setEditingId(null);
      return;
    }
    const id = editingId;
    const title = editingTitle.trim().slice(0, 200);
    renameConvo.mutate({ id, title });
    if (id === conversationId) setConversationTitle(title);
    setEditingId(null);
  }

  // Track external id changes (e.g., launcher resumes last thread).
  useEffect(() => {
    if (externalConversationId !== undefined) {
      setConversationId(externalConversationId);
    }
  }, [externalConversationId]);

  // Hydrate turns from the loaded conversation's persisted messages.
  useEffect(() => {
    if (!loadedConvo.data) return;
    const hydrated: Turn[] = loadedConvo.data.messages.map((m) => {
      const toolCalls = Array.isArray(m.toolCalls)
        ? (m.toolCalls as Array<{
            id: string;
            name: string;
            input: unknown;
            ok?: boolean;
            output?: unknown;
          }>).map((c) => ({
            id: c.id,
            name: c.name,
            input: c.input,
            status: (c.ok === false ? "error" : "ok") as ToolCall["status"],
            output: c.output,
          }))
        : [];
      return {
        id: m.id,
        role: m.role as "user" | "assistant",
        text: m.content,
        toolCalls,
        done: true,
      };
    });
    setTurns(hydrated);
    setConversationTitle(loadedConvo.data.title);
  }, [loadedConvo.data]);

  // When no conversation is loaded, reset to empty thread.
  useEffect(() => {
    if (conversationId == null) {
      setTurns([]);
      setConversationTitle("New thread");
    }
  }, [conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns]);

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      setShowPicker(false);
    }
  }, [open]);

  // Auto-dispatch a pending prompt (e.g. from AnalyzeWithAgentButton).
  // Guarded by !streaming so a retry-click doesn't double-send.
  useEffect(() => {
    if (!open || !pendingPrompt || streaming) return;
    // Fire once, then clear it via the parent callback.
    const prompt = pendingPrompt;
    onPendingPromptConsumed?.();
    // Defer to next tick so setTurns doesn't race with the open transition.
    const id = window.setTimeout(() => {
      void send(prompt);
    }, 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pendingPrompt]);

  const switchTo = useCallback(
    (id: string | null) => {
      abortRef.current?.abort();
      setConversationId(id);
      setShowPicker(false);
      onConversationChange?.(id);
    },
    [onConversationChange]
  );

  const send = useCallback(
    async (message: string) => {
      if (!message.trim() || streaming) return;

      const userTurnId = crypto.randomUUID();
      const assistantTurnId = crypto.randomUUID();

      setTurns((t) => [
        ...t,
        {
          id: userTurnId,
          role: "user",
          text: message,
          toolCalls: [],
          done: true,
        },
        {
          id: assistantTurnId,
          role: "assistant",
          text: "",
          toolCalls: [],
          done: false,
        },
      ]);
      setInput("");
      setStreaming(true);

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const res = await fetch("/api/ai/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            message,
            conversationId: conversationId ?? undefined,
          }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          throw new Error(`Agent failed: ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let idx;
          while ((idx = buffer.indexOf("\n\n")) >= 0) {
            const raw = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const dataLine = raw.split("\n").find((l) => l.startsWith("data: "));
            if (!dataLine) continue;
            const payload = JSON.parse(dataLine.slice(6));
            if (payload.type === "conversation_ready") {
              if (!conversationId) {
                setConversationId(payload.conversationId);
                onConversationChange?.(payload.conversationId);
              }
              setConversationTitle(payload.title);
            } else {
              applyEvent(assistantTurnId, payload, setTurns);
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Agent error";
        setTurns((t) =>
          t.map((turn) =>
            turn.id === assistantTurnId
              ? { ...turn, done: true, error: msg }
              : turn
          )
        );
      } finally {
        setStreaming(false);
        abortRef.current = null;
        // Refresh thread list so the newly-created convo appears and timestamps update.
        utils.agentConversation.list.invalidate();
      }
    },
    [workspaceId, streaming, conversationId, onConversationChange, utils]
  );

  if (!open) return null;

  return (
    <aside className="fixed right-0 top-0 h-screen w-full sm:w-[480px] z-50 border-l bg-card flex flex-col shadow-xl">
      <div className="px-5 py-3.5 border-b bg-gradient-to-r from-[var(--ai)]/10 to-transparent relative">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="h-8 w-8 rounded-lg bg-[var(--ai)]/15 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-[var(--ai)]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ai)]/80 leading-none mb-1">
                Agent Console
              </p>
              <button
                onClick={() => setShowPicker((v) => !v)}
                aria-expanded={showPicker}
                title="Switch thread"
                className="group flex items-center gap-1 max-w-full text-left rounded-md -mx-1 px-1 py-0.5 hover:bg-[var(--ai)]/5 transition-colors"
              >
                <h2 className="font-semibold text-[13px] text-foreground truncate">
                  {conversationTitle}
                </h2>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform",
                    showPicker && "rotate-180"
                  )}
                />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {turns.length > 0 && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => exportThreadToMarkdown(conversationTitle, turns)}
                aria-label="Download thread as markdown"
                title="Download thread (Markdown)"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {showPicker && (
          <div className="absolute left-4 right-4 top-full mt-1 rounded-lg border bg-popover shadow-xl z-[60] max-h-80 overflow-y-auto backdrop-blur-none">
            <button
              onClick={() => switchTo(null)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-popover hover:bg-muted border-b text-[var(--ai)]"
            >
              <Plus className="h-3.5 w-3.5" />
              New thread
            </button>
            {convoList.data && convoList.data.length > 0 ? (
              convoList.data.map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm bg-popover hover:bg-muted border-b last:border-b-0 group",
                    c.id === conversationId && "bg-[var(--ai)]/10"
                  )}
                >
                  {editingId === c.id ? (
                    <>
                      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <input
                        autoFocus
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename();
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        onBlur={commitRename}
                        className="flex-1 min-w-0 text-sm bg-background border rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-[var(--ai)]"
                      />
                      <button
                        onClick={commitRename}
                        className="p-1 rounded text-emerald-600 hover:bg-emerald-50 shrink-0"
                        aria-label="Save"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => switchTo(c.id)}
                        className="flex-1 min-w-0 flex items-center gap-2 text-left"
                      >
                        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-foreground">{c.title}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {c._count.messages} message
                            {c._count.messages === 1 ? "" : "s"} ·{" "}
                            {formatRelative(c.updatedAt)}
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={() => startRename(c.id, c.title)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-[var(--ai)] hover:bg-[var(--ai)]/10 transition-all shrink-0"
                        aria-label={`Rename ${c.title}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => {
                          if (!window.confirm(`Delete thread "${c.title}"?`)) return;
                          if (c.id === conversationId) switchTo(null);
                          deleteConvo.mutate({ id: c.id });
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-all shrink-0"
                        aria-label={`Delete ${c.title}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
              ))
            ) : (
              <p className="px-3 py-3 text-xs text-muted-foreground text-center bg-popover">
                No prior threads
              </p>
            )}
          </div>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {turns.length === 0 && (
          <div className="text-center text-xs text-muted-foreground pt-8">
            <p className="mb-2">Ask about your portfolio, risks, or capabilities.</p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {SAMPLE_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="text-[11px] px-2 py-1 rounded-md border bg-background hover:bg-[var(--ai)]/5 hover:border-[var(--ai)]/40 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn) => (
          <TurnView key={turn.id} turn={turn} />
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t px-4 py-3 flex items-center gap-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the agent…"
          disabled={streaming}
          className="text-sm"
        />
        <Button
          type="submit"
          size="icon"
          disabled={streaming || !input.trim()}
          className="bg-[var(--ai)] hover:bg-[var(--ai)]/90 text-white shrink-0"
        >
          {streaming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </aside>
  );
}

const SAMPLE_PROMPTS = [
  "Which apps are candidates to retire?",
  "Count risks by category",
  "Show active initiatives",
];

function applyEvent(
  turnId: string,
  event: { type: string } & Record<string, unknown>,
  setTurns: React.Dispatch<React.SetStateAction<Turn[]>>
) {
  setTurns((turns) =>
    turns.map((turn) => {
      if (turn.id !== turnId) return turn;
      switch (event.type) {
        case "text_delta":
          return { ...turn, text: turn.text + String(event.text ?? "") };
        case "tool_call":
          return {
            ...turn,
            toolCalls: [
              ...turn.toolCalls,
              {
                id: String(event.id),
                name: String(event.name),
                input: event.input,
                status: "running",
              },
            ],
          };
        case "tool_result":
          return {
            ...turn,
            toolCalls: turn.toolCalls.map((c) =>
              c.id === event.id
                ? {
                    ...c,
                    status: event.ok ? "ok" : "error",
                    output: event.output,
                  }
                : c
            ),
          };
        case "final":
          return { ...turn, done: true };
        case "error":
          return {
            ...turn,
            done: true,
            error: String(event.message ?? "Error"),
          };
        default:
          return turn;
      }
    })
  );
}

function TurnView({ turn }: { turn: Turn }) {
  if (turn.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary text-white px-3 py-2 text-sm">
          {turn.text}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {turn.toolCalls.map((tc) => (
        <ToolCallCard key={tc.id} call={tc} />
      ))}
      {(turn.text || turn.error) && (
        <div
          className={cn(
            "rounded-2xl rounded-bl-md bg-card border px-3 py-2 text-sm leading-relaxed",
            turn.error && "border-red-200 bg-red-50/50 text-red-900"
          )}
        >
          {turn.text && (
            <span className="inline prose-sm">
              {renderMarkdown(turn.text)}
            </span>
          )}
          {!turn.done && !turn.error && (
            <span className="inline-block w-1.5 h-3 bg-foreground/50 ml-0.5 animate-pulse align-middle" />
          )}
          {turn.error && (
            <div className="mt-1 text-[11px] flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {turn.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ToolCallCard({ call }: { call: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-lg border border-[var(--ai)]/30 bg-[var(--ai)]/5 px-2.5 py-1.5 text-[11px]">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-1.5"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-[var(--ai)]" />
        ) : (
          <ChevronRight className="h-3 w-3 text-[var(--ai)]" />
        )}
        <Wrench className="h-3 w-3 text-[var(--ai)]" />
        <span className="font-mono font-medium text-[var(--ai)]">{call.name}</span>
        <span className="ml-auto">
          {call.status === "running" && (
            <Loader2 className="h-3 w-3 animate-spin text-[var(--ai)]" />
          )}
          {call.status === "ok" && (
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
          )}
          {call.status === "error" && (
            <AlertCircle className="h-3 w-3 text-red-600" />
          )}
        </span>
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1">
          <pre className="text-[10px] bg-background/60 rounded p-1.5 overflow-x-auto">
{JSON.stringify(call.input, null, 2)}
          </pre>
          {call.output != null && (
            <pre className="text-[10px] bg-background/60 rounded p-1.5 overflow-x-auto max-h-40">
{JSON.stringify(call.output, null, 2).slice(0, 4000)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function exportThreadToMarkdown(title: string, turns: Turn[]) {
  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`_Exported ${new Date().toLocaleString()}_`);
  lines.push("");

  for (const turn of turns) {
    if (turn.role === "user") {
      lines.push(`## 🧑 You`);
      lines.push("");
      lines.push(turn.text);
      lines.push("");
    } else {
      lines.push(`## ✨ Agent`);
      lines.push("");
      if (turn.toolCalls.length > 0) {
        lines.push("**Tools used:**");
        for (const c of turn.toolCalls) {
          const badge =
            c.status === "ok" ? "✓" : c.status === "error" ? "✗" : "…";
          lines.push(`- ${badge} \`${c.name}\``);
        }
        lines.push("");
      }
      if (turn.text) {
        lines.push(turn.text);
        lines.push("");
      }
      if (turn.error) {
        lines.push(`> ⚠️ Error: ${turn.error}`);
        lines.push("");
      }
    }
  }

  const md = lines.join("\n");
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(title)}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "agent-thread"
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
