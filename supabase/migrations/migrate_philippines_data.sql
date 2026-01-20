-- ==============================
-- MIGRATE EXISTING PHILIPPINES DATA
-- ==============================
-- This migration script assigns all existing data to the Philippines country
-- Run this AFTER adding country_id columns and BEFORE making them NOT NULL
-- 
-- IMPORTANT: Run this in DEV first to test, then in production after validation

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

-- Verify migration: Check for any NULL country_id values
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
  ELSE
    RAISE NOTICE 'SUCCESS: All records have country_id assigned';
  END IF;
END $$;
