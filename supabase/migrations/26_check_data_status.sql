-- ==============================
-- CHECK DATA STATUS: Verify if raw data exists and why cleaning might have failed
-- ==============================
-- Run this to check a specific dataset's raw data status
-- Replace 'YOUR_DATASET_ID' with the actual dataset UUID

-- Example usage:
-- SELECT * FROM check_data_status('your-dataset-uuid-here');

CREATE OR REPLACE FUNCTION check_data_status(p_dataset_id UUID)
RETURNS TABLE (
  check_type TEXT,
  count_value BIGINT,
  message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_dataset_type TEXT;
  v_admin_level TEXT;
  v_country_id UUID;
  v_raw_count BIGINT := 0;
  v_cleaned_count BIGINT := 0;
  v_raw_sample_count BIGINT := 0;
  v_potential_matches BIGINT := 0;
BEGIN
  -- Get dataset info
  SELECT d.type, d.admin_level, d.country_id 
  INTO v_dataset_type, v_admin_level, v_country_id
  FROM datasets d
  WHERE d.id = p_dataset_id;
  
  IF v_dataset_type IS NULL THEN
    RETURN QUERY SELECT 'ERROR'::TEXT, 0::BIGINT, 'Dataset not found'::TEXT;
    RETURN;
  END IF;
  
  -- Count raw data
  IF v_dataset_type = 'numeric' THEN
    SELECT COUNT(*) INTO v_raw_count
    FROM dataset_values_numeric_raw
    WHERE dataset_id = p_dataset_id;
    
    SELECT COUNT(*) INTO v_cleaned_count
    FROM dataset_values_numeric
    WHERE dataset_id = p_dataset_id;
    
    -- Check if raw PCodes would match admin_boundaries
    SELECT COUNT(*) INTO v_potential_matches
    FROM (
      SELECT DISTINCT TRIM(admin_pcode) AS pcode
      FROM dataset_values_numeric_raw
      WHERE dataset_id = p_dataset_id
        AND admin_pcode IS NOT NULL
        AND admin_pcode != ''
    ) raw_pcodes
    WHERE EXISTS (
      SELECT 1 FROM admin_boundaries ab
      WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(raw_pcodes.pcode)
        AND (v_country_id IS NULL OR ab.country_id = v_country_id)
    );
    
    SELECT COUNT(*) INTO v_raw_sample_count
    FROM (
      SELECT DISTINCT TRIM(admin_pcode) AS pcode
      FROM dataset_values_numeric_raw
      WHERE dataset_id = p_dataset_id
        AND admin_pcode IS NOT NULL
        AND admin_pcode != ''
    ) sub;
  ELSE
    SELECT COUNT(*) INTO v_raw_count
    FROM dataset_values_categorical_raw
    WHERE dataset_id = p_dataset_id;
    
    SELECT COUNT(*) INTO v_cleaned_count
    FROM dataset_values_categorical
    WHERE dataset_id = p_dataset_id;
    
    -- Check if raw PCodes would match admin_boundaries
    SELECT COUNT(*) INTO v_potential_matches
    FROM (
      SELECT DISTINCT TRIM(admin_pcode) AS pcode
      FROM dataset_values_categorical_raw
      WHERE dataset_id = p_dataset_id
        AND admin_pcode IS NOT NULL
        AND admin_pcode != ''
    ) raw_pcodes
    WHERE EXISTS (
      SELECT 1 FROM admin_boundaries ab
      WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(raw_pcodes.pcode)
        AND (v_country_id IS NULL OR ab.country_id = v_country_id)
    );
    
    SELECT COUNT(*) INTO v_raw_sample_count
    FROM (
      SELECT DISTINCT TRIM(admin_pcode) AS pcode
      FROM dataset_values_categorical_raw
      WHERE dataset_id = p_dataset_id
        AND admin_pcode IS NOT NULL
        AND admin_pcode != ''
    ) sub;
  END IF;
  
  -- Return status
  RETURN QUERY SELECT 
    'Dataset Info'::TEXT,
    NULL::BIGINT,
    (v_dataset_type || ' (admin_level: ' || COALESCE(v_admin_level, 'NULL') || ', country_id: ' || COALESCE(v_country_id::TEXT, 'NULL') || ')')::TEXT;
  
  RETURN QUERY SELECT 
    'Raw Data Rows'::TEXT,
    v_raw_count,
    'Number of rows in raw table (this should still exist!)'::TEXT;
  
  RETURN QUERY SELECT 
    'Cleaned Data Rows'::TEXT,
    v_cleaned_count,
    'Number of rows in cleaned table (this was deleted if 0)'::TEXT;
  
  RETURN QUERY SELECT 
    'Distinct Raw PCodes'::TEXT,
    v_raw_sample_count,
    'Number of distinct PCodes in raw data'::TEXT;
  
  RETURN QUERY SELECT 
    'Potential Matches'::TEXT,
    v_potential_matches,
    ('Number of raw PCodes that exist in admin_boundaries for country ' || COALESCE(v_country_id::TEXT, 'any'))::TEXT;
  
  IF v_raw_count > 0 AND v_cleaned_count = 0 THEN
    RETURN QUERY SELECT 
      'STATUS'::TEXT,
      0::BIGINT,
      '⚠️ Raw data exists but cleaned data is missing. You can restore by re-running the cleaning workflow.'::TEXT;
  ELSIF v_raw_count = 0 AND v_cleaned_count = 0 THEN
    RETURN QUERY SELECT 
      'STATUS'::TEXT,
      0::BIGINT,
      '❌ Both raw and cleaned data are missing. Data may have been permanently deleted.'::TEXT;
  ELSIF v_raw_count > 0 AND v_cleaned_count > 0 THEN
    RETURN QUERY SELECT 
      'STATUS'::TEXT,
      v_cleaned_count,
      '✓ Data exists in both raw and cleaned tables.'::TEXT;
  END IF;
  
  IF v_raw_count > 0 AND v_potential_matches = 0 THEN
    RETURN QUERY SELECT 
      'WARNING'::TEXT,
      0::BIGINT,
      '⚠️ Raw PCodes do not match any admin_boundaries. Check country_id and PCode format.'::TEXT;
  ELSIF v_raw_count > 0 AND v_potential_matches < v_raw_sample_count THEN
    RETURN QUERY SELECT 
      'WARNING'::TEXT,
      (v_raw_sample_count - v_potential_matches),
      ('⚠️ Some raw PCodes (' || (v_raw_sample_count - v_potential_matches) || ') do not match admin_boundaries.')::TEXT;
  END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.check_data_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_data_status(UUID) TO anon;
