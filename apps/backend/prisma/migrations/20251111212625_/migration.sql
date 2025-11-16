/*
  Warnings:

  - The primary key for the `activity_types` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Made the column `activityTypeId` on table `activities` required. This step will fail if there are existing NULL values in that column.
  - Made the column `subject` on table `activities` required. This step will fail if there are existing NULL values in that column.

*/

-- Ensure activity_types exists (legacy deployments may not have created this table)
CREATE TABLE IF NOT EXISTS "activity_types" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT,
  "key" TEXT,
  "description" TEXT,
  "color" TEXT,
  "icon" TEXT,
  "isActive" BOOLEAN,
  "isSystem" BOOLEAN,
  "order" INTEGER,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3)
);

-- DropForeignKey
ALTER TABLE "activities" DROP CONSTRAINT IF EXISTS "activities_activityTypeId_fkey";

-- DropForeignKey
ALTER TABLE "activities" DROP CONSTRAINT IF EXISTS "activities_assignedToId_fkey";

-- DropForeignKey
ALTER TABLE "activity_types" DROP CONSTRAINT IF EXISTS "activity_types_createdById_fkey";

-- DropIndex
DROP INDEX IF EXISTS "activities_visibility_idx";

-- Ensure required columns exist before altering them
ALTER TABLE "activities"
  ADD COLUMN IF NOT EXISTS "activityTypeId" TEXT,
  ADD COLUMN IF NOT EXISTS "subject" TEXT,
  ADD COLUMN IF NOT EXISTS "assignedToId" TEXT;

-- AlterTable
ALTER TABLE "activities" ALTER COLUMN "activityTypeId" SET NOT NULL,
ALTER COLUMN "activityTypeId" SET DATA TYPE TEXT,
ALTER COLUMN "subject" SET NOT NULL;

-- AlterTable
ALTER TABLE "activity_types" DROP CONSTRAINT "activity_types_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text,
ADD CONSTRAINT "activity_types_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "activity_types_isActive_idx" ON "activity_types"("isActive");

-- CreateIndex
CREATE INDEX "activity_types_order_idx" ON "activity_types"("order");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_activityTypeId_fkey" FOREIGN KEY ("activityTypeId") REFERENCES "activity_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_types" ADD CONSTRAINT "activity_types_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
