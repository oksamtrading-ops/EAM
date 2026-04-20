import { NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  verifyPasscode,
  signShareCookie,
  shareCookieName,
  DEFAULT_UNLOCK_TTL_SEC,
} from "@/server/share/accessControl";

export const runtime = "nodejs";

/**
 * Public endpoint. POST { passcode } → 200 + Set-Cookie on success,
 * 401 on wrong passcode, 404 if share missing/revoked, 410 if
 * expired. Tiny in-memory IP-keyed rate limit keeps brute-force
 * attempts bounded — good enough for a 6-char code with scrypt
 * hashing behind it.
 */

type Bucket = { count: number; firstAttemptMs: number };
const attempts = new Map<string, Bucket>();
const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 min
const RATE_MAX = 5;

function hitRate(ip: string): boolean {
  const now = Date.now();
  const bucket = attempts.get(ip);
  if (!bucket || now - bucket.firstAttemptMs > RATE_WINDOW_MS) {
    attempts.set(ip, { count: 1, firstAttemptMs: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_MAX;
}

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "anonymous"
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (hitRate(clientIp(req))) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429 }
    );
  }

  let body: { passcode?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const passcode = typeof body.passcode === "string" ? body.passcode : "";
  if (!passcode) {
    return NextResponse.json({ error: "Passcode required" }, { status: 400 });
  }

  const share = await db.agentConversationShare.findUnique({
    where: { slug },
    select: {
      id: true,
      revoked: true,
      expiresAt: true,
      protectionMode: true,
      passcodeHash: true,
    },
  });
  if (!share || share.revoked) {
    return NextResponse.json({ error: "Share not found" }, { status: 404 });
  }
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Share has expired" }, { status: 410 });
  }
  if (share.protectionMode !== "PASSCODE" || !share.passcodeHash) {
    return NextResponse.json(
      { error: "This share doesn't require a passcode" },
      { status: 400 }
    );
  }
  if (!verifyPasscode(passcode, share.passcodeHash)) {
    return NextResponse.json({ error: "Incorrect code" }, { status: 401 });
  }

  // TTL: shorter of the share expiry and DEFAULT_UNLOCK_TTL_SEC. This
  // way an abandoned browser can't retain access past the share's own
  // lifetime.
  const nowSec = Math.floor(Date.now() / 1000);
  const shareExpSec = share.expiresAt
    ? Math.floor(share.expiresAt.getTime() / 1000)
    : nowSec + DEFAULT_UNLOCK_TTL_SEC * 10; // no expiry → long-ish
  const expSec = Math.min(shareExpSec, nowSec + DEFAULT_UNLOCK_TTL_SEC);
  const cookieValue = signShareCookie(slug, expSec);
  const cookieName = shareCookieName(slug);
  const maxAge = expSec - nowSec;

  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieName, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/share/c/${slug}`,
    maxAge,
  });
  return res;
}
