-- ============================================
-- score_building_typology RPC Function
-- ============================================
-- Scores categorical datasets (e.g., building typology) by:
-- 1. Calculating percentage of houses in each location that score 1-5
-- 2. Applying aggregation method (20% rule, custom %, median, mode, weighted mean)
-- 
-- Parameters:
--   in_instance_id: UUID - Instance ID
--   in_dataset_id: UUID - Dataset ID to score
--   in_category_scores: JSONB - Category to score mappings
--     Example: [{"category": "Concrete", "score": 5}, {"category": "Wood", "score": 3}]
--   in_method: TEXT - Aggregation method
--     - 'twenty_percent': Worst score where ≥20% of population live
--     - 'custom_percent': Worst score where ≥threshold% of population live
--     - 'median': Median score (50th percentile)
--     - 'mode': Most prevalent score
--     - 'weighted_mean': Weighted average by counts
--   in_threshold: NUMERIC - Custom threshold (0-1, used for custom_percent method)
--   in_limit_to_affected: BOOLEAN - Limit to affected areas only (optional, default false)
--
-- Returns: void (inserts scores into instance_dataset_scores table)
-- ============================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.score_building_typology(UUID, UUID, JSONB, TEXT, NUMERIC);
DROP FUNCTION IF EXISTS public.score_building_typology(UUID, UUID, JSONB, TEXT, NUMERIC, BOOLEAN);

