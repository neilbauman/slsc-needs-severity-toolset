-- ==============================
-- INVESTIGATE DATA LOSS
-- ==============================
-- This function helps investigate what happened to the data
-- Run this to check for any traces of the data

CREATE OR REPLACE FUNCTION investigate_data_loss(p_dataset_id UUID)
RETURNS TABLE (
  check_type TEXT,
  status TEXT,
  message TEXT,
  count_value BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_dataset_name TEXT;
  v_dataset_type TEXT;
  v_created_at TIMESTAMP;
  v_updated_at TIMESTAMP;
  v_raw_numeric_count BIGINT := 0;
  v_raw_categorical_count BIGINT := 0;
  v_cleaned_numeric_count BIGINT := 0;
  v_cleaned_categorical_count BIGINT := 0;
  v_similar_datasets_count BIGINT := 0;
BEGIN
  -- Get dataset info
  SELECT d.name, d.type, d.created_at, d.updated_at
  INTO v_dataset_name, v_dataset_type, v_created_at, v_updated_at
  FROM datasets d
  WHERE d.id = p_dataset_id;
  
  IF v_dataset_name IS NULL THEN
    RETURN QUERY SELECT 
      'ERROR'::TEXT,
      'failed'::TEXT,
      'Dataset not found'::TEXT,
      0::BIGINT;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT 
    'Dataset Info'::TEXT,
    'info'::TEXT,
    ('Name: ' || v_dataset_name || ', Type: ' || v_dataset_type || ', Created: ' || COALESCE(v_created_at::TEXT, 'unknown'))::TEXT,
    0::BIGINT;
  
  -- Check raw numeric data
  SELECT COUNT(*) INTO v_raw_numeric_count
  FROM dataset_values_numeric_raw
  WHERE dataset_id = p_dataset_id;
  
  -- Check raw categorical data
  SELECT COUNT(*) INTO v_raw_categorical_count
  FROM dataset_values_categorical_raw
  WHERE dataset_id = p_dataset_id;
  
  -- Check cleaned numeric data
  SELECT COUNT(*) INTO v_cleaned_numeric_count
  FROM dataset_values_numeric
  WHERE dataset_id = p_dataset_id;
  
  -- Check cleaned categorical data
  SELECT COUNT(*) INTO v_cleaned_categorical_count
  FROM dataset_values_categorical
  WHERE dataset_id = p_dataset_id;
  
  RETURN QUERY SELECT 
    'Raw Numeric Data'::TEXT,
    CASE WHEN v_raw_numeric_count > 0 THEN 'found'::TEXT ELSE 'missing'::TEXT END,
    ('Found ' || v_raw_numeric_count || ' rows')::TEXT,
    v_raw_numeric_count;
  
  RETURN QUERY SELECT 
    'Raw Categorical Data'::TEXT,
    CASE WHEN v_raw_categorical_count > 0 THEN 'found'::TEXT ELSE 'missing'::TEXT END,
    ('Found ' || v_raw_categorical_count || ' rows')::TEXT,
    v_raw_categorical_count;
  
  RETURN QUERY SELECT 
    'Cleaned Numeric Data'::TEXT,
    CASE WHEN v_cleaned_numeric_count > 0 THEN 'found'::TEXT ELSE 'missing'::TEXT END,
    ('Found ' || v_cleaned_numeric_count || ' rows')::TEXT,
    v_cleaned_numeric_count;
  
  RETURN QUERY SELECT 
    'Cleaned Categorical Data'::TEXT,
    CASE WHEN v_cleaned_categorical_count > 0 THEN 'found'::TEXT ELSE 'missing'::TEXT END,
    ('Found ' || v_cleaned_categorical_count || ' rows')::TEXT,
    v_cleaned_categorical_count;
  
  -- Check for similar datasets (same name, different ID - might be a duplicate)
  SELECT COUNT(*) INTO v_similar_datasets_count
  FROM datasets d
  WHERE d.name = v_dataset_name
    AND d.id != p_dataset_id
    AND d.type = v_dataset_type;
  
  IF v_similar_datasets_count > 0 THEN
    RETURN QUERY SELECT 
      'Similar Datasets'::TEXT,
      'warning'::TEXT,
      ('Found ' || v_similar_datasets_count || ' other dataset(s) with the same name. Check if data might be there.')::TEXT,
      v_similar_datasets_count;
    
    -- List the similar datasets
    RETURN QUERY
    SELECT 
      'Similar Dataset ID'::TEXT,
      'info'::TEXT,
      ('ID: ' || d.id::TEXT || ', Created: ' || COALESCE(d.created_at::TEXT, 'unknown'))::TEXT,
      0::BIGINT
    FROM datasets d
    WHERE d.name = v_dataset_name
      AND d.id != p_dataset_id
      AND d.type = v_dataset_type
    ORDER BY d.created_at DESC;
  END IF;
  
  -- Check if there are any recent backups or audit logs
  -- (This would depend on your backup/audit setup)
  
  IF v_raw_numeric_count = 0 AND v_raw_categorical_count = 0 
     AND v_cleaned_numeric_count = 0 AND v_cleaned_categorical_count = 0 THEN
    RETURN QUERY SELECT 
      'CONCLUSION'::TEXT,
      'critical'::TEXT,
      'All data is missing. Raw data should not have been deleted by the cleaning process. Possible causes: manual deletion, cascade delete, or data was never uploaded.'::TEXT,
      0::BIGINT;
  END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.investigate_data_loss(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.investigate_data_loss(UUID) TO anon;

-- Also create a query to check for datasets with similar names that might have the data
CREATE OR REPLACE FUNCTION find_similar_datasets(p_dataset_name TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  type TEXT,
  created_at TIMESTAMP,
  raw_numeric_count BIGINT,
  raw_categorical_count BIGINT,
  cleaned_numeric_count BIGINT,
  cleaned_categorical_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.name,
    d.type,
    d.created_at,
    (SELECT COUNT(*) FROM dataset_values_numeric_raw WHERE dataset_id = d.id) AS raw_numeric_count,
    (SELECT COUNT(*) FROM dataset_values_categorical_raw WHERE dataset_id = d.id) AS raw_categorical_count,
    (SELECT COUNT(*) FROM dataset_values_numeric WHERE dataset_id = d.id) AS cleaned_numeric_count,
    (SELECT COUNT(*) FROM dataset_values_categorical WHERE dataset_id = d.id) AS cleaned_categorical_count
  FROM datasets d
  WHERE LOWER(d.name) LIKE '%' || LOWER(p_dataset_name) || '%'
  ORDER BY d.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_similar_datasets(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_similar_datasets(TEXT) TO anon;
