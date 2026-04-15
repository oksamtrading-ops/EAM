"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type OwnerFieldUser = {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
};

export type OwnerFieldValue = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
} | null;

export function OwnerField({
  label,
  owner,
  onChange,
  users,
}: {
  label: string;
  owner: OwnerFieldValue;
  onChange: (id: string | null) => void;
  users?: OwnerFieldUser[];
}) {
  const [search, setSearch] = useState("");

  const filtered = (users ?? []).filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (u.name?.toLowerCase().includes(q)) || u.email.toLowerCase().includes(q);
  });

  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      {owner ? (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md border bg-card group">
          {owner.avatarUrl ? (
            <img src={owner.avatarUrl} alt="" className="h-5 w-5 rounded-full" />
          ) : (
            <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-[9px] font-bold text-primary">
                {(owner.name ?? "?")[0]?.toUpperCase()}
              </span>
            </div>
          )}
          <span className="text-xs font-medium truncate flex-1">{owner.name ?? "Unknown"}</span>
          <button
            onClick={() => onChange(null)}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500 transition"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <Popover>
          <PopoverTrigger className="w-full h-8 px-2 rounded-md border border-dashed text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition text-left">
            + Assign {label.toLowerCase()}
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="start">
            <div className="p-2 border-b">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users..."
                className="w-full text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
              />
            </div>
            <div className="max-h-48 overflow-auto p-1">
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground px-2 py-3 text-center">No users found</p>
              ) : (
                filtered.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => { onChange(u.id); setSearch(""); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-muted transition"
                  >
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt="" className="h-5 w-5 rounded-full" />
                    ) : (
                      <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-[9px] font-bold text-primary">
                          {(u.name ?? u.email)[0]?.toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{u.name ?? "Unnamed"}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
