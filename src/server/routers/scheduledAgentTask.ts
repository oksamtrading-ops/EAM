import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { CronExpressionParser } from "cron-parser";
import { router, workspaceProcedure } from "@/server/trpc";

function computeNextRun(cronExpression: string, from: Date = new Date()): Date {
  const interval = CronExpressionParser.parse(cronExpression, {
    currentDate: from,
  });
  return interval.next().toDate();
}

export const scheduledAgentTaskRouter = router({
  list: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.db.scheduledAgentTask.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        userId: ctx.dbUserId,
      },
      orderBy: [{ enabled: "desc" }, { nextRunAt: "asc" }],
      include: {
        lastRun: {
          select: {
            id: true,
            status: true,
            endedAt: true,
            errorMessage: true,
          },
        },
      },
    });
  }),

  create: workspaceProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        prompt: z.string().min(1).max(5000),
        cronExpression: z.string().min(9).max(200),
        enabled: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let nextRunAt: Date;
      try {
        nextRunAt = computeNextRun(input.cronExpression);
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid cron expression: ${err instanceof Error ? err.message : "parse failed"}`,
        });
      }
      return ctx.db.scheduledAgentTask.create({
        data: {
          workspaceId: ctx.workspaceId,
          userId: ctx.dbUserId,
          name: input.name,
          prompt: input.prompt,
          cronExpression: input.cronExpression,
          enabled: input.enabled,
          nextRunAt,
        },
      });
    }),

  update: workspaceProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        prompt: z.string().min(1).max(5000).optional(),
        cronExpression: z.string().min(9).max(200).optional(),
        enabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.scheduledAgentTask.findFirst({
        where: {
          id: input.id,
          workspaceId: ctx.workspaceId,
          userId: ctx.dbUserId,
        },
        select: { id: true, cronExpression: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const { id, cronExpression, ...data } = input;
      let nextRunAt: Date | undefined;
      if (cronExpression && cronExpression !== existing.cronExpression) {
        try {
          nextRunAt = computeNextRun(cronExpression);
        } catch (err) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid cron expression: ${err instanceof Error ? err.message : "parse failed"}`,
          });
        }
      }
      return ctx.db.scheduledAgentTask.update({
        where: { id },
        data: {
          ...data,
          ...(cronExpression ? { cronExpression } : {}),
          ...(nextRunAt ? { nextRunAt } : {}),
        },
      });
    }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.scheduledAgentTask.findFirst({
        where: {
          id: input.id,
          workspaceId: ctx.workspaceId,
          userId: ctx.dbUserId,
        },
        select: { id: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.db.scheduledAgentTask.delete({ where: { id: input.id } });
      return { success: true };
    }),

  /**
   * Run a scheduled task immediately — useful for testing and for
   * "run now" button. Re-computes nextRunAt afterwards.
   */
  runNow: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.scheduledAgentTask.findFirst({
        where: {
          id: input.id,
          workspaceId: ctx.workspaceId,
          userId: ctx.dbUserId,
        },
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });

      // Execute asynchronously so the mutation returns immediately.
      // The cron endpoint and this path share the same executor.
      const { executeScheduledTask } = await import(
        "@/server/ai/scheduledTasks"
      );
      await executeScheduledTask(task.id);
      return { success: true };
    }),
});
