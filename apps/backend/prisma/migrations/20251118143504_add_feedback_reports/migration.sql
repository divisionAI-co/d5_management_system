-- CreateEnum
CREATE TYPE "FeedbackReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'SENT');

-- CreateTable
CREATE TABLE "feedback_reports" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "tasksCount" INTEGER,
    "totalDaysOffTaken" INTEGER,
    "totalRemainingDaysOff" INTEGER,
    "bankHolidays" JSONB,
    "hrFeedback" TEXT,
    "hrActionDescription" TEXT,
    "hrUpdatedAt" TIMESTAMP(3),
    "hrUpdatedBy" TEXT,
    "amFeedback" TEXT,
    "amUpdatedAt" TIMESTAMP(3),
    "amUpdatedBy" TEXT,
    "communicationRating" INTEGER,
    "collaborationRating" INTEGER,
    "taskEstimationRating" INTEGER,
    "timelinessRating" INTEGER,
    "employeeSummary" TEXT,
    "employeeUpdatedAt" TIMESTAMP(3),
    "status" "FeedbackReportStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "sentTo" TEXT,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_reports_employeeId_idx" ON "feedback_reports"("employeeId");

-- CreateIndex
CREATE INDEX "feedback_reports_status_idx" ON "feedback_reports"("status");

-- CreateIndex
CREATE INDEX "feedback_reports_month_year_idx" ON "feedback_reports"("month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_reports_employeeId_month_year_key" ON "feedback_reports"("employeeId", "month", "year");

-- AddForeignKey
ALTER TABLE "feedback_reports" ADD CONSTRAINT "feedback_reports_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_reports" ADD CONSTRAINT "feedback_reports_hrUpdatedBy_fkey" FOREIGN KEY ("hrUpdatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_reports" ADD CONSTRAINT "feedback_reports_amUpdatedBy_fkey" FOREIGN KEY ("amUpdatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
