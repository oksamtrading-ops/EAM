import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";

export async function createTRPCContext(opts: { headers: Headers }) {
  const { userId } = await auth();
  const workspaceId = opts.headers.get("x-workspace-id") ?? null;

  return {
    db,
    userId,
    workspaceId,
    headers: opts.headers,
  };
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;
