import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * HMAC-signed active-workspace cookie.
 *
 * Threat model: client must not be able to forge or modify the active
 * workspace selection. Server signs `<wsId>.<exp>` with a shared secret
 * (reuses SHARE_COOKIE_SECRET) and verifies on every read.
 *
 * Format: `<wsId>.<expUnixSec>.<hmacHex>`
 *
 * The `enforceWorkspace` tRPC middleware still does a DB membership
 * check (belt and braces). HMAC's value-add is closing the future hole
 * where a new procedure forgets that middleware.
 */

export const COOKIE_NAME = "eam-active-workspace-sig";
const TTL_SECONDS = 60 * 60 * 8; // 8h sliding

export function sign(workspaceId: string): string {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const mac = createHmac("sha256", getSecret())
    .update(`${workspaceId}.${exp}`)
    .digest("hex");
  return `${workspaceId}.${exp}.${mac}`;
}

export function verify(value: string | undefined | null): string | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [workspaceId, expStr, mac] = parts;
  if (!workspaceId || !expStr || !mac) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
  const expected = createHmac("sha256", getSecret())
    .update(`${workspaceId}.${exp}`)
    .digest("hex");
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(mac, "hex");
    if (a.length !== b.length) return null;
    return timingSafeEqual(a, b) ? workspaceId : null;
  } catch {
    return null;
  }
}

export const COOKIE_MAX_AGE = TTL_SECONDS;

function getSecret(): string {
  const s = process.env.SHARE_COOKIE_SECRET;
  if (!s && process.env.NODE_ENV === "production") {
    throw new Error("SHARE_COOKIE_SECRET required in production");
  }
  return s ?? "dev-only-fallback-do-not-use";
}
