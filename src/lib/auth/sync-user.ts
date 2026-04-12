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

  // Fetch all active workspaces for this user
  let workspaces = await db.workspace.findMany({
    where: { userId: user.id, isActive: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  // Ensure at least one workspace exists
  if (workspaces.length === 0) {
    const ws = await db.workspace.create({
      data: {
        name: "My Workspace",
        slug: `ws-${user.id}`,
        userId: user.id,
        isDefault: true,
        isActive: true,
      },
    });
    workspaces = [ws];
  }

  // Ensure exactly one default workspace
  const hasDefault = workspaces.some((w) => w.isDefault);
  if (!hasDefault) {
    await db.workspace.update({
      where: { id: workspaces[0]!.id },
      data: { isDefault: true },
    });
    workspaces[0] = { ...workspaces[0]!, isDefault: true };
  }

  // The "default" workspace is the first one (sorted by isDefault desc)
  const defaultWorkspace = workspaces.find((w) => w.isDefault) ?? workspaces[0]!;

  return { user, workspaces, defaultWorkspace };
}
