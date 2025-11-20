-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "parentId" TEXT;

-- CreateTable
CREATE TABLE "task_blocks" (
    "id" TEXT NOT NULL,
    "blockingTaskId" TEXT NOT NULL,
    "blockedTaskId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_relations" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "relatedTaskId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_relations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_blocks_blockingTaskId_idx" ON "task_blocks"("blockingTaskId");

-- CreateIndex
CREATE INDEX "task_blocks_blockedTaskId_idx" ON "task_blocks"("blockedTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "task_blocks_blockingTaskId_blockedTaskId_key" ON "task_blocks"("blockingTaskId", "blockedTaskId");

-- CreateIndex
CREATE INDEX "task_relations_taskId_idx" ON "task_relations"("taskId");

-- CreateIndex
CREATE INDEX "task_relations_relatedTaskId_idx" ON "task_relations"("relatedTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "task_relations_taskId_relatedTaskId_key" ON "task_relations"("taskId", "relatedTaskId");

-- CreateIndex
CREATE INDEX "tasks_parentId_idx" ON "tasks"("parentId");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_blocks" ADD CONSTRAINT "task_blocks_blockingTaskId_fkey" FOREIGN KEY ("blockingTaskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_blocks" ADD CONSTRAINT "task_blocks_blockedTaskId_fkey" FOREIGN KEY ("blockedTaskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_relations" ADD CONSTRAINT "task_relations_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_relations" ADD CONSTRAINT "task_relations_relatedTaskId_fkey" FOREIGN KEY ("relatedTaskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
