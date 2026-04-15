import { cn } from "@/lib/utils";
import {
  REGULATORY_TAG_COLORS,
  REGULATORY_TAG_LABELS,
} from "@/lib/constants/data-architecture-colors";

interface Props {
  tags: string[] | null | undefined;
  className?: string;
  empty?: string;
}

export function RegulatoryTagList({ tags, className, empty }: Props) {
  if (!tags || tags.length === 0) {
    return empty ? (
      <span className="text-[11px] text-muted-foreground">{empty}</span>
    ) : null;
  }

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {tags.map((tag) => {
        const color = REGULATORY_TAG_COLORS[tag] ?? "#6366f1";
        const label = REGULATORY_TAG_LABELS[tag] ?? tag;
        return (
          <span
            key={tag}
            className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide border"
            style={{
              color,
              borderColor: `${color}55`,
              background: `${color}12`,
            }}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}
