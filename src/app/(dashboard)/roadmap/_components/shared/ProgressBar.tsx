import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  className,
  showLabel = false,
}: {
  value: number;
  className?: string;
  showLabel?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const color = pct === 100 ? "bg-emerald-500" : pct >= 50 ? "bg-blue-500" : "bg-gray-400";

  if (showLabel) {
    return (
      <div className={cn("space-y-1", className)}>
        <div className="flex items-center gap-1.5">
          <div
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
            style={{
              backgroundColor: pct === 100 ? "#d1fae5" : pct >= 50 ? "#dbeafe" : "#f3f4f6",
              color: pct === 100 ? "#065f46" : pct >= 50 ? "#1d4ed8" : "#6b7280",
            }}
          >
            <Clock className="h-3 w-3" />
            {pct}%
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", color)}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
