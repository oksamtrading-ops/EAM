"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, ShieldCheck, Clock } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { RecentAchievement } from "@/lib/contracts/dashboard";

interface Props {
  items: RecentAchievement[];
  loading: boolean;
}

const MAX_VISIBLE = 5;

const ICON_MAP = {
  INITIATIVE_COMPLETE: { Icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
  RISK_RESOLVED: { Icon: ShieldCheck, color: "text-blue-600", bg: "bg-blue-50" },
  EOL_ACKNOWLEDGED: { Icon: Clock, color: "text-violet-600", bg: "bg-violet-50" },
} as const;

function AchievementRow({ item }: { item: RecentAchievement }) {
  const { Icon, color, bg } = ICON_MAP[item.type];
  return (
    <li>
      <Link href={item.href} className="flex gap-3 group hover:bg-muted/30 rounded-lg p-1 -mx-1 transition-colors">
        <div className={`mt-0.5 flex-shrink-0 rounded-full p-1.5 ${bg}`}>
          <Icon className={`h-3.5 w-3.5 ${color}`} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium leading-snug truncate group-hover:text-[var(--link)] transition-colors">
            {item.title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {item.description} &middot;{" "}
            {formatDistanceToNow(new Date(item.completedAt), { addSuffix: true })}
          </p>
        </div>
      </Link>
    </li>
  );
}

export function RecentAchievementsCard({ items, loading }: Props) {
  const [showAll, setShowAll] = useState(false);
  const displayed = items.slice(0, MAX_VISIBLE);
  const hasMore = items.length > MAX_VISIBLE;

  return (
    <>
      <div className="glass-chart flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <h3 className="font-semibold text-sm">Recent Achievements</h3>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-7 h-7 rounded-full bg-muted/60" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-muted/60 rounded w-3/4" />
                  <div className="h-2.5 bg-muted/40 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-8 text-sm text-muted-foreground text-center">
            No achievements in this period.
          </div>
        ) : (
          <>
            <ul className="space-y-3">
              {displayed.map((item) => (
                <AchievementRow key={item.id} item={item} />
              ))}
            </ul>
            {hasMore && (
              <button
                onClick={() => setShowAll(true)}
                className="text-xs font-medium text-[var(--link)] hover:underline self-start"
              >
                See all {items.length} achievements &rarr;
              </button>
            )}
          </>
        )}
      </div>

      {/* Full list sheet */}
      <Sheet open={showAll} onOpenChange={setShowAll}>
        <SheetContent side="right" className="data-[side=right]:sm:max-w-md flex flex-col overflow-hidden p-0">
          <SheetHeader className="px-5 pt-5 pb-4 border-b">
            <SheetTitle className="text-base">All Achievements</SheetTitle>
            <SheetDescription>{items.length} achievement{items.length !== 1 ? "s" : ""}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-5 pb-5">
            <ul className="space-y-3 pt-3">
              {items.map((item) => (
                <AchievementRow key={item.id} item={item} />
              ))}
            </ul>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
