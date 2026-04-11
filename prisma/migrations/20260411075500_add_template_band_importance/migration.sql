-- AlterTable
ALTER TABLE "capability_templates" ADD COLUMN     "band" TEXT,
ADD COLUMN     "strategicImportance" "StrategicImportance" NOT NULL DEFAULT 'NOT_ASSESSED';
