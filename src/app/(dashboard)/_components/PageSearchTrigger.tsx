"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useCmdPalette } from "./CmdPaletteProvider";

export function PageSearchTrigger() {
  const { setOpen } = useCmdPalette();
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsMac(/Mac|iPod|iPhone|iPad/.test(navigator.platform));
    }
  }, []);

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={`Search (${isMac ? "⌘K" : "Ctrl K"})`}
      title={`Search (${isMac ? "⌘K" : "Ctrl K"})`}
      className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-[#86868b] hover:text-[#1a1f2e] hover:bg-black/[0.04] transition"
    >
      <Search className="h-3.5 w-3.5" />
      <kbd className="text-[10px] font-mono text-[#86868b]">
        {isMac ? "⌘K" : "Ctrl K"}
      </kbd>
    </button>
  );
}
