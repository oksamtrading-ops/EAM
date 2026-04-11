import { cn } from "@/lib/utils";

const HORIZON_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  H1_NOW: {
    label: "H1 Now",
    className: "bg-blue-100 text-blue-700 border-blue-200",
  },
  H2_NEXT: {
    label: "H2 Next",
    className: "bg-purple-100 text-purple-700 border-purple-200",
  },
  H3_LATER: {
    label: "H3 Later",
    className: "bg-gray-100 text-gray-600 border-gray-200",
  },
  BEYOND: {
    label: "Beyond",
    className: "bg-slate-100 text-slate-500 border-slate-200",
  },
};

export function HorizonBadge({
  horizon,
  className,
}: {
  horizon: string;
  className?: string;
}) {
  const config = HORIZON_CONFIG[horizon] ?? HORIZON_CONFIG.BEYOND;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
