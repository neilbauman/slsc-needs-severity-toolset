-- ==============================
-- CREATE ADMIN BOUNDARIES RPC FUNCTIONS
-- ==============================
-- These functions retrieve administrative boundaries for mapping
-- Updated to support country isolation

-- Function: get_admin_boundaries_geojson
-- Returns admin boundaries as GeoJSON FeatureCollection
CREATE OR REPLACE FUNCTION public.get_admin_boundaries_geojson(
  admin_pcodes TEXT[] DEFAULT NULL,
  admin_level TEXT DEFAULT NULL,
  parent_pcode TEXT DEFAULT NULL,
  country_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  features JSONB;
  v_country_id UUID := country_id;
  v_admin_level TEXT := admin_level;
  v_parent_pcode TEXT := parent_pcode;
  v_admin_pcodes TEXT[] := admin_pcodes;
BEGIN
  SELECT jsonb_build_object(
    'type', 'FeatureCollection',
    'features', COALESCE(jsonb_agg(
      jsonb_build_object(
        'type', 'Feature',
        'geometry', ST_AsGeoJSON(ab.geometry)::jsonb,
        'properties', jsonb_build_object(
          'admin_pcode', ab.admin_pcode,
          'admin_level', ab.admin_level,
          'name', ab.name,
          'parent_pcode', ab.parent_pcode
        )
      )
    ), '[]'::jsonb)
  )
  INTO features
  FROM admin_boundaries ab
  WHERE (v_country_id IS NULL OR ab.country_id = v_country_id)
    AND (v_admin_level IS NULL OR ab.admin_level = v_admin_level)
    AND (v_parent_pcode IS NULL OR ab.parent_pcode = v_parent_pcode)
    AND (v_admin_pcodes IS NULL OR array_length(v_admin_pcodes, 1) = 0 OR ab.admin_pcode = ANY(v_admin_pcodes));
  
  RETURN COALESCE(features, jsonb_build_object('type', 'FeatureCollection', 'features', '[]'::jsonb));
END;
$$;

-- Function: get_admin_boundaries_list
-- Returns list of admin boundaries with metadata
-- Note: Supports both old parameter names (in_level) and new ones (in_admin_level) for compatibility
CREATE OR REPLACE FUNCTION public.get_admin_boundaries_list(
  in_level TEXT DEFAULT NULL,
  in_admin_level TEXT DEFAULT NULL,
  in_parent_pcode TEXT DEFAULT NULL,
  in_search TEXT DEFAULT NULL,
  in_country_id UUID DEFAULT NULL
)
RETURNS TABLE (
  admin_pcode TEXT,
  admin_level TEXT,
  name TEXT,
  parent_pcode TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ab.admin_pcode,
    ab.admin_level,
    ab.name,
    ab.parent_pcode
  FROM admin_boundaries ab
  WHERE (in_country_id IS NULL OR ab.country_id = in_country_id)
    AND (COALESCE(in_admin_level, in_level) IS NULL OR ab.admin_level = COALESCE(in_admin_level, in_level))
    AND (in_parent_pcode IS NULL OR ab.parent_pcode = in_parent_pcode)
    AND (in_search IS NULL OR ab.name ILIKE '%' || in_search || '%')
  ORDER BY ab.admin_level, ab.name;
END;
$$;

COMMENT ON FUNCTION public.get_admin_boundaries_geojson IS 'Returns admin boundaries as GeoJSON. Supports country isolation via country_id parameter.';
COMMENT ON FUNCTION public.get_admin_boundaries_list IS 'Returns list of admin boundaries with metadata. Supports country isolation via country_id parameter.';
