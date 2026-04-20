import { NextResponse } from "next/server";
import { db } from "@/server/db";

export const runtime = "nodejs";
export const maxDuration = 60;

const STALE_AFTER_MINUTES = 10;

/**
 * Vercel Cron target. Marks orphaned RUNNING AgentRun rows as
 * CANCELLED after STALE_AFTER_MINUTES. CRON_SECRET-gated in prod;
 * unauthenticated in local dev for easy manual invocation.
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const header = req.headers.get("authorization") ?? "";
    if (header !== `Bearer ${expected}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  // $executeRaw returns the number of affected rows in Postgres.
  const swept = await db.$executeRaw`
    UPDATE agent_runs
    SET status = 'CANCELLED'::"AgentRunStatus",
        "endedAt" = NOW(),
        "errorMessage" = COALESCE(
          "errorMessage",
          'Swept by /api/cron/sweep-stale-runs'
        )
    WHERE status = 'RUNNING'
      AND "startedAt" < NOW() - (${STALE_AFTER_MINUTES} || ' minutes')::interval
  `;

  return NextResponse.json({
    ok: true,
    swept,
    at: new Date().toISOString(),
  });
}
