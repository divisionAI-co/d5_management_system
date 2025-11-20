-- AlterEnum
ALTER TYPE "TemplateType" ADD VALUE 'SALES_PERFORMANCE_REPORT';

-- CreateTable
CREATE TABLE "sales_performance_reports" (
    "id" TEXT NOT NULL,
    "salespersonId" TEXT NOT NULL,
    "weekEnding" TIMESTAMP(3) NOT NULL,
    "linkedinConnectionRequests" INTEGER NOT NULL DEFAULT 0,
    "linkedinAccepted" INTEGER NOT NULL DEFAULT 0,
    "linkedinAcceptedPercentage" DECIMAL(5,2),
    "linkedinMeetingsScheduled" INTEGER NOT NULL DEFAULT 0,
    "linkedinMeetingsScheduledPercentage" DECIMAL(5,2),
    "linkedinAccountsCount" INTEGER NOT NULL DEFAULT 0,
    "linkedinMarketsTargeted" TEXT,
    "inmailSent" INTEGER NOT NULL DEFAULT 0,
    "inmailReplies" INTEGER NOT NULL DEFAULT 0,
    "inmailRepliesPercentage" DECIMAL(5,2),
    "inmailMeetingsScheduled" INTEGER NOT NULL DEFAULT 0,
    "inmailMeetingsScheduledPercentage" DECIMAL(5,2),
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_performance_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_performance_reports_salespersonId_idx" ON "sales_performance_reports"("salespersonId");

-- CreateIndex
CREATE INDEX "sales_performance_reports_weekEnding_idx" ON "sales_performance_reports"("weekEnding");

-- CreateIndex
CREATE UNIQUE INDEX "sales_performance_reports_salespersonId_weekEnding_key" ON "sales_performance_reports"("salespersonId", "weekEnding");

-- AddForeignKey
ALTER TABLE "sales_performance_reports" ADD CONSTRAINT "sales_performance_reports_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
