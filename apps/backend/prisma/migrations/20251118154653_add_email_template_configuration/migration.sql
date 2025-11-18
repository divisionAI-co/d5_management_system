-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TemplateType" ADD VALUE 'EOD_REPORT_SUBMITTED';
ALTER TYPE "TemplateType" ADD VALUE 'LEAVE_REQUEST_CREATED';
ALTER TYPE "TemplateType" ADD VALUE 'LEAVE_REQUEST_APPROVED';
ALTER TYPE "TemplateType" ADD VALUE 'LEAVE_REQUEST_REJECTED';
ALTER TYPE "TemplateType" ADD VALUE 'TASK_ASSIGNED';
ALTER TYPE "TemplateType" ADD VALUE 'MENTION_NOTIFICATION';
ALTER TYPE "TemplateType" ADD VALUE 'REMOTE_WORK_WINDOW_OPENED';

-- AlterTable
ALTER TABLE "company_settings" ADD COLUMN     "emailTemplateEodReportSubmittedId" TEXT,
ADD COLUMN     "emailTemplateLeaveRequestApprovedId" TEXT,
ADD COLUMN     "emailTemplateLeaveRequestCreatedId" TEXT,
ADD COLUMN     "emailTemplateLeaveRequestRejectedId" TEXT,
ADD COLUMN     "emailTemplateMentionNotificationId" TEXT,
ADD COLUMN     "emailTemplateRemoteWorkWindowOpenedId" TEXT,
ADD COLUMN     "emailTemplateTaskAssignedId" TEXT;
