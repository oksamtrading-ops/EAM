import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/server/db";

export async function syncUser() {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const user = await db.user.upsert({
    where: { clerkId: clerkUser.id },
    update: {
      email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
      name: clerkUser.fullName,
      avatarUrl: clerkUser.imageUrl,
    },
    create: {
      clerkId: clerkUser.id,
      email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
      name: clerkUser.fullName,
      avatarUrl: clerkUser.imageUrl,
    },
  });

  // Fetch ALL workspaces (isActive may be null/false on rows created before migration)
  let allWorkspaces = await db.workspace.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  // Fix any rows where isActive was not set by the migration (null → true)
  const needsActivation = allWorkspaces.filter((w) => !w.isActive);
  if (needsActivation.length > 0) {
    await db.workspace.updateMany({
      where: { userId: user.id, isActive: false },
      data: { isActive: true },
    });
    allWorkspaces = allWorkspaces.map((w) => ({ ...w, isActive: true }));
  }

  // Create a default workspace only if none exist at all
  if (allWorkspaces.length === 0) {
    const ws = await db.workspace.create({
      data: {
        name: "My Workspace",
        slug: `ws-${user.id}`,
        userId: user.id,
        isDefault: true,
        isActive: true,
      },
    });
    allWorkspaces = [ws];
  }

  // Ensure exactly one default
  const hasDefault = allWorkspaces.some((w) => w.isDefault);
  if (!hasDefault) {
    await db.workspace.update({
      where: { id: allWorkspaces[0]!.id },
      data: { isDefault: true },
    });
    allWorkspaces[0] = { ...allWorkspaces[0]!, isDefault: true };
  }

  const workspaces = allWorkspaces.filter((w) => w.isActive);
  const defaultWorkspace =
    workspaces.find((w) => w.isDefault) ?? workspaces[0]!;

  return { user, workspaces, defaultWorkspace };
}
