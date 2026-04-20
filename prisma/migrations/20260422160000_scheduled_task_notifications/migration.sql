-- Email notifications for scheduled-agent-task runs.

CREATE TYPE "ScheduledTaskNotifyMode" AS ENUM ('NEVER', 'ON_FAILURE', 'ALWAYS');

ALTER TABLE "scheduled_agent_tasks"
  ADD COLUMN "notifyEmail" TEXT,
  ADD COLUMN "notifyMode" "ScheduledTaskNotifyMode" NOT NULL DEFAULT 'NEVER';
