-- Clean Numeric Dataset v3
-- Enhanced cleaning with configurable matching strategies
-- Applies PCode alignment and value normalization

CREATE OR REPLACE FUNCTION clean_numeric_dataset_v3(
  dataset_id UUID,
  matching_config JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_dataset_type TEXT;
  v_admin_level TEXT;
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
  -- Get dataset metadata
  SELECT type, admin_level INTO v_dataset_type, v_admin_level
  FROM datasets
  WHERE id = dataset_id;
  
  IF v_dataset_type IS NULL THEN
    RAISE EXCEPTION 'Dataset not found: %', dataset_id;
  END IF;

  IF v_dataset_type != 'numeric' THEN
    RAISE EXCEPTION 'Dataset type mismatch: expected numeric, got %', v_dataset_type;
  END IF;

  -- Delete existing cleaned values
  DELETE FROM dataset_values_numeric WHERE dataset_id = clean_numeric_dataset_v3.dataset_id;

  -- Insert cleaned values with matching
  WITH raw_data AS (
    SELECT 
      id,
      TRIM(COALESCE(admin_pcode_raw, '')) AS pcode,
      TRIM(COALESCE(admin_name_raw, '')) AS name,
      value_raw,
      is_percentage
    FROM dataset_values_numeric_raw
    WHERE dataset_id = clean_numeric_dataset_v3.dataset_id
      AND (admin_pcode_raw IS NOT NULL OR admin_name_raw IS NOT NULL)
  ),
  matched_data AS (
    SELECT 
      rd.id,
      rd.pcode AS raw_pcode,
      rd.name AS raw_name,
      rd.value_raw,
      rd.is_percentage,
      -- Find best match using same logic as preview
      COALESCE(
        -- Exact match
        CASE 
          WHEN v_exact_match AND rd.pcode != '' THEN
            (SELECT ab.admin_pcode FROM admin_boundaries ab 
             WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(rd.pcode)
               AND (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
             LIMIT 1)
          ELSE NULL
        END,
        -- Fuzzy PCode
        CASE 
          WHEN v_fuzzy_pcode AND rd.pcode != '' THEN
            (SELECT ab.admin_pcode FROM admin_boundaries ab 
             WHERE (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
               AND similarity(UPPER(TRIM(ab.admin_pcode)), UPPER(rd.pcode)) >= v_fuzzy_threshold
             ORDER BY similarity(UPPER(TRIM(ab.admin_pcode)), UPPER(rd.pcode)) DESC
             LIMIT 1)
          ELSE NULL
        END,
        -- Name match
        CASE 
          WHEN v_name_match AND rd.name != '' THEN
            (SELECT ab.admin_pcode FROM admin_boundaries ab 
             WHERE UPPER(TRIM(ab.name)) = UPPER(rd.name)
               AND (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
             LIMIT 1)
          ELSE NULL
        END,
        -- Fuzzy name
        CASE 
          WHEN v_fuzzy_name AND rd.name != '' THEN
            (SELECT ab.admin_pcode FROM admin_boundaries ab 
             WHERE (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
               AND similarity(UPPER(TRIM(ab.name)), UPPER(rd.name)) >= v_fuzzy_threshold
             ORDER BY similarity(UPPER(TRIM(ab.name)), UPPER(rd.name)) DESC
             LIMIT 1)
          ELSE NULL
        END,
        -- Prefix match
        CASE 
          WHEN v_prefix_match AND rd.pcode != '' THEN
            (SELECT ab.admin_pcode FROM admin_boundaries ab 
             WHERE (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
               AND ab.admin_pcode LIKE rd.pcode || '%'
             LIMIT 1)
          ELSE NULL
        END
      ) AS matched_pcode,
      -- Parse numeric value
      CASE 
        WHEN rd.value_raw IS NULL OR rd.value_raw = '' THEN NULL
        WHEN rd.value_raw ~ '^[0-9]+\.?[0-9]*$' OR rd.value_raw ~ '^-?[0-9]+\.?[0-9]*$' THEN
          rd.value_raw::NUMERIC
        ELSE NULL
      END AS numeric_value
    FROM raw_data rd
  )
  INSERT INTO dataset_values_numeric (dataset_id, admin_pcode, value)
  SELECT 
    clean_numeric_dataset_v3.dataset_id,
    md.matched_pcode,
    md.numeric_value
  FROM matched_data md
  WHERE md.matched_pcode IS NOT NULL
    AND md.numeric_value IS NOT NULL;

  GET DIAGNOSTICS v_processed_count = ROW_COUNT;

  -- Count matched vs unmatched
  SELECT COUNT(*) INTO v_matched_count
  FROM dataset_values_numeric
  WHERE dataset_id = clean_numeric_dataset_v3.dataset_id;

  SELECT COUNT(*) INTO v_unmatched_count
  FROM dataset_values_numeric_raw
  WHERE dataset_id = clean_numeric_dataset_v3.dataset_id
    AND id NOT IN (
      SELECT id FROM dataset_values_numeric_raw r
      WHERE EXISTS (
        SELECT 1 FROM dataset_values_numeric n
        WHERE n.dataset_id = clean_numeric_dataset_v3.dataset_id
          AND n.admin_pcode IN (
            SELECT ab.admin_pcode FROM admin_boundaries ab
            WHERE (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
              AND (
                (v_exact_match AND UPPER(TRIM(ab.admin_pcode)) = UPPER(TRIM(COALESCE(r.admin_pcode_raw, ''))))
                OR (v_name_match AND UPPER(TRIM(ab.name)) = UPPER(TRIM(COALESCE(r.admin_name_raw, ''))))
              )
          )
      )
    );

  -- Update dataset status
  UPDATE datasets
  SET metadata = COALESCE(metadata, '{}'::JSONB) || jsonb_build_object(
    'cleaning_status', 'ready',
    'readiness', 'ready',
    'cleaned_at', NOW()
  ),
  updated_at = NOW()
  WHERE id = dataset_id;

  -- Recompute health metrics
  PERFORM compute_data_health(dataset_id);

  -- Build result
  v_result := jsonb_build_object(
    'status', 'success',
    'processed_rows', v_processed_count,
    'matched_rows', v_matched_count,
    'unmatched_rows', v_unmatched_count,
    'dataset_id', dataset_id
  );

  RETURN v_result;
END;
$$;

