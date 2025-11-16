/*
  Warnings:

  - You are about to drop the column `remoteWorkWindowEnd` on the `company_settings` table. All the data in the column will be lost.
  - You are about to drop the column `remoteWorkWindowOpen` on the `company_settings` table. All the data in the column will be lost.
  - You are about to drop the column `remoteWorkWindowStart` on the `company_settings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "company_settings" DROP COLUMN "remoteWorkWindowEnd",
DROP COLUMN "remoteWorkWindowOpen",
DROP COLUMN "remoteWorkWindowStart",
ALTER COLUMN "remoteWorkLimit" SET DEFAULT 1;
