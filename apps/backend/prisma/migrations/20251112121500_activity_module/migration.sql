-- Create activity visibility enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ActivityVisibility') THEN
    CREATE TYPE "ActivityVisibility" AS ENUM ('PUBLIC', 'TEAM', 'PRIVATE');
  END IF;
END$$;

-- Create activity types table
CREATE TABLE IF NOT EXISTS "activity_types" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "key" TEXT NOT NULL UNIQUE,
  "description" TEXT,
  "color" TEXT DEFAULT '#2563EB',
  "icon" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "isSystem" BOOLEAN NOT NULL DEFAULT FALSE,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activity_types_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL
);

-- Ensure legacy snake_case columns are renamed to camelCase
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_types' AND column_name = 'is_active') THEN
    ALTER TABLE "activity_types" RENAME COLUMN "is_active" TO "isActive";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_types' AND column_name = 'is_system') THEN
    ALTER TABLE "activity_types" RENAME COLUMN "is_system" TO "isSystem";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_types' AND column_name = 'created_by_id') THEN
    ALTER TABLE "activity_types" RENAME COLUMN "created_by_id" TO "createdById";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_types' AND column_name = 'created_at') THEN
    ALTER TABLE "activity_types" RENAME COLUMN "created_at" TO "createdAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_types' AND column_name = 'updated_at') THEN
    ALTER TABLE "activity_types" RENAME COLUMN "updated_at" TO "updatedAt";
  END IF;
END$$;

-- Ensure required columns exist with proper defaults
ALTER TABLE "activity_types"
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "order" INTEGER,
  ADD COLUMN IF NOT EXISTS "createdById" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

UPDATE "activity_types"
SET
  "isActive" = COALESCE("isActive", TRUE),
  "isSystem" = COALESCE("isSystem", FALSE),
  "order" = COALESCE("order", 0),
  "createdAt" = COALESCE("createdAt", CURRENT_TIMESTAMP),
  "updatedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP);

ALTER TABLE "activity_types"
  ALTER COLUMN "isActive" SET NOT NULL,
  ALTER COLUMN "isActive" SET DEFAULT TRUE,
  ALTER COLUMN "isSystem" SET NOT NULL,
  ALTER COLUMN "isSystem" SET DEFAULT FALSE,
  ALTER COLUMN "order" SET NOT NULL,
  ALTER COLUMN "order" SET DEFAULT 0,
  ALTER COLUMN "createdAt" SET NOT NULL,
  ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "updatedAt" SET NOT NULL,
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- Seed default activity types if table is empty
INSERT INTO "activity_types" ("name", "key", "description", "color", "icon", "isSystem", "order")
SELECT * FROM (VALUES
  ('Note', 'NOTE', 'General note or update', '#2563EB', 'StickyNote', TRUE, 0),
  ('Call', 'CALL', 'Phone call or voice conversation', '#0284C7', 'Phone', TRUE, 10),
  ('Email', 'EMAIL', 'Email communication', '#7C3AED', 'Mail', TRUE, 20),
  ('Meeting', 'MEETING', 'Scheduled meeting or appointment', '#10B981', 'Calendar', TRUE, 30),
  ('Task Update', 'TASK_UPDATE', 'Update about task progress', '#F59E0B', 'CheckSquare', TRUE, 40),
  ('Status Change', 'STATUS_CHANGE', 'Status change event', '#6366F1', 'Shuffle', TRUE, 50)
) AS seed("name", "key", "description", "color", "icon", "is_system", "order")
WHERE NOT EXISTS (SELECT 1 FROM "activity_types");

-- Extend activities table with new columns
ALTER TABLE "activities"
  ADD COLUMN IF NOT EXISTS "activityTypeId" UUID,
  ADD COLUMN IF NOT EXISTS "subject" TEXT,
  ADD COLUMN IF NOT EXISTS "body" TEXT,
  ADD COLUMN IF NOT EXISTS "activityDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reminderAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "isReminderSent" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "isPinned" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "isCompleted" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "visibility" "ActivityVisibility" NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN IF NOT EXISTS "assignedToId" TEXT;

-- Rename legacy snake_case columns if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'activity_type_id') THEN
    ALTER TABLE "activities" RENAME COLUMN "activity_type_id" TO "activityTypeId";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'activity_date') THEN
    ALTER TABLE "activities" RENAME COLUMN "activity_date" TO "activityDate";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'reminder_at') THEN
    ALTER TABLE "activities" RENAME COLUMN "reminder_at" TO "reminderAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'is_reminder_sent') THEN
    ALTER TABLE "activities" RENAME COLUMN "is_reminder_sent" TO "isReminderSent";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'is_pinned') THEN
    ALTER TABLE "activities" RENAME COLUMN "is_pinned" TO "isPinned";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'is_completed') THEN
    ALTER TABLE "activities" RENAME COLUMN "is_completed" TO "isCompleted";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'assigned_to_id') THEN
    ALTER TABLE "activities" RENAME COLUMN "assigned_to_id" TO "assignedToId";
  END IF;
END$$;

-- Map legacy enum values to the new activity_types table
UPDATE "activities" AS a
SET "activityTypeId" = t.id
FROM "activity_types" AS t
WHERE a."activityTypeId" IS NULL
  AND t."key" = a."type"::text;

-- Carry over subject/body data from old columns
UPDATE "activities"
SET "subject" = COALESCE("subject", "title"),
    "body" = COALESCE("body", "description");

-- Ensure there is always a fallback subject
UPDATE "activities"
SET "subject" = 'Untitled activity'
WHERE "subject" IS NULL OR trim("subject") = '';

-- Enforce not null constraints on new required fields
-- Foreign key relationships
ALTER TABLE "activities"
  DROP CONSTRAINT IF EXISTS "activities_activity_type_id_fkey";

ALTER TABLE "activities"
  DROP CONSTRAINT IF EXISTS "activities_activityTypeId_fkey";

ALTER TABLE "activities"
  ADD CONSTRAINT "activities_activityTypeId_fkey"
    FOREIGN KEY ("activityTypeId") REFERENCES "activity_types"("id") ON DELETE RESTRICT;

ALTER TABLE "activities"
  DROP CONSTRAINT IF EXISTS "activities_assigned_to_id_fkey";

ALTER TABLE "activities"
  DROP CONSTRAINT IF EXISTS "activities_assignedToId_fkey";

ALTER TABLE "activities"
  ADD CONSTRAINT "activities_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL;

-- Drop legacy columns
ALTER TABLE "activities"
  DROP COLUMN IF EXISTS "title",
  DROP COLUMN IF EXISTS "description",
  DROP COLUMN IF EXISTS "type";

-- Drop legacy enum when present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ActivityType') THEN
    DROP TYPE "ActivityType";
  END IF;
END$$;

-- Indices
CREATE INDEX IF NOT EXISTS "activities_activityTypeId_idx" ON "activities" ("activityTypeId");
CREATE INDEX IF NOT EXISTS "activities_assignedToId_idx" ON "activities" ("assignedToId");
CREATE INDEX IF NOT EXISTS "activities_visibility_idx" ON "activities" ("visibility");


