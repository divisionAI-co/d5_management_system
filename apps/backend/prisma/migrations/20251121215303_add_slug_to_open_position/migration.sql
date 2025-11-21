-- AlterTable: Add slug column as nullable first
ALTER TABLE "open_positions" ADD COLUMN "slug" TEXT;

-- Generate slugs for existing positions
-- This function generates a URL-friendly slug from the title
UPDATE "open_positions"
SET "slug" = LOWER(REGEXP_REPLACE(
  REGEXP_REPLACE(
    REGEXP_REPLACE("title", '[^\w\s-]', '', 'g'),
    '[\s_-]+', '-', 'g'
  ),
  '^-+|-+$', '', 'g'
))
WHERE "slug" IS NULL;

-- Ensure unique slugs by appending numbers if needed
DO $$
DECLARE
  pos RECORD;
  counter INTEGER;
  unique_slug TEXT;
BEGIN
  FOR pos IN SELECT id, slug FROM "open_positions" WHERE slug IS NOT NULL ORDER BY "createdAt" LOOP
    counter := 1;
    unique_slug := pos.slug;
    
    WHILE EXISTS (SELECT 1 FROM "open_positions" WHERE slug = unique_slug AND id != pos.id) LOOP
      unique_slug := pos.slug || '-' || counter;
      counter := counter + 1;
    END LOOP;
    
    UPDATE "open_positions" SET slug = unique_slug WHERE id = pos.id;
  END LOOP;
END $$;

-- Make slug required and add unique constraint
ALTER TABLE "open_positions" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "open_positions_slug_key" ON "open_positions"("slug");
CREATE INDEX "open_positions_slug_idx" ON "open_positions"("slug");

