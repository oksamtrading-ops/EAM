import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  // Vercel Cron endpoints — secured by CRON_SECRET Bearer token inside the handler.
  "/api/cron(.*)",
  // Shared conversation read-only pages + their backing public API.
  // Access control is per-slug (revoked / expired checks in the handler).
  "/api/public(.*)",
  "/share(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
