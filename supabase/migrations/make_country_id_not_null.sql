-- ==============================
-- MAKE COUNTRY_ID NOT NULL
-- ==============================
-- This migration makes country_id columns NOT NULL after data migration is complete
-- 
-- IMPORTANT: Only run this AFTER migrate_philippines_data.sql has been run
-- and verified that all records have country_id assigned

-- Make datasets.country_id NOT NULL
ALTER TABLE public.datasets 
  ALTER COLUMN country_id SET NOT NULL;

-- Make admin_boundaries.country_id NOT NULL (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_boundaries') THEN
    ALTER TABLE public.admin_boundaries 
      ALTER COLUMN country_id SET NOT NULL;
  END IF;
END $$;

-- Make instances.country_id NOT NULL (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'instances') THEN
    ALTER TABLE public.instances 
      ALTER COLUMN country_id SET NOT NULL;
  END IF;
END $$;

-- Make hazard_events.country_id NOT NULL (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hazard_events') THEN
    ALTER TABLE public.hazard_events 
      ALTER COLUMN country_id SET NOT NULL;
  END IF;
END $$;

RAISE NOTICE 'All country_id columns are now NOT NULL. Country isolation is enforced at database level.';
