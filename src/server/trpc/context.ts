import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { assertEnv } from "@/server/env";
import {
  COOKIE_NAME as WS_COOKIE_NAME,
  verify as verifyWsCookie,
} from "@/server/auth/workspaceCookie";

const LEGACY_COOKIE_NAME = "eam-active-workspace";

export async function createTRPCContext(opts: { headers: Headers }) {
  // Request-time env validation. Skipped during `next build`'s page-data
  // collection phase by env.ts itself; first real request validates +
  // throws on missing required prod keys.
  assertEnv();
  const { userId } = await auth();

  // Primary path: HMAC-signed cookie. Fallback: legacy unsigned cookie
  // (still gated by enforceWorkspace's DB membership check). The
  // x-workspace-id header is no longer trusted.
  const cookieHeader = opts.headers.get("cookie") ?? "";
  const cookies = parseCookies(cookieHeader);
  const signed = verifyWsCookie(cookies[WS_COOKIE_NAME]);
  const legacy = cookies[LEGACY_COOKIE_NAME] ?? null;
  const workspaceId = signed ?? legacy;

  if (process.env.NODE_ENV !== "test") {
    console.log(
      JSON.stringify({
        evt: "ws_cookie_verify",
        outcome: signed ? "signed" : legacy ? "legacy_fallback" : "missing",
      })
    );
  }

  return {
    db,
    userId,
    workspaceId,
    headers: opts.headers,
  };
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of header.split(";")) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}
