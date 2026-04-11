import { router } from "@/server/trpc";
import { capabilityRouter } from "./capability";
import { workspaceRouter } from "./workspace";
import { tagRouter } from "./tag";
import { versionRouter } from "./version";
import { applicationRouter } from "./application";
import { initiativeRouter } from "./initiative";
import { milestoneRouter } from "./milestone";
import { objectiveRouter } from "./objective";
import { archStateRouter } from "./archState";

export const appRouter = router({
  capability: capabilityRouter,
  workspace: workspaceRouter,
  tag: tagRouter,
  version: versionRouter,
  application: applicationRouter,
  initiative: initiativeRouter,
  milestone: milestoneRouter,
  objective: objectiveRouter,
  archState: archStateRouter,
});

export type AppRouter = typeof appRouter;
