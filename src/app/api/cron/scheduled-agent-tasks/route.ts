import { NextResponse } from "next/server";
import { executeDueScheduledTasks } from "@/server/ai/scheduledTasks";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Invoked by Vercel Cron (config in vercel.json). Authenticates via
 * the CRON_SECRET header Vercel injects when configured; if the env
 * var isn't set (e.g. local dev), the endpoint still allows unauth'd
 * GET so you can test manually.
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const header = req.headers.get("authorization") ?? "";
    if (header !== `Bearer ${expected}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  const result = await executeDueScheduledTasks();
  return NextResponse.json({
    ok: true,
    executed: result.executed,
    failed: result.failed,
    at: new Date().toISOString(),
  });
}
