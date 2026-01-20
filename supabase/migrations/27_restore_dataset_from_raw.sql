-- ==============================
-- RESTORE DATASET FROM RAW DATA
-- ==============================
-- This function restores cleaned data by re-running the cleaning process
-- on the raw data. Use this if cleaned data was accidentally deleted.
--
-- Example usage:
-- SELECT * FROM restore_dataset_from_raw('your-dataset-id-here');

CREATE OR REPLACE FUNCTION restore_dataset_from_raw(p_dataset_id UUID)
RETURNS TABLE (
  step TEXT,
  status TEXT,
  message TEXT,
  count_value BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_dataset_type TEXT;
  v_admin_level TEXT;
  v_country_id UUID;
  v_raw_count BIGINT := 0;
  v_cleaned_before BIGINT := 0;
  v_cleaned_after BIGINT := 0;
  v_matched_count BIGINT := 0;
  v_unmatched_count BIGINT := 0;
  v_matching_config JSONB;
BEGIN
  -- Get dataset info
  SELECT d.type, d.admin_level, d.country_id 
  INTO v_dataset_type, v_admin_level, v_country_id
  FROM datasets d
  WHERE d.id = p_dataset_id;
  
  IF v_dataset_type IS NULL THEN
    RETURN QUERY SELECT 
      'ERROR'::TEXT,
      'failed'::TEXT,
      'Dataset not found'::TEXT,
      0::BIGINT;
    RETURN;
  END IF;
  
  -- Check raw data exists
  IF v_dataset_type = 'numeric' THEN
    SELECT COUNT(*) INTO v_raw_count
    FROM dataset_values_numeric_raw
    WHERE dataset_id = p_dataset_id;
    
    SELECT COUNT(*) INTO v_cleaned_before
    FROM dataset_values_numeric dvn
    WHERE dvn.dataset_id = p_dataset_id;
  ELSE
    SELECT COUNT(*) INTO v_raw_count
    FROM dataset_values_categorical_raw dvcr
    WHERE dvcr.dataset_id = p_dataset_id;
    
    SELECT COUNT(*) INTO v_cleaned_before
    FROM dataset_values_categorical dvc
    WHERE dvc.dataset_id = p_dataset_id;
  END IF;
  
  RETURN QUERY SELECT 
    'Check Raw Data'::TEXT,
    CASE WHEN v_raw_count > 0 THEN 'found'::TEXT ELSE 'missing'::TEXT END,
    ('Found ' || v_raw_count || ' rows in raw table')::TEXT,
    v_raw_count;
  
  IF v_raw_count = 0 THEN
    RETURN QUERY SELECT 
      'ERROR'::TEXT,
      'failed'::TEXT,
      'No raw data found. Cannot restore. You may need to re-upload the dataset.'::TEXT,
      0::BIGINT;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT 
    'Current Cleaned Data'::TEXT,
    'info'::TEXT,
    ('Currently ' || v_cleaned_before || ' rows in cleaned table')::TEXT,
    v_cleaned_before;
  
  -- Set up matching config (use default settings that are more permissive)
  v_matching_config := jsonb_build_object(
    'exact_match', true,
    'fuzzy_pcode', true,
    'fuzzy_threshold', 0.7,  -- Lower threshold for more matches
    'prefix_match', true,
    'name_match', false,  -- Disable name matching as it's not reliable
    'fuzzy_name', false
  );
  
  -- Run the appropriate cleaning function
  IF v_dataset_type = 'numeric' THEN
    DECLARE
      v_result JSONB;
    BEGIN
      SELECT public.clean_numeric_dataset_v3(p_dataset_id, v_matching_config) INTO v_result;
      
      v_matched_count := COALESCE((v_result->>'matched')::BIGINT, 0);
      v_unmatched_count := COALESCE((v_result->>'unmatched')::BIGINT, 0);
      
      SELECT COUNT(*) INTO v_cleaned_after
      FROM dataset_values_numeric dvn
      WHERE dvn.dataset_id = p_dataset_id;
      
      RETURN QUERY SELECT 
        'Cleaning Result'::TEXT,
        CASE WHEN v_matched_count > 0 THEN 'success'::TEXT ELSE 'warning'::TEXT END,
        ('Matched: ' || v_matched_count || ', Unmatched: ' || v_unmatched_count)::TEXT,
        v_matched_count;
    END;
  ELSE
    DECLARE
      v_result JSONB;
    BEGIN
      SELECT public.clean_categorical_dataset_v3(p_dataset_id, v_matching_config) INTO v_result;
      
      v_matched_count := COALESCE((v_result->>'matched')::BIGINT, 0);
      v_unmatched_count := COALESCE((v_result->>'unmatched')::BIGINT, 0);
      
      SELECT COUNT(*) INTO v_cleaned_after
      FROM dataset_values_categorical dvc
      WHERE dvc.dataset_id = p_dataset_id;
      
      RETURN QUERY SELECT 
        'Cleaning Result'::TEXT,
        CASE WHEN v_matched_count > 0 THEN 'success'::TEXT ELSE 'warning'::TEXT END,
        ('Matched: ' || v_matched_count || ', Unmatched: ' || v_unmatched_count)::TEXT,
        v_matched_count;
    END;
  END IF;
  
  RETURN QUERY SELECT 
    'Restored Cleaned Data'::TEXT,
    CASE WHEN v_cleaned_after > v_cleaned_before THEN 'success'::TEXT ELSE 'info'::TEXT END,
    ('Now ' || v_cleaned_after || ' rows in cleaned table (was ' || v_cleaned_before || ')')::TEXT,
    v_cleaned_after;
  
  -- Recompute data health
  BEGIN
    PERFORM public.compute_data_health(p_dataset_id);
    RETURN QUERY SELECT 
      'Data Health'::TEXT,
      'updated'::TEXT,
      'Data health metrics have been recomputed'::TEXT,
      0::BIGINT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 
      'Data Health'::TEXT,
      'warning'::TEXT,
      ('Could not recompute data health: ' || SQLERRM)::TEXT,
      0::BIGINT;
  END;
  
  IF v_matched_count = 0 AND v_unmatched_count > 0 THEN
    RETURN QUERY SELECT 
      'WARNING'::TEXT,
      'warning'::TEXT,
      'No matches found. Check that PCodes in raw data exist in admin_boundaries for the correct country.'::TEXT,
      0::BIGINT;
  END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.restore_dataset_from_raw(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_dataset_from_raw(UUID) TO anon;
