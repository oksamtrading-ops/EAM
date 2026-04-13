"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { GlobalCmdPalette } from "./GlobalCmdPalette";

type Ctx = {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
};

const CmdPaletteCtx = createContext<Ctx | null>(null);

export function CmdPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Industry standard: ⌘K / Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <CmdPaletteCtx.Provider value={{ open, setOpen, toggle }}>
      {children}
      <GlobalCmdPalette open={open} onClose={() => setOpen(false)} />
    </CmdPaletteCtx.Provider>
  );
}

export function useCmdPalette() {
  const ctx = useContext(CmdPaletteCtx);
  if (!ctx) throw new Error("useCmdPalette must be used inside CmdPaletteProvider");
  return ctx;
}
