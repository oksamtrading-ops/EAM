-- Add per-workspace Anthropic monthly budget cap.
-- NULL = unlimited (legacy behavior preserved). OpenAI embedding cost
-- is NOT covered by this cap.

ALTER TABLE "workspace_agent_settings"
  ADD COLUMN "monthlyAnthropicBudgetUsd" DECIMAL(10, 2);
