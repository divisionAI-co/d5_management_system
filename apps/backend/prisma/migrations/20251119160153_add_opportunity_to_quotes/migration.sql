-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "opportunityId" TEXT;

-- CreateIndex
CREATE INDEX "quotes_opportunityId_idx" ON "quotes"("opportunityId");

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
