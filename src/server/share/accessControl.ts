import "server-only";
import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

/**
 * Primitives for share-link access control. All crypto comes from
 * node:crypto — no external dependency. Used by:
 *   - agentConversationShareRouter (hash on create/rotate).
 *   - /api/public/conversations/[slug]/unlock (verify + issue cookie).
 *   - /share/c/[slug] page (verify cookie before rendering).
 *
 * Passcode storage format: `<saltB64>$<hashB64>` where both are 32-byte
 * base64-encoded. Prevents pre-computed rainbow tables and doesn't
 * require a separate column for the salt.
 *
 * Cookie format: `<expUnixSec>.<hmacHex>` where the HMAC is over
 * `<slug>.<exp>` using SHARE_COOKIE_SECRET.
 */

const SCRYPT_COST = 16384; // N; default is 16384, fine for short codes
const SCRYPT_KEYLEN = 32;
const SALT_LEN = 32;

/** 6-char alphanumeric, upper-case, confusables removed (0/O/1/I/L). */
const PASSCODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const PASSCODE_LEN = 6;

export function generatePasscode(): string {
  const bytes = randomBytes(PASSCODE_LEN);
  let out = "";
  for (let i = 0; i < PASSCODE_LEN; i++) {
    out += PASSCODE_ALPHABET[bytes[i]! % PASSCODE_ALPHABET.length];
  }
  return out;
}

export function hashPasscode(code: string): string {
  const salt = randomBytes(SALT_LEN);
  const hash = scryptSync(code.normalize("NFKC"), salt, SCRYPT_KEYLEN, {
    N: SCRYPT_COST,
  });
  return `${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPasscode(code: string, stored: string): boolean {
  const [saltB64, hashB64] = stored.split("$");
  if (!saltB64 || !hashB64) return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltB64, "base64");
    expected = Buffer.from(hashB64, "base64");
  } catch {
    return false;
  }
  if (expected.length !== SCRYPT_KEYLEN) return false;
  const candidate = scryptSync(
    code.normalize("NFKC"),
    salt,
    SCRYPT_KEYLEN,
    { N: SCRYPT_COST }
  );
  // timingSafeEqual requires equal-length buffers (already enforced).
  try {
    return timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

// -----------------------------------------------------------------
// Signed cookie for "viewer already proved the passcode"
// -----------------------------------------------------------------

function getCookieSecret(): string {
  const fromEnv = process.env.SHARE_COOKIE_SECRET;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    // Fail closed in prod — don't let a missing secret silently
    // accept forged cookies.
    throw new Error(
      "SHARE_COOKIE_SECRET is required in production (>=16 chars)."
    );
  }
  // Dev fallback — predictable, loud.
  console.warn(
    "[share-acl] SHARE_COOKIE_SECRET missing; using dev fallback. Cookies are NOT trustworthy in this mode."
  );
  return "dev-only-share-cookie-secret-do-not-use-in-prod";
}

export function signShareCookie(slug: string, expUnixSec: number): string {
  const mac = createHmac("sha256", getCookieSecret())
    .update(`${slug}.${expUnixSec}`)
    .digest("hex");
  return `${expUnixSec}.${mac}`;
}

export function verifyShareCookie(
  slug: string,
  cookie: string | undefined
): boolean {
  if (!cookie) return false;
  const [expStr, mac] = cookie.split(".");
  if (!expStr || !mac) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp)) return false;
  if (exp < Math.floor(Date.now() / 1000)) return false;
  const expected = createHmac("sha256", getCookieSecret())
    .update(`${slug}.${exp}`)
    .digest("hex");
  if (expected.length !== mac.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(mac));
  } catch {
    return false;
  }
}

/**
 * Cookie name is share-scoped so unlocking one share doesn't unlock
 * another on the same browser.
 */
export function shareCookieName(slug: string): string {
  return `share-ok-${slug}`;
}

/**
 * Default cookie TTL when the share has no expiry. Chosen shorter
 * than the typical share window so an abandoned browser won't retain
 * access forever.
 */
export const DEFAULT_UNLOCK_TTL_SEC = 7 * 24 * 60 * 60; // 7 days
