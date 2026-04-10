import { redirect } from "next/navigation";
import { syncUser } from "@/lib/auth/sync-user";
import { TRPCProvider } from "@/lib/trpc/provider";
import { WorkspaceProvider } from "@/hooks/useWorkspace";
import { DashboardShell } from "./_components/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const result = await syncUser();

  if (!result) {
    redirect("/sign-in");
  }

  const { workspace } = result;

  return (
    <TRPCProvider workspaceId={workspace.id}>
      <WorkspaceProvider
        value={{
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          industry: workspace.industry,
        }}
      >
        <DashboardShell>{children}</DashboardShell>
      </WorkspaceProvider>
    </TRPCProvider>
  );
}
