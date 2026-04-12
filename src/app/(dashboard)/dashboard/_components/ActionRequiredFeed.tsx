"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ArrowRight } from "lucide-react";
import type { ActionItem } from "@/lib/contracts/dashboard";

interface Props {
  items: ActionItem[];
}

const MAX_VISIBLE = 5;

const SEVERITY_STYLES: Record<string, { border: string; badge: string }> = {
  critical: { border: "border-l-4 border-l-destructive", badge: "bg-destructive text-destructive-foreground" },
  high: { border: "border-l-4 border-l-orange-500", badge: "bg-orange-500 text-white" },
  medium: { border: "border-l-4 border-l-yellow-500", badge: "bg-yellow-500 text-white" },
};

const TYPE_LABELS: Record<string, string> = {
  RISK: "Risk",
  EOL: "EOL",
  COMPLIANCE: "Compliance",
  INITIATIVE: "Initiative",
};

function ActionRow({ item }: { item: ActionItem }) {
  const styles = SEVERITY_STYLES[item.severity] ?? SEVERITY_STYLES.medium;
  return (
    <li className={`flex items-start gap-3 px-6 py-3 ${styles.border}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${styles.badge}`}>
            {item.severity}
          </span>
          <Badge variant="outline" className="text-[10px] py-0 px-1.5">
            {TYPE_LABELS[item.type] ?? item.type}
          </Badge>
          <span className="text-sm font-medium truncate">{item.title}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
      </div>
      <Link
        href={item.href}
        className="shrink-0 text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 mt-0.5"
      >
        View <ArrowRight className="h-3 w-3" />
      </Link>
    </li>
  );
}

export function ActionRequiredFeed({ items }: Props) {
  const [showAll, setShowAll] = useState(false);
  const displayed = items.slice(0, MAX_VISIBLE);
  const hasMore = items.length > MAX_VISIBLE;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Action Required</CardTitle>
            <span className="text-xs text-muted-foreground">
              {items.length} item{items.length !== 1 ? "s" : ""}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {displayed.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6 pb-4">
              No immediate actions required &mdash; everything looks good.
            </p>
          ) : (
            <ul className="divide-y">
              {displayed.map((item) => (
                <ActionRow key={item.id} item={item} />
              ))}
            </ul>
          )}
          {hasMore && (
            <div className="px-6 py-3 border-t">
              <button
                onClick={() => setShowAll(true)}
                className="text-xs font-medium text-[#0076A8] hover:underline"
              >
                See all {items.length} items &rarr;
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full list sheet */}
      <Sheet open={showAll} onOpenChange={setShowAll}>
        <SheetContent side="right" className="data-[side=right]:sm:max-w-lg flex flex-col overflow-hidden p-0">
          <SheetHeader className="px-5 pt-5 pb-4 border-b">
            <SheetTitle className="text-base">All Action Items</SheetTitle>
            <SheetDescription>{items.length} item{items.length !== 1 ? "s" : ""}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">
            <ul className="divide-y">
              {items.map((item) => (
                <ActionRow key={item.id} item={item} />
              ))}
            </ul>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
