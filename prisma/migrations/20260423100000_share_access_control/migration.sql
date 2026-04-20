-- Share access control — passcode + sign-in-required alongside the
-- current anonymous default.

CREATE TYPE "ShareProtectionMode" AS ENUM ('ANONYMOUS', 'PASSCODE', 'SIGNED_IN');

ALTER TABLE "agent_conversation_shares"
  ADD COLUMN "protectionMode" "ShareProtectionMode" NOT NULL DEFAULT 'ANONYMOUS',
  ADD COLUMN "passcodeHash" TEXT;
