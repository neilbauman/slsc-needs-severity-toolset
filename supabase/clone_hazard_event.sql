-- ==============================
-- CLONE A HAZARD EVENT INTO ANOTHER INSTANCE
-- ==============================
-- Copies a hazard_events row (geometry + metadata) so tracks can be reused.

CREATE OR REPLACE FUNCTION public.clone_hazard_event(
  p_source_event_id UUID,
  p_target_instance_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_id UUID;
BEGIN
  INSERT INTO public.hazard_events (
    instance_id,
    name,
    description,
    event_type,
    geometry,
    metadata,
    magnitude_field,
    uploaded_by,
    is_shared
  )
  SELECT
    p_target_instance_id,
    CONCAT(name, ' (imported)'),
    description,
    event_type,
    geometry,
    metadata,
    magnitude_field,
    uploaded_by,
    is_shared
  FROM public.hazard_events
  WHERE id = p_source_event_id
  RETURNING id INTO v_new_id;

  IF v_new_id IS NULL THEN
    RAISE EXCEPTION 'Source hazard event % not found', p_source_event_id;
  END IF;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clone_hazard_event(UUID, UUID) TO authenticated;

