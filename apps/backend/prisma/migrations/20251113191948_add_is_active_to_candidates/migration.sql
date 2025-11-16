-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "candidates_isActive_idx" ON "candidates"("isActive");
