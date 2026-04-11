-- CreateEnum
CREATE TYPE "InitiativeStatus" AS ENUM ('DRAFT', 'PLANNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InitiativePriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "InitiativeCategory" AS ENUM ('MODERNISATION', 'CONSOLIDATION', 'DIGITALISATION', 'COMPLIANCE', 'OPTIMISATION', 'INNOVATION', 'DECOMMISSION');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETE', 'BLOCKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ArchStateType" AS ENUM ('AS_IS', 'TO_BE');

-- CreateEnum
CREATE TYPE "DependencyType" AS ENUM ('FINISH_TO_START', 'FINISH_TO_FINISH', 'START_TO_START');

-- CreateEnum
CREATE TYPE "RoadmapHorizon" AS ENUM ('H1_NOW', 'H2_NEXT', 'H3_LATER', 'BEYOND');

-- CreateTable
CREATE TABLE "objectives" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetDate" TIMESTAMP(3),
    "kpiDescription" TEXT,
    "kpiTarget" TEXT,
    "ownerId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "initiatives" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "InitiativeCategory" NOT NULL DEFAULT 'MODERNISATION',
    "status" "InitiativeStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" "InitiativePriority" NOT NULL DEFAULT 'MEDIUM',
    "horizon" "RoadmapHorizon" NOT NULL DEFAULT 'H2_NEXT',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "budgetUsd" DECIMAL(14,2),
    "budgetCurrency" TEXT NOT NULL DEFAULT 'USD',
    "ownerId" TEXT,
    "businessSponsor" TEXT,
    "progressPct" INTEGER NOT NULL DEFAULT 0,
    "ragStatus" TEXT NOT NULL DEFAULT 'GREEN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "initiatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestones" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "ownerId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "initiative_dependencies" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "dependentId" TEXT NOT NULL,
    "blockingId" TEXT NOT NULL,
    "dependencyType" "DependencyType" NOT NULL DEFAULT 'FINISH_TO_START',
    "lagDays" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "initiative_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestone_dependencies" (
    "dependentId" TEXT NOT NULL,
    "blockingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milestone_dependencies_pkey" PRIMARY KEY ("dependentId","blockingId")
);

-- CreateTable
CREATE TABLE "initiative_capability_maps" (
    "initiativeId" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "impactType" TEXT NOT NULL DEFAULT 'IMPROVES',
    "currentMaturity" TEXT,
    "targetMaturity" TEXT,
    "notes" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "initiative_capability_maps_pkey" PRIMARY KEY ("initiativeId","capabilityId")
);

-- CreateTable
CREATE TABLE "initiative_application_maps" (
    "initiativeId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL DEFAULT 'MODIFIES',
    "notes" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "initiative_application_maps_pkey" PRIMARY KEY ("initiativeId","applicationId")
);

-- CreateTable
CREATE TABLE "initiative_objective_maps" (
    "initiativeId" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "initiative_objective_maps_pkey" PRIMARY KEY ("initiativeId","objectiveId")
);

-- CreateTable
CREATE TABLE "architecture_states" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "initiativeId" TEXT,
    "stateType" "ArchStateType" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "snapshot" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "architecture_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "initiative_tags" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',

    CONSTRAINT "initiative_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "initiative_tag_maps" (
    "initiativeId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "initiative_tag_maps_pkey" PRIMARY KEY ("initiativeId","tagId")
);

-- CreateIndex
CREATE INDEX "objectives_workspaceId_idx" ON "objectives"("workspaceId");

-- CreateIndex
CREATE INDEX "initiatives_workspaceId_idx" ON "initiatives"("workspaceId");

-- CreateIndex
CREATE INDEX "initiatives_workspaceId_status_idx" ON "initiatives"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "initiatives_workspaceId_horizon_idx" ON "initiatives"("workspaceId", "horizon");

-- CreateIndex
CREATE INDEX "milestones_initiativeId_idx" ON "milestones"("initiativeId");

-- CreateIndex
CREATE INDEX "milestones_workspaceId_idx" ON "milestones"("workspaceId");

-- CreateIndex
CREATE INDEX "initiative_dependencies_workspaceId_idx" ON "initiative_dependencies"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "initiative_dependencies_dependentId_blockingId_key" ON "initiative_dependencies"("dependentId", "blockingId");

-- CreateIndex
CREATE INDEX "initiative_capability_maps_workspaceId_capabilityId_idx" ON "initiative_capability_maps"("workspaceId", "capabilityId");

-- CreateIndex
CREATE INDEX "initiative_application_maps_workspaceId_applicationId_idx" ON "initiative_application_maps"("workspaceId", "applicationId");

-- CreateIndex
CREATE INDEX "architecture_states_workspaceId_stateType_idx" ON "architecture_states"("workspaceId", "stateType");

-- CreateIndex
CREATE INDEX "architecture_states_initiativeId_idx" ON "architecture_states"("initiativeId");

-- CreateIndex
CREATE UNIQUE INDEX "initiative_tags_workspaceId_name_key" ON "initiative_tags"("workspaceId", "name");

-- AddForeignKey
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiative_dependencies" ADD CONSTRAINT "initiative_dependencies_dependentId_fkey" FOREIGN KEY ("dependentId") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiative_dependencies" ADD CONSTRAINT "initiative_dependencies_blockingId_fkey" FOREIGN KEY ("blockingId") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_dependencies" ADD CONSTRAINT "milestone_dependencies_dependentId_fkey" FOREIGN KEY ("dependentId") REFERENCES "milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_dependencies" ADD CONSTRAINT "milestone_dependencies_blockingId_fkey" FOREIGN KEY ("blockingId") REFERENCES "milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiative_capability_maps" ADD CONSTRAINT "initiative_capability_maps_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiative_application_maps" ADD CONSTRAINT "initiative_application_maps_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiative_objective_maps" ADD CONSTRAINT "initiative_objective_maps_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiative_objective_maps" ADD CONSTRAINT "initiative_objective_maps_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "objectives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "architecture_states" ADD CONSTRAINT "architecture_states_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "architecture_states" ADD CONSTRAINT "architecture_states_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "initiatives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "architecture_states" ADD CONSTRAINT "architecture_states_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiative_tags" ADD CONSTRAINT "initiative_tags_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiative_tag_maps" ADD CONSTRAINT "initiative_tag_maps_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiative_tag_maps" ADD CONSTRAINT "initiative_tag_maps_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "initiative_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
