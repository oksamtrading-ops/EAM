"use client";

import { useState } from "react";
import Link from "next/link";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { X, Pin } from "lucide-react";
import type { PinnedItem } from "@/lib/contracts/dashboard";

interface Props {
  pins: PinnedItem[];
  onUnpin: (id: string) => void;
}

const MAX_VISIBLE = 5;

function PinRow({ pin, onUnpin }: { pin: PinnedItem; onUnpin: (id: string) => void }) {
  return (
    <li className="flex items-center gap-2 px-6 py-2.5">
      <Link href={pin.href} className="flex-1 text-sm truncate hover:underline">
        {pin.label}
      </Link>
      <span className="text-[10px] text-muted-foreground shrink-0">
        {pin.entityType.replace(/([A-Z])/g, " $1").trim()}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={() => onUnpin(pin.id)}
      >
        <X className="h-3 w-3" />
      </Button>
    </li>
  );
}

export function PinnedItemsCard({ pins, onUnpin }: Props) {
  const [showAll, setShowAll] = useState(false);
  const displayed = pins.slice(0, MAX_VISIBLE);
  const hasMore = pins.length > MAX_VISIBLE;

  return (
    <>
      <div className="glass-chart !p-0 flex flex-col gap-4 overflow-hidden py-4">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Pin className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Pinned Items</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {pins.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6 pb-4">
              No pinned items yet. Pin risks, initiatives, or applications for quick access.
            </p>
          ) : (
            <>
              <ul className="divide-y">
                {displayed.map((pin) => (
                  <PinRow key={pin.id} pin={pin} onUnpin={onUnpin} />
                ))}
              </ul>
              {hasMore && (
                <div className="px-6 py-3 border-t">
                  <button
                    onClick={() => setShowAll(true)}
                    className="text-xs font-medium text-[var(--link)] hover:underline"
                  >
                    See all {pins.length} pinned items &rarr;
                  </button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </div>

      {/* Full list sheet */}
      <Sheet open={showAll} onOpenChange={setShowAll}>
        <SheetContent side="right" className="data-[side=right]:sm:max-w-md flex flex-col overflow-hidden p-0">
          <SheetHeader className="px-5 pt-5 pb-4 border-b">
            <SheetTitle className="text-base">All Pinned Items</SheetTitle>
            <SheetDescription>{pins.length} item{pins.length !== 1 ? "s" : ""}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">
            <ul className="divide-y">
              {pins.map((pin) => (
                <PinRow key={pin.id} pin={pin} onUnpin={onUnpin} />
              ))}
            </ul>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
