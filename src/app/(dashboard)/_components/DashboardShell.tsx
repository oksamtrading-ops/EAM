"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  Network,
  Settings,
  Tags,
  Building2,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";

const navItems = [
  {
    label: "Capabilities",
    href: "/capabilities",
    icon: Network,
    description: "Business capability map",
  },
  {
    label: "Organizations",
    href: "/organizations",
    icon: Building2,
    description: "Business units",
  },
  {
    label: "Tags",
    href: "/tags",
    icon: Tags,
    description: "Classification tags",
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    description: "Workspace config",
  },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { workspaceName, industry } = useWorkspace();

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f9fa]">
      {/* Sidebar */}
      <aside className="w-[260px] bg-[#1a1f2e] flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/10">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#86BC25] flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-[15px] text-white tracking-tight">
                EAM Platform
              </h1>
              <p className="text-[11px] text-white/50 truncate max-w-[160px]">
                {workspaceName} · {industry}
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">
            Modules
          </p>
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all",
                  isActive
                    ? "bg-[#86BC25]/15 text-[#86BC25]"
                    : "text-white/60 hover:bg-white/5 hover:text-white/90"
                )}
              >
                <item.icon className="h-[18px] w-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t border-white/10 flex items-center gap-3">
          <UserButton
            appearance={{
              elements: {
                avatarBox: "h-8 w-8",
              },
            }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/70 truncate">Signed in</p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
