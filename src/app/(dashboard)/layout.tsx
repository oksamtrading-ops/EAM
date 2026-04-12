import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { syncUser } from "@/lib/auth/sync-user";
import { TRPCProvider } from "@/lib/trpc/provider";
import { WorkspaceProvider } from "@/hooks/useWorkspace";
import { DashboardShell } from "./_components/DashboardShell";
import { ActiveWorkspaceResolver } from "./_components/ActiveWorkspaceResolver";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const result = await syncUser();

  if (!result) {
    redirect("/sign-in");
  }

  const { workspaces, defaultWorkspace } = result;

  const workspaceInfos = workspaces.map((w) => ({
    id: w.id,
    name: w.name,
    industry: w.industry,
    clientName: w.clientName,
    isDefault: w.isDefault,
    isActive: w.isActive,
  }));

  return (
    <ActiveWorkspaceResolver
      workspaces={workspaceInfos}
      defaultWorkspaceId={defaultWorkspace.id}
    >
      {(activeWorkspaceId) => (
        <TRPCProvider workspaceId={activeWorkspaceId}>
          <WorkspaceProvider
            workspaces={workspaceInfos}
            defaultWorkspaceId={defaultWorkspace.id}
          >
            <DashboardShell>{children}</DashboardShell>
          </WorkspaceProvider>
        </TRPCProvider>
      )}
    </ActiveWorkspaceResolver>
  );
}
