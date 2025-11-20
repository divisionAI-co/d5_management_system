-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "templateId" TEXT;

-- CreateIndex
CREATE INDEX "quotes_templateId_idx" ON "quotes"("templateId");

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