-- Create the function
CREATE FUNCTION public.score_building_typology(
  in_instance_id UUID,
  in_dataset_id UUID,
  in_category_scores JSONB,
  in_method TEXT,
  in_threshold NUMERIC DEFAULT 0.2,
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
  v_admin_pcode TEXT;
  v_total_houses NUMERIC;
  v_score1_count NUMERIC;
  v_score2_count NUMERIC;
  v_score3_count NUMERIC;
  v_score4_count NUMERIC;
  v_score5_count NUMERIC;
  v_score1_pct NUMERIC;
  v_score2_pct NUMERIC;
  v_score3_pct NUMERIC;
  v_score4_pct NUMERIC;
  v_score5_pct NUMERIC;
  v_calculated_score NUMERIC;
  v_cumulative_pct NUMERIC;
  v_max_pct NUMERIC;
  v_weighted_sum NUMERIC;
BEGIN
  -- Get dataset admin level
  SELECT UPPER(TRIM(admin_level)) INTO v_dataset_admin_level
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
    SELECT ARRAY_AGG(DISTINCT admin_pcode) INTO v_affected_adm3_codes
    FROM admin_boundaries
    WHERE UPPER(TRIM(admin_level)) = 'ADM3'
      AND parent_pcode = ANY(v_instance_admin_scope);
    
    -- Fallback: check if admin_pcode starts with ADM2 codes
    IF v_affected_adm3_codes IS NULL OR array_length(v_affected_adm3_codes, 1) = 0 THEN
      SELECT ARRAY_AGG(DISTINCT admin_pcode) INTO v_affected_adm3_codes
      FROM admin_boundaries
      WHERE UPPER(TRIM(admin_level)) = 'ADM3'
        AND EXISTS (
          SELECT 1 FROM unnest(v_instance_admin_scope) AS adm2_code
          WHERE admin_pcode LIKE adm2_code || '%'
        );
    END IF;
  END IF;
  
  -- Delete existing scores for this dataset/instance combination
  DELETE FROM instance_dataset_scores
  WHERE instance_id = in_instance_id
    AND dataset_id = in_dataset_id;
  
  -- For each location, calculate score distribution and apply aggregation method
  -- Step 1: Calculate percentage distribution by score for each location
  IF in_limit_to_affected AND v_affected_adm3_codes IS NOT NULL AND array_length(v_affected_adm3_codes, 1) > 0 THEN
    -- Score only affected areas
    INSERT INTO instance_dataset_scores (instance_id, dataset_id, admin_pcode, score)
    WITH location_scores AS (
      SELECT 
        dvc.admin_pcode,
        -- Calculate total houses in this location
        SUM(COALESCE(dvc.value, 0)) AS total_houses,
        -- Count houses by score (1-5)
        SUM(CASE WHEN (cs->>'score')::NUMERIC = 1 THEN COALESCE(dvc.value, 0) ELSE 0 END) AS score1_count,
        SUM(CASE WHEN (cs->>'score')::NUMERIC = 2 THEN COALESCE(dvc.value, 0) ELSE 0 END) AS score2_count,
        SUM(CASE WHEN (cs->>'score')::NUMERIC = 3 THEN COALESCE(dvc.value, 0) ELSE 0 END) AS score3_count,
        SUM(CASE WHEN (cs->>'score')::NUMERIC = 4 THEN COALESCE(dvc.value, 0) ELSE 0 END) AS score4_count,
        SUM(CASE WHEN (cs->>'score')::NUMERIC = 5 THEN COALESCE(dvc.value, 0) ELSE 0 END) AS score5_count
      FROM dataset_values_categorical dvc
      INNER JOIN LATERAL jsonb_array_elements(in_category_scores) AS cs ON true
      WHERE dvc.dataset_id = in_dataset_id
        AND dvc.category = (cs->>'category')
        AND (cs->>'score')::NUMERIC IN (1, 2, 3, 4, 5)
        AND dvc.admin_pcode = ANY(v_affected_adm3_codes)
      GROUP BY dvc.admin_pcode
      HAVING SUM(COALESCE(dvc.value, 0)) > 0
    ),
    location_percentages AS (
      SELECT 
        admin_pcode,
        total_houses,
        score1_count,
        score2_count,
        score3_count,
        score4_count,
        score5_count,
        -- Calculate percentages
        CASE WHEN total_houses > 0 THEN (score1_count / total_houses * 100) ELSE 0 END AS score1_pct,
        CASE WHEN total_houses > 0 THEN (score2_count / total_houses * 100) ELSE 0 END AS score2_pct,
        CASE WHEN total_houses > 0 THEN (score3_count / total_houses * 100) ELSE 0 END AS score3_pct,
        CASE WHEN total_houses > 0 THEN (score4_count / total_houses * 100) ELSE 0 END AS score4_pct,
        CASE WHEN total_houses > 0 THEN (score5_count / total_houses * 100) ELSE 0 END AS score5_pct
      FROM location_scores
    )
    SELECT 
      in_instance_id,
      in_dataset_id,
      lp.admin_pcode,
      CASE
        -- 20% Rule or Custom % Rule: Find worst (highest) score where threshold is met
        WHEN in_method IN ('twenty_percent', 'custom_percent') THEN
          CASE
            WHEN lp.score5_pct >= (CASE WHEN in_method = 'twenty_percent' THEN 20 ELSE in_threshold * 100 END) THEN 5
            WHEN lp.score4_pct >= (CASE WHEN in_method = 'twenty_percent' THEN 20 ELSE in_threshold * 100 END) THEN 4
            WHEN lp.score3_pct >= (CASE WHEN in_method = 'twenty_percent' THEN 20 ELSE in_threshold * 100 END) THEN 3
            WHEN lp.score2_pct >= (CASE WHEN in_method = 'twenty_percent' THEN 20 ELSE in_threshold * 100 END) THEN 2
            WHEN lp.score1_pct >= (CASE WHEN in_method = 'twenty_percent' THEN 20 ELSE in_threshold * 100 END) THEN 1
            ELSE 1 -- Default to worst if no threshold met
          END
        -- Median: Find score where cumulative percentage >= 50%
        WHEN in_method = 'median' THEN
          CASE
            WHEN lp.score1_pct >= 50 THEN 1
            WHEN lp.score1_pct + lp.score2_pct >= 50 THEN 2
            WHEN lp.score1_pct + lp.score2_pct + lp.score3_pct >= 50 THEN 3
            WHEN lp.score1_pct + lp.score2_pct + lp.score3_pct + lp.score4_pct >= 50 THEN 4
            ELSE 5
          END
        -- Mode: Most prevalent score
        WHEN in_method = 'mode' THEN
          CASE
            WHEN lp.score5_pct >= lp.score4_pct AND lp.score5_pct >= lp.score3_pct 
              AND lp.score5_pct >= lp.score2_pct AND lp.score5_pct >= lp.score1_pct THEN 5
            WHEN lp.score4_pct >= lp.score3_pct AND lp.score4_pct >= lp.score2_pct 
              AND lp.score4_pct >= lp.score1_pct THEN 4
            WHEN lp.score3_pct >= lp.score2_pct AND lp.score3_pct >= lp.score1_pct THEN 3
            WHEN lp.score2_pct >= lp.score1_pct THEN 2
            ELSE 1
          END
        -- Weighted Mean: Average weighted by counts
        WHEN in_method = 'weighted_mean' THEN
          ROUND(
            (lp.score1_count * 1 + lp.score2_count * 2 + lp.score3_count * 3 + 
             lp.score4_count * 4 + lp.score5_count * 5) / NULLIF(lp.total_houses, 0),
            2
          )
        ELSE 1 -- Default
      END AS score
    FROM location_percentages lp;
  ELSE
    -- Score all locations
    INSERT INTO instance_dataset_scores (instance_id, dataset_id, admin_pcode, score)
    WITH location_scores AS (
      SELECT 
        dvc.admin_pcode,
        SUM(COALESCE(dvc.value, 0)) AS total_houses,
        SUM(CASE WHEN cs.score = 1 THEN COALESCE(dvc.value, 0) ELSE 0 END) AS score1_count,
        SUM(CASE WHEN cs.score = 2 THEN COALESCE(dvc.value, 0) ELSE 0 END) AS score2_count,
        SUM(CASE WHEN cs.score = 3 THEN COALESCE(dvc.value, 0) ELSE 0 END) AS score3_count,
        SUM(CASE WHEN cs.score = 4 THEN COALESCE(dvc.value, 0) ELSE 0 END) AS score4_count,
        SUM(CASE WHEN cs.score = 5 THEN COALESCE(dvc.value, 0) ELSE 0 END) AS score5_count
      FROM dataset_values_categorical dvc
      INNER JOIN LATERAL jsonb_array_elements(in_category_scores) AS cs ON true
      WHERE dvc.dataset_id = in_dataset_id
        AND dvc.category = (cs->>'category')
        AND (cs->>'score')::NUMERIC IN (1, 2, 3, 4, 5)
      GROUP BY dvc.admin_pcode
      HAVING SUM(COALESCE(dvc.value, 0)) > 0
    ),
    location_percentages AS (
      SELECT 
        admin_pcode,
        total_houses,
        score1_count,
        score2_count,
        score3_count,
        score4_count,
        score5_count,
        CASE WHEN total_houses > 0 THEN (score1_count / total_houses * 100) ELSE 0 END AS score1_pct,
        CASE WHEN total_houses > 0 THEN (score2_count / total_houses * 100) ELSE 0 END AS score2_pct,
        CASE WHEN total_houses > 0 THEN (score3_count / total_houses * 100) ELSE 0 END AS score3_pct,
        CASE WHEN total_houses > 0 THEN (score4_count / total_houses * 100) ELSE 0 END AS score4_pct,
        CASE WHEN total_houses > 0 THEN (score5_count / total_houses * 100) ELSE 0 END AS score5_pct
      FROM location_scores
    )
    SELECT 
      in_instance_id,
      in_dataset_id,
      lp.admin_pcode,
      CASE
        WHEN in_method IN ('twenty_percent', 'custom_percent') THEN
          CASE
            WHEN lp.score5_pct >= (CASE WHEN in_method = 'twenty_percent' THEN 20 ELSE in_threshold * 100 END) THEN 5
            WHEN lp.score4_pct >= (CASE WHEN in_method = 'twenty_percent' THEN 20 ELSE in_threshold * 100 END) THEN 4
            WHEN lp.score3_pct >= (CASE WHEN in_method = 'twenty_percent' THEN 20 ELSE in_threshold * 100 END) THEN 3
            WHEN lp.score2_pct >= (CASE WHEN in_method = 'twenty_percent' THEN 20 ELSE in_threshold * 100 END) THEN 2
            WHEN lp.score1_pct >= (CASE WHEN in_method = 'twenty_percent' THEN 20 ELSE in_threshold * 100 END) THEN 1
            ELSE 1
          END
        WHEN in_method = 'median' THEN
          CASE
            WHEN lp.score1_pct >= 50 THEN 1
            WHEN lp.score1_pct + lp.score2_pct >= 50 THEN 2
            WHEN lp.score1_pct + lp.score2_pct + lp.score3_pct >= 50 THEN 3
            WHEN lp.score1_pct + lp.score2_pct + lp.score3_pct + lp.score4_pct >= 50 THEN 4
            ELSE 5
          END
        WHEN in_method = 'mode' THEN
          CASE
            WHEN lp.score5_pct >= lp.score4_pct AND lp.score5_pct >= lp.score3_pct 
              AND lp.score5_pct >= lp.score2_pct AND lp.score5_pct >= lp.score1_pct THEN 5
            WHEN lp.score4_pct >= lp.score3_pct AND lp.score4_pct >= lp.score2_pct 
              AND lp.score4_pct >= lp.score1_pct THEN 4
            WHEN lp.score3_pct >= lp.score2_pct AND lp.score3_pct >= lp.score1_pct THEN 3
            WHEN lp.score2_pct >= lp.score1_pct THEN 2
            ELSE 1
          END
        WHEN in_method = 'weighted_mean' THEN
          ROUND(
            (lp.score1_count * 1 + lp.score2_count * 2 + lp.score3_count * 3 + 
             lp.score4_count * 4 + lp.score5_count * 5) / NULLIF(lp.total_houses, 0),
            2
          )
        ELSE 1
      END AS score
    FROM location_percentages lp;
  END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.score_building_typology(UUID, UUID, JSONB, TEXT, NUMERIC, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.score_building_typology(UUID, UUID, JSONB, TEXT, NUMERIC, BOOLEAN) TO anon;

