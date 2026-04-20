import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";
import { estimateRunCostUsd } from "@/lib/utils/agentPricing";

const SinceDaysInput = z
  .object({ sinceDays: z.number().int().min(1).max(365).default(30) })
  .optional();

export const agentRunRouter = router({
  list: workspaceProcedure
    .input(
      z
        .object({
          kind: z.string().optional(),
          kindPrefix: z.string().optional(),
          hideSubRuns: z.boolean().optional(),
          /**
           * Drops console runs whose conversation has been deleted.
           * Use in UIs where orphaned rows are noise (e.g. the
           * deliverable wizard). The trace viewer at /agents/runs
           * still surfaces them for audit purposes.
           */
          hideOrphanConsole: z.boolean().optional(),
          limit: z.number().int().min(1).max(200).default(50),
          cursor: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const orphanFilter =
        input?.hideOrphanConsole
          ? {
              NOT: { kind: "console", conversationId: null },
            }
          : {};
      const runs = await ctx.db.agentRun.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          kind: input?.kind
            ? input.kind
            : input?.kindPrefix
              ? { startsWith: input.kindPrefix }
              : undefined,
          parentRunId: input?.hideSubRuns ? null : undefined,
          ...orphanFilter,
        },
        orderBy: { startedAt: "desc" },
        take: limit + 1, // fetch +1 to know if there's a next page
        ...(input?.cursor
          ? { cursor: { id: input.cursor }, skip: 1 }
          : {}),
        select: {
          id: true,
          kind: true,
          status: true,
          startedAt: true,
          endedAt: true,
          model: true,
          promptVersion: true,
          totalTokensIn: true,
          totalTokensOut: true,
          errorMessage: true,
          parentRunId: true,
          // Conversation title is the human-friendly label for "console"
          // runs (auto-derived from the first user message). Sub-agent
          // and scheduled runs have no conversation — fall back to kind
          // in the UI.
          conversation: { select: { id: true, title: true } },
          _count: { select: { steps: true, subRuns: true } },
        },
      });
      const hasNext = runs.length > limit;
      const items = hasNext ? runs.slice(0, limit) : runs;
      return {
        items,
        nextCursor: hasNext ? items[items.length - 1]!.id : null,
      };
    }),

  listKinds: workspaceProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.agentRun.groupBy({
      by: ["kind"],
      where: { workspaceId: ctx.workspaceId },
      _count: { _all: true },
      orderBy: { kind: "asc" },
    });
    return rows.map((r) => ({ kind: r.kind, count: r._count._all }));
  }),

  /**
   * Aggregate cost/token totals for a workspace over the last N days.
   * `totalUsd` is estimated from per-model pricing — not a billed
   * figure, but close enough for operator awareness.
   */
  costSummary: workspaceProcedure
    .input(SinceDaysInput)
    .query(async ({ ctx, input }) => {
      const sinceDays = input?.sinceDays ?? 30;
      const since = new Date(Date.now() - sinceDays * 86_400_000);
      const rows = await ctx.db.agentRun.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          startedAt: { gte: since },
          parentRunId: null, // parent only; sub-runs roll up into parents conceptually
        },
        select: {
          model: true,
          totalTokensIn: true,
          totalTokensOut: true,
        },
      });
      let totalUsd = 0;
      let totalTokensIn = 0;
      let totalTokensOut = 0;
      for (const r of rows) {
        totalUsd += estimateRunCostUsd(r);
        totalTokensIn += r.totalTokensIn;
        totalTokensOut += r.totalTokensOut;
      }
      return {
        sinceDays,
        runCount: rows.length,
        totalUsd,
        totalTokensIn,
        totalTokensOut,
      };
    }),

  /**
   * Cost + run counts grouped by AgentRun.kind, so operators can see
   * which workflow is burning the most.
   */
  costByKind: workspaceProcedure
    .input(SinceDaysInput)
    .query(async ({ ctx, input }) => {
      const sinceDays = input?.sinceDays ?? 30;
      const since = new Date(Date.now() - sinceDays * 86_400_000);
      const rows = await ctx.db.agentRun.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          startedAt: { gte: since },
          parentRunId: null,
        },
        select: {
          kind: true,
          model: true,
          totalTokensIn: true,
          totalTokensOut: true,
        },
      });
      const byKind = new Map<
        string,
        { kind: string; usd: number; tokens: number; runs: number }
      >();
      for (const r of rows) {
        const entry = byKind.get(r.kind) ?? {
          kind: r.kind,
          usd: 0,
          tokens: 0,
          runs: 0,
        };
        entry.usd += estimateRunCostUsd(r);
        entry.tokens += r.totalTokensIn + r.totalTokensOut;
        entry.runs += 1;
        byKind.set(r.kind, entry);
      }
      return Array.from(byKind.values()).sort((a, b) => b.usd - a.usd);
    }),

  /**
   * Daily cost rollup for a trend chart. Uses a raw query because
   * Prisma groupBy can't truncate dates.
   */
  costByDay: workspaceProcedure
    .input(SinceDaysInput)
    .query(async ({ ctx, input }) => {
      const sinceDays = input?.sinceDays ?? 30;
      const since = new Date(Date.now() - sinceDays * 86_400_000);
      const rows = await ctx.db.agentRun.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          startedAt: { gte: since },
          parentRunId: null,
        },
        select: {
          model: true,
          startedAt: true,
          totalTokensIn: true,
          totalTokensOut: true,
        },
      });
      const byDay = new Map<
        string,
        { day: string; usd: number; tokens: number; runs: number }
      >();
      for (const r of rows) {
        // Bucket by UTC date — ignore timezones in the KPI; cost is
        // already an estimate.
        const day = r.startedAt.toISOString().slice(0, 10);
        const entry = byDay.get(day) ?? {
          day,
          usd: 0,
          tokens: 0,
          runs: 0,
        };
        entry.usd += estimateRunCostUsd(r);
        entry.tokens += r.totalTokensIn + r.totalTokensOut;
        entry.runs += 1;
        byDay.set(day, entry);
      }
      return Array.from(byDay.values()).sort((a, b) =>
        a.day < b.day ? -1 : a.day > b.day ? 1 : 0
      );
    }),

  /**
   * Top N most expensive runs in the window — operator's "where did
   * the money go?" view.
   */
  topCostRuns: workspaceProcedure
    .input(
      z
        .object({
          sinceDays: z.number().int().min(1).max(365).default(30),
          limit: z.number().int().min(1).max(50).default(10),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const sinceDays = input?.sinceDays ?? 30;
      const limit = input?.limit ?? 10;
      const since = new Date(Date.now() - sinceDays * 86_400_000);
      // Fetch enough to sort by cost; tokens+model decides cost, and
      // there's no DB column to sort on directly. Limit the pool so we
      // don't pull every run for a heavy workspace.
      const rows = await ctx.db.agentRun.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          startedAt: { gte: since },
          parentRunId: null,
        },
        orderBy: [
          { totalTokensOut: "desc" },
          { totalTokensIn: "desc" },
        ],
        take: 500,
        select: {
          id: true,
          kind: true,
          model: true,
          status: true,
          startedAt: true,
          totalTokensIn: true,
          totalTokensOut: true,
          conversation: { select: { title: true } },
        },
      });
      return rows
        .map((r) => ({ ...r, usd: estimateRunCostUsd(r) }))
        .sort((a, b) => b.usd - a.usd)
        .slice(0, limit);
    }),

  getById: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const run = await ctx.db.agentRun.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
        include: {
          steps: { orderBy: { ordinal: "asc" } },
          parent: { select: { id: true, kind: true, status: true } },
          subRuns: {
            orderBy: { startedAt: "asc" },
            select: {
              id: true,
              kind: true,
              status: true,
              startedAt: true,
              endedAt: true,
              totalTokensIn: true,
              totalTokensOut: true,
              errorMessage: true,
            },
          },
        },
      });
      if (!run) throw new TRPCError({ code: "NOT_FOUND" });
      return run;
    }),
});
