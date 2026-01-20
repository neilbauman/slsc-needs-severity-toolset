-- ==============================
-- FIX GEOJSON VIEW FOR MAP DISPLAY
-- ==============================
-- Updates v_instance_admin_scores_geojson to work even when scores don't exist yet
-- Also creates a view that shows geometry for affected areas regardless of scores

-- Drop and recreate the view to handle cases where scores may not exist
DROP VIEW IF EXISTS public.v_instance_admin_scores_geojson;

-- Check which geometry column exists and create view accordingly
DO $$
DECLARE
  has_geom BOOLEAN := FALSE;
  has_geometry BOOLEAN := FALSE;
BEGIN
  -- Check if 'geom' column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'admin_boundaries'
      AND column_name = 'geom'
  ) INTO has_geom;
  
  -- Check if 'geometry' column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'admin_boundaries'
      AND column_name = 'geometry'
  ) INTO has_geometry;
  
  -- Create view based on which column exists
  -- Use same logic as get_affected_adm3 for consistency (but without LATERAL to avoid view issues)
  IF has_geom THEN
    EXECUTE '
    CREATE OR REPLACE VIEW public.v_instance_admin_scores_geojson AS
    SELECT DISTINCT
      i.id AS instance_id,
      ab.admin_pcode,
      ST_AsGeoJSON(ab.geom)::jsonb AS geojson
    FROM public.instances i
    INNER JOIN public.admin_boundaries ab 
      ON ab.country_id = i.country_id
      AND UPPER(TRIM(ab.admin_level)) = ''ADM3''
      AND ab.geom IS NOT NULL
      AND (
        -- Direct parent_pcode match (same as get_affected_adm3)
        (i.admin_scope IS NOT NULL AND array_length(i.admin_scope, 1) > 0 AND ab.parent_pcode = ANY(i.admin_scope))
        OR
        -- Prefix match (fallback, same as get_affected_adm3)
        (i.admin_scope IS NOT NULL AND array_length(i.admin_scope, 1) > 0 AND EXISTS (
          SELECT 1 
          FROM (SELECT unnest(i.admin_scope) AS scope_val) AS scope_table
          WHERE ab.admin_pcode LIKE scope_table.scope_val || ''%''
        ))
      )';
  ELSIF has_geometry THEN
    EXECUTE '
    CREATE OR REPLACE VIEW public.v_instance_admin_scores_geojson AS
    SELECT DISTINCT
      i.id AS instance_id,
      ab.admin_pcode,
      ST_AsGeoJSON(ab.geometry)::jsonb AS geojson
    FROM public.instances i
    INNER JOIN public.admin_boundaries ab 
      ON ab.country_id = i.country_id
      AND UPPER(TRIM(ab.admin_level)) = ''ADM3''
      AND ab.geometry IS NOT NULL
      AND (
        -- Direct parent_pcode match (same as get_affected_adm3)
        (i.admin_scope IS NOT NULL AND array_length(i.admin_scope, 1) > 0 AND ab.parent_pcode = ANY(i.admin_scope))
        OR
        -- Prefix match (fallback, same as get_affected_adm3)
        (i.admin_scope IS NOT NULL AND array_length(i.admin_scope, 1) > 0 AND EXISTS (
          SELECT 1 
          FROM (SELECT unnest(i.admin_scope) AS scope_val) AS scope_table
          WHERE ab.admin_pcode LIKE scope_table.scope_val || ''%''
        ))
      )';
  ELSE
    -- No geometry column found - create empty view
    EXECUTE '
    CREATE OR REPLACE VIEW public.v_instance_admin_scores_geojson AS
    SELECT 
      NULL::UUID AS instance_id,
      NULL::TEXT AS admin_pcode,
      NULL::jsonb AS geojson
    WHERE FALSE';
    
    RAISE WARNING 'No geometry column found in admin_boundaries table. View created but will return no rows.';
  END IF;
END $$;

-- Grant permissions
GRANT SELECT ON public.v_instance_admin_scores_geojson TO anon, authenticated;

COMMENT ON VIEW public.v_instance_admin_scores_geojson IS 'Provides GeoJSON geometry for admin areas in affected scope, with optional scores. Shows geometry even if scores have not been calculated yet.';

