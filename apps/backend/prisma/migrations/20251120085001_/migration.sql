-- CreateEnum
CREATE TYPE "CheckInStatus" AS ENUM ('IN', 'OUT');

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "cardNumber" TEXT;

-- CreateTable
CREATE TABLE "employee_check_ins" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "employeeCardNumber" TEXT NOT NULL,
    "status" "CheckInStatus" NOT NULL,
    "employeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_check_ins_employeeId_idx" ON "employee_check_ins"("employeeId");

-- CreateIndex
CREATE INDEX "employee_check_ins_employeeCardNumber_idx" ON "employee_check_ins"("employeeCardNumber");

-- CreateIndex
CREATE INDEX "employee_check_ins_date_idx" ON "employee_check_ins"("date");

-- CreateIndex
CREATE INDEX "employee_check_ins_status_idx" ON "employee_check_ins"("status");

-- AddForeignKey
ALTER TABLE "employee_check_ins" ADD CONSTRAINT "employee_check_ins_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
