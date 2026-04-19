"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  /** Prompt to send as the first user message. Becomes the thread title (auto-derived). */
  prompt: string;
  /** Button label. Defaults to "Analyze with agent". */
  label?: string;
  size?: "sm" | "default";
  className?: string;
};

/**
 * Drop-in button that opens the global Agent Console in a fresh thread
 * and auto-sends the provided prompt. Backed by a window custom event
 * listened to by AgentConsoleLauncher — no context / provider needed.
 *
 * Typical use: entity detail panels for applications, capabilities,
 * risks, etc., where a pre-scoped "analyze this" action is useful.
 */
export function AnalyzeWithAgentButton({
  prompt,
  label = "Analyze with agent",
  size = "sm",
  className,
}: Props) {
  function handleClick() {
    window.dispatchEvent(
      new CustomEvent("agent-console:open", {
        detail: { prompt },
      })
    );
  }

  return (
    <Button
      variant="outline"
      size={size}
      onClick={handleClick}
      className={cn(
        "gap-1.5 border-[var(--ai)]/30 text-[var(--ai)] hover:bg-[var(--ai)]/5 hover:border-[var(--ai)]/50",
        className
      )}
    >
      <Sparkles className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
