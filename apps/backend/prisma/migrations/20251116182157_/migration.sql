-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "recruiterId" TEXT;

-- AlterTable
ALTER TABLE "open_positions" ALTER COLUMN "opportunityId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "candidates_recruiterId_idx" ON "candidates"("recruiterId");

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
