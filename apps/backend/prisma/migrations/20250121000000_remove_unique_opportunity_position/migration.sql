-- Drop unique constraint if table and constraint exist
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'open_positions'
    ) AND EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'open_positions_opportunityId_key' 
        AND table_name = 'open_positions'
    ) THEN
        ALTER TABLE "open_positions" DROP CONSTRAINT "open_positions_opportunityId_key";
    END IF;
END $$;

