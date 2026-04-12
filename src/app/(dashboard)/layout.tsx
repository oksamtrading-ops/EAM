import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { syncUser } from "@/lib/auth/sync-user";
import { TRPCProvider } from "@/lib/trpc/provider";
import { WorkspaceProvider } from "@/hooks/useWorkspace";
import { DashboardShell } from "./_components/DashboardShell";

const COOKIE_KEY = "eam-active-workspace";

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

  // Read active workspace from cookie (written client-side on switch + reload)
  const cookieStore = await cookies();
  const cookieId = cookieStore.get(COOKIE_KEY)?.value;
  const activeWorkspaceId =
    workspaceInfos.find((w) => w.id === cookieId && w.isActive)?.id ??
    defaultWorkspace.id;

  return (
    <TRPCProvider workspaceId={activeWorkspaceId}>
      <WorkspaceProvider
        workspaces={workspaceInfos}
        defaultWorkspaceId={activeWorkspaceId}
      >
        <DashboardShell>{children}</DashboardShell>
      </WorkspaceProvider>
    </TRPCProvider>
  );
}
