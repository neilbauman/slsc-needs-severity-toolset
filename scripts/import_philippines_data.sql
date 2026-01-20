-- ==============================
-- IMPORT PHILIPPINES DATA
-- ==============================
-- Run this in your TARGET database (new multi-country database)
-- AFTER you've imported the data using the exported INSERT statements
--
-- This script assigns country_id to all imported data
--
-- IMPORTANT: 
-- 1. First, ensure Philippines country exists (from migrations)
-- 2. Import data using exported INSERT statements from export_philippines_data.sql
-- 3. Then run this script to assign country_id

DO $$
DECLARE
  phl_country_id UUID;
  updated_count INTEGER;
BEGIN
  -- Get Philippines country ID
  SELECT id INTO phl_country_id FROM public.countries WHERE iso_code = 'PHL';
  
  IF phl_country_id IS NULL THEN
    RAISE EXCEPTION 'Philippines country not found! Please run migrations first.';
  END IF;
  
  RAISE NOTICE 'Using Philippines country_id: %', phl_country_id;
  
  -- Update datasets
  UPDATE public.datasets 
  SET country_id = phl_country_id 
  WHERE country_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % datasets with Philippines country_id', updated_count;
  
  -- Update admin_boundaries
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_boundaries') THEN
    UPDATE public.admin_boundaries 
    SET country_id = phl_country_id 
    WHERE country_id IS NULL;
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % admin_boundaries with Philippines country_id', updated_count;
  END IF;
  
  -- Update instances
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'instances') THEN
    UPDATE public.instances 
    SET country_id = phl_country_id 
    WHERE country_id IS NULL;
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % instances with Philippines country_id', updated_count;
  END IF;
  
  -- Update hazard_events
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hazard_events') THEN
    UPDATE public.hazard_events 
    SET country_id = phl_country_id 
    WHERE country_id IS NULL;
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % hazard_events with Philippines country_id', updated_count;
  END IF;
  
  RAISE NOTICE 'Import complete! All imported data assigned to Philippines.';
END $$;

-- ==============================
-- VERIFY IMPORT
-- ==============================

DO $$
DECLARE
  null_datasets INTEGER;
  null_instances INTEGER;
  null_boundaries INTEGER;
  null_hazard_events INTEGER;
  total_datasets INTEGER;
  total_instances INTEGER;
  total_boundaries INTEGER;
BEGIN
  -- Check datasets
  SELECT COUNT(*) INTO total_datasets FROM public.datasets;
  SELECT COUNT(*) INTO null_datasets FROM public.datasets WHERE country_id IS NULL;
  
  -- Check instances
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'instances') THEN
    SELECT COUNT(*) INTO total_instances FROM public.instances;
    SELECT COUNT(*) INTO null_instances FROM public.instances WHERE country_id IS NULL;
  ELSE
    total_instances := 0;
    null_instances := 0;
  END IF;
  
  -- Check boundaries
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_boundaries') THEN
    SELECT COUNT(*) INTO total_boundaries FROM public.admin_boundaries;
    SELECT COUNT(*) INTO null_boundaries FROM public.admin_boundaries WHERE country_id IS NULL;
  ELSE
    total_boundaries := 0;
    null_boundaries := 0;
  END IF;
  
  -- Report results
  RAISE NOTICE '=== IMPORT VERIFICATION ===';
  RAISE NOTICE 'Datasets: % total, % with country_id, % missing country_id', 
    total_datasets, total_datasets - null_datasets, null_datasets;
  RAISE NOTICE 'Instances: % total, % with country_id, % missing country_id', 
    total_instances, total_instances - null_instances, null_instances;
  RAISE NOTICE 'Admin Boundaries: % total, % with country_id, % missing country_id', 
    total_boundaries, total_boundaries - null_boundaries, null_boundaries;
  
  IF null_datasets > 0 OR null_instances > 0 OR null_boundaries > 0 THEN
    RAISE WARNING 'WARNING: Some records are missing country_id!';
  ELSE
    RAISE NOTICE 'SUCCESS: All records have country_id assigned';
  END IF;
END $$;

-- ==============================
-- SUMMARY QUERY
-- ==============================
-- Run this to see a summary of imported data

SELECT 
  'datasets' as table_name,
  COUNT(*) as total_records,
  COUNT(country_id) as with_country_id,
  COUNT(*) - COUNT(country_id) as missing_country_id
FROM public.datasets
UNION ALL
SELECT 
  'instances',
  COUNT(*),
  COUNT(country_id),
  COUNT(*) - COUNT(country_id)
FROM public.instances
UNION ALL
SELECT 
  'admin_boundaries',
  COUNT(*),
  COUNT(country_id),
  COUNT(*) - COUNT(country_id)
FROM public.admin_boundaries
UNION ALL
SELECT 
  'dataset_values_numeric',
  COUNT(*),
  NULL,
  NULL
FROM public.dataset_values_numeric
UNION ALL
SELECT 
  'dataset_values_categorical',
  COUNT(*),
  NULL,
  NULL
FROM public.dataset_values_categorical
UNION ALL
SELECT 
  'instance_datasets',
  COUNT(*),
  NULL,
  NULL
FROM public.instance_datasets
UNION ALL
SELECT 
  'instance_dataset_scores',
  COUNT(*),
  NULL,
  NULL
FROM public.instance_dataset_scores
UNION ALL
SELECT 
  'affected_areas',
  COUNT(*),
  NULL,
  NULL
FROM public.affected_areas
ORDER BY table_name;
