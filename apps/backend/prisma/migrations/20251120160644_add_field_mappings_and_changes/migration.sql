-- CreateEnum
CREATE TYPE "AiActionOperationType" AS ENUM ('READ_ONLY', 'UPDATE', 'CREATE');

-- AlterTable
ALTER TABLE "ai_actions" ADD COLUMN     "operationType" "AiActionOperationType" NOT NULL DEFAULT 'READ_ONLY';

-- CreateTable
CREATE TABLE "ai_action_field_mappings" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "targetField" TEXT NOT NULL,
    "transformRule" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_action_field_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_action_field_mappings_actionId_sourceKey_targetField_key" ON "ai_action_field_mappings"("actionId", "sourceKey", "targetField");

-- AddForeignKey
ALTER TABLE "ai_action_field_mappings" ADD CONSTRAINT "ai_action_field_mappings_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "ai_actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
