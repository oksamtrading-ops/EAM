"use client";

import { useEffect, useRef, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type FilterGroup = {
  key: string;
  label: string;
  options: { value: string; label: string }[];
};

type Props = {
  search?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  groups: FilterGroup[];
  values: Record<string, string>;
  onValuesChange: (next: Record<string, string>) => void;
};

export function TabFilters({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  groups,
  values,
  onValuesChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const searchEnabled = typeof search === "string" && !!onSearchChange;

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

  const activeCount =
    groups.filter((g) => values[g.key] && values[g.key] !== "").length +
    (searchEnabled && search ? 1 : 0);
  const hasActive = activeCount > 0;

  function reset() {
    const next: Record<string, string> = { ...values };
    for (const g of groups) next[g.key] = "";
    onValuesChange(next);
    if (searchEnabled) onSearchChange!("");
  }

  function setValue(key: string, v: string) {
    onValuesChange({ ...values, [key]: v });
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-medium transition-all",
          hasActive
            ? "border-primary text-primary bg-primary/5"
            : "border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        )}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Filters</span>
        {hasActive && (
          <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold leading-none">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-[calc(100%+6px)] right-0 sm:right-auto sm:left-0 bg-background text-foreground border border-border shadow-xl rounded-xl p-3 min-w-[260px] z-[100]">
          {searchEnabled && (
            <div className="mb-3">
              <div className="flex items-center gap-1.5 border rounded-lg px-2.5 h-8 bg-muted/20">
                <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={search!}
                  onChange={(e) => onSearchChange!(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                />
                {search && (
                  <button
                    onClick={() => onSearchChange!("")}
                    className="text-muted-foreground hover:text-foreground"
                    type="button"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {groups.map((g) => {
            const v = values[g.key] ?? "";
            return (
              <div key={g.key} className="mb-3 last:mb-0">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  {g.label}
                </p>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setValue(g.key, "")}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
                      v === ""
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    All
                  </button>
                  {g.options.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setValue(g.key, opt.value)}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
                        v === opt.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {hasActive && (
            <div className="border-t pt-2 mt-1">
              <button
                type="button"
                onClick={reset}
                className="text-[11px] text-primary hover:underline font-medium"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
