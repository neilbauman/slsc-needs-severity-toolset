-- ==============================
-- RESTORE DATASETS FROM SOURCE DATABASE
-- ==============================
-- This provides SQL queries to copy data from the source database
-- You'll need to run these queries in the SOURCE database first to export,
-- then in the TARGET database to import.
--
-- STEP 1: Run the export queries in the SOURCE database
-- STEP 2: Copy the results
-- STEP 3: Run the import queries in the TARGET database

-- ==============================
-- EXPORT QUERIES (Run in SOURCE database)
-- ==============================

-- Export dataset metadata
-- Run this in SOURCE database and copy the results:
/*
SELECT 
  id,
  name,
  description,
  admin_level,
  type,
  indicator_id,
  created_at,
  is_baseline,
  is_derived,
  metadata,
  uploaded_by,
  collected_at,
  source,
  country_id
FROM datasets
WHERE name IN ('Building Typology', 'Population')  -- Replace with your dataset names
ORDER BY name;
*/

-- Export raw numeric data
-- Run this in SOURCE database for each numeric dataset:
/*
SELECT 
  dataset_id,
  admin_pcode,
  value
FROM dataset_values_numeric_raw
WHERE dataset_id = 'your-dataset-id-from-source'  -- Replace with actual ID
ORDER BY admin_pcode;
*/

-- Export raw categorical data
-- Run this in SOURCE database for each categorical dataset:
/*
SELECT 
  dataset_id,
  admin_pcode,
  category,
  value
FROM dataset_values_categorical_raw
WHERE dataset_id = 'your-dataset-id-from-source'  -- Replace with actual ID
ORDER BY admin_pcode, category;
*/

-- ==============================
-- IMPORT QUERIES (Run in TARGET database)
-- ==============================

