-- AlterEnum
ALTER TYPE "AiCollectionKey" ADD VALUE 'QUOTES';

-- AlterEnum
ALTER TYPE "AiEntityType" ADD VALUE 'QUOTE';

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "quoteId" TEXT;

-- CreateIndex
CREATE INDEX "activities_quoteId_idx" ON "activities"("quoteId");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
