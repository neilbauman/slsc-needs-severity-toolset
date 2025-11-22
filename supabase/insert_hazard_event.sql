-- ==============================
-- INSERT HAZARD EVENT RPC FUNCTION
-- ==============================
-- Helper function to insert hazard events with proper GeoJSON to PostGIS conversion

CREATE OR REPLACE FUNCTION public.insert_hazard_event(
  p_instance_id UUID,
  p_name TEXT,
  p_geojson JSONB,
  p_description TEXT DEFAULT NULL,
  p_event_type TEXT DEFAULT 'earthquake',
  p_magnitude_field TEXT DEFAULT 'value',
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_hazard_event_id UUID;
  v_geometry GEOGRAPHY;
  v_feature JSONB;
  v_geometries JSONB;
BEGIN
  -- Convert GeoJSON FeatureCollection to PostGIS geometry
  -- For shake maps, we typically have LineString/MultiLineString features
  -- We'll combine them into a GeometryCollection
  
  -- Extract all geometries from features
  v_geometries := (
    SELECT jsonb_agg(f->'geometry')
    FROM jsonb_array_elements(p_geojson->'features') AS f
  );

  -- Create GeometryCollection from all feature geometries
  BEGIN
    v_geometry := ST_GeomFromGeoJSON(
      jsonb_build_object(
        'type', 'GeometryCollection',
        'geometries', v_geometries
      )::text
    )::GEOGRAPHY;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback: try to extract first geometry if GeometryCollection fails
    IF jsonb_array_length(p_geojson->'features') > 0 THEN
      v_feature := p_geojson->'features'->0;
      v_geometry := ST_GeomFromGeoJSON((v_feature->'geometry')::text)::GEOGRAPHY;
    ELSE
      RAISE EXCEPTION 'No features found in GeoJSON';
    END IF;
  END;

  -- Insert hazard event
  INSERT INTO public.hazard_events (
    instance_id,
    name,
    description,
    event_type,
    geometry,
    metadata,
    magnitude_field
  ) VALUES (
    p_instance_id,
    p_name,
    p_description,
    p_event_type,
    v_geometry,
    jsonb_build_object(
      'original_geojson', p_geojson,
      'feature_count', jsonb_array_length(p_geojson->'features')
    ) || COALESCE(p_metadata, '{}'::JSONB),
    p_magnitude_field
  )
  RETURNING id INTO v_hazard_event_id;

  RETURN v_hazard_event_id;
END;
$$;

