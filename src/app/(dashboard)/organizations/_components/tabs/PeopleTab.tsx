"use client";

import { trpc } from "@/lib/trpc/client";
import { Users } from "lucide-react";

export function PeopleTab() {
  const { data: users, isLoading } = trpc.workspace.listUsers.useQuery();

  if (isLoading) {
    return (
      <div className="animate-pulse text-muted-foreground text-sm">
        Loading...
      </div>
    );
  }

  const list = users ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {list.length} user{list.length !== 1 ? "s" : ""} in this workspace
      </p>

      <div className="bg-white rounded-xl border overflow-hidden">
        {list.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-1">
              No users found in this workspace.
            </p>
            <p className="text-xs text-muted-foreground">
              Users appear here when they own the workspace or are assigned as
              capability owners.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {list.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-3 px-5 py-4 hover:bg-[#fafbfc]"
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="h-9 w-9 rounded-full"
                  />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-[#0B5CD6]/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-[#0B5CD6]">
                      {(user.name ?? user.email ?? "?")[0]?.toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#1a1f2e] truncate">
                    {user.name ?? "Unnamed"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-[#fafbfc] rounded-xl border border-dashed p-5">
        <h3 className="text-sm font-medium text-[#1a1f2e] mb-2">
          How users are added
        </h3>
        <p className="text-xs text-muted-foreground">
          Users are synced automatically from your authentication provider
          (Clerk). When you assign someone as a Business Owner or IT Owner on a
          capability, they appear here.
        </p>
      </div>
    </div>
  );
}
