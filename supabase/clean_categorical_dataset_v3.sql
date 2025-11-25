-- Clean Categorical Dataset v3
-- Enhanced cleaning with configurable matching strategies
-- Handles both wide and long format categorical data

CREATE OR REPLACE FUNCTION clean_categorical_dataset_v3(
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
  v_raw_row JSONB;
  v_shape TEXT;
  v_categories TEXT[];
  v_category_value NUMERIC;
BEGIN
  -- Get dataset metadata
  SELECT type, admin_level INTO v_dataset_type, v_admin_level
  FROM datasets
  WHERE id = dataset_id;
  
  IF v_dataset_type IS NULL THEN
    RAISE EXCEPTION 'Dataset not found: %', dataset_id;
  END IF;

  IF v_dataset_type != 'categorical' THEN
    RAISE EXCEPTION 'Dataset type mismatch: expected categorical, got %', v_dataset_type;
  END IF;

  -- Delete existing cleaned values
  DELETE FROM dataset_values_categorical WHERE dataset_id = clean_categorical_dataset_v3.dataset_id;

  -- Process raw categorical data
  FOR v_raw_row IN 
    SELECT row_to_json(r.*)::JSONB AS raw_row
    FROM dataset_values_categorical_raw r
    WHERE r.dataset_id = clean_categorical_dataset_v3.dataset_id
      AND (r.admin_pcode_raw IS NOT NULL OR r.admin_name_raw IS NOT NULL)
  LOOP
    -- Extract shape and categories from raw_row metadata
    v_shape := COALESCE(v_raw_row->>'shape', 'long');
    v_categories := ARRAY[]::TEXT[];

    -- Get matched PCode using same logic as numeric
    DECLARE
      v_raw_pcode TEXT := TRIM(COALESCE(v_raw_row->>'admin_pcode_raw', ''));
      v_raw_name TEXT := TRIM(COALESCE(v_raw_row->>'admin_name_raw', ''));
      v_matched_pcode TEXT;
    BEGIN
      -- Find best match
      SELECT COALESCE(
        -- Exact match
        CASE 
          WHEN v_exact_match AND v_raw_pcode != '' THEN
            (SELECT ab.admin_pcode FROM admin_boundaries ab 
             WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(v_raw_pcode)
               AND (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
             LIMIT 1)
          ELSE NULL
        END,
        -- Fuzzy PCode
        CASE 
          WHEN v_fuzzy_pcode AND v_raw_pcode != '' THEN
            (SELECT ab.admin_pcode FROM admin_boundaries ab 
             WHERE (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
               AND similarity(UPPER(TRIM(ab.admin_pcode)), UPPER(v_raw_pcode)) >= v_fuzzy_threshold
             ORDER BY similarity(UPPER(TRIM(ab.admin_pcode)), UPPER(v_raw_pcode)) DESC
             LIMIT 1)
          ELSE NULL
        END,
        -- Name match
        CASE 
          WHEN v_name_match AND v_raw_name != '' THEN
            (SELECT ab.admin_pcode FROM admin_boundaries ab 
             WHERE UPPER(TRIM(ab.name)) = UPPER(v_raw_name)
               AND (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
             LIMIT 1)
          ELSE NULL
        END,
        -- Fuzzy name
        CASE 
          WHEN v_fuzzy_name AND v_raw_name != '' THEN
            (SELECT ab.admin_pcode FROM admin_boundaries ab 
             WHERE (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
               AND similarity(UPPER(TRIM(ab.name)), UPPER(v_raw_name)) >= v_fuzzy_threshold
             ORDER BY similarity(UPPER(TRIM(ab.name)), UPPER(v_raw_name)) DESC
             LIMIT 1)
          ELSE NULL
        END,
        -- Prefix match
        CASE 
          WHEN v_prefix_match AND v_raw_pcode != '' THEN
            (SELECT ab.admin_pcode FROM admin_boundaries ab 
             WHERE (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
               AND ab.admin_pcode LIKE v_raw_pcode || '%'
             LIMIT 1)
          ELSE NULL
        END
      ) INTO v_matched_pcode;

      IF v_matched_pcode IS NOT NULL THEN
        -- Process based on shape
        IF v_shape = 'wide' THEN
          -- Extract wide format categories from raw_row
          DECLARE
            v_wide_categories JSONB := v_raw_row->'raw_row'->'__ssc_wide_categories';
            v_category_key TEXT;
            v_category_normalized TEXT;
          BEGIN
            IF v_wide_categories IS NOT NULL THEN
              FOR v_category_key IN SELECT jsonb_array_elements_text(v_wide_categories)
              LOOP
                -- Get normalized category name
                v_category_normalized := COALESCE(
                  v_raw_row->'raw_row'->'__ssc_wide_categories_normalized'->>v_category_key,
                  LOWER(REGEXP_REPLACE(v_category_key, '[^a-z0-9]+', '_', 'g'))
                );
                
                -- Extract value for this category
                v_category_value := NULL;
                IF v_raw_row->'raw_row'->>v_category_key IS NOT NULL THEN
                  BEGIN
                    v_category_value := (v_raw_row->'raw_row'->>v_category_key)::NUMERIC;
                  EXCEPTION WHEN OTHERS THEN
                    v_category_value := NULL;
                  END;
                END IF;

                -- Insert category value
                IF v_category_normalized IS NOT NULL THEN
                  INSERT INTO dataset_values_categorical (dataset_id, admin_pcode, category, value)
                  VALUES (clean_categorical_dataset_v3.dataset_id, v_matched_pcode, v_category_normalized, v_category_value)
                  ON CONFLICT DO NOTHING;
                  
                  v_processed_count := v_processed_count + 1;
                END IF;
              END LOOP;
            END IF;
          END;
        ELSE
          -- Long format: extract from category_value_column
          DECLARE
            v_category_col TEXT := COALESCE(v_raw_row->'raw_row'->>'__ssc_category_value_column', 'category');
            v_category_val TEXT;
            v_value_val NUMERIC;
          BEGIN
            v_category_val := v_raw_row->'raw_row'->>v_category_col;
            IF v_category_val IS NOT NULL THEN
              v_category_val := LOWER(REGEXP_REPLACE(v_category_val, '[^a-z0-9]+', '_', 'g'));
              
              -- Try to extract numeric value
              BEGIN
                v_value_val := (v_raw_row->'raw_row'->>'value')::NUMERIC;
              EXCEPTION WHEN OTHERS THEN
                v_value_val := NULL;
              END;

              INSERT INTO dataset_values_categorical (dataset_id, admin_pcode, category, value)
              VALUES (clean_categorical_dataset_v3.dataset_id, v_matched_pcode, v_category_val, v_value_val)
              ON CONFLICT DO NOTHING;
              
              v_processed_count := v_processed_count + 1;
            END IF;
          END;
        END IF;
      END IF;
    END;
  END LOOP;

  -- Count matched vs unmatched
  SELECT COUNT(DISTINCT admin_pcode) INTO v_matched_count
  FROM dataset_values_categorical
  WHERE dataset_id = clean_categorical_dataset_v3.dataset_id;

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

