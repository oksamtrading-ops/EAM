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

  // Ensure a default workspace exists
  let workspace = await db.workspace.findFirst({
    where: { userId: user.id },
  });

  if (!workspace) {
    workspace = await db.workspace.create({
      data: {
        name: "My Workspace",
        slug: `ws-${user.id}`,
        userId: user.id,
      },
    });
  }

  return { user, workspace };
}
