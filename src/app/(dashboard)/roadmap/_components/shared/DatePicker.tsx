"use client";

import { useEffect, useRef, useState } from "react";
import { format, getDaysInMonth, startOfMonth, getDay } from "date-fns";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 21 }, (_, i) => CURRENT_YEAR - 5 + i);

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
}: {
  value: string; // "YYYY-MM-DD" or ""
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const parsed = value ? new Date(value + "T00:00:00") : null;
  const initialYear = parsed ? parsed.getFullYear() : CURRENT_YEAR;
  const initialMonth = parsed ? parsed.getMonth() : new Date().getMonth();

  const [viewYear, setViewYear] = useState(initialYear);
  const [viewMonth, setViewMonth] = useState(initialMonth);

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync view when value changes externally
  useEffect(() => {
    if (parsed) {
      setViewYear(parsed.getFullYear());
      setViewMonth(parsed.getMonth());
    }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  function selectDay(day: number) {
    const month = String(viewMonth + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    onChange(`${viewYear}-${month}-${d}`);
    setOpen(false);
  }

  function clearDate(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
  }

  // Build calendar grid
  const daysInMonth = getDaysInMonth(new Date(viewYear, viewMonth));
  const firstDayOfWeek = getDay(startOfMonth(new Date(viewYear, viewMonth))); // 0=Sun
  const blanks = Array.from({ length: firstDayOfWeek });
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const selectedDay = parsed && parsed.getFullYear() === viewYear && parsed.getMonth() === viewMonth
    ? parsed.getDate()
    : null;

  const today = new Date();
  const todayDay = today.getFullYear() === viewYear && today.getMonth() === viewMonth
    ? today.getDate()
    : null;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full h-10 flex items-center gap-2 border rounded-md px-3 text-sm text-left focus:outline-none focus:ring-1 focus:ring-[#86BC25] bg-background hover:border-gray-400 transition-colors"
      >
        <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className={cn("flex-1", !value && "text-muted-foreground")}>
          {parsed ? format(parsed, "MMM d, yyyy") : placeholder}
        </span>
        {value && (
          <span
            onClick={clearDate}
            className="text-muted-foreground hover:text-foreground text-xs leading-none"
          >
            ✕
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-background border rounded-xl shadow-lg p-3 w-[280px]">
          {/* Month / Year selectors */}
          <div className="flex items-center gap-1 mb-3">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded hover:bg-muted transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <select
              value={viewMonth}
              onChange={(e) => setViewMonth(Number(e.target.value))}
              className="flex-1 text-xs font-semibold border rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-[#86BC25]"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i}>{m}</option>
              ))}
            </select>

            <select
              value={viewYear}
              onChange={(e) => setViewYear(Number(e.target.value))}
              className="text-xs font-semibold border rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-[#86BC25]"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={nextMonth}
              className="p-1 rounded hover:bg-muted transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
              <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {blanks.map((_, i) => <div key={`b${i}`} />)}
            {days.map((day) => {
              const isSelected = selectedDay === day;
              const isToday = todayDay === day;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={cn(
                    "h-8 w-full text-xs rounded-md transition-colors",
                    isSelected
                      ? "bg-[#86BC25] text-white font-semibold"
                      : isToday
                      ? "border border-[#86BC25] text-[#86BC25] font-semibold hover:bg-[#86BC25]/10"
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
