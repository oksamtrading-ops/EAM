import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { syncUser } from "@/lib/auth/sync-user";
import { TRPCProvider } from "@/lib/trpc/provider";
import { WorkspaceProvider } from "@/hooks/useWorkspace";
import { DashboardShell } from "./_components/DashboardShell";
import {
  COOKIE_NAME as WS_COOKIE_NAME,
  verify as verifyWsCookie,
} from "@/server/auth/workspaceCookie";

const LEGACY_COOKIE_KEY = "eam-active-workspace";

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

  // Prefer the HMAC-signed cookie. Fall back to the legacy unsigned
  // cookie during the rollout window — membership is re-checked
  // against the workspaces list either way.
  const cookieStore = await cookies();
  const signed = verifyWsCookie(cookieStore.get(WS_COOKIE_NAME)?.value);
  const legacyId = cookieStore.get(LEGACY_COOKIE_KEY)?.value;
  const candidate = signed ?? legacyId ?? null;
  const activeWorkspaceId =
    workspaceInfos.find((w) => w.id === candidate && w.isActive)?.id ??
    defaultWorkspace.id;

  return (
    <TRPCProvider>
      <WorkspaceProvider
        workspaces={workspaceInfos}
        defaultWorkspaceId={activeWorkspaceId}
      >
        <DashboardShell>{children}</DashboardShell>
      </WorkspaceProvider>
    </TRPCProvider>
  );
}
