"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

/**
 * Compact theme toggle — matches the mockup's icon-button shape.
 * Renders nothing until mounted to avoid the next-themes hydration
 * mismatch flash.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Render a same-sized placeholder during SSR/before mount so the
  // top-bar layout doesn't shift when the icon appears.
  if (!mounted) {
    return (
      <div
        aria-hidden="true"
        className={cn(
          "h-8 w-8 rounded-lg bg-white/60 dark:bg-zinc-900/60 border border-zinc-200/70 dark:border-zinc-800",
          className
        )}
      />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(
        "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
        "bg-white/60 dark:bg-zinc-900/60",
        "hover:bg-white dark:hover:bg-zinc-900",
        "border border-zinc-200/70 dark:border-zinc-800",
        className
      )}
    >
      {isDark ? (
        <Sun className="h-3.5 w-3.5" />
      ) : (
        <Moon className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
