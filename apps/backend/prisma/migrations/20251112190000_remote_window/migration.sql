-- AlterTable
ALTER TABLE "company_settings"
  ADD COLUMN "remoteWorkWindowOpen" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "remoteWorkWindowStart" TIMESTAMP(3),
  ADD COLUMN "remoteWorkWindowEnd" TIMESTAMP(3),
  ALTER COLUMN "remoteWorkLimit" SET DEFAULT 3;

-- Ensure defaults are applied to existing rows
UPDATE "company_settings"
SET
  "remoteWorkWindowOpen" = COALESCE("remoteWorkWindowOpen", false),
  "remoteWorkLimit" = COALESCE("remoteWorkLimit", 3);

