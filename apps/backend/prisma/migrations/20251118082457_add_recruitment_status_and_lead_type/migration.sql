-- CreateEnum
CREATE TYPE "LeadType" AS ENUM ('END_CUSTOMER', 'INTERMEDIARY');

-- CreateEnum
CREATE TYPE "RecruitmentStatus" AS ENUM ('HEADHUNTING', 'STANDARD');

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "leadType" "LeadType";

-- AlterTable
ALTER TABLE "open_positions" ADD COLUMN     "recruitmentStatus" "RecruitmentStatus";
