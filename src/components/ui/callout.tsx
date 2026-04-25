import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Callout — codified inline message surface. Replaces the
 * `rounded-lg border bg-X-50 p-3 flex items-start gap-2` triplet
 * pattern that drifted across ~10 files (KnowledgeDraftCard,
 * ShareConversationDialog, WorkspaceKnowledgeClient, etc.).
 *
 * Tone palette is locked — see `Badge` for the same five tones.
 * Compose with CalloutTitle / CalloutBody / CalloutActions or pass
 * arbitrary children for ad-hoc layouts.
 */

const calloutVariants = cva(
  "rounded-lg border p-3 flex items-start gap-2.5",
  {
    variants: {
      tone: {
        success:
          "bg-emerald-50/70 border-emerald-200 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-100",
        warn:
          "bg-amber-50/70 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-100",
        danger:
          "bg-red-50/70 border-red-200 text-red-900 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-100",
        info:
          "bg-blue-50/70 border-blue-200 text-blue-900 dark:bg-blue-950/30 dark:border-blue-900/50 dark:text-blue-100",
        auth:
          "bg-violet-50/70 border-violet-200 text-violet-900 dark:bg-violet-950/30 dark:border-violet-900/50 dark:text-violet-100",
      },
      density: {
        compact: "p-2.5 gap-2 text-[11px]",
        default: "p-3 gap-2.5 text-xs",
        comfortable: "p-4 gap-3 text-sm",
      },
    },
    defaultVariants: {
      tone: "info",
      density: "default",
    },
  }
);

const iconToneClass: Record<NonNullable<CalloutTone>, string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
  info: "text-blue-600 dark:text-blue-400",
  auth: "text-violet-600 dark:text-violet-400",
};

type CalloutTone = NonNullable<VariantProps<typeof calloutVariants>["tone"]>;

type CalloutProps = React.ComponentPropsWithoutRef<"div"> &
  VariantProps<typeof calloutVariants> & {
    /** Optional leading icon (lucide). Sized 3.5/3.5 with auto tone color. */
    icon?: LucideIcon;
  };

function Callout({
  className,
  tone = "info",
  density = "default",
  icon: Icon,
  children,
  ...rest
}: CalloutProps) {
  const resolvedTone: CalloutTone = (tone ?? "info") as CalloutTone;
  return (
    <div
      data-slot="callout"
      data-tone={resolvedTone}
      className={cn(calloutVariants({ tone, density }), className)}
      {...rest}
    >
      {Icon && (
        <Icon
          className={cn(
            "h-3.5 w-3.5 shrink-0 mt-0.5",
            iconToneClass[resolvedTone]
          )}
          aria-hidden="true"
        />
      )}
      <div className="min-w-0 flex-1 space-y-1">{children}</div>
    </div>
  );
}

function CalloutTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="callout-title"
      className={cn("font-medium leading-tight", className)}
      {...props}
    />
  );
}

function CalloutBody({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  // Inherits the tone color from the parent at 80% via opacity stacking
  // so titles read as primary and bodies as supporting.
  return (
    <div
      data-slot="callout-body"
      className={cn("opacity-80 leading-relaxed", className)}
      {...props}
    />
  );
}

function CalloutActions({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="callout-actions"
      className={cn("flex items-center gap-1.5 pt-1", className)}
      {...props}
    />
  );
}

export { Callout, CalloutTitle, CalloutBody, CalloutActions, calloutVariants };
export type { CalloutTone };
