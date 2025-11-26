-- Compute Data Health Metrics
-- Calculates comprehensive health metrics for a dataset:
-- - Alignment Rate: % of rows with matched PCodes
-- - Coverage: % of reference admin areas covered
-- - Completeness: % of rows with valid values
-- - Uniqueness: % of unique rows
-- - Validation Errors: Count of invalid values

CREATE OR REPLACE FUNCTION compute_data_health(
  p_dataset_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_dataset_type TEXT;
  v_admin_level TEXT;
  v_total_rows BIGINT := 0;
  v_matched_rows BIGINT := 0;
  v_valid_rows BIGINT := 0;
  v_unique_rows BIGINT := 0;
  v_reference_count BIGINT := 0;
  v_covered_count BIGINT := 0;
  v_validation_errors BIGINT := 0;
  v_alignment_rate NUMERIC;
  v_coverage NUMERIC;
  v_completeness NUMERIC;
  v_uniqueness NUMERIC;
  v_result JSONB;
BEGIN
  -- Get dataset metadata
  SELECT type, admin_level INTO v_dataset_type, v_admin_level
  FROM datasets
  WHERE id = p_dataset_id;
  
  IF v_dataset_type IS NULL THEN
    RAISE EXCEPTION 'Dataset not found: %', dataset_id;
  END IF;

  -- Count reference admin areas at the dataset's admin level
  SELECT COUNT(*) INTO v_reference_count
  FROM admin_boundaries
  WHERE (v_admin_level IS NULL OR UPPER(TRIM(admin_level)) = UPPER(v_admin_level));

  -- Process numeric datasets
  IF v_dataset_type = 'numeric' THEN
    -- Count total raw rows
    SELECT COUNT(*) INTO v_total_rows
    FROM dataset_values_numeric_raw
    WHERE dataset_id = p_dataset_id;

    -- Count matched rows (rows that have been cleaned and aligned)
    SELECT COUNT(DISTINCT admin_pcode) INTO v_matched_rows
    FROM dataset_values_numeric
    WHERE dataset_id = p_dataset_id
      AND admin_pcode IN (SELECT admin_pcode FROM admin_boundaries);

    -- Count valid rows (non-null, numeric values)
    SELECT COUNT(*) INTO v_valid_rows
    FROM dataset_values_numeric_raw
    WHERE dataset_id = p_dataset_id
      AND value_raw IS NOT NULL
      AND value_raw != ''
      AND (value_raw ~ '^[0-9]+\.?[0-9]*$' OR value_raw ~ '^-?[0-9]+\.?[0-9]*$');

    -- Count unique rows (by pcode)
    SELECT COUNT(DISTINCT COALESCE(admin_pcode_raw, admin_name_raw)) INTO v_unique_rows
    FROM dataset_values_numeric_raw
    WHERE dataset_id = p_dataset_id
      AND (admin_pcode_raw IS NOT NULL OR admin_name_raw IS NOT NULL);

    -- Count validation errors (invalid numeric values)
    SELECT COUNT(*) INTO v_validation_errors
    FROM dataset_values_numeric_raw
    WHERE dataset_id = p_dataset_id
      AND value_raw IS NOT NULL
      AND value_raw != ''
      AND NOT (value_raw ~ '^[0-9]+\.?[0-9]*$' OR value_raw ~ '^-?[0-9]+\.?[0-9]*$');

    -- Count covered admin areas
    SELECT COUNT(DISTINCT dvn.admin_pcode) INTO v_covered_count
    FROM dataset_values_numeric dvn
    WHERE dvn.dataset_id = p_dataset_id
      AND EXISTS (
        SELECT 1 FROM admin_boundaries ab
        WHERE ab.admin_pcode = dvn.admin_pcode
          AND (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
      );

  -- Process categorical datasets
  ELSIF v_dataset_type = 'categorical' THEN
    -- Count total raw rows
    SELECT COUNT(*) INTO v_total_rows
    FROM dataset_values_categorical_raw
    WHERE dataset_id = p_dataset_id;

    -- Count matched rows
    SELECT COUNT(DISTINCT admin_pcode) INTO v_matched_rows
    FROM dataset_values_categorical
    WHERE dataset_id = p_dataset_id
      AND admin_pcode IN (SELECT admin_pcode FROM admin_boundaries);

    -- Count valid rows (have pcode or name)
    SELECT COUNT(*) INTO v_valid_rows
    FROM dataset_values_categorical_raw
    WHERE dataset_id = p_dataset_id
      AND (admin_pcode_raw IS NOT NULL OR admin_name_raw IS NOT NULL);

    -- Count unique rows
    SELECT COUNT(DISTINCT COALESCE(admin_pcode_raw, admin_name_raw)) INTO v_unique_rows
    FROM dataset_values_categorical_raw
    WHERE dataset_id = p_dataset_id
      AND (admin_pcode_raw IS NOT NULL OR admin_name_raw IS NOT NULL);

    -- Validation errors for categorical (missing category info)
    SELECT COUNT(*) INTO v_validation_errors
    FROM dataset_values_categorical_raw
    WHERE dataset_id = p_dataset_id
      AND (admin_pcode_raw IS NULL OR admin_pcode_raw = '')
      AND (admin_name_raw IS NULL OR admin_name_raw = '');

    -- Count covered admin areas
    SELECT COUNT(DISTINCT dvc.admin_pcode) INTO v_covered_count
    FROM dataset_values_categorical dvc
    WHERE dvc.dataset_id = p_dataset_id
      AND EXISTS (
        SELECT 1 FROM admin_boundaries ab
        WHERE ab.admin_pcode = dvc.admin_pcode
          AND (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
      );
  END IF;

  -- Calculate rates
  v_alignment_rate := CASE 
    WHEN v_total_rows > 0 THEN v_matched_rows::NUMERIC / v_total_rows::NUMERIC 
    ELSE 0 
  END;

  v_coverage := CASE 
    WHEN v_reference_count > 0 THEN v_covered_count::NUMERIC / v_reference_count::NUMERIC 
    ELSE 0 
  END;

  v_completeness := CASE 
    WHEN v_total_rows > 0 THEN v_valid_rows::NUMERIC / v_total_rows::NUMERIC 
    ELSE 0 
  END;

  v_uniqueness := CASE 
    WHEN v_total_rows > 0 THEN v_unique_rows::NUMERIC / v_total_rows::NUMERIC 
    ELSE 0 
  END;

  -- Build result JSONB
  v_result := jsonb_build_object(
    'alignment_rate', v_alignment_rate,
    'coverage', v_coverage,
    'completeness', v_completeness,
    'uniqueness', v_uniqueness,
    'total_rows', v_total_rows,
    'matched_rows', v_matched_rows,
    'unmatched_rows', v_total_rows - v_matched_rows,
    'valid_rows', v_valid_rows,
    'unique_rows', v_unique_rows,
    'validation_errors', v_validation_errors,
    'reference_count', v_reference_count,
    'covered_count', v_covered_count,
    'percent', v_alignment_rate * 100,
    'matched', v_matched_rows,
    'total', v_total_rows,
    'count', v_total_rows,
    'aligned', v_matched_rows
  );

  -- Update dataset metadata
  UPDATE datasets
  SET metadata = COALESCE(metadata, '{}'::JSONB) || jsonb_build_object('data_health', v_result),
      updated_at = NOW()
  WHERE id = p_dataset_id;

  RETURN v_result;
END;
$$;

