-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'MENTIONED_IN_ACTIVITY';

-- AlterTable
ALTER TABLE "notification_settings" ADD COLUMN     "mentionedInActivity" BOOLEAN NOT NULL DEFAULT true;
