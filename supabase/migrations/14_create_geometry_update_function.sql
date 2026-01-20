-- ==============================
-- CREATE FUNCTION TO UPDATE GEOMETRY FROM GEOJSON
-- ==============================
-- This function allows updating geometry columns from GeoJSON data
-- Used by the migration script to transfer geometry data

CREATE OR REPLACE FUNCTION public.update_admin_boundary_geometry(
  p_admin_pcode TEXT,
  p_country_id UUID,
  p_geojson JSONB,
  p_geom_col TEXT DEFAULT 'geometry'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_geom_type TEXT;
BEGIN
  -- Validate inputs
  IF p_admin_pcode IS NULL OR p_country_id IS NULL OR p_geojson IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Determine which geometry column to use
  IF p_geom_col = 'geom' THEN
    -- Update using geom column
    UPDATE public.admin_boundaries
    SET geom = ST_GeomFromGeoJSON(p_geojson::text)
    WHERE admin_pcode = p_admin_pcode
      AND country_id = p_country_id;
  ELSIF p_geom_col = 'geometry' THEN
    -- Update using geometry column
    UPDATE public.admin_boundaries
    SET geometry = ST_GeomFromGeoJSON(p_geojson::text)
    WHERE admin_pcode = p_admin_pcode
      AND country_id = p_country_id;
  ELSE
    RETURN FALSE;
  END IF;
  
  RETURN FOUND;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail
    RAISE WARNING 'Error updating geometry for %: %', p_admin_pcode, SQLERRM;
    RETURN FALSE;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.update_admin_boundary_geometry(TEXT, UUID, JSONB, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.update_admin_boundary_geometry IS 'Updates admin_boundary geometry from GeoJSON. Used for geometry data migration.';
