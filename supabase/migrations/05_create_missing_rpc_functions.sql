-- ==============================
-- CREATE MISSING RPC FUNCTIONS
-- ==============================
-- Creates the missing RPC functions needed for instance pages
-- Run this in the TARGET database

-- ==============================
-- 1. Create get_affected_adm3 function
-- ==============================
CREATE OR REPLACE FUNCTION public.get_affected_adm3(
  in_scope TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  admin_pcode TEXT,
  name TEXT,
  geom JSONB
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_country_id UUID;
  v_geom_col TEXT;
  v_scope_filtered TEXT[];
BEGIN
  -- Handle NULL or empty scope
  IF in_scope IS NULL THEN
    RETURN;
  END IF;
  
  -- Filter out NULL and empty strings from scope array
  SELECT ARRAY_AGG(DISTINCT elem) INTO v_scope_filtered
  FROM unnest(in_scope) AS elem
  WHERE elem IS NOT NULL AND trim(elem) != '';
  
  -- If no valid codes after filtering, return empty
  IF v_scope_filtered IS NULL OR array_length(v_scope_filtered, 1) = 0 THEN
    RETURN;
  END IF;
  
  -- Get country_id from first admin boundary in scope (they should all be same country)
  SELECT ab.country_id INTO v_country_id
  FROM public.admin_boundaries ab
  WHERE ab.admin_pcode = ANY(v_scope_filtered)
  LIMIT 1;
  
  -- Detect geometry column name (cache it to avoid repeated queries)
  SELECT column_name INTO v_geom_col
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'admin_boundaries'
    AND column_name IN ('geom', 'geometry')
  ORDER BY CASE column_name WHEN 'geom' THEN 1 ELSE 2 END
  LIMIT 1;
  
  -- Default to 'geometry' if neither column found
  IF v_geom_col IS NULL THEN
    v_geom_col := 'geometry';
  END IF;
  
  -- Get ADM3 codes from affected ADM2 areas
  -- Try direct parent_pcode relationship first, then prefix matching
  IF v_geom_col = 'geom' THEN
    RETURN QUERY
    SELECT 
      ab.admin_pcode,
      ab.name,
      CASE WHEN ab.geom IS NOT NULL THEN ST_AsGeoJSON(ab.geom)::jsonb ELSE NULL END AS geom
    FROM public.admin_boundaries ab
    WHERE UPPER(TRIM(ab.admin_level)) = 'ADM3'
      AND (
        ab.parent_pcode = ANY(v_scope_filtered)
        OR EXISTS (
          SELECT 1 
          FROM (SELECT unnest(v_scope_filtered) AS scope_val) AS scope_table
          WHERE ab.admin_pcode LIKE scope_table.scope_val || '%'
        )
      )
      AND (v_country_id IS NULL OR ab.country_id = v_country_id);
  ELSE
    RETURN QUERY
    SELECT 
      ab.admin_pcode,
      ab.name,
      CASE WHEN ab.geometry IS NOT NULL THEN ST_AsGeoJSON(ab.geometry)::jsonb ELSE NULL END AS geom
    FROM public.admin_boundaries ab
    WHERE UPPER(TRIM(ab.admin_level)) = 'ADM3'
      AND (
        ab.parent_pcode = ANY(v_scope_filtered)
        OR EXISTS (
          SELECT 1 
          FROM (SELECT unnest(v_scope_filtered) AS scope_val) AS scope_table
          WHERE ab.admin_pcode LIKE scope_table.scope_val || '%'
        )
      )
      AND (v_country_id IS NULL OR ab.country_id = v_country_id);
  END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_affected_adm3(TEXT[]) TO anon, authenticated;

COMMENT ON FUNCTION public.get_affected_adm3 IS 'Retrieves affected ADM3 administrative areas for given ADM2 scope, with country isolation';

-- ==============================
-- 2. Create get_hazard_events_for_instance function
-- ==============================
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
    CASE
      WHEN he.metadata->'original_geojson' IS NOT NULL THEN
        CASE
          WHEN he.event_type = 'typhoon' AND he.metadata->>'preprocessing_applied' IS NULL THEN
            -- Only filter if preprocessing wasn't done during upload (safety net for old data)
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
        -- Fallback: convert PostGIS geometry to GeoJSON (hazard_events uses 'geometry' column)
        CASE
          WHEN he.geometry IS NOT NULL THEN ST_AsGeoJSON(he.geometry::GEOMETRY)::JSONB
          ELSE NULL
        END
    END AS geojson,
    he.magnitude_field,
    he.metadata,
    he.created_at
  FROM public.hazard_events he
  INNER JOIN public.instances i ON i.id = he.instance_id
  WHERE he.instance_id = in_instance_id
    AND he.country_id = i.country_id
  ORDER BY he.created_at DESC;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_hazard_events_for_instance(UUID) TO anon, authenticated;

COMMENT ON FUNCTION public.get_hazard_events_for_instance IS 'Retrieves hazard events for an instance with GeoJSON geometry, with country isolation';

-- ==============================
-- 3. Optimize get_instance_summary to handle empty data better
-- ==============================
-- Drop and recreate with timeout protection
DROP FUNCTION IF EXISTS public.get_instance_summary(UUID);

CREATE OR REPLACE FUNCTION public.get_instance_summary(
  in_instance_id UUID
)
RETURNS TABLE (
  total_population NUMERIC,
  people_concern NUMERIC,
  people_need NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_instance RECORD;
  v_population_dataset_id UUID;
  v_poverty_dataset_id UUID;
  v_total_pop NUMERIC := 0;
  v_people_concern NUMERIC := 0;
  v_people_need NUMERIC := 0;
  v_admin_scope TEXT[];
  v_country_id UUID;
BEGIN
  -- Get instance configuration
  SELECT 
    population_dataset_id,
    admin_scope,
    country_id
  INTO v_instance
  FROM public.instances
  WHERE id = in_instance_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;
  
  v_population_dataset_id := v_instance.population_dataset_id;
  v_admin_scope := v_instance.admin_scope;
  v_country_id := v_instance.country_id;

  -- If no admin_scope, return zeros immediately
  IF v_admin_scope IS NULL OR array_length(v_admin_scope, 1) = 0 THEN
    RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;

  -- If population_dataset_id is not set, try to find a population dataset automatically
  IF v_population_dataset_id IS NULL THEN
    SELECT id INTO v_population_dataset_id
    FROM public.datasets
    WHERE (name ILIKE '%population%' OR name ILIKE '%pop%')
      AND type = 'numeric'
      AND admin_level IN ('ADM3', 'ADM4')
      AND country_id = v_country_id
    ORDER BY 
      CASE WHEN name ILIKE '%population%' THEN 1 ELSE 2 END,
      created_at DESC
    LIMIT 1;
  END IF;

  -- Find poverty rate dataset (look for dataset with 'poverty' in name)
  SELECT id INTO v_poverty_dataset_id
  FROM public.datasets
  WHERE name ILIKE '%poverty%'
    AND country_id = v_country_id
  LIMIT 1;

  -- Get affected ADM3 codes (with country filter)
  DECLARE
    v_affected_codes TEXT[];
  BEGIN
    -- Get ADM3 codes from affected ADM2 areas
    -- Try direct parent_pcode relationship first
    SELECT ARRAY_AGG(DISTINCT admin_pcode) INTO v_affected_codes
    FROM public.admin_boundaries
    WHERE UPPER(TRIM(admin_level)) = 'ADM3'
      AND parent_pcode = ANY(v_admin_scope)
      AND country_id = v_country_id;
    
    -- If no codes found, try prefix matching
    IF v_affected_codes IS NULL OR array_length(v_affected_codes, 1) = 0 THEN
      SELECT ARRAY_AGG(DISTINCT admin_pcode) INTO v_affected_codes
      FROM public.admin_boundaries
      WHERE UPPER(TRIM(admin_level)) = 'ADM3'
        AND country_id = v_country_id
        AND EXISTS (
          SELECT 1 FROM unnest(v_admin_scope) AS adm2_code
          WHERE admin_pcode LIKE adm2_code || '%'
        );
    END IF;

    -- If no affected codes, return zeros
    IF v_affected_codes IS NULL OR array_length(v_affected_codes, 1) = 0 THEN
      RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC, 0::NUMERIC;
      RETURN;
    END IF;

    -- Calculate total population in affected areas (only if dataset exists)
    IF v_population_dataset_id IS NOT NULL THEN
      DECLARE
        v_pop_admin_level TEXT;
      BEGIN
        -- Get the admin level of the population dataset
        SELECT UPPER(TRIM(admin_level)) INTO v_pop_admin_level
        FROM public.datasets
        WHERE id = v_population_dataset_id;
        
        -- If population is at ADM4 and we need ADM3, aggregate up
        IF v_pop_admin_level = 'ADM4' THEN
          SELECT COALESCE(SUM(dvn.value), 0) INTO v_total_pop
          FROM public.dataset_values_numeric dvn
          INNER JOIN public.datasets d ON d.id = dvn.dataset_id
          INNER JOIN public.admin_boundaries ab4 ON ab4.admin_pcode = dvn.admin_pcode
          INNER JOIN public.admin_boundaries ab3 ON ab3.admin_pcode = ab4.parent_pcode
          WHERE dvn.dataset_id = v_population_dataset_id
            AND UPPER(TRIM(ab4.admin_level)) = 'ADM4'
            AND UPPER(TRIM(ab3.admin_level)) = 'ADM3'
            AND ab3.admin_pcode = ANY(v_affected_codes)
            AND ab4.country_id = v_country_id
            AND ab3.country_id = v_country_id
            AND d.country_id = v_country_id
          LIMIT 10000; -- Safety limit to prevent timeout
        -- If population is at ADM3, direct match
        ELSIF v_pop_admin_level IN ('ADM3', 'adm3') THEN
          SELECT COALESCE(SUM(dvn.value), 0) INTO v_total_pop
          FROM public.dataset_values_numeric dvn
          INNER JOIN public.datasets d ON d.id = dvn.dataset_id
          WHERE dvn.dataset_id = v_population_dataset_id
            AND dvn.admin_pcode = ANY(v_affected_codes)
            AND d.country_id = v_country_id
          LIMIT 10000; -- Safety limit
        END IF;
      END;
    END IF;

    -- Calculate people of concern (only if we have population data and scores exist)
    IF v_population_dataset_id IS NOT NULL THEN
      -- Check if instance_category_scores has data for this instance
      IF EXISTS (SELECT 1 FROM public.instance_category_scores WHERE instance_id = in_instance_id AND category = 'Overall' LIMIT 1) THEN
        DECLARE
          v_pop_admin_level TEXT;
        BEGIN
          SELECT UPPER(TRIM(admin_level)) INTO v_pop_admin_level
          FROM public.datasets
          WHERE id = v_population_dataset_id;
          
          IF v_pop_admin_level = 'ADM4' THEN
            SELECT COALESCE(SUM(dvn.value), 0) INTO v_people_concern
            FROM public.dataset_values_numeric dvn
            INNER JOIN public.datasets d ON d.id = dvn.dataset_id
            INNER JOIN public.admin_boundaries ab4 ON ab4.admin_pcode = dvn.admin_pcode
            INNER JOIN public.admin_boundaries ab3 ON ab3.admin_pcode = ab4.parent_pcode
            INNER JOIN public.instance_category_scores ics ON ics.admin_pcode = ab3.admin_pcode
            WHERE dvn.dataset_id = v_population_dataset_id
              AND UPPER(TRIM(ab4.admin_level)) = 'ADM4'
              AND UPPER(TRIM(ab3.admin_level)) = 'ADM3'
              AND ab3.admin_pcode = ANY(v_affected_codes)
              AND ics.instance_id = in_instance_id
              AND ics.category = 'Overall'
              AND ics.score >= 3.0
              AND ab4.country_id = v_country_id
              AND ab3.country_id = v_country_id
              AND d.country_id = v_country_id
            LIMIT 10000;
          ELSIF v_pop_admin_level = 'ADM3' THEN
            SELECT COALESCE(SUM(dvn.value), 0) INTO v_people_concern
            FROM public.dataset_values_numeric dvn
            INNER JOIN public.datasets d ON d.id = dvn.dataset_id
            INNER JOIN public.instance_category_scores ics ON ics.admin_pcode = dvn.admin_pcode
            WHERE dvn.dataset_id = v_population_dataset_id
              AND dvn.admin_pcode = ANY(v_affected_codes)
              AND ics.instance_id = in_instance_id
              AND ics.category = 'Overall'
              AND ics.score >= 3.0
              AND d.country_id = v_country_id
            LIMIT 10000;
          END IF;
        END;
      END IF;
    END IF;

    -- Calculate people in need (only if we have both population and poverty data and scores exist)
    IF v_population_dataset_id IS NOT NULL AND v_poverty_dataset_id IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.instance_category_scores WHERE instance_id = in_instance_id AND category = 'Overall' LIMIT 1) THEN
        DECLARE
          v_pop_admin_level TEXT;
          v_pov_admin_level TEXT;
        BEGIN
          SELECT UPPER(TRIM(admin_level)) INTO v_pop_admin_level
          FROM public.datasets
          WHERE id = v_population_dataset_id;
          
          SELECT UPPER(TRIM(admin_level)) INTO v_pov_admin_level
          FROM public.datasets
          WHERE id = v_poverty_dataset_id;
          
          IF v_pop_admin_level = 'ADM4' THEN
            SELECT COALESCE(SUM(dvn_pop.value * COALESCE(dvn_pov.value, 0) / 100.0), 0) INTO v_people_need
            FROM public.dataset_values_numeric dvn_pop
            INNER JOIN public.datasets d_pop ON d_pop.id = dvn_pop.dataset_id
            INNER JOIN public.admin_boundaries ab4_pop ON ab4_pop.admin_pcode = dvn_pop.admin_pcode
            INNER JOIN public.admin_boundaries ab3_pop ON ab3_pop.admin_pcode = ab4_pop.parent_pcode
            INNER JOIN public.instance_category_scores ics ON ics.admin_pcode = ab3_pop.admin_pcode
            INNER JOIN public.datasets d_pov ON d_pov.id = v_poverty_dataset_id
            LEFT JOIN public.dataset_values_numeric dvn_pov 
              ON dvn_pov.dataset_id = v_poverty_dataset_id 
              AND (
                (v_pov_admin_level = 'ADM4' AND dvn_pov.admin_pcode = dvn_pop.admin_pcode)
                OR (v_pov_admin_level = 'ADM3' AND dvn_pov.admin_pcode = ab3_pop.admin_pcode)
              )
            WHERE dvn_pop.dataset_id = v_population_dataset_id
              AND UPPER(TRIM(ab4_pop.admin_level)) = 'ADM4'
              AND UPPER(TRIM(ab3_pop.admin_level)) = 'ADM3'
              AND ab3_pop.admin_pcode = ANY(v_affected_codes)
              AND ics.instance_id = in_instance_id
              AND ics.category = 'Overall'
              AND ics.score >= 3.0
              AND ab4_pop.country_id = v_country_id
              AND ab3_pop.country_id = v_country_id
              AND d_pop.country_id = v_country_id
              AND d_pov.country_id = v_country_id
            LIMIT 10000;
          ELSIF v_pop_admin_level = 'ADM3' THEN
            SELECT COALESCE(SUM(dvn_pop.value * COALESCE(dvn_pov.value, 0) / 100.0), 0) INTO v_people_need
            FROM public.dataset_values_numeric dvn_pop
            INNER JOIN public.datasets d_pop ON d_pop.id = dvn_pop.dataset_id
            INNER JOIN public.instance_category_scores ics ON ics.admin_pcode = dvn_pop.admin_pcode
            INNER JOIN public.datasets d_pov ON d_pov.id = v_poverty_dataset_id
            LEFT JOIN public.dataset_values_numeric dvn_pov 
              ON dvn_pov.dataset_id = v_poverty_dataset_id 
              AND dvn_pov.admin_pcode = dvn_pop.admin_pcode
            WHERE dvn_pop.dataset_id = v_population_dataset_id
              AND dvn_pop.admin_pcode = ANY(v_affected_codes)
              AND ics.instance_id = in_instance_id
              AND ics.category = 'Overall'
              AND ics.score >= 3.0
              AND d_pop.country_id = v_country_id
              AND d_pov.country_id = v_country_id
            LIMIT 10000;
          END IF;
        END;
      END IF;
    END IF;
  END;

  RETURN QUERY SELECT 
    COALESCE(v_total_pop, 0)::NUMERIC,
    COALESCE(v_people_concern, 0)::NUMERIC,
    COALESCE(v_people_need, 0)::NUMERIC;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_instance_summary(UUID) TO anon, authenticated;

COMMENT ON FUNCTION public.get_instance_summary IS 'Calculates summary metrics for an instance: total_population, people_concern (severity ≥ 3), and people_need (people_concern × poverty rate). Optimized to handle empty data and prevent timeouts.';
