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
    -- For typhoon events, filter out Polygon features if they still exist
    -- Optimization: Only filter if preprocessing wasn't already applied
    CASE
      WHEN he.metadata->'original_geojson' IS NOT NULL THEN
        CASE
          WHEN he.event_type = 'typhoon' AND he.metadata->>'preprocessing_applied' IS NULL THEN
            -- Only filter if preprocessing wasn't done during upload (safety net for old data)
            -- Check if polygons exist first to avoid unnecessary processing
            CASE
              WHEN EXISTS (
                SELECT 1 
                FROM jsonb_array_elements(he.metadata->'original_geojson'->'features') AS feature
                WHERE LOWER(COALESCE(feature->'geometry'->>'type', '')) IN ('polygon', 'multipolygon')
                LIMIT 1
              ) THEN
                -- Filter out Polygon/MultiPolygon features for typhoons (keep only track)
                jsonb_build_object(
                  'type', 'FeatureCollection',
                  'features', (
                    SELECT jsonb_agg(feature)
                    FROM jsonb_array_elements(he.metadata->'original_geojson'->'features') AS feature
                    WHERE LOWER(COALESCE(feature->'geometry'->>'type', '')) IN ('linestring', 'multilinestring', 'point', 'multipoint')
                  )
                )
              ELSE
                -- No polygons found, return as-is
                he.metadata->'original_geojson'
            END
          ELSE
            -- Not a typhoon, or preprocessing already applied - return as-is
            he.metadata->'original_geojson'
        END
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

