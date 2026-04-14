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
        className="w-full inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 text-[13px] text-muted-foreground transition"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Search...</span>
        <kbd className="text-[10px] font-mono bg-muted/50 rounded px-1.5 py-0.5 text-muted-foreground/60">
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      </button>
    </div>
  );
}
