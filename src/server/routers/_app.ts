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
import { riskRouter } from "./risk";
import { techRadarRouter } from "./techRadar";
import { complianceRouter } from "./compliance";
import { eolRouter } from "./eol";
import { organizationRouter } from "./organization";
import { dashboardRouter } from "./dashboard";
import { searchRouter } from "./search";
import { paletteQueryRouter } from "./paletteQuery";
import { dataDomainRouter } from "./dataDomain";
import { dataEntityRouter } from "./dataEntity";
import { dataAttributeRouter } from "./dataAttribute";
import { appEntityUsageRouter } from "./appEntityUsage";
import { vendorRouter } from "./vendor";
import { technologyProductRouter } from "./technologyProduct";
import { technologyVersionRouter } from "./technologyVersion";
import { technologyComponentRouter } from "./technologyComponent";
import { technologyDependencyRouter } from "./technologyDependency";
import { technologyStandardRouter } from "./technologyStandard";
import { referenceArchitectureRouter } from "./referenceArchitecture";
import { techArchitectureRouter } from "./techArchitecture";
import { intakeRouter } from "./intake";
import { agentRunRouter } from "./agentRun";
import { agentConversationRouter } from "./agentConversation";

export const appRouter = router({
  dashboard: dashboardRouter,
  search: searchRouter,
  paletteQuery: paletteQueryRouter,
  capability: capabilityRouter,
  organization: organizationRouter,
  workspace: workspaceRouter,
  tag: tagRouter,
  version: versionRouter,
  application: applicationRouter,
  initiative: initiativeRouter,
  milestone: milestoneRouter,
  objective: objectiveRouter,
  archState: archStateRouter,
  risk: riskRouter,
  techRadar: techRadarRouter,
  compliance: complianceRouter,
  eol: eolRouter,
  dataDomain: dataDomainRouter,
  dataEntity: dataEntityRouter,
  dataAttribute: dataAttributeRouter,
  appEntityUsage: appEntityUsageRouter,
  vendor: vendorRouter,
  technologyProduct: technologyProductRouter,
  technologyVersion: technologyVersionRouter,
  technologyComponent: technologyComponentRouter,
  technologyDependency: technologyDependencyRouter,
  technologyStandard: technologyStandardRouter,
  referenceArchitecture: referenceArchitectureRouter,
  techArchitecture: techArchitectureRouter,
  intake: intakeRouter,
  agentRun: agentRunRouter,
  agentConversation: agentConversationRouter,
});

export type AppRouter = typeof appRouter;
