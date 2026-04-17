import { cn } from "@/lib/utils";
import {
  CLASSIFICATION_COLORS,
  CLASSIFICATION_LABELS,
} from "@/lib/constants/data-architecture-colors";

interface Props {
  classification: string;
  size?: "sm" | "md";
  className?: string;
}

export function ClassificationBadge({ classification, size = "sm", className }: Props) {
  const color = CLASSIFICATION_COLORS[classification] ?? "#64748b";
  const label = CLASSIFICATION_LABELS[classification] ?? classification;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        className
      )}
      style={{
        color,
        borderColor: `${color}55`,
        background: `${color}12`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
