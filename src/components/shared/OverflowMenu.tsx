"use client";

import { useState, useRef, useEffect } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OverflowAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  primary?: boolean;
}

/**
 * A "..." overflow menu that groups toolbar buttons on smaller screens.
 * Visible on < lg by default; hidden on lg+.
 */
export function OverflowMenu({
  actions,
  className,
}: {
  actions: OverflowAction[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center h-9 w-9 rounded-lg border border-border bg-white hover:bg-muted/50 transition-colors"
        aria-label="More actions"
      >
        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute top-[calc(100%+4px)] right-0 bg-white border border-border rounded-xl shadow-lg py-1 min-w-[200px] z-[100]">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={() => {
                action.onClick();
                setOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium rounded-lg mx-0 hover:bg-muted/50 transition-colors",
                action.primary
                  ? "text-[#0B5CD6] font-semibold"
                  : action.active
                  ? "text-[#7c3aed] bg-purple-50"
                  : "text-foreground"
              )}
            >
              <span className="w-4 h-4 flex items-center justify-center shrink-0">
                {action.icon}
              </span>
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
