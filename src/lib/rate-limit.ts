// Simple in-memory rate limiter for POC (no Redis needed)
// Limits per userId to prevent API credit abuse

const store = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  userId: string,
  { maxRequests = 10, windowMs = 60_000 } = {}
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = store.get(userId);

  if (!entry || now > entry.resetAt) {
    store.set(userId, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count };
}
