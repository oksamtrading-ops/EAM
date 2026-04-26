-- Add thumbnail storage to IntakeDocument for diagram intakes.
-- Source image is base64-encoded inline; capped at ~500KB at write
-- time. Both columns nullable — text intakes leave them empty.

ALTER TABLE "intake_documents"
  ADD COLUMN "thumbnailBase64" TEXT,
  ADD COLUMN "thumbnailMimeType" TEXT;
