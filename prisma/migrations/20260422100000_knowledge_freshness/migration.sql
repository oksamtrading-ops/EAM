-- Knowledge freshness: per-workspace stale threshold + per-fact review stamp.
-- See plan_c_#14 for rationale.

ALTER TABLE "workspace_knowledge"
  ADD COLUMN "lastReviewedAt" TIMESTAMP(3);

ALTER TABLE "workspace_agent_settings"
  ADD COLUMN "staleKnowledgeDays" INTEGER NOT NULL DEFAULT 90;
