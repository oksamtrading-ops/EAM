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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import { renderMarkdown } from "@/lib/utils/markdown";

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
};

export function AgentConsole({ open, onOpenChange }: Props) {
  const { workspaceId } = useWorkspace();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns]);

  useEffect(() => {
    if (!open) abortRef.current?.abort();
  }, [open]);

  const send = useCallback(
    async (message: string) => {
      if (!message.trim() || streaming) return;

      // Snapshot prior turns as history BEFORE we append the new pair.
      // Only include completed turns with text content (no tool-only
      // assistant turns, no in-flight assistants, no errored turns).
      const history = turns
        .filter((t) => t.done && !t.error && t.text.trim().length > 0)
        .map((t) => ({ role: t.role, text: t.text }));

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
            history: history.map((h) => ({ role: h.role, content: h.text })),
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
            applyEvent(assistantTurnId, payload, setTurns);
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
      }
    },
    [workspaceId, streaming, turns]
  );

  if (!open) return null;

  return (
    <aside className="fixed right-0 top-0 h-screen w-full sm:w-[480px] z-50 border-l bg-card flex flex-col shadow-xl">
      <div className="px-5 py-4 border-b flex items-center justify-between bg-gradient-to-r from-[var(--ai)]/10 to-transparent">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-[var(--ai)]/15 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-[var(--ai)]" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-foreground">Agent Console</h2>
            <p className="text-[11px] text-muted-foreground">
              Tool-grounded questions over your workspace
            </p>
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onOpenChange(false)}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </Button>
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
