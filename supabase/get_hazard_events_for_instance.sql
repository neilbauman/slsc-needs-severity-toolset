-- ==============================
-- GET HAZARD EVENTS FOR INSTANCE RPC FUNCTION
-- ==============================
-- Retrieves hazard events for an instance with GeoJSON geometry

CREATE OR REPLACE FUNCTION public.get_hazard_events_for_instance(
  in_instance_id UUID
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  event_type TEXT,
  geojson JSONB,
  magnitude_field TEXT,
  metadata JSONB,
  created_at TIMESTAMP
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    he.id,
    he.name,
    he.description,
    he.event_type,
    -- Convert PostGIS geometry back to GeoJSON
    CASE
      WHEN he.metadata->'original_geojson' IS NOT NULL THEN
        he.metadata->'original_geojson'
      ELSE
        -- Fallback: convert PostGIS geometry to GeoJSON
        ST_AsGeoJSON(he.geometry::GEOMETRY)::JSONB
    END AS geojson,
    he.magnitude_field,
    he.metadata,
    he.created_at
  FROM public.hazard_events he
  WHERE he.instance_id = in_instance_id
  ORDER BY he.created_at DESC;
END;
$$;

