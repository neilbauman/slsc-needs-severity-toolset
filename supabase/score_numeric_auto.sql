-- ============================================
-- score_numeric_auto RPC Function
-- ============================================
-- Automatically scores numeric datasets using configurable methods
-- 
-- Parameters:
--   in_instance_id: UUID - Instance ID
--   in_dataset_id: UUID - Dataset ID to score
--   in_method: TEXT - Scoring method ('minmax', 'threshold', 'zscore')
--   in_thresholds: JSONB - Threshold configuration (for threshold method)
--   in_scale_max: NUMERIC - Maximum scale value (e.g., 5)
--   in_inverse: BOOLEAN - Whether to invert scores
--   in_limit_to_affected: BOOLEAN - Limit to affected areas only
--
-- Returns: void (inserts scores into instance_dataset_scores table)
-- ============================================

-- Drop ALL existing versions of the function (handles overloaded functions)
-- This will drop any version regardless of parameter signature
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT oid::regprocedure AS func_signature
    FROM pg_proc
    WHERE proname = 'score_numeric_auto'
      AND pronamespace = 'public'::regnamespace
  ) LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
  END LOOP;
END $$;

-- Create the function with the correct signature
CREATE FUNCTION public.score_numeric_auto(
  in_instance_id UUID,
  in_dataset_id UUID,
  in_method TEXT,
  in_thresholds JSONB DEFAULT NULL,
  in_scale_max NUMERIC DEFAULT 5,
  in_inverse BOOLEAN DEFAULT FALSE,
  in_limit_to_affected BOOLEAN DEFAULT FALSE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_dataset_admin_level TEXT;
  v_instance_admin_scope TEXT[];
  v_affected_adm3_codes TEXT[];
  v_min_value NUMERIC;
  v_max_value NUMERIC;
  v_value_range NUMERIC;
  v_score NUMERIC;
  v_admin_pcode TEXT;
  v_value NUMERIC;
  v_threshold JSONB;
  v_found_threshold BOOLEAN;
BEGIN
  -- Get dataset admin level
  SELECT admin_level INTO v_dataset_admin_level
  FROM datasets
  WHERE id = in_dataset_id;
  
  IF v_dataset_admin_level IS NULL THEN
    RAISE EXCEPTION 'Dataset not found: %', in_dataset_id;
  END IF;
  
  -- Get instance admin_scope (ADM2 codes)
  SELECT admin_scope INTO v_instance_admin_scope
  FROM instances
  WHERE id = in_instance_id;
  
  IF v_instance_admin_scope IS NULL THEN
    RAISE EXCEPTION 'Instance not found: %', in_instance_id;
  END IF;
  
  -- If limiting to affected areas, get affected ADM3 codes
  IF in_limit_to_affected AND v_instance_admin_scope IS NOT NULL AND array_length(v_instance_admin_scope, 1) > 0 THEN
    -- Get ADM3 codes from affected ADM2 areas
    -- First try using admin_boundaries with parent_pcode relationship
    SELECT ARRAY_AGG(DISTINCT admin_pcode) INTO v_affected_adm3_codes
    FROM admin_boundaries
    WHERE admin_level = 'ADM3'
      AND parent_pcode = ANY(v_instance_admin_scope);
    
    -- If no ADM3 codes found, try alternative: check if admin_pcode starts with ADM2 codes
    IF v_affected_adm3_codes IS NULL OR array_length(v_affected_adm3_codes, 1) = 0 THEN
      -- Alternative approach: ADM3 codes might be prefixed with ADM2 codes
      SELECT ARRAY_AGG(DISTINCT admin_pcode) INTO v_affected_adm3_codes
      FROM admin_boundaries
      WHERE admin_level = 'ADM3'
        AND (
          EXISTS (
            SELECT 1 FROM unnest(v_instance_admin_scope) AS adm2_code
            WHERE admin_pcode LIKE adm2_code || '%'
          )
        );
    END IF;
    
    -- If still no codes found, log a warning but continue (will score all areas)
    IF v_affected_adm3_codes IS NULL OR array_length(v_affected_adm3_codes, 1) = 0 THEN
      RAISE WARNING 'No ADM3 codes found for admin_scope: %. Scoring all areas.', v_instance_admin_scope;
      v_affected_adm3_codes := NULL; -- Will cause scoring of all areas
    END IF;
  END IF;
  
  -- Delete existing scores for this dataset/instance combination
  DELETE FROM instance_dataset_scores
  WHERE instance_id = in_instance_id
    AND dataset_id = in_dataset_id;
  
  -- Handle different scoring methods
  IF in_method = 'minmax' THEN
    -- ============================================
    -- MIN-MAX NORMALIZATION
    -- ============================================
    
    -- Calculate min/max based on scope
    IF in_limit_to_affected AND v_affected_adm3_codes IS NOT NULL AND array_length(v_affected_adm3_codes, 1) > 0 THEN
      -- Calculate min/max from ONLY affected area data
      SELECT 
        MIN(value),
        MAX(value)
      INTO v_min_value, v_max_value
      FROM dataset_values_numeric
      WHERE dataset_id = in_dataset_id
        AND admin_pcode = ANY(v_affected_adm3_codes);
    ELSE
      -- Calculate min/max from entire country
      SELECT 
        MIN(value),
        MAX(value)
      INTO v_min_value, v_max_value
      FROM dataset_values_numeric
      WHERE dataset_id = in_dataset_id;
    END IF;
    
    -- Check if we have valid min/max values
    IF v_min_value IS NULL OR v_max_value IS NULL THEN
      RAISE EXCEPTION 'No data found for dataset: %', in_dataset_id;
    END IF;
    
    -- Handle edge case: all values are the same
    IF v_min_value = v_max_value THEN
      -- All values get the same score (middle of range)
      v_score := (in_scale_max + 1) / 2.0;
      
      -- Insert scores for all affected areas (or all if not limited)
      IF in_limit_to_affected AND v_affected_adm3_codes IS NOT NULL AND array_length(v_affected_adm3_codes, 1) > 0 THEN
        INSERT INTO instance_dataset_scores (instance_id, dataset_id, admin_pcode, score)
        SELECT 
          in_instance_id,
          in_dataset_id,
          admin_pcode,
          v_score
        FROM dataset_values_numeric
        WHERE dataset_id = in_dataset_id
          AND admin_pcode = ANY(v_affected_adm3_codes);
      ELSE
        INSERT INTO instance_dataset_scores (instance_id, dataset_id, admin_pcode, score)
        SELECT 
          in_instance_id,
          in_dataset_id,
          admin_pcode,
          v_score
        FROM dataset_values_numeric
        WHERE dataset_id = in_dataset_id;
      END IF;
      
      RETURN;
    END IF;
    
    -- Calculate range for normalization
    v_value_range := v_max_value - v_min_value;
    
    -- Normalize and insert scores
    IF in_limit_to_affected AND v_affected_adm3_codes IS NOT NULL AND array_length(v_affected_adm3_codes, 1) > 0 THEN
      -- Score only affected areas, but use affected area's min/max for normalization
      INSERT INTO instance_dataset_scores (instance_id, dataset_id, admin_pcode, score)
      SELECT 
        in_instance_id,
        in_dataset_id,
        dvn.admin_pcode,
        CASE
          WHEN in_inverse THEN
            -- Inverted: higher values get lower scores
            in_scale_max - ((dvn.value - v_min_value) / v_value_range * (in_scale_max - 1))
          ELSE
            -- Normal: higher values get higher scores
            1 + ((dvn.value - v_min_value) / v_value_range * (in_scale_max - 1))
        END AS score
      FROM dataset_values_numeric dvn
      WHERE dvn.dataset_id = in_dataset_id
        AND dvn.admin_pcode = ANY(v_affected_adm3_codes);
    ELSE
      -- Score entire country using country's min/max
      INSERT INTO instance_dataset_scores (instance_id, dataset_id, admin_pcode, score)
      SELECT 
        in_instance_id,
        in_dataset_id,
        dvn.admin_pcode,
        CASE
          WHEN in_inverse THEN
            -- Inverted: higher values get lower scores
            in_scale_max - ((dvn.value - v_min_value) / v_value_range * (in_scale_max - 1))
          ELSE
            -- Normal: higher values get higher scores
            1 + ((dvn.value - v_min_value) / v_value_range * (in_scale_max - 1))
        END AS score
      FROM dataset_values_numeric dvn
      WHERE dvn.dataset_id = in_dataset_id;
    END IF;
    
  ELSIF in_method = 'threshold' THEN
    -- ============================================
    -- THRESHOLD-BASED SCORING
    -- ============================================
    
    IF in_thresholds IS NULL OR jsonb_array_length(in_thresholds) = 0 THEN
      RAISE EXCEPTION 'Thresholds required for threshold method';
    END IF;
    
    -- Score based on thresholds
    IF in_limit_to_affected AND v_affected_adm3_codes IS NOT NULL AND array_length(v_affected_adm3_codes, 1) > 0 THEN
      INSERT INTO instance_dataset_scores (instance_id, dataset_id, admin_pcode, score)
      SELECT 
        in_instance_id,
        in_dataset_id,
        dvn.admin_pcode,
        (
          SELECT (threshold->>'score')::NUMERIC
          FROM jsonb_array_elements(in_thresholds) AS threshold
          WHERE (threshold->>'min')::NUMERIC <= dvn.value
            AND (COALESCE((threshold->>'max')::NUMERIC, 999999999) > dvn.value OR (threshold->>'max')::TEXT IS NULL)
          ORDER BY (threshold->>'min')::NUMERIC DESC
          LIMIT 1
        ) AS score
      FROM dataset_values_numeric dvn
      WHERE dvn.dataset_id = in_dataset_id
        AND dvn.admin_pcode = ANY(v_affected_adm3_codes)
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(in_thresholds) AS threshold
          WHERE (threshold->>'min')::NUMERIC <= dvn.value
            AND (COALESCE((threshold->>'max')::NUMERIC, 999999999) > dvn.value OR (threshold->>'max')::TEXT IS NULL)
        );
    ELSE
      INSERT INTO instance_dataset_scores (instance_id, dataset_id, admin_pcode, score)
      SELECT 
        in_instance_id,
        in_dataset_id,
        dvn.admin_pcode,
        (
          SELECT (threshold->>'score')::NUMERIC
          FROM jsonb_array_elements(in_thresholds) AS threshold
          WHERE (threshold->>'min')::NUMERIC <= dvn.value
            AND (COALESCE((threshold->>'max')::NUMERIC, 999999999) > dvn.value OR (threshold->>'max')::TEXT IS NULL)
          ORDER BY (threshold->>'min')::NUMERIC DESC
          LIMIT 1
        ) AS score
      FROM dataset_values_numeric dvn
      WHERE dvn.dataset_id = in_dataset_id
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(in_thresholds) AS threshold
          WHERE (threshold->>'min')::NUMERIC <= dvn.value
            AND (COALESCE((threshold->>'max')::NUMERIC, 999999999) > dvn.value OR (threshold->>'max')::TEXT IS NULL)
        );
    END IF;
    
  ELSIF in_method = 'zscore' THEN
    -- ============================================
    -- Z-SCORE NORMALIZATION
    -- ============================================
    
    -- Calculate mean and stddev based on scope
    DECLARE
      v_mean NUMERIC;
      v_stddev NUMERIC;
    BEGIN
      IF in_limit_to_affected AND v_affected_adm3_codes IS NOT NULL AND array_length(v_affected_adm3_codes, 1) > 0 THEN
        SELECT 
          AVG(value),
          STDDEV(value)
        INTO v_mean, v_stddev
        FROM dataset_values_numeric
        WHERE dataset_id = in_dataset_id
          AND admin_pcode = ANY(v_affected_adm3_codes);
      ELSE
        SELECT 
          AVG(value),
          STDDEV(value)
        INTO v_mean, v_stddev
        FROM dataset_values_numeric
        WHERE dataset_id = in_dataset_id;
      END IF;
      
      IF v_mean IS NULL OR v_stddev IS NULL OR v_stddev = 0 THEN
        RAISE EXCEPTION 'Cannot calculate z-scores: insufficient data or zero standard deviation';
      END IF;
      
      -- Convert z-scores to scale (assuming z-scores range from -3 to +3, map to 1 to scale_max)
      IF in_limit_to_affected AND v_affected_adm3_codes IS NOT NULL AND array_length(v_affected_adm3_codes, 1) > 0 THEN
        INSERT INTO instance_dataset_scores (instance_id, dataset_id, admin_pcode, score)
        SELECT 
          in_instance_id,
          in_dataset_id,
          dvn.admin_pcode,
          CASE
            WHEN in_inverse THEN
              in_scale_max - LEAST(GREATEST(1 + ((dvn.value - v_mean) / v_stddev + 3) / 6 * (in_scale_max - 1), 1), in_scale_max)
            ELSE
              LEAST(GREATEST(1 + ((dvn.value - v_mean) / v_stddev + 3) / 6 * (in_scale_max - 1), 1), in_scale_max)
          END AS score
        FROM dataset_values_numeric dvn
        WHERE dvn.dataset_id = in_dataset_id
          AND dvn.admin_pcode = ANY(v_affected_adm3_codes);
      ELSE
        INSERT INTO instance_dataset_scores (instance_id, dataset_id, admin_pcode, score)
        SELECT 
          in_instance_id,
          in_dataset_id,
          dvn.admin_pcode,
          CASE
            WHEN in_inverse THEN
              in_scale_max - LEAST(GREATEST(1 + ((dvn.value - v_mean) / v_stddev + 3) / 6 * (in_scale_max - 1), 1), in_scale_max)
            ELSE
              LEAST(GREATEST(1 + ((dvn.value - v_mean) / v_stddev + 3) / 6 * (in_scale_max - 1), 1), in_scale_max)
          END AS score
        FROM dataset_values_numeric dvn
        WHERE dvn.dataset_id = in_dataset_id;
      END IF;
    END;
    
  ELSE
    RAISE EXCEPTION 'Unknown scoring method: %', in_method;
  END IF;
  
END;
$$;

-- Grant execute permission (with full signature)
GRANT EXECUTE ON FUNCTION public.score_numeric_auto(UUID, UUID, TEXT, JSONB, NUMERIC, BOOLEAN, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.score_numeric_auto(UUID, UUID, TEXT, JSONB, NUMERIC, BOOLEAN, BOOLEAN) TO anon;

