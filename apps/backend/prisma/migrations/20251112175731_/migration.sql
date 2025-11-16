/*
  Warnings:

  - A unique constraint covering the columns `[key]` on the table `activity_types` will be added. If there are existing duplicate values, this will fail.
  - Made the column `name` on table `activity_types` required. This step will fail if there are existing NULL values in that column.
  - Made the column `key` on table `activity_types` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "AiEntityType" AS ENUM ('CUSTOMER', 'LEAD', 'OPPORTUNITY', 'CANDIDATE', 'EMPLOYEE', 'CONTACT', 'TASK');

-- CreateEnum
CREATE TYPE "AiActionExecutionStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "AiCollectionKey" AS ENUM ('EOD_REPORTS', 'OPPORTUNITIES', 'LEADS', 'TASKS', 'ACTIVITIES');

-- CreateEnum
CREATE TYPE "AiCollectionFormat" AS ENUM ('TABLE', 'BULLET_LIST', 'PLAIN_TEXT');

-- DropForeignKey
ALTER TABLE "activities" DROP CONSTRAINT "activities_activityTypeId_fkey";

-- DropForeignKey
ALTER TABLE "activities" DROP CONSTRAINT "activities_assignedToId_fkey";

-- DropIndex
DROP INDEX "activities_visibility_idx";

-- AlterTable
ALTER TABLE "activity_types" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "key" SET NOT NULL,
ALTER COLUMN "color" SET DEFAULT '#2563EB',
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "driveFolderId" TEXT;

-- AlterTable
ALTER TABLE "company_settings" ADD COLUMN     "annualLeaveAllowanceDays" INTEGER NOT NULL DEFAULT 20;

-- CreateTable
CREATE TABLE "ai_actions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "promptTemplate" TEXT NOT NULL,
    "entityType" "AiEntityType" NOT NULL,
    "model" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_action_fields" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "fieldLabel" TEXT NOT NULL,
    "metadata" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_action_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_action_collections" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "collectionKey" "AiCollectionKey" NOT NULL,
    "format" "AiCollectionFormat" NOT NULL DEFAULT 'TABLE',
    "limit" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_action_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_action_collection_fields" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "fieldLabel" TEXT NOT NULL,
    "metadata" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ai_action_collection_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_action_attachments" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "entityType" "AiEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "attachedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_action_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_action_executions" (
    "id" TEXT NOT NULL,
    "actionId" TEXT,
    "attachmentId" TEXT,
    "entityType" "AiEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "inputs" JSONB,
    "output" JSONB,
    "rawOutput" TEXT,
    "status" "AiActionExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "triggeredById" TEXT,
    "activityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ai_action_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_calendar_integrations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "external_account_id" TEXT,
    "external_email" TEXT,
    "sync_token" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_calendar_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_actions_entityType_idx" ON "ai_actions"("entityType");

-- CreateIndex
CREATE INDEX "ai_actions_isActive_idx" ON "ai_actions"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ai_action_fields_actionId_fieldKey_key" ON "ai_action_fields"("actionId", "fieldKey");

-- CreateIndex
CREATE INDEX "ai_action_collections_actionId_idx" ON "ai_action_collections"("actionId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_action_collection_fields_collectionId_fieldKey_key" ON "ai_action_collection_fields"("collectionId", "fieldKey");

-- CreateIndex
CREATE INDEX "ai_action_attachments_entityType_entityId_idx" ON "ai_action_attachments"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_action_attachments_actionId_entityType_entityId_key" ON "ai_action_attachments"("actionId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "ai_action_executions_entityType_entityId_idx" ON "ai_action_executions"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ai_action_executions_status_idx" ON "ai_action_executions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "user_calendar_integrations_user_id_provider_key" ON "user_calendar_integrations"("user_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "activity_types_key_key" ON "activity_types"("key");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_activityTypeId_fkey" FOREIGN KEY ("activityTypeId") REFERENCES "activity_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_actions" ADD CONSTRAINT "ai_actions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_action_fields" ADD CONSTRAINT "ai_action_fields_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "ai_actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_action_collections" ADD CONSTRAINT "ai_action_collections_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "ai_actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_action_collection_fields" ADD CONSTRAINT "ai_action_collection_fields_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "ai_action_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_action_attachments" ADD CONSTRAINT "ai_action_attachments_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "ai_actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_action_attachments" ADD CONSTRAINT "ai_action_attachments_attachedById_fkey" FOREIGN KEY ("attachedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_action_executions" ADD CONSTRAINT "ai_action_executions_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "ai_actions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_action_executions" ADD CONSTRAINT "ai_action_executions_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "ai_action_attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_action_executions" ADD CONSTRAINT "ai_action_executions_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_action_executions" ADD CONSTRAINT "ai_action_executions_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_calendar_integrations" ADD CONSTRAINT "user_calendar_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
