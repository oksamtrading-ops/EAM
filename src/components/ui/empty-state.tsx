import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * EmptyState — codifies the jumbo-icon empty layout used in
 * WorkspaceKnowledgeClient (×3), ScheduledTasksClient, IntakePageClient,
 * and elsewhere. Pass icon + title + body + action.
 *
 * Container sizing is fixed via `size`:
 *   - sm: in-card empty (h-48)
 *   - md: page section (h-64, the existing pattern)
 *   - lg: full-page (h-80, generous)
 */

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const heightBySize: Record<NonNullable<EmptyStateProps["size"]>, string> = {
  sm: "h-48",
  md: "h-64",
  lg: "h-80",
};

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  size = "md",
  className,
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center text-center",
        heightBySize[size],
        className
      )}
    >
      <div className="h-12 w-12 rounded-xl bg-[var(--ai)]/15 flex items-center justify-center mb-3">
        <Icon className="h-6 w-6 text-[var(--ai)]" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium mb-1">{title}</p>
      {body && (
        <p className="text-xs text-muted-foreground mb-4 max-w-md leading-relaxed">
          {body}
        </p>
      )}
      {action}
    </div>
  );
}
