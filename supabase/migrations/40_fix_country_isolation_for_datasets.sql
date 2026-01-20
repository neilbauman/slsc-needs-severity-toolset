-- ==============================
-- FIX COUNTRY ISOLATION FOR DATASETS
-- ==============================
-- This migration ensures all datasets have correct country_id values
-- and fixes any datasets that were incorrectly assigned to wrong countries

-- Step 1: Check for datasets with NULL country_id
DO $$
DECLARE
  null_count INTEGER;
  phl_country_id UUID;
BEGIN
  -- Get Philippines country ID
  SELECT id INTO phl_country_id FROM public.countries WHERE iso_code = 'PHL';
  
  -- Count NULL country_id datasets
  SELECT COUNT(*) INTO null_count FROM public.datasets WHERE country_id IS NULL;
  
  IF null_count > 0 THEN
    RAISE NOTICE 'Found % datasets with NULL country_id. These will be assigned to Philippines.', null_count;
    
    -- Assign NULL datasets to Philippines (assuming they're legacy Philippines data)
    UPDATE public.datasets 
    SET country_id = phl_country_id 
    WHERE country_id IS NULL;
    
    RAISE NOTICE 'Assigned % datasets to Philippines.', null_count;
  ELSE
    RAISE NOTICE 'No datasets with NULL country_id found.';
  END IF;
END $$;

-- Step 2: Verify Palestine and Sri Lanka have no datasets
-- (They should be empty for new countries)
DO $$
DECLARE
  pse_country_id UUID;
  lka_country_id UUID;
  pse_dataset_count INTEGER;
  lka_dataset_count INTEGER;
BEGIN
  -- Get country IDs
  SELECT id INTO pse_country_id FROM public.countries WHERE iso_code = 'PSE';
  SELECT id INTO lka_country_id FROM public.countries WHERE iso_code = 'LKA';
  
  IF pse_country_id IS NOT NULL THEN
    SELECT COUNT(*) INTO pse_dataset_count FROM public.datasets WHERE country_id = pse_country_id;
    IF pse_dataset_count > 0 THEN
      RAISE WARNING 'Palestine has % datasets. These should be removed or reassigned.', pse_dataset_count;
      -- Optionally: Set them to NULL or delete them
      -- UPDATE public.datasets SET country_id = NULL WHERE country_id = pse_country_id;
      -- Or delete: DELETE FROM public.datasets WHERE country_id = pse_country_id;
    ELSE
      RAISE NOTICE 'Palestine has no datasets (correct).';
    END IF;
  END IF;
  
  IF lka_country_id IS NOT NULL THEN
    SELECT COUNT(*) INTO lka_dataset_count FROM public.datasets WHERE country_id = lka_country_id;
    IF lka_dataset_count > 0 THEN
      RAISE WARNING 'Sri Lanka has % datasets. These should be removed or reassigned.', lka_dataset_count;
      -- Optionally: Set them to NULL or delete them
      -- UPDATE public.datasets SET country_id = NULL WHERE country_id = lka_country_id;
      -- Or delete: DELETE FROM public.datasets WHERE country_id = lka_country_id;
    ELSE
      RAISE NOTICE 'Sri Lanka has no datasets (correct).';
    END IF;
  END IF;
END $$;

-- Step 3: Remove datasets from Palestine and Sri Lanka (if they exist)
-- These countries should be empty for now
DO $$
DECLARE
  pse_country_id UUID;
  lka_country_id UUID;
  deleted_count INTEGER;
BEGIN
  SELECT id INTO pse_country_id FROM public.countries WHERE iso_code = 'PSE';
  SELECT id INTO lka_country_id FROM public.countries WHERE iso_code = 'LKA';
  
  -- Delete Palestine datasets (cascade will delete values)
  IF pse_country_id IS NOT NULL THEN
    DELETE FROM public.datasets WHERE country_id = pse_country_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    IF deleted_count > 0 THEN
      RAISE NOTICE 'Deleted % datasets from Palestine.', deleted_count;
    ELSE
      RAISE NOTICE 'Palestine has no datasets (already clean).';
    END IF;
  END IF;
  
  -- Delete Sri Lanka datasets (cascade will delete values)
  IF lka_country_id IS NOT NULL THEN
    DELETE FROM public.datasets WHERE country_id = lka_country_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    IF deleted_count > 0 THEN
      RAISE NOTICE 'Deleted % datasets from Sri Lanka.', deleted_count;
    ELSE
      RAISE NOTICE 'Sri Lanka has no datasets (already clean).';
    END IF;
  END IF;
END $$;

-- Step 4: Add constraint to prevent NULL country_id in future
-- (Only if you want to enforce this at the database level)
-- ALTER TABLE public.datasets 
--   ADD CONSTRAINT datasets_country_id_not_null 
--   CHECK (country_id IS NOT NULL);

COMMENT ON COLUMN public.datasets.country_id IS 'Country this dataset belongs to. Required for multi-country isolation.';