-- Create a diagnostic function to check what data exists
CREATE OR REPLACE FUNCTION public.diagnose_map_data(
  in_instance_id UUID
)
RETURNS TABLE (
  check_type TEXT,
  count_value BIGINT,
  message TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_country_id UUID;
  v_admin_scope TEXT[];
  v_affected_count BIGINT;
  v_geometry_count BIGINT;
  v_scores_count BIGINT;
  v_geojson_count BIGINT;
BEGIN
  -- Get instance info
  SELECT country_id, admin_scope INTO v_country_id, v_admin_scope
  FROM public.instances
  WHERE id = in_instance_id;
  
  IF v_country_id IS NULL THEN
    RETURN QUERY SELECT 'ERROR'::TEXT, 0::BIGINT, 'Instance not found'::TEXT;
    RETURN;
  END IF;
  
  -- Count affected ADM3 areas
  SELECT COUNT(DISTINCT admin_pcode) INTO v_affected_count
  FROM public.admin_boundaries
  WHERE UPPER(TRIM(admin_level)) = 'ADM3'
    AND country_id = v_country_id
    AND (
      (v_admin_scope IS NOT NULL AND parent_pcode = ANY(v_admin_scope))
      OR
      (v_admin_scope IS NOT NULL AND EXISTS (
        SELECT 1 FROM unnest(v_admin_scope) AS adm2_code
        WHERE admin_pcode LIKE adm2_code || '%'
      ))
    );
  
  RETURN QUERY SELECT 
    'Affected ADM3 Areas'::TEXT,
    v_affected_count,
    'Number of ADM3 areas in affected scope'::TEXT;
  
  -- Count areas with geometry (check which column exists first)
  DECLARE
    has_geom_col BOOLEAN := FALSE;
    has_geometry_col BOOLEAN := FALSE;
  BEGIN
    -- Check which geometry column exists
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'admin_boundaries' AND column_name = 'geom'
    ) INTO has_geom_col;
    
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'admin_boundaries' AND column_name = 'geometry'
    ) INTO has_geometry_col;
    
    -- Count based on which column exists
    IF has_geom_col THEN
      SELECT COUNT(DISTINCT ab.admin_pcode) INTO v_geometry_count
      FROM public.admin_boundaries ab
      WHERE UPPER(TRIM(ab.admin_level)) = 'ADM3'
        AND ab.country_id = v_country_id
        AND (
          (v_admin_scope IS NOT NULL AND ab.parent_pcode = ANY(v_admin_scope))
          OR
          (v_admin_scope IS NOT NULL AND EXISTS (
            SELECT 1 FROM unnest(v_admin_scope) AS adm2_code
            WHERE ab.admin_pcode LIKE adm2_code || '%'
          ))
        )
        AND ab.geom IS NOT NULL;
    ELSIF has_geometry_col THEN
      SELECT COUNT(DISTINCT ab.admin_pcode) INTO v_geometry_count
      FROM public.admin_boundaries ab
      WHERE UPPER(TRIM(ab.admin_level)) = 'ADM3'
        AND ab.country_id = v_country_id
        AND (
          (v_admin_scope IS NOT NULL AND ab.parent_pcode = ANY(v_admin_scope))
          OR
          (v_admin_scope IS NOT NULL AND EXISTS (
            SELECT 1 FROM unnest(v_admin_scope) AS adm2_code
            WHERE ab.admin_pcode LIKE adm2_code || '%'
          ))
        )
        AND ab.geometry IS NOT NULL;
    ELSE
      v_geometry_count := 0;
    END IF;
  END;
  
  RETURN QUERY SELECT 
    'Areas with Geometry'::TEXT,
    v_geometry_count,
    'Number of affected areas with geometry data'::TEXT;
  
  -- Count areas with Overall scores
  SELECT COUNT(DISTINCT admin_pcode) INTO v_scores_count
  FROM public.instance_category_scores
  WHERE instance_id = in_instance_id
    AND category = 'Overall';
  
  RETURN QUERY SELECT 
    'Areas with Overall Scores'::TEXT,
    v_scores_count,
    'Number of areas with calculated Overall scores'::TEXT;
  
  -- Count what the view would return
  SELECT COUNT(*) INTO v_geojson_count
  FROM public.v_instance_admin_scores_geojson
  WHERE instance_id = in_instance_id;
  
  RETURN QUERY SELECT 
    'GeoJSON View Rows'::TEXT,
    v_geojson_count,
    'Number of rows returned by v_instance_admin_scores_geojson view'::TEXT;
  
  -- Summary message
  IF v_geojson_count = 0 THEN
    IF v_geometry_count = 0 THEN
      RETURN QUERY SELECT 
        'ISSUE'::TEXT,
        0::BIGINT,
        'No geometry data found for affected areas. Check admin_boundaries table.'::TEXT;
    ELSIF v_admin_scope IS NULL OR array_length(v_admin_scope, 1) = 0 THEN
      RETURN QUERY SELECT 
        'ISSUE'::TEXT,
        0::BIGINT,
        'Instance has no admin_scope defined. Define affected area first.'::TEXT;
    ELSE
      RETURN QUERY SELECT 
        'INFO'::TEXT,
        0::BIGINT,
        'Geometry exists but view returns no rows. Check view definition.'::TEXT;
    END IF;
  ELSE
    RETURN QUERY SELECT 
      'SUCCESS'::TEXT,
      v_geojson_count,
      'Map data is available. View should work correctly.'::TEXT;
  END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.diagnose_map_data(UUID) TO anon, authenticated;

COMMENT ON FUNCTION public.diagnose_map_data IS 'Diagnostic function to check why map data might not be showing. Returns counts of affected areas, geometry data, scores, and view rows.';
