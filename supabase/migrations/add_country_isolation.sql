-- ==============================
-- ADD COUNTRY ISOLATION COLUMNS MIGRATION
-- ==============================
-- This migration adds country_id columns to all tables that need country isolation
-- Columns are nullable initially to allow migration of existing data

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
  END IF;
END $$;

-- Add country_id to instances table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'instances') THEN
    ALTER TABLE public.instances 
      ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES public.countries(id) ON DELETE CASCADE;
    
    CREATE INDEX IF NOT EXISTS idx_instances_country_id ON public.instances(country_id);
  END IF;
END $$;

-- Add country_id to hazard_events table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hazard_events') THEN
    ALTER TABLE public.hazard_events 
      ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES public.countries(id) ON DELETE CASCADE;
    
    CREATE INDEX IF NOT EXISTS idx_hazard_events_country_id ON public.hazard_events(country_id);
  END IF;
END $$;

-- Note: Related tables like instance_datasets, instance_dataset_scores, affected_areas
-- inherit country isolation through their instance relationship, but we may add direct
-- country_id columns later for performance if needed.

COMMENT ON COLUMN public.datasets.country_id IS 'Country isolation: links dataset to a specific country';
