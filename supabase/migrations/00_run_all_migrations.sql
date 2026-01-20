-- ==============================
-- COMPLETE MIGRATION SCRIPT
-- ==============================
-- Run this script in your DEV Supabase project SQL Editor
-- It runs all migrations in the correct order
--
-- IMPORTANT: 
-- 1. Run this in DEV first, NOT production
-- 2. Make sure you have your existing schema already set up
-- 3. Review each section before running

-- ==============================
-- STEP 1: Create Countries Table
-- ==============================

CREATE TABLE IF NOT EXISTS public.countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iso_code TEXT NOT NULL UNIQUE CHECK (char_length(iso_code) = 3),
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_countries_iso_code ON public.countries(iso_code);

INSERT INTO public.countries (iso_code, name) VALUES 
  ('PHL', 'Philippines'),
  ('BGD', 'Bangladesh'),
  ('MMR', 'Myanmar')
ON CONFLICT (iso_code) DO NOTHING;

COMMENT ON TABLE public.countries IS 'Stores country information for multi-country isolation';
COMMENT ON COLUMN public.countries.iso_code IS 'ISO 3166-1 alpha-3 country code (e.g., PHL, BGD, MMR)';

-- ==============================
-- STEP 2: Create User Countries Table
-- ==============================

CREATE TABLE IF NOT EXISTS public.user_countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country_id UUID NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, country_id)
);

CREATE INDEX IF NOT EXISTS idx_user_countries_user_id ON public.user_countries(user_id);
CREATE INDEX IF NOT EXISTS idx_user_countries_country_id ON public.user_countries(country_id);
CREATE INDEX IF NOT EXISTS idx_user_countries_role ON public.user_countries(role);

COMMENT ON TABLE public.user_countries IS 'Junction table linking users to countries with role-based access (admin or user)';
COMMENT ON COLUMN public.user_countries.role IS 'User role for this country: admin (site admin, all countries) or user (country-specific user)';

-- ==============================
-- STEP 3: Add Country Isolation Columns
-- ==============================

-- Add country_id to datasets table
ALTER TABLE public.datasets 
  ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES public.countries(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_datasets_country_id ON public.datasets(country_id);

-- Add country_id to admin_boundaries table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_boundaries') THEN
    ALTER TABLE public.admin_boundaries 
      ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES public.countries(id) ON DELETE CASCADE;
    
    CREATE INDEX IF NOT EXISTS idx_admin_boundaries_country_id ON public.admin_boundaries(country_id);
    RAISE NOTICE 'Added country_id to admin_boundaries';
  ELSE
    RAISE NOTICE 'admin_boundaries table does not exist, skipping';
  END IF;
END $$;

-- Add country_id to instances table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'instances') THEN
    ALTER TABLE public.instances 
      ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES public.countries(id) ON DELETE CASCADE;
    
    CREATE INDEX IF NOT EXISTS idx_instances_country_id ON public.instances(country_id);
    RAISE NOTICE 'Added country_id to instances';
  ELSE
    RAISE NOTICE 'instances table does not exist, skipping';
  END IF;
END $$;

-- Add country_id to hazard_events table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hazard_events') THEN
    ALTER TABLE public.hazard_events 
      ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES public.countries(id) ON DELETE CASCADE;
    
    CREATE INDEX IF NOT EXISTS idx_hazard_events_country_id ON public.hazard_events(country_id);
    RAISE NOTICE 'Added country_id to hazard_events';
  ELSE
    RAISE NOTICE 'hazard_events table does not exist, skipping';
  END IF;
END $$;

-- ==============================
-- STEP 4: Migrate Existing Data to Philippines
-- ==============================

DO $$
DECLARE
  phl_country_id UUID;
  updated_count INTEGER;
BEGIN
  -- Get or create Philippines country
  SELECT id INTO phl_country_id FROM public.countries WHERE iso_code = 'PHL';
  
  IF phl_country_id IS NULL THEN
    INSERT INTO public.countries (iso_code, name) 
    VALUES ('PHL', 'Philippines') 
    RETURNING id INTO phl_country_id;
    
    RAISE NOTICE 'Created Philippines country record with id: %', phl_country_id;
  ELSE
    RAISE NOTICE 'Found existing Philippines country record with id: %', phl_country_id;
  END IF;
  
  -- Update all existing datasets
  UPDATE public.datasets 
  SET country_id = phl_country_id 
  WHERE country_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % datasets with Philippines country_id', updated_count;
  
  -- Update admin_boundaries if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_boundaries') THEN
    UPDATE public.admin_boundaries 
    SET country_id = phl_country_id 
    WHERE country_id IS NULL;
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % admin_boundaries with Philippines country_id', updated_count;
  END IF;
  
  -- Update instances if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'instances') THEN
    UPDATE public.instances 
    SET country_id = phl_country_id 
    WHERE country_id IS NULL;
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % instances with Philippines country_id', updated_count;
  END IF;
  
  -- Update hazard_events if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hazard_events') THEN
    UPDATE public.hazard_events 
    SET country_id = phl_country_id 
    WHERE country_id IS NULL;
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % hazard_events with Philippines country_id', updated_count;
  END IF;
  
  RAISE NOTICE 'Migration complete! All existing data assigned to Philippines.';
END $$;

-- ==============================
-- STEP 5: Verify Migration
-- ==============================

DO $$
DECLARE
  null_datasets INTEGER;
  null_instances INTEGER;
  null_boundaries INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_datasets FROM public.datasets WHERE country_id IS NULL;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'instances') THEN
    SELECT COUNT(*) INTO null_instances FROM public.instances WHERE country_id IS NULL;
  ELSE
    null_instances := 0;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_boundaries') THEN
    SELECT COUNT(*) INTO null_boundaries FROM public.admin_boundaries WHERE country_id IS NULL;
  ELSE
    null_boundaries := 0;
  END IF;
  
  IF null_datasets > 0 OR null_instances > 0 OR null_boundaries > 0 THEN
    RAISE WARNING 'WARNING: Found NULL country_id values - datasets: %, instances: %, boundaries: %', 
      null_datasets, null_instances, null_boundaries;
    RAISE WARNING 'DO NOT proceed to Step 6 until all NULL values are resolved!';
  ELSE
    RAISE NOTICE 'SUCCESS: All records have country_id assigned';
    RAISE NOTICE 'You can now proceed to Step 6 (make country_id NOT NULL)';
  END IF;
END $$;

-- ==============================
-- STEP 6: Make Country ID NOT NULL (OPTIONAL - Only if Step 5 passed)
-- ==============================
-- Uncomment the section below ONLY after verifying all data has country_id
-- 
-- ALTER TABLE public.datasets 
--   ALTER COLUMN country_id SET NOT NULL;
-- 
-- DO $$
-- BEGIN
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_boundaries') THEN
--     ALTER TABLE public.admin_boundaries 
--       ALTER COLUMN country_id SET NOT NULL;
--   END IF;
-- END $$;
-- 
-- DO $$
-- BEGIN
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'instances') THEN
--     ALTER TABLE public.instances 
--       ALTER COLUMN country_id SET NOT NULL;
--   END IF;
-- END $$;
-- 
-- DO $$
-- BEGIN
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hazard_events') THEN
--     ALTER TABLE public.hazard_events 
--       ALTER COLUMN country_id SET NOT NULL;
--   END IF;
-- END $$;
