-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'FEEDBACK_REPORT';

-- AlterTable
ALTER TABLE "notification_settings" ADD COLUMN     "feedbackReport" BOOLEAN NOT NULL DEFAULT true;
