/*
  Warnings:

  - Made the column `employeeId` on table `employee_check_ins` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "employee_check_ins" DROP CONSTRAINT "employee_check_ins_employeeId_fkey";

-- AlterTable
ALTER TABLE "employee_check_ins" ALTER COLUMN "employeeId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "employee_check_ins" ADD CONSTRAINT "employee_check_ins_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
