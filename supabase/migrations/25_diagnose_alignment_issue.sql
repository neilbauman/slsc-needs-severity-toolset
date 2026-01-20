-- ==============================
-- DIAGNOSTIC: Check why alignment shows 0%
-- ==============================
-- Run this with a specific dataset_id to diagnose alignment issues
-- Replace 'YOUR_DATASET_ID' with the actual dataset UUID

-- Example usage:
-- SELECT * FROM diagnose_alignment_issue('your-dataset-uuid-here');

CREATE OR REPLACE FUNCTION diagnose_alignment_issue(p_dataset_id UUID)
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
  v_matched_count BIGINT := 0;
  v_admin_boundaries_count BIGINT := 0;
  v_sample_pcodes TEXT[];
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
    
    -- Get sample PCodes from cleaned data
    SELECT ARRAY_AGG(admin_pcode) INTO v_sample_pcodes
    FROM (
      SELECT DISTINCT admin_pcode
      FROM dataset_values_numeric
      WHERE dataset_id = p_dataset_id
      LIMIT 5
    ) sub;
  ELSE
    SELECT COUNT(*) INTO v_raw_count
    FROM dataset_values_categorical_raw
    WHERE dataset_id = p_dataset_id;
    
    SELECT COUNT(*) INTO v_cleaned_count
    FROM dataset_values_categorical
    WHERE dataset_id = p_dataset_id;
    
    -- Get sample PCodes from cleaned data
    SELECT ARRAY_AGG(admin_pcode) INTO v_sample_pcodes
    FROM (
      SELECT DISTINCT admin_pcode
      FROM dataset_values_categorical
      WHERE dataset_id = p_dataset_id
      LIMIT 5
    ) sub;
  END IF;
  
  -- Count admin boundaries that should match
  SELECT COUNT(*) INTO v_admin_boundaries_count
  FROM admin_boundaries ab
  WHERE (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
    AND (v_country_id IS NULL OR ab.country_id = v_country_id);
  
  -- Count how many cleaned PCodes actually match admin_boundaries
  IF v_dataset_type = 'numeric' THEN
    SELECT COUNT(*) INTO v_matched_count
    FROM dataset_values_numeric dvn
    WHERE dvn.dataset_id = p_dataset_id
      AND EXISTS (
        SELECT 1 FROM admin_boundaries ab
        WHERE ab.admin_pcode = dvn.admin_pcode
          AND (v_country_id IS NULL OR ab.country_id = v_country_id)
          AND (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
      );
  ELSE
    SELECT COUNT(*) INTO v_matched_count
    FROM dataset_values_categorical dvc
    WHERE dvc.dataset_id = p_dataset_id
      AND EXISTS (
        SELECT 1 FROM admin_boundaries ab
        WHERE ab.admin_pcode = dvc.admin_pcode
          AND (v_country_id IS NULL OR ab.country_id = v_country_id)
          AND (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
      );
  END IF;
  
  -- Return diagnostic results
  RETURN QUERY SELECT 
    'Dataset Type'::TEXT,
    NULL::BIGINT,
    (v_dataset_type || ' (admin_level: ' || COALESCE(v_admin_level, 'NULL') || ', country_id: ' || COALESCE(v_country_id::TEXT, 'NULL') || ')')::TEXT;
  
  RETURN QUERY SELECT 
    'Raw Data Rows'::TEXT,
    v_raw_count,
    'Number of rows in raw table'::TEXT;
  
  RETURN QUERY SELECT 
    'Cleaned Data Rows'::TEXT,
    v_cleaned_count,
    'Number of rows in cleaned table'::TEXT;
  
  RETURN QUERY SELECT 
    'Matched Rows'::TEXT,
    v_matched_count,
    'Number of cleaned rows that match admin_boundaries'::TEXT;
  
  RETURN QUERY SELECT 
    'Reference Admin Boundaries'::TEXT,
    v_admin_boundaries_count,
    ('Admin boundaries at level ' || COALESCE(v_admin_level, 'any') || ' for country ' || COALESCE(v_country_id::TEXT, 'any'))::TEXT;
  
  IF v_sample_pcodes IS NOT NULL AND array_length(v_sample_pcodes, 1) > 0 THEN
    RETURN QUERY SELECT 
      'Sample PCodes (Cleaned)'::TEXT,
      array_length(v_sample_pcodes, 1)::BIGINT,
      ('Sample PCodes from cleaned data: ' || array_to_string(v_sample_pcodes, ', '))::TEXT;
    
    -- Check if sample PCodes exist in admin_boundaries
    DECLARE
      v_found_count BIGINT := 0;
      v_pcode TEXT;
    BEGIN
      FOREACH v_pcode IN ARRAY v_sample_pcodes
      LOOP
        SELECT COUNT(*) INTO v_found_count
        FROM admin_boundaries ab
        WHERE ab.admin_pcode = v_pcode
          AND (v_country_id IS NULL OR ab.country_id = v_country_id)
          AND (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level));
        
        IF v_found_count = 0 THEN
          RETURN QUERY SELECT 
            'MISSING PCODE (Cleaned)'::TEXT,
            0::BIGINT,
            ('PCode "' || v_pcode || '" not found in admin_boundaries (level: ' || COALESCE(v_admin_level, 'any') || ', country: ' || COALESCE(v_country_id::TEXT, 'any') || ')')::TEXT;
        END IF;
      END LOOP;
    END;
  END IF;
  
  -- Check raw data and potential matches
  DECLARE
    v_raw_sample_pcodes TEXT[];
    v_potential_matches BIGINT := 0;
    v_raw_pcode TEXT;
  BEGIN
    -- Get sample PCodes from raw data
    IF v_dataset_type = 'numeric' THEN
      SELECT ARRAY_AGG(DISTINCT admin_pcode) INTO v_raw_sample_pcodes
      FROM (
        SELECT DISTINCT TRIM(admin_pcode) AS admin_pcode
        FROM dataset_values_numeric_raw
        WHERE dataset_id = p_dataset_id
          AND admin_pcode IS NOT NULL
          AND admin_pcode != ''
        LIMIT 10
      ) sub;
    ELSE
      SELECT ARRAY_AGG(DISTINCT admin_pcode) INTO v_raw_sample_pcodes
      FROM (
        SELECT DISTINCT TRIM(admin_pcode) AS admin_pcode
        FROM dataset_values_categorical_raw
        WHERE dataset_id = p_dataset_id
          AND admin_pcode IS NOT NULL
          AND admin_pcode != ''
        LIMIT 10
      ) sub;
    END IF;
    
    IF v_raw_sample_pcodes IS NOT NULL AND array_length(v_raw_sample_pcodes, 1) > 0 THEN
      RETURN QUERY SELECT 
        'Raw Data Sample PCodes'::TEXT,
        array_length(v_raw_sample_pcodes, 1)::BIGINT,
        ('Sample PCodes from raw data: ' || array_to_string(v_raw_sample_pcodes, ', '))::TEXT;
      
      -- Check how many raw PCodes would match admin_boundaries
      FOREACH v_raw_pcode IN ARRAY v_raw_sample_pcodes
      LOOP
        -- Check with admin_level filter (as cleaning function does)
        SELECT COUNT(*) INTO v_potential_matches
        FROM admin_boundaries ab
        WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(v_raw_pcode)
          AND (v_country_id IS NULL OR ab.country_id = v_country_id)
          AND (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level));
        
        IF v_potential_matches = 0 THEN
          -- Try without admin_level filter to see if it exists at different level
          SELECT COUNT(*) INTO v_potential_matches
          FROM admin_boundaries ab
          WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(v_raw_pcode)
            AND (v_country_id IS NULL OR ab.country_id = v_country_id);
          
          IF v_potential_matches > 0 THEN
            RETURN QUERY SELECT 
              'RAW PCODE MATCH (wrong level)'::TEXT,
              v_potential_matches,
              ('PCode "' || v_raw_pcode || '" exists in admin_boundaries but at different admin_level. Found at: ' || 
               (SELECT string_agg(DISTINCT ab.admin_level, ', ') FROM admin_boundaries ab 
                WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(v_raw_pcode)
                  AND (v_country_id IS NULL OR ab.country_id = v_country_id)
                LIMIT 1) || 
               ', expected: ' || COALESCE(v_admin_level, 'any'))::TEXT;
          ELSE
            RETURN QUERY SELECT 
              'RAW PCODE NOT FOUND'::TEXT,
              0::BIGINT,
              ('PCode "' || v_raw_pcode || '" not found in admin_boundaries for country ' || COALESCE(v_country_id::TEXT, 'any'))::TEXT;
          END IF;
        ELSE
          RETURN QUERY SELECT 
            'RAW PCODE MATCH'::TEXT,
            v_potential_matches,
            ('PCode "' || v_raw_pcode || '" found in admin_boundaries at correct level')::TEXT;
        END IF;
      END LOOP;
    ELSE
      RETURN QUERY SELECT 
        'Raw Data Status'::TEXT,
        0::BIGINT,
        'No raw data found (raw table is empty - data may have been deleted after cleaning)'::TEXT;
    END IF;
  END;
  
  -- Calculate expected alignment
  DECLARE
    v_expected_alignment NUMERIC;
  BEGIN
    IF v_raw_count > 0 THEN
      v_expected_alignment := (v_matched_count::NUMERIC / v_raw_count::NUMERIC) * 100;
    ELSIF v_cleaned_count > 0 THEN
      v_expected_alignment := (v_matched_count::NUMERIC / v_cleaned_count::NUMERIC) * 100;
    ELSE
      v_expected_alignment := 0;
    END IF;
    
    RETURN QUERY SELECT 
      'Expected Alignment'::TEXT,
      v_matched_count,
      (ROUND(v_expected_alignment, 2)::TEXT || '% (matched: ' || v_matched_count || ', baseline: ' || GREATEST(v_raw_count, v_cleaned_count) || ')')::TEXT;
  END;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.diagnose_alignment_issue(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.diagnose_alignment_issue(UUID) TO anon;
