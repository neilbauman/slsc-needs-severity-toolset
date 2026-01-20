-- Compute Data Health Metrics
-- Calculates comprehensive health metrics for a dataset:
-- - Alignment Rate: % of rows with matched PCodes
-- - Coverage: % of reference admin areas covered
-- - Completeness: % of rows with valid values
-- - Uniqueness: % of unique rows
-- - Validation Errors: Count of invalid values

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.compute_data_health(UUID);

CREATE OR REPLACE FUNCTION public.compute_data_health(
  dataset_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_dataset_id UUID; -- Store parameter in local variable to avoid ambiguity
  v_dataset_type TEXT;
  v_admin_level TEXT;
  v_country_id UUID;
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
  -- Store parameter in local variable to avoid column name ambiguity
  v_dataset_id := dataset_id;
  
  -- Get dataset metadata and country_id for data isolation
  SELECT d.type, d.admin_level, d.country_id INTO v_dataset_type, v_admin_level, v_country_id
  FROM datasets d
  WHERE d.id = v_dataset_id;
  
  IF v_dataset_type IS NULL THEN
    RAISE EXCEPTION 'Dataset not found: %', v_dataset_id;
  END IF;

  -- Count reference admin areas at the dataset's admin level (with country isolation)
  SELECT COUNT(*) INTO v_reference_count
  FROM admin_boundaries ab
  WHERE (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
    AND (v_country_id IS NULL OR ab.country_id = v_country_id);

  -- Process numeric datasets
  IF v_dataset_type = 'numeric' THEN
    -- Count total raw rows
    SELECT COUNT(*) INTO v_total_rows
    FROM dataset_values_numeric_raw dvnr
    WHERE dvnr.dataset_id = v_dataset_id;

    -- Count matched rows (rows that have been cleaned and aligned) with country isolation
    -- For numeric, count all rows (not distinct) to match the raw row count
    -- Note: We check if admin_pcode exists in admin_boundaries, with country filtering
    -- Admin level is checked but not strictly enforced (dataset might have mixed levels)
    SELECT COUNT(*) INTO v_matched_rows
    FROM dataset_values_numeric dvn
    WHERE dvn.dataset_id = v_dataset_id
      AND EXISTS (
        SELECT 1 FROM admin_boundaries ab
        WHERE ab.admin_pcode = dvn.admin_pcode
          AND (v_country_id IS NULL OR ab.country_id = v_country_id)
      );
    
    -- If no cleaned data exists, check raw data alignment potential
    -- This shows alignment before cleaning has been run
    IF v_matched_rows = 0 AND v_total_rows > 0 THEN
      -- Check how many raw rows would match admin_boundaries
      SELECT COUNT(*) INTO v_matched_rows
      FROM dataset_values_numeric_raw dvnr
      WHERE dvnr.dataset_id = v_dataset_id
        AND dvnr.admin_pcode IS NOT NULL
        AND dvnr.admin_pcode != ''
        AND EXISTS (
          SELECT 1 FROM admin_boundaries ab
          WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(TRIM(dvnr.admin_pcode))
            AND (v_country_id IS NULL OR ab.country_id = v_country_id)
        );
    END IF;
    
    -- If raw table is empty but cleaned table has data, use cleaned count as baseline
    -- This handles cases where raw data is deleted after successful cleaning
    IF v_total_rows = 0 AND v_matched_rows > 0 THEN
      v_total_rows := v_matched_rows;
    END IF;

    -- Count valid rows (non-null, numeric values)
    -- Note: The raw table stores values as NUMERIC, so we just check for non-null
    SELECT COUNT(*) INTO v_valid_rows
    FROM dataset_values_numeric_raw dvnr
    WHERE dvnr.dataset_id = v_dataset_id
      AND dvnr.value IS NOT NULL
      AND dvnr.admin_pcode IS NOT NULL
      AND dvnr.admin_pcode != '';

    -- Count unique rows (by pcode)
    SELECT COUNT(DISTINCT dvnr.admin_pcode) INTO v_unique_rows
    FROM dataset_values_numeric_raw dvnr
    WHERE dvnr.dataset_id = v_dataset_id
      AND dvnr.admin_pcode IS NOT NULL
      AND dvnr.admin_pcode != '';

    -- Count validation errors (missing pcode or value)
    SELECT COUNT(*) INTO v_validation_errors
    FROM dataset_values_numeric_raw dvnr
    WHERE dvnr.dataset_id = v_dataset_id
      AND (dvnr.admin_pcode IS NULL OR dvnr.admin_pcode = '' OR dvnr.value IS NULL);

    -- Count covered admin areas (with country isolation)
    -- First try cleaned data, then fall back to raw data if no cleaned data exists
    SELECT COUNT(DISTINCT dvn.admin_pcode) INTO v_covered_count
    FROM dataset_values_numeric dvn
    WHERE dvn.dataset_id = v_dataset_id
      AND EXISTS (
        SELECT 1 FROM admin_boundaries ab
        WHERE ab.admin_pcode = dvn.admin_pcode
          AND (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
          AND (v_country_id IS NULL OR ab.country_id = v_country_id)
      );
    
    -- If no cleaned data, check raw data for coverage
    IF v_covered_count = 0 AND v_total_rows > 0 THEN
      SELECT COUNT(DISTINCT dvnr.admin_pcode) INTO v_covered_count
      FROM dataset_values_numeric_raw dvnr
      WHERE dvnr.dataset_id = v_dataset_id
        AND dvnr.admin_pcode IS NOT NULL
        AND dvnr.admin_pcode != ''
        AND EXISTS (
          SELECT 1 FROM admin_boundaries ab
          WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(TRIM(dvnr.admin_pcode))
            AND (v_country_id IS NULL OR ab.country_id = v_country_id)
        );
    END IF;

  -- Process categorical datasets
  ELSIF v_dataset_type = 'categorical' THEN
    -- Count total raw rows (all rows, not distinct pcodes, since categorical can have multiple categories per pcode)
    SELECT COUNT(*) INTO v_total_rows
    FROM dataset_values_categorical_raw dvcr
    WHERE dvcr.dataset_id = v_dataset_id;

    -- Count matched rows (all cleaned rows that match admin boundaries, not just distinct pcodes)
    -- For categorical, we want to count all category rows that were successfully matched
    -- Check if admin_pcode exists in admin_boundaries (with country and admin_level filtering)
    SELECT COUNT(*) INTO v_matched_rows
    FROM dataset_values_categorical dvc
    WHERE dvc.dataset_id = v_dataset_id
      AND EXISTS (
        SELECT 1 FROM admin_boundaries ab
        WHERE ab.admin_pcode = dvc.admin_pcode
          AND (v_country_id IS NULL OR ab.country_id = v_country_id)
          AND (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
      );
    
    -- If no cleaned data exists, check raw data alignment potential
    -- This shows alignment before cleaning has been run
    IF v_matched_rows = 0 AND v_total_rows > 0 THEN
      -- Check how many raw rows would match admin_boundaries
      SELECT COUNT(*) INTO v_matched_rows
      FROM dataset_values_categorical_raw dvcr
      WHERE dvcr.dataset_id = v_dataset_id
        AND dvcr.admin_pcode IS NOT NULL
        AND dvcr.admin_pcode != ''
        AND EXISTS (
          SELECT 1 FROM admin_boundaries ab
          WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(TRIM(dvcr.admin_pcode))
            AND (v_country_id IS NULL OR ab.country_id = v_country_id)
        );
    END IF;
    
    -- If raw table is empty but cleaned table has data, use cleaned count as baseline
    -- This handles cases where raw data is deleted after successful cleaning
    IF v_total_rows = 0 AND v_matched_rows > 0 THEN
      v_total_rows := v_matched_rows;
    END IF;

    -- Count valid rows (have pcode and category)
    SELECT COUNT(*) INTO v_valid_rows
    FROM dataset_values_categorical_raw dvcr
    WHERE dvcr.dataset_id = v_dataset_id
      AND dvcr.admin_pcode IS NOT NULL
      AND dvcr.admin_pcode != ''
      AND dvcr.category IS NOT NULL
      AND dvcr.category != '';

    -- Count unique rows (by pcode and category combination)
    SELECT COUNT(DISTINCT (dvcr.admin_pcode || '|' || dvcr.category)) INTO v_unique_rows
    FROM dataset_values_categorical_raw dvcr
    WHERE dvcr.dataset_id = v_dataset_id
      AND dvcr.admin_pcode IS NOT NULL
      AND dvcr.admin_pcode != ''
      AND dvcr.category IS NOT NULL
      AND dvcr.category != '';

    -- Validation errors for categorical (missing pcode or category)
    SELECT COUNT(*) INTO v_validation_errors
    FROM dataset_values_categorical_raw dvcr
    WHERE dvcr.dataset_id = v_dataset_id
      AND (dvcr.admin_pcode IS NULL OR dvcr.admin_pcode = '')
      AND (dvcr.category IS NULL OR dvcr.category = '');

    -- Count covered admin areas (with country isolation)
    -- First try cleaned data, then fall back to raw data if no cleaned data exists
    SELECT COUNT(DISTINCT dvc.admin_pcode) INTO v_covered_count
    FROM dataset_values_categorical dvc
    WHERE dvc.dataset_id = v_dataset_id
      AND EXISTS (
        SELECT 1 FROM admin_boundaries ab
        WHERE ab.admin_pcode = dvc.admin_pcode
          AND (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
          AND (v_country_id IS NULL OR ab.country_id = v_country_id)
      );
    
    -- If no cleaned data, check raw data for coverage
    IF v_covered_count = 0 AND v_total_rows > 0 THEN
      SELECT COUNT(DISTINCT dvcr.admin_pcode) INTO v_covered_count
      FROM dataset_values_categorical_raw dvcr
      WHERE dvcr.dataset_id = v_dataset_id
        AND dvcr.admin_pcode IS NOT NULL
        AND dvcr.admin_pcode != ''
        AND EXISTS (
          SELECT 1 FROM admin_boundaries ab
          WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(TRIM(dvcr.admin_pcode))
            AND (v_country_id IS NULL OR ab.country_id = v_country_id)
        );
    END IF;
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
  UPDATE datasets d
  SET metadata = COALESCE(d.metadata, '{}'::JSONB) || jsonb_build_object('data_health', v_result),
      updated_at = NOW()
  WHERE d.id = v_dataset_id;

  RETURN v_result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.compute_data_health(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_data_health(UUID) TO anon;
