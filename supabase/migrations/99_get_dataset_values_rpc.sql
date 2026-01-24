-- RPC function to get all dataset values without row limits
-- This bypasses the default PostgREST row limit

CREATE OR REPLACE FUNCTION public.get_dataset_values_all(
  p_dataset_id UUID,
  p_type TEXT DEFAULT 'numeric'
)
RETURNS TABLE (
  admin_pcode TEXT,
  value NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_type = 'numeric' THEN
    RETURN QUERY
    SELECT dv.admin_pcode, dv.value
    FROM dataset_values_numeric dv
    WHERE dv.dataset_id = p_dataset_id;
  ELSE
    RETURN QUERY
    SELECT dv.admin_pcode, dv.value
    FROM dataset_values_categorical dv
    WHERE dv.dataset_id = p_dataset_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.get_dataset_values_all IS 'Returns all dataset values without row limits. Use for large ADM4 datasets.';
