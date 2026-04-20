-- Client branding for shared pages. logoUrl already exists on
-- Workspace; this adds the accent-color hex for share-page theming.

ALTER TABLE "workspaces"
  ADD COLUMN "brandColor" TEXT;
