-- ==============================
-- REFRESH SUPABASE SCHEMA CACHE
-- ==============================
-- This script refreshes Supabase's PostgREST schema cache
-- Run this after running migrations that add/modify columns

-- Method 1: Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- Method 2: Verify the column exists (for debugging)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'framework_indicators' 
      AND column_name = 'pillar_id'
  ) THEN
    RAISE NOTICE 'Column pillar_id exists in framework_indicators table';
  ELSE
    RAISE WARNING 'Column pillar_id does NOT exist - migration 53 may not have been run';
  END IF;
END $$;

-- Method 3: Alternative notification (if Method 1 doesn't work)
-- SELECT pg_notify('pgrst', 'reload schema');
