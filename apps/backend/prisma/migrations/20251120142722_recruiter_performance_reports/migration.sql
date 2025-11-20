-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TemplateType" ADD VALUE 'RECRUITER_PERFORMANCE_REPORT_INTERNAL';
ALTER TYPE "TemplateType" ADD VALUE 'RECRUITER_PERFORMANCE_REPORT_CUSTOMER';

-- CreateTable
CREATE TABLE "recruiter_performance_reports" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "recruiterId" TEXT NOT NULL,
    "weekEnding" TIMESTAMP(3) NOT NULL,
    "positionTitle" TEXT NOT NULL,
    "candidatesContactedActual" INTEGER NOT NULL DEFAULT 0,
    "candidatesContactedTarget" INTEGER NOT NULL DEFAULT 0,
    "culturalCallsActual" INTEGER NOT NULL DEFAULT 0,
    "culturalCallsTarget" INTEGER NOT NULL DEFAULT 0,
    "culturalCallsEfficiencyRatio" DECIMAL(5,2),
    "technicalCallsActual" INTEGER NOT NULL DEFAULT 0,
    "technicalCallsTarget" INTEGER NOT NULL DEFAULT 0,
    "technicalCallsEfficiencyRatio" DECIMAL(5,2),
    "clientInterviewsScheduledActual" INTEGER NOT NULL DEFAULT 0,
    "clientInterviewsScheduledTarget" INTEGER NOT NULL DEFAULT 0,
    "submissionToInterviewRatio" DECIMAL(5,2),
    "placementsThisWeek" INTEGER NOT NULL DEFAULT 0,
    "wins" JSONB,
    "challenges" JSONB,
    "priorities" JSONB,
    "topPerformingSources" JSONB,
    "pipelineStatus" JSONB,
    "internalPdfUrl" TEXT,
    "customerPdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recruiter_performance_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recruiter_performance_reports_positionId_idx" ON "recruiter_performance_reports"("positionId");

-- CreateIndex
CREATE INDEX "recruiter_performance_reports_recruiterId_idx" ON "recruiter_performance_reports"("recruiterId");

-- CreateIndex
CREATE INDEX "recruiter_performance_reports_weekEnding_idx" ON "recruiter_performance_reports"("weekEnding");

-- CreateIndex
CREATE UNIQUE INDEX "recruiter_performance_reports_positionId_recruiterId_weekEn_key" ON "recruiter_performance_reports"("positionId", "recruiterId", "weekEnding");

-- AddForeignKey
ALTER TABLE "recruiter_performance_reports" ADD CONSTRAINT "recruiter_performance_reports_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "open_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruiter_performance_reports" ADD CONSTRAINT "recruiter_performance_reports_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
