-- AlterTable
ALTER TABLE "company_settings" ADD COLUMN     "remoteWorkWindowEnd" TIMESTAMP(3),
ADD COLUMN     "remoteWorkWindowOpen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "remoteWorkWindowStart" TIMESTAMP(3),
ALTER COLUMN "remoteWorkLimit" SET DEFAULT 3;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "registrationId" TEXT,
ADD COLUMN     "taxId" TEXT;
