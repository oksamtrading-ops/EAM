"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useCollapsibleGroup } from "./CollapsibleGroup";

type Props = {
  /** Optional stable id used when this section lives inside a <CollapsibleGroup>. */
  id?: string;
  title: string;
  count?: number;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  /** Extra element rendered to the right of the title (e.g. an "Add" button) */
  actions?: React.ReactNode;
};

export function CollapsibleSection({
  id,
  title,
  count,
  icon,
  defaultOpen = false,
  children,
  actions,
}: Props) {
  const group = useCollapsibleGroup();
  const [localOpen, setLocalOpen] = useState(defaultOpen);

  const inGroup = group !== null && id !== undefined;
  const open = inGroup ? group!.openId === id : localOpen;
  const toggle = () => {
    if (inGroup) group!.toggle(id!);
    else setLocalOpen((v) => !v);
  };

  return (
    <section>
      <div className="flex items-center gap-1.5 mb-2">
        <button
          onClick={toggle}
          className="flex items-center gap-1.5 text-sm font-medium text-left flex-1 min-w-0"
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          {icon}
          <span className="truncate">{title}</span>
          {count !== undefined && (
            <span className="text-xs text-muted-foreground font-normal">
              ({count})
            </span>
          )}
        </button>
        {actions && <div className="shrink-0 flex items-center gap-1">{actions}</div>}
      </div>
      {open && children}
    </section>
  );
}
