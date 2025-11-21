-- AlterTable
ALTER TABLE "ai_action_executions" ADD COLUMN     "proposedChanges" JSONB,
ADD COLUMN     "appliedChanges" JSONB,
ADD COLUMN     "appliedAt" TIMESTAMP(3);