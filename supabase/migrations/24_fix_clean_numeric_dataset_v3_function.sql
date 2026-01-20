-- ==============================
-- FIX clean_numeric_dataset_v3 FUNCTION
-- ==============================
-- Fixes column name issues and adds country isolation
-- The raw tables use admin_pcode and value (not admin_pcode_raw, admin_name_raw, value_raw)

-- Drop existing function
DROP FUNCTION IF EXISTS public.clean_numeric_dataset_v3(UUID, JSONB);

-- Create extension if needed (for similarity function)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION public.clean_numeric_dataset_v3(
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

  IF v_dataset_type != 'numeric' THEN
    RAISE EXCEPTION 'Dataset type mismatch: expected numeric, got %', v_dataset_type;
  END IF;

  -- Check if we have raw data to process
  DECLARE
    v_raw_data_count BIGINT;
  BEGIN
    SELECT COUNT(*) INTO v_raw_data_count
    FROM dataset_values_numeric_raw dvnr
    WHERE dvnr.dataset_id = v_dataset_id
      AND dvnr.admin_pcode IS NOT NULL
      AND dvnr.admin_pcode != ''
      AND dvnr.value IS NOT NULL;
    
    IF v_raw_data_count = 0 THEN
      -- No raw data to process, but don't delete existing cleaned data
      RETURN jsonb_build_object(
        'status', 'success',
        'processed', 0,
        'matched', 0,
        'unmatched', 0,
        'message', 'No raw data found to process'
      );
    END IF;
  END;

  -- Delete existing cleaned values (only if we have raw data to process)
  DELETE FROM dataset_values_numeric WHERE dataset_id = v_dataset_id;

  -- Insert cleaned values with matching
  -- Note: The raw table uses admin_pcode and value (not admin_pcode_raw, admin_name_raw, value_raw)
  WITH raw_data AS (
    SELECT 
      dvnr.id,
      TRIM(COALESCE(dvnr.admin_pcode, '')) AS pcode,
      dvnr.value AS numeric_value
    FROM dataset_values_numeric_raw dvnr
    WHERE dvnr.dataset_id = v_dataset_id
      AND dvnr.admin_pcode IS NOT NULL
      AND dvnr.admin_pcode != ''
      AND dvnr.value IS NOT NULL
  ),
  matched_data AS (
    SELECT 
      rd.id,
      rd.pcode AS raw_pcode,
      rd.numeric_value,
      -- Find best match using same logic as preview (with country isolation)
      -- Note: We prioritize exact admin_level matches but don't require it strictly
      -- This allows matching even if admin_level metadata is slightly off
      COALESCE(
        -- Exact match (prefer matching admin_level, but don't require it)
        CASE 
          WHEN v_exact_match AND rd.pcode != '' THEN
            (SELECT ab.admin_pcode FROM admin_boundaries ab 
             WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(rd.pcode)
               AND (v_country_id IS NULL OR ab.country_id = v_country_id)
             ORDER BY CASE WHEN v_admin_level IS NOT NULL AND UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level) THEN 1 ELSE 2 END
             LIMIT 1)
          ELSE NULL
        END,
        -- Fuzzy PCode (prefer matching admin_level, but don't require it)
        CASE 
          WHEN v_fuzzy_pcode AND rd.pcode != '' THEN
            (SELECT ab.admin_pcode FROM admin_boundaries ab 
             WHERE (v_country_id IS NULL OR ab.country_id = v_country_id)
               AND similarity(UPPER(TRIM(ab.admin_pcode)), UPPER(rd.pcode)) >= v_fuzzy_threshold
             ORDER BY 
               CASE WHEN v_admin_level IS NOT NULL AND UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level) THEN 1 ELSE 2 END,
               similarity(UPPER(TRIM(ab.admin_pcode)), UPPER(rd.pcode)) DESC
             LIMIT 1)
          ELSE NULL
        END,
        -- Prefix match (prefer matching admin_level, but don't require it)
        CASE 
          WHEN v_prefix_match AND rd.pcode != '' THEN
            (SELECT ab.admin_pcode FROM admin_boundaries ab 
             WHERE (v_country_id IS NULL OR ab.country_id = v_country_id)
               AND ab.admin_pcode LIKE rd.pcode || '%'
             ORDER BY CASE WHEN v_admin_level IS NOT NULL AND UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level) THEN 1 ELSE 2 END
             LIMIT 1)
          ELSE NULL
        END
      ) AS matched_pcode
    FROM raw_data rd
  )
  INSERT INTO dataset_values_numeric (dataset_id, admin_pcode, value)
  SELECT 
    v_dataset_id,
    md.matched_pcode,
    md.numeric_value
  FROM matched_data md
  WHERE md.matched_pcode IS NOT NULL
    AND md.numeric_value IS NOT NULL;

  GET DIAGNOSTICS v_processed_count = ROW_COUNT;

  -- Count matched vs unmatched
  SELECT COUNT(*) INTO v_matched_count
  FROM dataset_values_numeric dvn
  WHERE dvn.dataset_id = v_dataset_id;

  SELECT COUNT(*) INTO v_unmatched_count
  FROM dataset_values_numeric_raw dvnr_unmatched
  WHERE dvnr_unmatched.dataset_id = v_dataset_id
    AND dvnr_unmatched.admin_pcode IS NOT NULL
    AND dvnr_unmatched.admin_pcode != ''
    AND dvnr_unmatched.id NOT IN (
      SELECT r.id 
      FROM dataset_values_numeric_raw r
      INNER JOIN dataset_values_numeric n ON n.dataset_id = v_dataset_id
      INNER JOIN admin_boundaries ab ON ab.admin_pcode = n.admin_pcode
      WHERE r.dataset_id = v_dataset_id
        AND (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
        AND (v_country_id IS NULL OR ab.country_id = v_country_id)
        AND UPPER(TRIM(ab.admin_pcode)) = UPPER(TRIM(r.admin_pcode))
    );

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
GRANT EXECUTE ON FUNCTION public.clean_numeric_dataset_v3(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clean_numeric_dataset_v3(UUID, JSONB) TO anon;
