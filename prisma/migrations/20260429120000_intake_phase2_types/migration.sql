-- Phase 2 of intake widening. Adds five new entity types so the
-- extractor can produce drafts for objectives, compliance
-- requirements, EOL watch entries, architecture states, and
-- workspace-singleton profile fields (IT vision / mission / brand
-- color / industry). Pure additions; existing rows unaffected.

ALTER TYPE "IntakeEntityType" ADD VALUE IF NOT EXISTS 'OBJECTIVE';
ALTER TYPE "IntakeEntityType" ADD VALUE IF NOT EXISTS 'COMPLIANCE_REQUIREMENT';
ALTER TYPE "IntakeEntityType" ADD VALUE IF NOT EXISTS 'EOL_WATCH';
ALTER TYPE "IntakeEntityType" ADD VALUE IF NOT EXISTS 'ARCH_STATE';
ALTER TYPE "IntakeEntityType" ADD VALUE IF NOT EXISTS 'WORKSPACE_PROFILE';
