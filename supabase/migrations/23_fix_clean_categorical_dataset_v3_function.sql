-- ==============================
-- FIX clean_categorical_dataset_v3 FUNCTION
-- ==============================
-- Fixes column name issues and adds country isolation
-- The raw tables use admin_pcode (not admin_pcode_raw) and don't have admin_name_raw

-- Drop existing function
DROP FUNCTION IF EXISTS public.clean_categorical_dataset_v3(UUID, JSONB);

-- Create extension if needed (for similarity function)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION public.clean_categorical_dataset_v3(
  dataset_id UUID,
  matching_config JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_dataset_id UUID; -- Store parameter to avoid ambiguity
  v_dataset_type TEXT;
  v_admin_level TEXT;
  v_country_id UUID;
  v_exact_match BOOLEAN := COALESCE((matching_config->>'exact_match')::BOOLEAN, true);
  v_fuzzy_pcode BOOLEAN := COALESCE((matching_config->>'fuzzy_pcode')::BOOLEAN, true);
  v_name_match BOOLEAN := COALESCE((matching_config->>'name_match')::BOOLEAN, true);
  v_fuzzy_name BOOLEAN := COALESCE((matching_config->>'fuzzy_name')::BOOLEAN, true);
  v_prefix_match BOOLEAN := COALESCE((matching_config->>'prefix_match')::BOOLEAN, true);
  v_fuzzy_threshold NUMERIC := COALESCE((matching_config->>'fuzzy_threshold')::NUMERIC, 0.8);
  v_processed_count BIGINT := 0;
  v_matched_count BIGINT := 0;
  v_unmatched_count BIGINT := 0;
  v_result JSONB;
  v_raw_row RECORD;
  v_shape TEXT;
  v_categories TEXT[];
  v_category_value NUMERIC;
BEGIN
  -- Store parameter in local variable to avoid ambiguity
  v_dataset_id := dataset_id;
  
  -- Get dataset metadata and country_id for data isolation
  SELECT d.type, d.admin_level, d.country_id INTO v_dataset_type, v_admin_level, v_country_id
  FROM datasets d
  WHERE d.id = v_dataset_id;
  
  IF v_dataset_type IS NULL THEN
    RAISE EXCEPTION 'Dataset not found: %', v_dataset_id;
  END IF;

  IF v_dataset_type != 'categorical' THEN
    RAISE EXCEPTION 'Dataset type mismatch: expected categorical, got %', v_dataset_type;
  END IF;

  -- Check if we have raw data to process
  SELECT COUNT(*) INTO v_processed_count
  FROM dataset_values_categorical_raw dvcr
  WHERE dvcr.dataset_id = v_dataset_id
    AND dvcr.admin_pcode IS NOT NULL
    AND dvcr.admin_pcode != '';
  
  IF v_processed_count = 0 THEN
    -- No raw data to process, but don't delete existing cleaned data
    RETURN jsonb_build_object(
      'status', 'success',
      'processed', 0,
      'matched', 0,
      'unmatched', 0,
      'message', 'No raw data found to process'
    );
  END IF;

  -- Delete existing cleaned values (only if we have raw data to process)
  DELETE FROM dataset_values_categorical dvc WHERE dvc.dataset_id = v_dataset_id;
  
  -- Reset counter for actual processing
  v_processed_count := 0;

  -- Process raw categorical data
  -- Note: The raw table uses admin_pcode (not admin_pcode_raw) and doesn't have admin_name_raw
  FOR v_raw_row IN 
    SELECT *
    FROM dataset_values_categorical_raw dvcr
    WHERE dvcr.dataset_id = v_dataset_id
      AND dvcr.admin_pcode IS NOT NULL
      AND dvcr.admin_pcode != ''
  LOOP
    -- Extract shape and categories from metadata (if stored)
    v_shape := 'long'; -- Default to long format
    v_categories := ARRAY[]::TEXT[];

    -- Get matched PCode using same logic as preview
    DECLARE
      v_raw_pcode TEXT := TRIM(COALESCE(v_raw_row.admin_pcode, ''));
      v_matched_pcode TEXT;
    BEGIN
      -- Find best match (with country isolation)
      -- Note: We prioritize exact admin_level matches but don't require it strictly
      -- This allows matching even if admin_level metadata is slightly off
      SELECT COALESCE(
        -- Exact match (prefer matching admin_level, but don't require it)
        CASE 
          WHEN v_exact_match AND v_raw_pcode != '' THEN
            (SELECT ab.admin_pcode FROM admin_boundaries ab 
             WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(v_raw_pcode)
               AND (v_country_id IS NULL OR ab.country_id = v_country_id)
             ORDER BY CASE WHEN v_admin_level IS NOT NULL AND UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level) THEN 1 ELSE 2 END
             LIMIT 1)
          ELSE NULL
        END,
        -- Fuzzy PCode (prefer matching admin_level, but don't require it)
        CASE 
          WHEN v_fuzzy_pcode AND v_raw_pcode != '' THEN
            (SELECT ab.admin_pcode FROM admin_boundaries ab 
             WHERE (v_country_id IS NULL OR ab.country_id = v_country_id)
               AND similarity(UPPER(TRIM(ab.admin_pcode)), UPPER(v_raw_pcode)) >= v_fuzzy_threshold
             ORDER BY 
               CASE WHEN v_admin_level IS NOT NULL AND UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level) THEN 1 ELSE 2 END,
               similarity(UPPER(TRIM(ab.admin_pcode)), UPPER(v_raw_pcode)) DESC
             LIMIT 1)
          ELSE NULL
        END,
        -- Prefix match (prefer matching admin_level, but don't require it)
        CASE 
          WHEN v_prefix_match AND v_raw_pcode != '' THEN
            (SELECT ab.admin_pcode FROM admin_boundaries ab 
             WHERE (v_country_id IS NULL OR ab.country_id = v_country_id)
               AND ab.admin_pcode LIKE v_raw_pcode || '%'
             ORDER BY CASE WHEN v_admin_level IS NOT NULL AND UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level) THEN 1 ELSE 2 END
             LIMIT 1)
          ELSE NULL
        END
      ) INTO v_matched_pcode;

      IF v_matched_pcode IS NOT NULL THEN
        -- Insert category value
        -- The raw table has: admin_pcode, category, value
        -- Use the function parameter directly to avoid ambiguity with table column
        INSERT INTO dataset_values_categorical (dataset_id, admin_pcode, category, value)
        VALUES (
          clean_categorical_dataset_v3.dataset_id, 
          v_matched_pcode, 
          COALESCE(v_raw_row.category, 'unknown'),
          v_raw_row.value
        )
        ON CONFLICT (dataset_id, admin_pcode, category) DO UPDATE
        SET value = EXCLUDED.value;
        
        v_processed_count := v_processed_count + 1;
        v_matched_count := v_matched_count + 1;
      ELSE
        v_unmatched_count := v_unmatched_count + 1;
      END IF;
    END;
  END LOOP;

  -- Update dataset status
  UPDATE datasets d
  SET metadata = COALESCE(d.metadata, '{}'::JSONB) || jsonb_build_object(
    'cleaning_status', 'ready',
    'readiness', 'ready',
    'cleaned_at', NOW()
  ),
  updated_at = NOW()
  WHERE d.id = v_dataset_id;

  -- Recompute health metrics
  PERFORM compute_data_health(v_dataset_id);

  -- Build result
  v_result := jsonb_build_object(
    'status', 'success',
    'processed_rows', v_processed_count,
    'matched_rows', v_matched_count,
    'unmatched_rows', v_unmatched_count,
    'dataset_id', v_dataset_id
  );

  RETURN v_result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.clean_categorical_dataset_v3(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clean_categorical_dataset_v3(UUID, JSONB) TO anon;
