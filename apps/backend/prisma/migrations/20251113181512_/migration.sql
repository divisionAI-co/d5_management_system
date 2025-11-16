-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CandidateStage" ADD VALUE 'ON_HOLD';
ALTER TYPE "CandidateStage" ADD VALUE 'CUSTOMER_REVIEW';
ALTER TYPE "CandidateStage" ADD VALUE 'CONTRACT_PROPOSAL';

-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "candidates_deletedAt_idx" ON "candidates"("deletedAt");
