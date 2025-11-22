-- ==============================
-- SCORE HAZARD EVENT RPC FUNCTION
-- ==============================
-- Calculates vulnerability scores for admin areas based on hazard event magnitude
-- Uses centroid of admin boundaries to find nearest shake map contour

CREATE OR REPLACE FUNCTION public.score_hazard_event(
  in_hazard_event_id UUID,
  in_instance_id UUID,
  in_magnitude_ranges JSONB,
  in_limit_to_affected BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_hazard_event RECORD;
  v_admin_pcode TEXT;
  v_admin_centroid GEOGRAPHY;
  v_magnitude_value NUMERIC;
  v_score NUMERIC;
  v_range JSONB;
  v_contour_geom GEOGRAPHY;
  v_min_distance NUMERIC;
  v_nearest_magnitude NUMERIC;
  v_scored_count INTEGER := 0;
  v_total_score NUMERIC := 0;
  v_affected_pcodes TEXT[];
  v_geom_column TEXT;
  v_boundary_geom GEOGRAPHY;
  v_total_admin_areas INTEGER := 0;
  v_processed_count INTEGER := 0;
  v_skipped_no_geom INTEGER := 0;
  v_skipped_no_magnitude INTEGER := 0;
BEGIN
  -- Load hazard event
  SELECT * INTO v_hazard_event
  FROM public.hazard_events
  WHERE id = in_hazard_event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Hazard event not found'
    );
  END IF;

  -- Get affected admin areas if limiting
  -- Affected areas are stored in instances.admin_scope as an array
  IF in_limit_to_affected THEN
    SELECT admin_scope INTO v_affected_pcodes
    FROM public.instances
    WHERE id = in_instance_id;
    
    -- If admin_scope is NULL or empty, set to empty array
    IF v_affected_pcodes IS NULL THEN
      v_affected_pcodes := ARRAY[]::TEXT[];
    END IF;
  END IF;

  -- Extract geometries from hazard event metadata
  -- The geometry is stored as a GeometryCollection in PostGIS
  -- We need to extract individual features to find nearest contour

  -- First, determine which geometry column exists in admin_boundaries
  SELECT column_name INTO v_geom_column
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'admin_boundaries'
    AND column_name IN ('geom', 'geometry')
  ORDER BY CASE column_name WHEN 'geom' THEN 1 ELSE 2 END
  LIMIT 1;
  
  -- If no geometry column found, we can't proceed
  IF v_geom_column IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'No geometry column found in admin_boundaries table (expected ''geom'' or ''geometry'')',
      'scored_locations', 0,
      'average_score', 0
    );
  END IF;
  
  -- Debug: Log geometry column found
  RAISE NOTICE 'Using geometry column: %', v_geom_column;

  -- Count total admin areas to process
  SELECT COUNT(*) INTO v_total_admin_areas
  FROM public.admin_boundaries ab
  WHERE ab.admin_level = 'ADM3'
    AND (
      NOT in_limit_to_affected
      OR ab.admin_pcode = ANY(v_affected_pcodes)
    );
  
  RAISE NOTICE 'Processing % admin areas (limit_to_affected: %)', v_total_admin_areas, in_limit_to_affected;
  IF in_limit_to_affected THEN
    RAISE NOTICE 'Affected area codes count: %', COALESCE(array_length(v_affected_pcodes, 1), 0);
  END IF;

  -- For each admin area, find the nearest contour and extract magnitude
  FOR v_admin_pcode IN
    SELECT DISTINCT ab.admin_pcode
    FROM public.admin_boundaries ab
    WHERE ab.admin_level = 'ADM3'
      AND (
        NOT in_limit_to_affected
        OR ab.admin_pcode = ANY(v_affected_pcodes)
      )
  LOOP
    v_processed_count := v_processed_count + 1;
    -- Get geometry for this admin boundary using the detected column name
    IF v_geom_column = 'geom' THEN
      SELECT geom::GEOGRAPHY INTO v_boundary_geom
      FROM public.admin_boundaries
      WHERE admin_pcode = v_admin_pcode AND admin_level = 'ADM3'
      LIMIT 1;
    ELSE
      SELECT geometry::GEOGRAPHY INTO v_boundary_geom
      FROM public.admin_boundaries
      WHERE admin_pcode = v_admin_pcode AND admin_level = 'ADM3'
      LIMIT 1;
    END IF;
    
    -- If no geometry, skip this admin area
    IF v_boundary_geom IS NULL THEN
      v_skipped_no_geom := v_skipped_no_geom + 1;
      IF v_processed_count <= 5 THEN
        RAISE NOTICE 'Skipping admin_pcode %: no geometry found', v_admin_pcode;
      END IF;
      CONTINUE;
    END IF;
    
    -- Calculate centroid of admin boundary
    BEGIN
      v_admin_centroid := ST_Centroid(v_boundary_geom);
    EXCEPTION WHEN OTHERS THEN
      CONTINUE; -- Skip if centroid calculation fails
    END;

    -- Find nearest contour line from hazard event geometry
    -- The geometry is stored as a GeometryCollection, so we need to:
    -- 1. Extract individual geometries
    -- 2. Find the one closest to the centroid
    -- 3. Extract magnitude from that contour's properties

    -- For now, we'll use a distance-based approach
    -- Since we stored the entire FeatureCollection, we need to extract from metadata
    v_min_distance := NULL;
    v_nearest_magnitude := NULL;

    -- Extract magnitude from metadata's original_geojson
    -- Find the feature whose geometry is closest to the centroid
    IF v_hazard_event.metadata IS NOT NULL AND v_hazard_event.metadata->'original_geojson' IS NOT NULL THEN
      DECLARE
        v_feature JSONB;
        v_feature_geom GEOGRAPHY;
        v_distance NUMERIC;
        v_magnitude_field TEXT;
      BEGIN
        v_magnitude_field := COALESCE(v_hazard_event.magnitude_field, 'value');

        -- Iterate through features in the GeoJSON
        FOR v_feature IN
          SELECT * FROM jsonb_array_elements(v_hazard_event.metadata->'original_geojson'->'features')
        LOOP
          -- Convert feature geometry to PostGIS
          BEGIN
            v_feature_geom := ST_GeomFromGeoJSON((v_feature->'geometry')::text)::GEOGRAPHY;

            -- Calculate distance from centroid to this contour
            v_distance := ST_Distance(v_admin_centroid, v_feature_geom);

            -- Check if this is the closest so far
            IF v_min_distance IS NULL OR v_distance < v_min_distance THEN
              v_min_distance := v_distance;
              
              -- Extract magnitude value from feature properties
              IF v_feature->'properties'->v_magnitude_field IS NOT NULL THEN
                v_nearest_magnitude := (v_feature->'properties'->v_magnitude_field)::NUMERIC;
              END IF;
            END IF;
          EXCEPTION WHEN OTHERS THEN
            CONTINUE; -- Skip invalid geometries
          END;
        END LOOP;
      END;
    END IF;

    -- If we found a magnitude value, map it to a score
    IF v_nearest_magnitude IS NOT NULL THEN
      v_score := NULL;

      -- Find which range this magnitude falls into
      FOR v_range IN SELECT * FROM jsonb_array_elements(in_magnitude_ranges)
      LOOP
        IF v_nearest_magnitude >= (v_range->>'min')::NUMERIC 
           AND v_nearest_magnitude < (v_range->>'max')::NUMERIC THEN
          v_score := (v_range->>'score')::NUMERIC;
          EXIT;
        END IF;
      END LOOP;

      -- If no range matched, use the last range (highest score)
      IF v_score IS NULL THEN
        v_range := (SELECT jsonb_array_elements(in_magnitude_ranges) ORDER BY (value->>'max')::NUMERIC DESC LIMIT 1);
        v_score := (v_range->>'score')::NUMERIC;
      END IF;

      -- Insert or update score
      INSERT INTO public.hazard_event_scores (
        hazard_event_id,
        instance_id,
        admin_pcode,
        score,
        magnitude_value
      ) VALUES (
        in_hazard_event_id,
        in_instance_id,
        v_admin_pcode,
        v_score,
        v_nearest_magnitude
      )
      ON CONFLICT (hazard_event_id, instance_id, admin_pcode)
      DO UPDATE SET
        score = EXCLUDED.score,
        magnitude_value = EXCLUDED.magnitude_value,
        computed_at = NOW();

      v_scored_count := v_scored_count + 1;
      v_total_score := v_total_score + v_score;
    ELSE
      v_skipped_no_magnitude := v_skipped_no_magnitude + 1;
      IF v_processed_count <= 5 THEN
        RAISE NOTICE 'Skipping admin_pcode %: no magnitude value found', v_admin_pcode;
      END IF;
    END IF;
  END LOOP;

  -- Log summary
  RAISE NOTICE 'Scoring complete: % scored, % skipped (no geom), % skipped (no magnitude)', 
    v_scored_count, v_skipped_no_geom, v_skipped_no_magnitude;

  -- Return statistics with detailed info
  RETURN jsonb_build_object(
    'status', CASE WHEN v_scored_count > 0 THEN 'success' ELSE 'warning' END,
    'scored_locations', v_scored_count,
    'average_score', CASE WHEN v_scored_count > 0 THEN v_total_score / v_scored_count ELSE 0 END,
    'total_admin_areas', v_processed_count,
    'skipped_no_geometry', v_skipped_no_geom,
    'skipped_no_magnitude', v_skipped_no_magnitude,
    'message', CASE 
      WHEN v_scored_count = 0 AND v_skipped_no_geom > 0 THEN 'No geometry found for admin boundaries'
      WHEN v_scored_count = 0 AND v_skipped_no_magnitude > 0 THEN 'No magnitude values matched admin areas'
      WHEN v_scored_count = 0 THEN 'No locations scored - check admin boundaries and magnitude ranges'
      ELSE 'Scoring completed successfully'
    END
  );
END;
$$;

