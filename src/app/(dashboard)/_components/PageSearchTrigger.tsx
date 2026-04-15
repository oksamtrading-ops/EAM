"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useCmdPalette } from "./CmdPaletteProvider";

/**
 * SidebarSearchPill — full-width search trigger mounted in the sidebar
 * between the workspace switcher and the MODULES nav list.
 * Styled for dark sidebar background.
 */
export function SidebarSearchPill() {
  const { setOpen } = useCmdPalette();
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsMac(/Mac|iPod|iPhone|iPad/.test(navigator.platform));
    }
  }, []);

  return (
    <div className="px-3 pt-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Search (${isMac ? "⌘K" : "Ctrl K"})`}
        className="w-full inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-[var(--sidebar-border)] bg-[var(--sidebar-hover)] hover:bg-[rgba(79,143,229,0.14)] text-[13px] text-[var(--sidebar-muted-foreground)] transition"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Search...</span>
        <kbd className="text-[10px] font-mono bg-[var(--sidebar-hover)] rounded px-1.5 py-0.5 text-[var(--sidebar-muted)]">
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      </button>
    </div>
  );
}
