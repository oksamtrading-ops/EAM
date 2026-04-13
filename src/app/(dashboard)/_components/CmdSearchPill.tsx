"use client";

import { Search } from "lucide-react";
import { useCmdPalette } from "./CmdPaletteProvider";
import { useEffect, useState } from "react";

export function CmdSearchPill() {
  const { setOpen } = useCmdPalette();
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsMac(/Mac|iPod|iPhone|iPad/.test(navigator.platform));
    }
  }, []);

  return (
    <button
      onClick={() => setOpen(true)}
      className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-[#d1d1d6] bg-white/70 hover:bg-white/90 text-[13px] text-[#86868b] transition shadow-sm"
      aria-label="Open search"
    >
      <Search className="h-3.5 w-3.5" />
      <span>Search…</span>
      <kbd className="ml-2 text-[10px] font-mono bg-black/[0.06] rounded px-1.5 py-0.5 text-[#3a3a3c]">
        {isMac ? "⌘K" : "Ctrl K"}
      </kbd>
    </button>
  );
}
