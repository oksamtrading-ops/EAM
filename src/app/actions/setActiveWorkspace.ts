"use server";

import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { db } from "@/server/db";
import {
  COOKIE_NAME,
  COOKIE_MAX_AGE,
  sign,
} from "@/server/auth/workspaceCookie";

export async function setActiveWorkspace(workspaceId: string): Promise<
  { ok: true } | { ok: false; reason: string }
> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { ok: false, reason: "unauthenticated" };

  const user = await db.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });
  if (!user) return { ok: false, reason: "user_not_found" };

  const ws = await db.workspace.findFirst({
    where: { id: workspaceId, userId: user.id, isActive: true },
    select: { id: true },
  });
  if (!ws) return { ok: false, reason: "forbidden" };

  const jar = await cookies();
  jar.set(COOKIE_NAME, sign(ws.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  return { ok: true };
}
