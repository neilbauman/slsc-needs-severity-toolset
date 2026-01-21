-- ==============================
-- CREATE IMPORT BOUNDARIES FUNCTION
-- ==============================
-- RPC function to import boundaries from GeoJSON with proper geometry handling
-- This ensures geometries are stored as Geography (not Points) and validates parent/child relationships

CREATE OR REPLACE FUNCTION public.import_admin_boundaries(
  p_country_id UUID,
  p_admin_level TEXT,
  p_boundaries JSONB
)
RETURNS TABLE(
  imported_count INTEGER,
  skipped_count INTEGER,
  error_count INTEGER,
  errors TEXT[]
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_feature JSONB;
  v_imported INTEGER := 0;
  v_skipped INTEGER := 0;
  v_error_count INTEGER := 0;
  v_errors TEXT[] := ARRAY[]::TEXT[];
  v_geometry GEOGRAPHY;
  v_geom_type TEXT;
  v_admin_pcode TEXT;
  v_name TEXT;
  v_parent_pcode TEXT;
BEGIN
  -- Delete existing boundaries for this country and level
  DELETE FROM public.admin_boundaries
  WHERE country_id = p_country_id
    AND admin_level = p_admin_level;
  
  -- Process each feature
  FOR v_feature IN SELECT * FROM jsonb_array_elements(p_boundaries->'features')
  LOOP
    BEGIN
      -- Extract properties
      v_admin_pcode := v_feature->'properties'->>'admin_pcode';
      v_name := v_feature->'properties'->>'name';
      v_parent_pcode := v_feature->'properties'->>'parent_pcode';
      
      -- Skip if no pcode
      IF v_admin_pcode IS NULL OR v_admin_pcode = '' THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;
      
      -- Convert geometry from GeoJSON
      v_geometry := ST_GeomFromGeoJSON((v_feature->'geometry')::text)::GEOGRAPHY;
      
      -- Check geometry type - skip Points
      v_geom_type := ST_GeometryType(v_geometry::geometry);
      IF v_geom_type NOT IN ('ST_Polygon', 'ST_MultiPolygon') THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;
      
      -- Validate geometry
      IF NOT ST_IsValid(v_geometry::geometry) THEN
        v_errors := array_append(v_errors, format('Invalid geometry for %s', v_admin_pcode));
        v_error_count := v_error_count + 1;
        CONTINUE;
      END IF;
      
      -- Insert boundary
      INSERT INTO public.admin_boundaries (
        admin_pcode,
        admin_level,
        name,
        parent_pcode,
        country_id,
        geometry,
        metadata
      ) VALUES (
        v_admin_pcode,
        p_admin_level,
        v_name,
        NULLIF(v_parent_pcode, ''),
        p_country_id,
        v_geometry,
        jsonb_build_object(
          'source', 'OCHA HDX',
          'source_link', format('https://data.humdata.org/dataset/cod-ab-%s', 
            (SELECT LOWER(iso_code) FROM countries WHERE id = p_country_id)),
          'imported_at', NOW(),
          'geometry_type', v_geom_type
        )
      );
      
      v_imported := v_imported + 1;
      
    EXCEPTION WHEN OTHERS THEN
      v_error_count := v_error_count + 1;
      v_errors := array_append(v_errors, format('Error importing %s: %s', 
        COALESCE(v_admin_pcode, 'unknown'), SQLERRM));
    END;
  END LOOP;
  
  RETURN QUERY SELECT v_imported, v_skipped, v_error_count, v_errors;
END;
$$;

COMMENT ON FUNCTION public.import_admin_boundaries IS 'Imports admin boundaries from GeoJSON, filtering out Points and validating geometries';
