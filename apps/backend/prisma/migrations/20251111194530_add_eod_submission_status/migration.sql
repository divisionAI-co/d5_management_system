-- AlterTable
ALTER TABLE "eod_reports"
  ALTER COLUMN "submittedAt" DROP NOT NULL,
  ALTER COLUMN "submittedAt" DROP DEFAULT;


