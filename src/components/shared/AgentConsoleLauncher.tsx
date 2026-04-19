"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { AgentConsole } from "./AgentConsole";
import { useWorkspace } from "@/hooks/useWorkspace";

const STORAGE_KEY_PREFIX = "eam.agentConsole.lastThread.";

/**
 * Floating AI button that opens the shared AgentConsole.
 * Mounted once in the dashboard shell so every page has an "ask the agent"
 * affordance. Keyboard shortcut: Cmd/Ctrl + Shift + A.
 * Remembers the last-opened conversation per workspace in localStorage.
 */
export function AgentConsoleLauncher() {
  const { workspaceId } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const storageKey = `${STORAGE_KEY_PREFIX}${workspaceId}`;

  // Restore the last-opened thread id for this workspace.
  useEffect(() => {
    if (!workspaceId) return;
    try {
      const stored = window.localStorage.getItem(storageKey);
      setConversationId(stored ?? null);
    } catch {
      // ignore storage errors
    }
  }, [workspaceId, storageKey]);

  // Persist whenever the active thread changes.
  const handleConversationChange = useCallback(
    (id: string | null) => {
      setConversationId(id);
      try {
        if (id) window.localStorage.setItem(storageKey, id);
        else window.localStorage.removeItem(storageKey);
      } catch {
        // ignore storage errors
      }
    },
    [storageKey]
  );

  const toggle = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isShortcut =
        (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "a";
      if (!isShortcut) return;
      e.preventDefault();
      toggle();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Ask the agent (⌘⇧A)"
          aria-label="Open Agent Console"
          className="group fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full bg-[var(--ai)] text-white shadow-xl shadow-[var(--ai)]/30 flex items-center justify-center hover:bg-[var(--ai)]/90 hover:shadow-2xl hover:shadow-[var(--ai)]/40 transition-all duration-[var(--duration-normal)] ease-[var(--ease-spring)] hover:-translate-y-0.5"
        >
          <Sparkles className="h-5 w-5 transition-transform group-hover:scale-110" />
          <span className="sr-only">Open Agent Console</span>
        </button>
      )}
      <AgentConsole
        open={open}
        onOpenChange={setOpen}
        conversationId={conversationId}
        onConversationChange={handleConversationChange}
      />
    </>
  );
}
