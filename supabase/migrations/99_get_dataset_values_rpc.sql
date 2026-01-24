-- RPC function to get all dataset values without row limits
-- Returns JSONB to bypass PostgREST row limits completely

CREATE OR REPLACE FUNCTION public.get_dataset_values_json(
  p_dataset_id UUID,
  p_type TEXT DEFAULT 'numeric'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  IF p_type = 'numeric' THEN
    SELECT jsonb_agg(jsonb_build_object('admin_pcode', dv.admin_pcode, 'value', dv.value))
    INTO result
    FROM dataset_values_numeric dv
    WHERE dv.dataset_id = p_dataset_id;
  ELSE
    SELECT jsonb_agg(jsonb_build_object('admin_pcode', dv.admin_pcode, 'value', dv.value))
    INTO result
    FROM dataset_values_categorical dv
    WHERE dv.dataset_id = p_dataset_id;
  END IF;
  
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.get_dataset_values_json IS 'Returns all dataset values as JSON. Bypasses PostgREST row limits for large ADM4 datasets.';
