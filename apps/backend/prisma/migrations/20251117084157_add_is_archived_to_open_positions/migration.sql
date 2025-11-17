-- AlterTable
ALTER TABLE "open_positions" ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "open_positions_isArchived_idx" ON "open_positions"("isArchived");
