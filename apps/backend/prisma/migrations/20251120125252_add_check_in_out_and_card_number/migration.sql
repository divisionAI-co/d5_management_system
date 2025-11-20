-- CreateEnum
CREATE TYPE "CheckInOutStatus" AS ENUM ('IN', 'OUT');

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "cardNumber" TEXT;

-- CreateTable
CREATE TABLE "check_in_outs" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "dateTime" TIMESTAMP(3) NOT NULL,
    "status" "CheckInOutStatus" NOT NULL,
    "importedAt" TIMESTAMP(3),
    "importedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "check_in_outs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "check_in_outs_employeeId_idx" ON "check_in_outs"("employeeId");

-- CreateIndex
CREATE INDEX "check_in_outs_dateTime_idx" ON "check_in_outs"("dateTime");

-- CreateIndex
CREATE INDEX "check_in_outs_status_idx" ON "check_in_outs"("status");

-- AddForeignKey
ALTER TABLE "check_in_outs" ADD CONSTRAINT "check_in_outs_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_in_outs" ADD CONSTRAINT "check_in_outs_importedBy_fkey" FOREIGN KEY ("importedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
