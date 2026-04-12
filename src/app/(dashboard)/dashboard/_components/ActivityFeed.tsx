"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { formatDistanceToNow } from "date-fns";
import type { ActivityEntry } from "@/lib/contracts/dashboard";

interface Props {
  entries: ActivityEntry[];
}

const MAX_VISIBLE = 5;

const ACTION_VERBS: Record<string, string> = {
  CREATE: "created",
  UPDATE: "updated",
  DELETE: "deleted",
  IMPORT: "imported",
  ASSESS: "assessed",
};

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  return (
    <li className="px-6 py-2.5">
      <p className="text-xs leading-snug">
        <span className="font-medium">{entry.actorName}</span>
        {" "}
        <span className="text-muted-foreground">
          {ACTION_VERBS[entry.action] ?? entry.action.toLowerCase()}
        </span>
        {" "}
        {entry.href ? (
          <Link href={entry.href} className="hover:underline">
            {entry.label}
          </Link>
        ) : (
          <span>{entry.label}</span>
        )}
      </p>
      <p className="text-[10px] text-muted-foreground mt-0.5">
        {formatDistanceToNow(new Date(entry.occurredAt), { addSuffix: true })}
      </p>
    </li>
  );
}

export function ActivityFeed({ entries }: Props) {
  const [showAll, setShowAll] = useState(false);
  const displayed = entries.slice(0, MAX_VISIBLE);
  const hasMore = entries.length > MAX_VISIBLE;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6 pb-4">No recent activity.</p>
          ) : (
            <>
              <ul className="divide-y">
                {displayed.map((entry) => (
                  <ActivityRow key={entry.id} entry={entry} />
                ))}
              </ul>
              {hasMore && (
                <div className="px-6 py-3 border-t">
                  <button
                    onClick={() => setShowAll(true)}
                    className="text-xs font-medium text-[#0076A8] hover:underline"
                  >
                    See all {entries.length} entries &rarr;
                  </button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Full list sheet */}
      <Sheet open={showAll} onOpenChange={setShowAll}>
        <SheetContent side="right" className="data-[side=right]:sm:max-w-md flex flex-col overflow-hidden p-0">
          <SheetHeader className="px-5 pt-5 pb-4 border-b">
            <SheetTitle className="text-base">All Activity</SheetTitle>
            <SheetDescription>{entries.length} entr{entries.length !== 1 ? "ies" : "y"}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">
            <ul className="divide-y">
              {entries.map((entry) => (
                <ActivityRow key={entry.id} entry={entry} />
              ))}
            </ul>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
