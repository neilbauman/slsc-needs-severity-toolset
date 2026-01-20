-- ==============================
-- SCORE HAZARD EVENT RPC FUNCTION
-- ==============================
-- Calculates vulnerability scores for admin areas based on hazard event magnitude
-- Supports multiple spatial matching methods:
--   'centroid' (default): Find nearest contour to admin boundary centroid
--   'intersection': Use contour that intersects with admin boundary
--   'overlap': Use contour with maximum overlap with admin boundary
--   'within_distance': Find contours within specified distance (meters) of boundary
--   'point_on_surface': Use ST_PointOnSurface instead of centroid
-- 
-- Also supports distance-based scoring for track-type events (typhoons, storms)

-- Drop ALL existing versions of the function (handles overloaded functions)
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT oid::regprocedure AS func_signature
    FROM pg_proc
    WHERE proname = 'score_hazard_event'
      AND pronamespace = 'public'::regnamespace
  ) LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
  END LOOP;
END $$;

-- Create the function with parameter order matching what Supabase expects
-- Error shows Supabase expects: in_distance_meters, in_distance_ranges, in_hazard_event_id, in_instance_id, in_limit_to_affected, in_matching_method
-- PostgreSQL requires: required params (no defaults) first, then optional with defaults
-- Since all params except first two have defaults, we match Supabase's expected order for the optional ones
CREATE OR REPLACE FUNCTION public.score_hazard_event(
  in_hazard_event_id UUID,
  in_instance_id UUID,
  in_distance_meters NUMERIC DEFAULT 10000,
  in_distance_ranges JSONB DEFAULT NULL,
  in_limit_to_affected BOOLEAN DEFAULT true,
  in_matching_method TEXT DEFAULT 'centroid',
  in_magnitude_ranges JSONB DEFAULT NULL
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
  v_matching_method TEXT;
  v_distance_threshold NUMERIC;
  v_point GEOGRAPHY;
  v_intersection_geom GEOGRAPHY;
  v_max_overlap NUMERIC;
  v_best_magnitude NUMERIC;
  v_use_distance_scoring BOOLEAN := FALSE; -- Flag to use distance-based scoring
  v_track_distance NUMERIC; -- Distance from admin area to track
  v_hazard_geometry GEOGRAPHY; -- Combined geometry of all track features
  v_track_geometries JSONB; -- LineString geometries extracted from GeoJSON
  v_geom_type TEXT; -- Geometry type of a feature
BEGIN
  -- Increase statement timeout for large earthquake datasets (5 minutes)
  -- Note: This only affects the current function execution
  PERFORM set_config('statement_timeout', '300000', false);
  
  -- Validate and set matching method
  v_matching_method := LOWER(COALESCE(in_matching_method, 'centroid'));
  IF v_matching_method NOT IN ('centroid', 'intersection', 'overlap', 'within_distance', 'point_on_surface') THEN
    v_matching_method := 'centroid';
    RAISE NOTICE 'Invalid matching method, defaulting to centroid';
  END IF;
  
  v_distance_threshold := COALESCE(in_distance_meters, 10000);
  
  RAISE NOTICE 'Using matching method: %', v_matching_method;
  IF v_matching_method = 'within_distance' THEN
    RAISE NOTICE 'Distance threshold: % meters', v_distance_threshold;
  END IF;
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

  -- Determine scoring mode: use distance-based if distance_ranges provided, otherwise magnitude-based
  IF in_distance_ranges IS NOT NULL AND jsonb_array_length(in_distance_ranges) > 0 THEN
    v_use_distance_scoring := TRUE;
    RAISE NOTICE 'Using distance-based scoring mode';
  ELSE
    v_use_distance_scoring := FALSE;
    RAISE NOTICE 'Using magnitude-based scoring mode';
  END IF;

  -- For distance-based scoring, extract only LineString/MultiLineString features (track)
  -- and exclude Polygon/MultiPolygon features (cone)
  IF v_use_distance_scoring THEN
    -- Extract only LineString/MultiLineString geometries from original GeoJSON
    -- Also log what geometry types are actually in the GeoJSON for debugging
    DECLARE
      v_all_geom_types TEXT[];
    BEGIN
      -- Get all geometry types for debugging
      SELECT array_agg(DISTINCT (f->'geometry'->>'type')::TEXT) INTO v_all_geom_types
      FROM jsonb_array_elements(v_hazard_event.metadata->'original_geojson'->'features') AS f;
      
      RAISE NOTICE 'Geometry types found in GeoJSON: %', array_to_string(v_all_geom_types, ', ');
      
      -- Extract LineString/MultiLineString geometries
      -- Use case-insensitive matching and handle potential nulls
      v_track_geometries := (
        SELECT jsonb_agg(f->'geometry')
        FROM jsonb_array_elements(v_hazard_event.metadata->'original_geojson'->'features') AS f
        WHERE f->'geometry' IS NOT NULL
          AND LOWER(COALESCE(f->'geometry'->>'type', '')) IN ('linestring', 'multilinestring')
      );
      
      IF v_track_geometries IS NULL OR jsonb_array_length(v_track_geometries) = 0 THEN
        RAISE WARNING 'No LineString/MultiLineString features found! Found types: %', array_to_string(v_all_geom_types, ', ');
      ELSE
        RAISE NOTICE 'Found % LineString/MultiLineString features for track extraction', jsonb_array_length(v_track_geometries);
      END IF;
    END;
    
    -- If we found LineString features, create a combined geometry from them
    IF v_track_geometries IS NOT NULL AND jsonb_array_length(v_track_geometries) > 0 THEN
      BEGIN
        -- Convert each LineString geometry and collect them
        DECLARE
          v_line_geoms GEOGRAPHY[];
          v_single_geom GEOGRAPHY;
        BEGIN
          v_line_geoms := ARRAY[]::GEOGRAPHY[];
          
          -- Convert each LineString from JSON to PostGIS geometry
          FOR i IN 0..jsonb_array_length(v_track_geometries) - 1 LOOP
            BEGIN
              v_single_geom := ST_GeomFromGeoJSON((v_track_geometries->i)::text)::GEOGRAPHY;
              v_line_geoms := array_append(v_line_geoms, v_single_geom);
            EXCEPTION WHEN OTHERS THEN
              -- Skip invalid geometries
              CONTINUE;
            END;
          END LOOP;
          
          -- Combine LineStrings using ST_Collect (creates MultiLineString if multiple, LineString if single)
          IF array_length(v_line_geoms, 1) = 1 THEN
            v_hazard_geometry := v_line_geoms[1];
            RAISE NOTICE 'Using single LineString geometry';
          ELSIF array_length(v_line_geoms, 1) > 1 THEN
            -- Use ST_Collect with a subquery to combine LineStrings into MultiLineString
            -- Convert to GEOMETRY for ST_Collect, then cast back to GEOGRAPHY
            SELECT ST_Collect(geom::GEOMETRY)::GEOGRAPHY INTO v_hazard_geometry
            FROM unnest(v_line_geoms) AS geom;
            
            RAISE NOTICE 'Combined % LineStrings into MultiLineString', array_length(v_line_geoms, 1);
          ELSE
            RAISE EXCEPTION 'No valid LineString geometries found after conversion';
          END IF;
          
          RAISE NOTICE 'Extracted % LineString features for track distance calculation, geometry type: %', 
            array_length(v_line_geoms, 1), ST_GeometryType(v_hazard_geometry::GEOMETRY);
          
          -- Verify the combined geometry is a LineString type
          IF ST_GeometryType(v_hazard_geometry::GEOMETRY) NOT LIKE '%Line%' THEN
            RAISE WARNING 'WARNING: Combined track geometry is not a LineString type: %. Distance calculation may be incorrect.', 
              ST_GeometryType(v_hazard_geometry::GEOMETRY);
          END IF;
          
          -- Verify the combined geometry is a LineString type
          IF ST_GeometryType(v_hazard_geometry::GEOMETRY) NOT LIKE '%Line%' THEN
            RAISE WARNING 'WARNING: Combined track geometry is not a LineString type: %', ST_GeometryType(v_hazard_geometry::GEOMETRY);
          END IF;
        END;
      EXCEPTION WHEN OTHERS THEN
        -- Do NOT fallback to full geometry - this will cause distance 0 for points inside polygons
        RAISE EXCEPTION 'Failed to extract track geometry: %. Cannot use full geometry (includes polygons) for distance-based scoring.', SQLERRM;
      END;
    ELSE
      -- No LineString features found - this is a critical error for distance-based scoring
      -- We cannot use the full geometry because it includes polygons (cone) which will return distance 0
      RAISE EXCEPTION 'CRITICAL ERROR: No LineString/MultiLineString features found in GeoJSON for distance-based scoring. Cannot calculate distances using polygon geometry (cone). Please ensure the GeoJSON contains LineString features for the track.';
    END IF;
  END IF;

  -- Get affected admin areas if limiting
  -- Affected areas are stored in instances.admin_scope as an array
  IF in_limit_to_affected THEN
    SELECT admin_scope INTO v_affected_pcodes
    FROM public.instances
    WHERE id = in_instance_id;
    
    -- If admin_scope is NULL or empty, warn and score all areas instead
    IF v_affected_pcodes IS NULL OR array_length(v_affected_pcodes, 1) = 0 THEN
      RAISE NOTICE 'No affected area scope defined - scoring all ADM3 areas';
      v_affected_pcodes := NULL; -- Will cause scoring of all areas
      -- Override the limit flag since we have no scope
      -- Actually, keep the flag but use NULL to mean "all"
    END IF;
  ELSE
    v_affected_pcodes := NULL; -- Score all areas
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
      v_affected_pcodes IS NULL  -- Score all if no scope defined
      OR ab.admin_pcode = ANY(v_affected_pcodes)  -- Or match scope
      OR (in_limit_to_affected AND ab.parent_pcode = ANY(v_affected_pcodes))  -- Or parent matches (ADM2)
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
        v_affected_pcodes IS NULL  -- Score all if no scope defined
        OR ab.admin_pcode = ANY(v_affected_pcodes)  -- Or match scope
        OR (in_limit_to_affected AND ab.parent_pcode = ANY(v_affected_pcodes))  -- Or parent matches (ADM2)
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
    
    -- Determine which point/geometry to use based on matching method
    BEGIN
      IF v_matching_method = 'centroid' THEN
        v_point := ST_Centroid(v_boundary_geom);
      ELSIF v_matching_method = 'point_on_surface' THEN
        v_point := ST_PointOnSurface(v_boundary_geom::GEOMETRY)::GEOGRAPHY;
      ELSE
        -- For intersection/overlap methods, we'll use the boundary itself
        v_point := NULL;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_skipped_no_geom := v_skipped_no_geom + 1;
      CONTINUE; -- Skip if point calculation fails
    END;

    -- For distance-based scoring, calculate distance to track directly
    IF v_use_distance_scoring THEN
      BEGIN
        -- Calculate distance from admin area point to the track
        -- ST_Distance works correctly with LineString and MultiLineString (from ST_Collect)
        -- For LineString/MultiLineString, ST_Distance returns the minimum distance to any point on the line
        DECLARE
          v_geom_type TEXT;
          v_is_valid BOOLEAN;
        BEGIN
          -- Verify v_hazard_geometry is set and is a LineString type
          IF v_hazard_geometry IS NULL THEN
            RAISE EXCEPTION 'CRITICAL: v_hazard_geometry is NULL! Track extraction must have failed.';
          END IF;
          
          v_geom_type := ST_GeometryType(v_hazard_geometry::GEOMETRY);
          v_is_valid := (v_geom_type LIKE '%Line%');
          
          -- Verify we're using a LineString type, not a Polygon
          IF NOT v_is_valid THEN
            RAISE EXCEPTION 'CRITICAL ERROR: Track geometry is not a LineString type: %. Cannot calculate distances. Expected LineString/MultiLineString but got: %', 
              v_geom_type, v_geom_type;
          END IF;
          
          -- Calculate distance
          IF v_point IS NOT NULL THEN
            v_track_distance := ST_Distance(v_point, v_hazard_geometry);
          ELSE
            -- Use boundary geometry if point not available
            v_track_distance := ST_Distance(v_boundary_geom, v_hazard_geometry);
          END IF;
          
          -- Debug: Log distance for first few locations to verify calculation
          IF v_processed_count <= 5 THEN
            RAISE NOTICE 'Admin %: distance to track = % meters (%.2f km), geometry type: %', 
              v_admin_pcode, v_track_distance, v_track_distance / 1000.0, v_geom_type;
          END IF;
          
          -- Critical check: if distance is 0, this is likely wrong (point should not be exactly on track)
          IF v_track_distance = 0 AND v_processed_count <= 10 THEN
            RAISE WARNING 'CRITICAL: Admin % has distance 0 - this suggests the point is on the track or geometry extraction failed!', 
              v_admin_pcode;
          END IF;
        END;
        
        -- Map distance to score using distance ranges
        -- Ranges are in meters (converted from km in frontend)
        v_score := NULL;
        FOR v_range IN SELECT * FROM jsonb_array_elements(in_distance_ranges)
        LOOP
          DECLARE
            v_range_min NUMERIC := (v_range->>'min')::NUMERIC;
            v_range_max NUMERIC := (v_range->>'max')::NUMERIC;
          BEGIN
            -- Check if distance falls within this range
            -- Note: ranges should be non-overlapping with min inclusive, max exclusive
            IF v_track_distance >= v_range_min AND v_track_distance < v_range_max THEN
              v_score := (v_range->>'score')::NUMERIC;
              -- Debug for first few locations
              IF v_processed_count <= 5 THEN
                RAISE NOTICE 'Admin %: distance %m (%.2f km) matches range [%, %)m, score = %', 
                  v_admin_pcode, v_track_distance, v_track_distance / 1000.0, v_range_min, v_range_max, v_score;
              END IF;
              EXIT;
            END IF;
          END;
        END LOOP;

        -- If no range matched, use the last range (furthest = lowest score)
        IF v_score IS NULL THEN
          -- Find the range with the highest max value
          SELECT * INTO v_range 
          FROM jsonb_array_elements(in_distance_ranges) 
          ORDER BY (value->>'max')::NUMERIC DESC 
          LIMIT 1;
          
          IF v_range IS NOT NULL THEN
            v_score := (v_range->>'score')::NUMERIC;
            IF v_processed_count <= 5 THEN
              RAISE NOTICE 'Admin %: distance %m (%.2f km) did not match any range, using last range score = %', 
                v_admin_pcode, v_track_distance, v_track_distance / 1000.0, v_score;
            END IF;
          ELSE
            -- Fallback: if no ranges at all, default to score 1
            v_score := 1;
            RAISE NOTICE 'Admin %: No distance ranges found, defaulting to score 1', v_admin_pcode;
          END IF;
        END IF;

        -- Insert or update score
        INSERT INTO public.hazard_event_scores (
          hazard_event_id,
          instance_id,
          admin_pcode,
          score,
          magnitude_value -- Store distance as magnitude_value for consistency
        ) VALUES (
          in_hazard_event_id,
          in_instance_id,
          v_admin_pcode,
          v_score,
          v_track_distance
        )
        ON CONFLICT (hazard_event_id, instance_id, admin_pcode)
        DO UPDATE SET
          score = EXCLUDED.score,
          magnitude_value = EXCLUDED.magnitude_value,
          computed_at = NOW();

        v_scored_count := v_scored_count + 1;
        v_total_score := v_total_score + v_score;
        
        -- Skip the magnitude-based logic below
        CONTINUE;
      EXCEPTION WHEN OTHERS THEN
        v_skipped_no_magnitude := v_skipped_no_magnitude + 1;
        CONTINUE;
      END;
    END IF;

    -- Find matching contour based on selected method (magnitude-based scoring)
    v_nearest_magnitude := NULL;
    v_min_distance := NULL;
    v_max_overlap := NULL;
    v_best_magnitude := NULL;

    -- Extract magnitude from metadata's original_geojson
    IF v_hazard_event.metadata IS NOT NULL AND v_hazard_event.metadata->'original_geojson' IS NOT NULL THEN
      DECLARE
        v_feature JSONB;
        v_feature_geom GEOGRAPHY;
        v_distance NUMERIC;
        v_magnitude_field TEXT;
        v_overlap_area NUMERIC;
        v_intersects BOOLEAN;
      BEGIN
        v_magnitude_field := COALESCE(v_hazard_event.magnitude_field, 'value');

        -- Pre-filter features by distance for performance (for all methods except intersection which does its own filtering)
        -- For intersection, we'll do distance filtering inside the loop
        -- For other methods, we can optimize by only checking nearby features
        
        -- Performance optimization: For centroid/point_on_surface methods, we can exit early
        -- once we find a very close match (within 1km) since we're looking for the nearest
        DECLARE
          v_found_close_match BOOLEAN := FALSE;
          v_close_threshold NUMERIC := 1000; -- 1km - if we find a contour this close, use it
        BEGIN
          -- Iterate through features in the GeoJSON
          FOR v_feature IN
            SELECT * FROM jsonb_array_elements(v_hazard_event.metadata->'original_geojson'->'features')
          LOOP
          -- Convert feature geometry to PostGIS
          BEGIN
            v_feature_geom := ST_GeomFromGeoJSON((v_feature->'geometry')::text)::GEOGRAPHY;
            
            -- Extract magnitude value from feature properties
            IF v_feature->'properties'->v_magnitude_field IS NULL THEN
              CONTINUE; -- Skip features without magnitude
            END IF;
            
            -- Quick distance check for performance (skip features that are clearly too far)
            -- Only for methods that need it (centroid, point_on_surface, within_distance)
            IF v_matching_method IN ('centroid', 'point_on_surface', 'within_distance') THEN
              IF v_point IS NOT NULL THEN
                DECLARE
                  v_quick_distance NUMERIC;
                BEGIN
                  v_quick_distance := ST_Distance(v_point, v_feature_geom);
                  -- Skip if feature is more than 200km away (for performance)
                  IF v_quick_distance > 200000 THEN
                    CONTINUE;
                  END IF;
                EXCEPTION WHEN OTHERS THEN
                  -- If distance check fails, continue anyway
                END;
              END IF;
            END IF;
            
            DECLARE
              v_feature_magnitude NUMERIC;
            BEGIN
              v_feature_magnitude := (v_feature->'properties'->v_magnitude_field)::NUMERIC;
              
              -- Apply matching method
              IF v_matching_method = 'centroid' OR v_matching_method = 'point_on_surface' THEN
                -- Distance-based: find nearest contour
                v_distance := ST_Distance(v_point, v_feature_geom);
                IF v_min_distance IS NULL OR v_distance < v_min_distance THEN
                  v_min_distance := v_distance;
                  v_nearest_magnitude := v_feature_magnitude;
                  -- Performance optimization: if we found a very close match, we can exit early
                  -- This significantly speeds up processing for large datasets
                  IF v_distance < v_close_threshold THEN
                    v_found_close_match := TRUE;
                  END IF;
                END IF;
                
              ELSIF v_matching_method = 'within_distance' THEN
                -- Find contours within distance threshold
                IF ST_DWithin(v_boundary_geom, v_feature_geom, v_distance_threshold) THEN
                  v_distance := ST_Distance(v_boundary_geom, v_feature_geom);
                  IF v_min_distance IS NULL OR v_distance < v_min_distance THEN
                    v_min_distance := v_distance;
                    v_nearest_magnitude := v_feature_magnitude;
                  END IF;
                END IF;
                
              ELSIF v_matching_method = 'intersection' THEN
                -- Use first contour that intersects the boundary
                -- Pre-filter with ST_DWithin for performance (within 50km)
                IF ST_DWithin(v_boundary_geom, v_feature_geom, 50000) THEN
                  IF ST_Intersects(v_boundary_geom, v_feature_geom) THEN
                    IF v_nearest_magnitude IS NULL THEN
                      v_nearest_magnitude := v_feature_magnitude;
                      -- For intersection, use first match and exit early for performance
                      EXIT;
                    END IF;
                  END IF;
                END IF;
                
              ELSIF v_matching_method = 'overlap' THEN
                -- Find contour with maximum overlap
                -- For line-based contours, we need a different approach
                -- Instead of buffering, use the length of line that passes through the boundary
                BEGIN
                  DECLARE
                    v_intersection_geom GEOGRAPHY;
                    v_intersection_length NUMERIC;
                    v_boundary_area NUMERIC;
                  BEGIN
                    -- For lines, calculate the length of the line segment that intersects the boundary
                    -- For polygons, calculate the area of intersection
                    BEGIN
                      v_intersection_geom := ST_Intersection(v_boundary_geom::GEOMETRY, v_feature_geom::GEOMETRY)::GEOGRAPHY;
                      
                      IF v_intersection_geom IS NOT NULL THEN
                        -- Determine if intersection is a line or polygon
                        DECLARE
                          v_geom_type TEXT;
                        BEGIN
                          v_geom_type := ST_GeometryType(v_intersection_geom::GEOMETRY);
                          
                          IF v_geom_type LIKE '%Line%' THEN
                            -- For line intersections, use length as overlap measure
                            v_intersection_length := ST_Length(v_intersection_geom);
                            -- Use length as the overlap metric (normalize by boundary perimeter for comparison)
                            v_boundary_area := ST_Perimeter(v_boundary_geom);
                            IF v_boundary_area > 0 AND v_intersection_length > 0 THEN
                              -- Use intersection length as overlap metric
                              IF v_max_overlap IS NULL OR v_intersection_length > v_max_overlap THEN
                                v_max_overlap := v_intersection_length;
                                v_best_magnitude := v_feature_magnitude;
                              END IF;
                            END IF;
                          ELSIF v_geom_type LIKE '%Polygon%' OR v_geom_type LIKE '%MultiPolygon%' THEN
                            -- For polygon intersections, use area
                            v_overlap_area := ST_Area(v_intersection_geom);
                            v_boundary_area := ST_Area(v_boundary_geom);
                            IF v_boundary_area > 0 AND v_overlap_area > 0 THEN
                              -- Only consider meaningful overlaps (> 0.1% of boundary area)
                              IF (v_overlap_area / v_boundary_area) > 0.001 THEN
                                IF v_max_overlap IS NULL OR v_overlap_area > v_max_overlap THEN
                                  v_max_overlap := v_overlap_area;
                                  v_best_magnitude := v_feature_magnitude;
                                END IF;
                              END IF;
                            END IF;
                          END IF;
                        END;
                      END IF;
                    EXCEPTION WHEN OTHERS THEN
                      -- If intersection fails, check if line is within boundary using ST_Within
                      BEGIN
                        IF ST_Within(v_feature_geom::GEOMETRY, v_boundary_geom::GEOMETRY) THEN
                          -- Line is completely within boundary, use its length
                          v_intersection_length := ST_Length(v_feature_geom);
                          IF v_max_overlap IS NULL OR v_intersection_length > v_max_overlap THEN
                            v_max_overlap := v_intersection_length;
                            v_best_magnitude := v_feature_magnitude;
                          END IF;
                        ELSE
                          -- Fall back to distance for lines that don't intersect
                          v_distance := ST_Distance(v_boundary_geom, v_feature_geom);
                          IF v_min_distance IS NULL OR v_distance < v_min_distance THEN
                            v_min_distance := v_distance;
                            -- Only use as fallback if no overlap found yet
                            IF v_best_magnitude IS NULL AND v_nearest_magnitude IS NULL THEN
                              v_nearest_magnitude := v_feature_magnitude;
                            END IF;
                          END IF;
                        END IF;
                      EXCEPTION WHEN OTHERS THEN
                        -- Final fallback to distance
                        v_distance := ST_Distance(v_boundary_geom, v_feature_geom);
                        IF v_min_distance IS NULL OR v_distance < v_min_distance THEN
                          v_min_distance := v_distance;
                          IF v_best_magnitude IS NULL AND v_nearest_magnitude IS NULL THEN
                            v_nearest_magnitude := v_feature_magnitude;
                          END IF;
                        END IF;
                      END;
                    END;
                  END;
                EXCEPTION WHEN OTHERS THEN
                  -- Final fallback to distance
                  v_distance := ST_Distance(v_boundary_geom, v_feature_geom);
                  IF v_min_distance IS NULL OR v_distance < v_min_distance THEN
                    v_min_distance := v_distance;
                    IF v_best_magnitude IS NULL AND v_nearest_magnitude IS NULL THEN
                      v_nearest_magnitude := v_feature_magnitude;
                    END IF;
                  END IF;
                END;
              END IF;
            END;
          EXCEPTION WHEN OTHERS THEN
            CONTINUE; -- Skip invalid geometries
          END;
          
          -- Performance optimization: exit early if we found a very close match
          -- This prevents processing hundreds of distant contours when we already have a good match
          IF v_found_close_match AND (v_matching_method = 'centroid' OR v_matching_method = 'point_on_surface') THEN
            EXIT;
          END IF;
        END LOOP;
        END; -- Close the DECLARE block for v_found_close_match
        
        -- For overlap method, use the best magnitude found
        IF v_matching_method = 'overlap' AND v_best_magnitude IS NOT NULL THEN
          v_nearest_magnitude := v_best_magnitude;
        END IF;
      END;
    END IF;

    -- If we found a magnitude value, map it to a score (magnitude-based scoring only)
    IF NOT v_use_distance_scoring AND v_nearest_magnitude IS NOT NULL THEN
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.score_hazard_event(UUID, UUID, NUMERIC, JSONB, BOOLEAN, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.score_hazard_event(UUID, UUID, NUMERIC, JSONB, BOOLEAN, TEXT, JSONB) TO anon;
