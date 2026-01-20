-- ==============================
-- RESTORE SPECIFIC DATASETS FROM SOURCE
-- ==============================
-- This script restores the two specific datasets:
-- 1. Building Typologies (adm3) - a017b4a4-b958-4ede-ab9d-8f4124188d4c
-- 2. Building Typology - 59abe182-73c6-47f5-8e7b-752a1168bf06

-- ==============================
-- STEP 1: RUN IN SOURCE DATABASE
-- ==============================
-- First, check the schema to get correct column names
/*
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('dataset_values_categorical_raw', 'dataset_values_categorical')
  AND table_name LIKE '%categorical%'
ORDER BY table_name, ordinal_position;
*/

-- Export Dataset 1: Building Typologies (adm3)
-- Run this in SOURCE database and copy ALL results:
/*
SELECT 
  admin_pcode,
  category,
  value
FROM dataset_values_categorical_raw
WHERE dataset_id = 'a017b4a4-b958-4ede-ab9d-8f4124188d4c'
ORDER BY admin_pcode, category;
*/

-- If raw table doesn't exist or is empty, use cleaned table:
/*
SELECT 
  admin_pcode,
  category,
  value
FROM dataset_values_categorical
WHERE dataset_id = 'a017b4a4-b958-4ede-ab9d-8f4124188d4c'
ORDER BY admin_pcode, category;
*/

-- Export Dataset 2: Building Typology
-- Run this in SOURCE database and copy ALL results:
/*
SELECT 
  admin_pcode,
  category,
  value
FROM dataset_values_categorical_raw
WHERE dataset_id = '59abe182-73c6-47f5-8e7b-752a1168bf06'
ORDER BY admin_pcode, category;
*/

-- If raw table doesn't exist or is empty, use cleaned table:
/*
SELECT 
  admin_pcode,
  category,
  value
FROM dataset_values_categorical
WHERE dataset_id = '59abe182-73c6-47f5-8e7b-752a1168bf06'
ORDER BY admin_pcode, category;
*/

-- ==============================
-- STEP 2: RUN IN TARGET DATABASE
-- ==============================
-- First, find or create the target dataset IDs

-- Check if datasets exist in target:
SELECT id, name, type 
FROM datasets 
WHERE name IN ('Building Typologies (adm3)', 'Building Typology')
ORDER BY name;

-- If they don't exist, you'll need to create them first or note the IDs

-- ==============================
-- STEP 3: IMPORT FUNCTION
-- ==============================
-- This function helps import the exported data

CREATE OR REPLACE FUNCTION import_categorical_raw_data(
  p_target_dataset_id UUID,
  p_data_rows JSONB
)
RETURNS TABLE (
  step TEXT,
  status TEXT,
  message TEXT,
  count_value BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_row JSONB;
  v_inserted BIGINT := 0;
  v_errors BIGINT := 0;
  v_error_msg TEXT;
BEGIN
  -- Verify dataset exists
  IF NOT EXISTS (SELECT 1 FROM datasets WHERE id = p_target_dataset_id) THEN
    RETURN QUERY SELECT 
      'ERROR'::TEXT,
      'failed'::TEXT,
      'Target dataset not found. Create it first or use correct ID.'::TEXT,
      0::BIGINT;
    RETURN;
  END IF;
  
  -- Clear existing raw data
  DELETE FROM dataset_values_categorical_raw WHERE dataset_id = p_target_dataset_id;
  
  RETURN QUERY SELECT 
    'Cleared Existing'::TEXT,
    'info'::TEXT,
    'Cleared existing raw data'::TEXT,
    0::BIGINT;
  
  -- Insert new data
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_data_rows)
  LOOP
    BEGIN
      INSERT INTO dataset_values_categorical_raw (
        dataset_id, 
        admin_pcode, 
        category, 
        value
      )
      VALUES (
        p_target_dataset_id,
        (v_row->>'admin_pcode')::TEXT,
        (v_row->>'category')::TEXT,
        CASE 
          WHEN v_row->>'value' IS NULL OR v_row->>'value' = 'null' THEN NULL
          ELSE (v_row->>'value')::NUMERIC
        END
      );
      v_inserted := v_inserted + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      v_error_msg := SQLERRM;
    END;
  END LOOP;
  
  RETURN QUERY SELECT 
    'Import Complete'::TEXT,
    CASE WHEN v_errors = 0 THEN 'success'::TEXT ELSE 'warning'::TEXT END,
    ('Inserted ' || v_inserted || ' rows, ' || v_errors || ' errors' || 
     CASE WHEN v_errors > 0 THEN ': ' || v_error_msg ELSE '' END)::TEXT,
    v_inserted;
  
  -- Now run cleaning
  DECLARE
    v_result JSONB;
    v_matched BIGINT;
  BEGIN
    SELECT public.clean_categorical_dataset_v3(
      p_target_dataset_id,
      jsonb_build_object(
        'exact_match', true,
        'fuzzy_pcode', true,
        'fuzzy_threshold', 0.7,
        'prefix_match', true
      )
    ) INTO v_result;
    
    v_matched := COALESCE((v_result->>'matched')::BIGINT, 0);
    
    RETURN QUERY SELECT 
      'Cleaning Complete'::TEXT,
      CASE WHEN v_matched > 0 THEN 'success'::TEXT ELSE 'warning'::TEXT END,
      ('Matched ' || v_matched || ' rows')::TEXT,
      v_matched;
  END;
  
  -- Recompute health
  BEGIN
    PERFORM public.compute_data_health(p_target_dataset_id);
    RETURN QUERY SELECT 
      'Health Updated'::TEXT,
      'success'::TEXT,
      'Data health recomputed'::TEXT,
      0::BIGINT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 
      'Health Update'::TEXT,
      'warning'::TEXT,
      ('Could not recompute: ' || SQLERRM)::TEXT,
      0::BIGINT;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_categorical_raw_data(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_categorical_raw_data(UUID, JSONB) TO anon;

-- ==============================
-- USAGE INSTRUCTIONS
-- ==============================
-- 1. In SOURCE database, run the export queries above
-- 2. Copy the results as JSON array format, or use CSV
-- 3. In TARGET database:
--    a. Find your target dataset IDs
--    b. Convert exported data to JSONB format
--    c. Call: SELECT * FROM import_categorical_raw_data('target-dataset-id', '[...json data...]'::JSONB);