-- Function to restore dataset from exported data
CREATE OR REPLACE FUNCTION restore_dataset_from_export(
  p_source_dataset_id UUID,  -- ID from source database
  p_target_dataset_id UUID,    -- ID in target database (existing or new)
  p_dataset_name TEXT,
  p_dataset_type TEXT,
  p_raw_data JSONB  -- Array of raw data rows
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
  v_inserted_count BIGINT := 0;
  v_error_count BIGINT := 0;
BEGIN
  -- Verify target dataset exists
  IF NOT EXISTS (SELECT 1 FROM datasets WHERE id = p_target_dataset_id) THEN
    RETURN QUERY SELECT 
      'ERROR'::TEXT,
      'failed'::TEXT,
      'Target dataset not found. Create the dataset first or use the correct ID.'::TEXT,
      0::BIGINT;
    RETURN;
  END IF;
  
  -- Insert raw data
  IF p_dataset_type = 'numeric' THEN
    -- Delete existing raw data first
    DELETE FROM dataset_values_numeric_raw WHERE dataset_id = p_target_dataset_id;
    
    -- Insert new raw data
    FOR v_row IN SELECT * FROM jsonb_array_elements(p_raw_data)
    LOOP
      BEGIN
        INSERT INTO dataset_values_numeric_raw (dataset_id, admin_pcode, value)
        VALUES (
          p_target_dataset_id,
          (v_row->>'admin_pcode')::TEXT,
          (v_row->>'value')::NUMERIC
        );
        v_inserted_count := v_inserted_count + 1;
      EXCEPTION WHEN OTHERS THEN
        v_error_count := v_error_count + 1;
      END;
    END LOOP;
  ELSE
    -- Delete existing raw data first
    DELETE FROM dataset_values_categorical_raw WHERE dataset_id = p_target_dataset_id;
    
    -- Insert new raw data
    FOR v_row IN SELECT * FROM jsonb_array_elements(p_raw_data)
    LOOP
      BEGIN
        INSERT INTO dataset_values_categorical_raw (dataset_id, admin_pcode, category, value)
        VALUES (
          p_target_dataset_id,
          (v_row->>'admin_pcode')::TEXT,
          (v_row->>'category')::TEXT,
          CASE 
            WHEN v_row->>'value' IS NULL OR v_row->>'value' = 'null' THEN NULL
            ELSE (v_row->>'value')::NUMERIC
          END
        );
        v_inserted_count := v_inserted_count + 1;
      EXCEPTION WHEN OTHERS THEN
        v_error_count := v_error_count + 1;
      END;
    END LOOP;
  END IF;
  
  RETURN QUERY SELECT 
    'Import Raw Data'::TEXT,
    CASE WHEN v_error_count = 0 THEN 'success'::TEXT ELSE 'warning'::TEXT END,
    ('Inserted ' || v_inserted_count || ' rows, ' || v_error_count || ' errors')::TEXT,
    v_inserted_count;
  
  -- Now run cleaning to restore cleaned data
  DECLARE
    v_cleaning_result JSONB;
    v_matched_count BIGINT;
  BEGIN
    IF p_dataset_type = 'numeric' THEN
      SELECT public.clean_numeric_dataset_v3(
        p_target_dataset_id,
        jsonb_build_object(
          'exact_match', true,
          'fuzzy_pcode', true,
          'fuzzy_threshold', 0.7,
          'prefix_match', true
        )
      ) INTO v_cleaning_result;
    ELSE
      SELECT public.clean_categorical_dataset_v3(
        p_target_dataset_id,
        jsonb_build_object(
          'exact_match', true,
          'fuzzy_pcode', true,
          'fuzzy_threshold', 0.7,
          'prefix_match', true
        )
      ) INTO v_cleaning_result;
    END IF;
    
    v_matched_count := COALESCE((v_cleaning_result->>'matched')::BIGINT, 0);
    
    RETURN QUERY SELECT 
      'Cleaning Complete'::TEXT,
      CASE WHEN v_matched_count > 0 THEN 'success'::TEXT ELSE 'warning'::TEXT END,
      ('Matched ' || v_matched_count || ' rows during cleaning')::TEXT,
      v_matched_count;
  END;
  
  -- Recompute data health
  BEGIN
    PERFORM public.compute_data_health(p_target_dataset_id);
    RETURN QUERY SELECT 
      'Data Health'::TEXT,
      'updated'::TEXT,
      'Data health metrics recomputed'::TEXT,
      0::BIGINT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 
      'Data Health'::TEXT,
      'warning'::TEXT,
      ('Could not recompute: ' || SQLERRM)::TEXT,
      0::BIGINT;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_dataset_from_export(UUID, UUID, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_dataset_from_export(UUID, UUID, TEXT, TEXT, JSONB) TO anon;

-- ==============================
-- SIMPLER DIRECT COPY FUNCTION
-- ==============================
-- If you have direct database access, you can use this simpler approach

CREATE OR REPLACE FUNCTION copy_raw_data_from_source(
  p_source_dataset_id UUID,
  p_target_dataset_id UUID,
  p_dataset_type TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_count BIGINT;
  v_sql TEXT;
BEGIN
  -- This function generates SQL that you can run if you have direct DB access
  -- or use dblink extension
  
  IF p_dataset_type = 'numeric' THEN
    v_sql := format(
      'INSERT INTO dataset_values_numeric_raw (dataset_id, admin_pcode, value)
       SELECT %L::UUID, admin_pcode, value
       FROM dataset_values_numeric_raw
       WHERE dataset_id = %L::UUID
       ON CONFLICT DO NOTHING;',
      p_target_dataset_id,
      p_source_dataset_id
    );
  ELSE
    v_sql := format(
      'INSERT INTO dataset_values_categorical_raw (dataset_id, admin_pcode, category, value)
       SELECT %L::UUID, admin_pcode, category, value
       FROM dataset_values_categorical_raw
       WHERE dataset_id = %L::UUID
       ON CONFLICT DO NOTHING;',
      p_target_dataset_id,
      p_source_dataset_id
    );
  END IF;
  
  RETURN v_sql;
END;
$$;

GRANT EXECUTE ON FUNCTION public.copy_raw_data_from_source(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.copy_raw_data_from_source(UUID, UUID, TEXT) TO anon;
