-- ==============================
-- CREATE SCORING AGGREGATE FUNCTIONS
-- ==============================
-- Creates score_framework_aggregate and score_final_aggregate functions
-- Run this in the TARGET database

-- ==============================
-- 1. Create score_framework_aggregate function
-- ==============================
-- Drop existing functions first to avoid return type conflicts
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT oid::regprocedure AS func_signature
    FROM pg_proc
    WHERE proname = 'score_framework_aggregate'
      AND pronamespace = 'public'::regnamespace
  ) LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
  END LOOP;
END $$;

-- Shared implementation function
CREATE OR REPLACE FUNCTION public._score_framework_aggregate_impl(
  p_instance_id UUID,
  p_config JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_instance_id UUID := p_instance_id;
  v_config JSONB := p_config;
  v_category_key TEXT;
  v_method TEXT;
  v_weights JSONB;
  v_upserted_rows INTEGER := 0;
  v_total_score NUMERIC := 0;
  v_location_count INTEGER := 0;
  v_weights_map JSONB;
  v_category_config JSONB;
  v_country_id UUID;
BEGIN
  IF v_instance_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Instance ID is required'
    );
  END IF;

  -- Get country_id from instance for filtering
  SELECT country_id INTO v_country_id
  FROM public.instances
  WHERE id = v_instance_id;
  
  IF v_country_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Instance not found or missing country_id'
    );
  END IF;

  -- Use default config if none provided
  -- Load weights from instance_scoring_weights and hazard_events.metadata
  IF v_config IS NULL THEN
    -- Build weights map from database using JSON aggregation (more efficient)
    SELECT 
      COALESCE(
        jsonb_object_agg(
          dataset_id::TEXT,
          COALESCE(dataset_weight, 1.0)
        ),
        '{}'::jsonb
      ) || COALESCE(
        (
          SELECT jsonb_object_agg(
            'hazard_event_' || id::TEXT,
            COALESCE((metadata->>'weight')::NUMERIC, 1.0)
          )
          FROM hazard_events
          WHERE instance_id = v_instance_id
            AND country_id = v_country_id
            AND metadata IS NOT NULL
            AND metadata ? 'weight'
        ),
        '{}'::jsonb
      )
    INTO v_weights_map
    FROM instance_scoring_weights
    WHERE instance_id = v_instance_id;

    -- Build config with weighted_normalized_sum method and loaded weights
    -- For Hazard category, automatically use compounding_hazards if multiple hazard events exist
    DECLARE
      v_hazard_event_count INTEGER;
      v_hazard_method TEXT;
    BEGIN
      SELECT COUNT(*) INTO v_hazard_event_count
      FROM hazard_events
      WHERE instance_id = v_instance_id
        AND country_id = v_country_id;
      
      -- Use compounding_hazards if multiple hazard events, otherwise weighted_normalized_sum
      v_hazard_method := CASE 
        WHEN v_hazard_event_count > 1 THEN 'compounding_hazards'
        ELSE 'weighted_normalized_sum'
      END;
      
      v_config := jsonb_build_object(
        'categories', jsonb_build_array(
          jsonb_build_object('key', 'SSC Framework - P1', 'method', 'weighted_normalized_sum', 'weights', COALESCE(v_weights_map, '{}'::jsonb)),
          jsonb_build_object('key', 'SSC Framework - P2', 'method', 'weighted_normalized_sum', 'weights', COALESCE(v_weights_map, '{}'::jsonb)),
          jsonb_build_object('key', 'SSC Framework - P3', 'method', 'weighted_normalized_sum', 'weights', COALESCE(v_weights_map, '{}'::jsonb)),
          jsonb_build_object('key', 'Hazard', 'method', v_hazard_method, 'weights', COALESCE(v_weights_map, '{}'::jsonb)),
          jsonb_build_object('key', 'Underlying Vulnerability', 'method', 'weighted_normalized_sum', 'weights', COALESCE(v_weights_map, '{}'::jsonb))
        )
      );
    END;
  END IF;

  -- Process each category using bulk operations
  FOR v_category_config IN SELECT * FROM jsonb_array_elements(v_config->'categories')
  LOOP
    v_category_key := v_category_config->>'key';
    v_method := COALESCE(v_category_config->>'method', 'average');
    v_weights := COALESCE(v_category_config->'weights', '{}'::jsonb);

    -- Calculate category scores for ALL admin areas at once using bulk query
    -- This is much more efficient than row-by-row processing
    INSERT INTO instance_category_scores (instance_id, category, admin_pcode, score)
    SELECT 
      v_instance_id,
      v_category_key,
      admin_pcode,
      CASE
        WHEN v_method = 'average' THEN
          AVG(score)
        WHEN v_method = 'weighted_mean' OR v_method = 'custom_weighted' THEN
          CASE 
            WHEN SUM(weight) > 0 THEN SUM(score * weight) / SUM(weight)
            ELSE NULL
          END
        WHEN v_method = 'weighted_normalized_sum' THEN
          -- Weighted sum of normalized scores with renormalization
          CASE 
            WHEN SUM(weight) > 0 THEN
              LEAST(5.0, GREATEST(1.0,
                (SUM((score - 1.0) / 4.0 * weight) / NULLIF(SUM(weight), 0)) * 4.0 + 1.0
              ))
            ELSE NULL
          END
        WHEN v_method = 'compounding_hazards' THEN
          -- Special method for compounding hazards
          CASE
            WHEN COUNT(*) > 1 THEN
              LEAST(5.0, GREATEST(1.0,
                (
                  (SUM((score - 1.0) / 4.0 * weight) / NULLIF(SUM(weight), 0))
                  + (EXP(SUM(LN(GREATEST((score - 1.0) / 4.0, 0.01))))) * 0.5
                ) * 4.0 + 1.0
              ))
            ELSE
              LEAST(5.0, GREATEST(1.0, ((MAX(score) - 1.0) / 4.0) * 4.0 + 1.0))
          END
        WHEN v_method = 'worst_case' THEN
          MAX(score)
        WHEN v_method = 'best_case' THEN
          MIN(score)
        ELSE
          AVG(score) -- Default to average
      END AS category_score
    FROM (
      -- Regular dataset scores
      SELECT 
        ids.admin_pcode,
        ids.score,
        CASE 
          WHEN (v_method = 'custom_weighted' OR v_method = 'weighted_mean' OR v_method = 'weighted_normalized_sum' OR v_method = 'compounding_hazards') AND v_weights ? ids.dataset_id::TEXT 
          THEN (v_weights->ids.dataset_id::TEXT)::NUMERIC
          ELSE 1.0
        END AS weight
      FROM instance_dataset_scores ids
      INNER JOIN instance_datasets id ON id.dataset_id = ids.dataset_id
      INNER JOIN datasets d ON d.id = ids.dataset_id
      WHERE ids.instance_id = v_instance_id
        AND id.instance_id = v_instance_id
        AND d.country_id = v_country_id
        AND COALESCE(d.metadata->>'category', 'Uncategorized') = v_category_key
      
      UNION ALL
      
      -- Hazard event scores (only for Hazard category)
      SELECT 
        hes.admin_pcode,
        hes.score,
        CASE 
          WHEN (v_method = 'custom_weighted' OR v_method = 'weighted_mean' OR v_method = 'weighted_normalized_sum' OR v_method = 'compounding_hazards') AND v_weights ? ('hazard_event_' || hes.hazard_event_id::TEXT)
          THEN (v_weights->('hazard_event_' || hes.hazard_event_id::TEXT))::NUMERIC
          ELSE 1.0
        END AS weight
      FROM hazard_event_scores hes
      INNER JOIN hazard_events he ON he.id = hes.hazard_event_id
      WHERE hes.instance_id = v_instance_id
        AND he.instance_id = v_instance_id
        AND he.country_id = v_country_id
        AND v_category_key = 'Hazard'
    ) AS all_scores
    GROUP BY admin_pcode
    HAVING COUNT(*) > 0 -- Only include admin areas with at least one score
    ON CONFLICT (instance_id, category, admin_pcode)
    DO UPDATE SET 
      score = EXCLUDED.score,
      computed_at = NOW();
    
    GET DIAGNOSTICS v_upserted_rows = ROW_COUNT;
  END LOOP;

  -- Calculate overall statistics after all categories are processed
  SELECT 
    COUNT(DISTINCT admin_pcode),
    COALESCE(SUM(score), 0)
  INTO v_location_count, v_total_score
  FROM instance_category_scores
  WHERE instance_id = v_instance_id;

  -- Return results
  RETURN jsonb_build_object(
    'status', 'done',
    'upserted_rows', v_upserted_rows,
    'framework_avg', CASE WHEN v_location_count > 0 THEN v_total_score / v_location_count ELSE 0 END
  );
END;
$$;

-- Create public wrapper functions with explicit overloads
-- Overload 1: Just instance_id (UUID)
CREATE OR REPLACE FUNCTION public.score_framework_aggregate(
  in_instance_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN public._score_framework_aggregate_impl(in_instance_id, NULL);
END;
$$;

-- Overload 2: Config and instance_id (JSONB, UUID)
CREATE OR REPLACE FUNCTION public.score_framework_aggregate(
  in_config JSONB,
  in_instance_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN public._score_framework_aggregate_impl(in_instance_id, in_config);
END;
$$;

-- Overload 3: Legacy - config with instance_id inside (JSONB)
CREATE OR REPLACE FUNCTION public.score_framework_aggregate(
  in_config JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_instance_id UUID;
BEGIN
  -- Extract instance_id from config
  IF in_config IS NULL OR NOT (in_config ? 'instance_id') THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'instance_id is required in config'
    );
  END IF;
  
  v_instance_id := (in_config->>'instance_id')::UUID;
  RETURN public._score_framework_aggregate_impl(v_instance_id, in_config);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.score_framework_aggregate(JSONB, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.score_framework_aggregate(JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.score_framework_aggregate(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public._score_framework_aggregate_impl(UUID, JSONB) TO anon, authenticated;

COMMENT ON FUNCTION public.score_framework_aggregate(UUID) IS 'Aggregates category scores (P1, P2, P3, Hazard, Underlying Vulnerability) into framework rollup scores, with country isolation';
COMMENT ON FUNCTION public.score_framework_aggregate(JSONB, UUID) IS 'Aggregates category scores with custom config, with country isolation';
COMMENT ON FUNCTION public.score_framework_aggregate(JSONB) IS 'Legacy: Aggregates category scores with instance_id in config, with country isolation';

-- ==============================
-- 2. Create score_final_aggregate function
-- ==============================
CREATE OR REPLACE FUNCTION public.score_final_aggregate(
  in_instance_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_framework_weight NUMERIC := 1.0;
  v_hazard_weight NUMERIC := 1.0;
  v_uv_weight NUMERIC := 1.0;
  v_upserted_rows INTEGER := 0;
  v_total_score NUMERIC := 0;
  v_location_count INTEGER := 0;
  v_sample_category_weight NUMERIC;
  v_country_id UUID;
BEGIN
  -- Get country_id from instance for filtering
  SELECT country_id INTO v_country_id
  FROM public.instances
  WHERE id = in_instance_id;
  
  IF v_country_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Instance not found or missing country_id'
    );
  END IF;

  -- Get category weights from instance_scoring_weights
  -- Get framework weight (P1, P2, P3 all have the same category_weight - it's the weight of the SSC Framework category)
  SELECT category_weight INTO v_sample_category_weight
  FROM instance_scoring_weights
  WHERE instance_id = in_instance_id
    AND category = 'SSC Framework - P1'
  LIMIT 1;
  
  -- Use the weight directly (it's already the category weight, not per-pillar)
  -- If NULL or not found, default to 0 (not 1.0) so it doesn't contribute if not set
  v_framework_weight := COALESCE(v_sample_category_weight, 0.0);
  
  -- Get Hazard category weight
  -- First check hazard_events.metadata (this is where hazard event category weights are stored)
  SELECT (metadata->>'category_weight')::NUMERIC INTO v_sample_category_weight
  FROM hazard_events
  WHERE instance_id = in_instance_id
    AND country_id = v_country_id
    AND metadata IS NOT NULL
    AND metadata ? 'category_weight'
  LIMIT 1;
  
  -- If found in hazard_events, use that
  IF v_sample_category_weight IS NOT NULL THEN
    v_hazard_weight := v_sample_category_weight;
  ELSE
    -- Fallback to instance_scoring_weights (for regular datasets in Hazard category)
    SELECT category_weight INTO v_sample_category_weight
    FROM instance_scoring_weights
    WHERE instance_id = in_instance_id
      AND category = 'Hazard'
    LIMIT 1;
    
    -- Use the weight directly, default to 0 if not found
    v_hazard_weight := COALESCE(v_sample_category_weight, 0.0);
  END IF;
  
  -- Get Underlying Vulnerability category weight
  SELECT category_weight INTO v_sample_category_weight
  FROM instance_scoring_weights
  WHERE instance_id = in_instance_id
    AND category = 'Underlying Vulnerability'
  LIMIT 1;
  
  -- Use the weight directly, default to 0 if not found
  v_uv_weight := COALESCE(v_sample_category_weight, 0.0);
  
  -- If all weights are 0, use equal weights as fallback (shouldn't happen if weights are saved)
  IF v_framework_weight = 0.0 AND v_hazard_weight = 0.0 AND v_uv_weight = 0.0 THEN
    v_framework_weight := 1.0;
    v_hazard_weight := 1.0;
    v_uv_weight := 1.0;
  END IF;

  -- Calculate and store final scores for ALL admin areas at once using bulk query
  -- This is much more efficient than row-by-row processing
  -- Only include categories with non-zero weights in the calculation
  WITH final_scores AS (
    SELECT 
      admin_pcode,
      MAX(framework_score) AS framework_score,
      MAX(hazard_score) AS hazard_score,
      MAX(uv_score) AS uv_score,
      -- Only include scores for categories with non-zero weights
      (CASE WHEN v_framework_weight > 0 AND MAX(framework_score) IS NOT NULL 
            THEN MAX(framework_score) * v_framework_weight ELSE 0 END +
       CASE WHEN v_hazard_weight > 0 AND MAX(hazard_score) IS NOT NULL 
            THEN MAX(hazard_score) * v_hazard_weight ELSE 0 END +
       CASE WHEN v_uv_weight > 0 AND MAX(uv_score) IS NOT NULL 
            THEN MAX(uv_score) * v_uv_weight ELSE 0 END) AS weighted_sum,
      -- Only count weights for categories with non-zero weights and existing scores
      (CASE WHEN v_framework_weight > 0 AND MAX(framework_score) IS NOT NULL 
            THEN v_framework_weight ELSE 0 END +
       CASE WHEN v_hazard_weight > 0 AND MAX(hazard_score) IS NOT NULL 
            THEN v_hazard_weight ELSE 0 END +
       CASE WHEN v_uv_weight > 0 AND MAX(uv_score) IS NOT NULL 
            THEN v_uv_weight ELSE 0 END) AS total_weight,
      -- Count components for fallback calculation (only count categories with non-zero weights)
      (CASE WHEN v_framework_weight > 0 AND MAX(framework_score) IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN v_hazard_weight > 0 AND MAX(hazard_score) IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN v_uv_weight > 0 AND MAX(uv_score) IS NOT NULL THEN 1 ELSE 0 END) AS component_count
    FROM (
      -- Get framework score (ONLY if framework_weight > 0 - completely exclude if weight is 0)
      SELECT 
        ics_framework.admin_pcode,
        ics_framework.score AS framework_score,
        NULL::NUMERIC AS hazard_score,
        NULL::NUMERIC AS uv_score
      FROM instance_category_scores ics_framework
      WHERE ics_framework.instance_id = in_instance_id
        AND ics_framework.category = 'SSC Framework'
        AND v_framework_weight > 0  -- Only include if weight > 0
      
      UNION ALL
      
      -- If no 'SSC Framework', calculate from P1, P2, P3 (ONLY if framework_weight > 0)
      SELECT 
        ics_pillar.admin_pcode,
        AVG(ics_pillar.score) AS framework_score,
        NULL::NUMERIC AS hazard_score,
        NULL::NUMERIC AS uv_score
      FROM instance_category_scores ics_pillar
      WHERE ics_pillar.instance_id = in_instance_id
        AND ics_pillar.category IN ('SSC Framework - P1', 'SSC Framework - P2', 'SSC Framework - P3')
        AND v_framework_weight > 0  -- Only include if weight > 0
        AND NOT EXISTS (
          SELECT 1 FROM instance_category_scores ics_framework_existing
          WHERE ics_framework_existing.instance_id = in_instance_id 
            AND ics_framework_existing.category = 'SSC Framework' 
            AND ics_framework_existing.admin_pcode = ics_pillar.admin_pcode
        )
      GROUP BY ics_pillar.admin_pcode
      
      UNION ALL
      
      -- Get hazard score (ONLY if hazard_weight > 0 - completely exclude if weight is 0)
      SELECT 
        ics_hazard.admin_pcode,
        NULL::NUMERIC AS framework_score,
        ics_hazard.score AS hazard_score,
        NULL::NUMERIC AS uv_score
      FROM instance_category_scores ics_hazard
      WHERE ics_hazard.instance_id = in_instance_id
        AND ics_hazard.category = 'Hazard'
        AND v_hazard_weight > 0  -- Only include if weight > 0
      
      UNION ALL
      
      -- Get underlying vulnerability score (ONLY if uv_weight > 0 - completely exclude if weight is 0)
      SELECT 
        ics_uv.admin_pcode,
        NULL::NUMERIC AS framework_score,
        NULL::NUMERIC AS hazard_score,
        ics_uv.score AS uv_score
      FROM instance_category_scores ics_uv
      WHERE ics_uv.instance_id = in_instance_id
        AND ics_uv.category = 'Underlying Vulnerability'
        AND v_uv_weight > 0  -- Only include if weight > 0
    ) AS category_scores
    GROUP BY admin_pcode
    HAVING COUNT(*) > 0 -- Only include admin areas with at least one category score
  )
  INSERT INTO instance_category_scores (instance_id, category, admin_pcode, score)
  SELECT 
    in_instance_id,
    'Overall' AS category,
    admin_pcode,
    CASE
      -- If only one category has a non-zero weight and a score, use that score directly
      WHEN v_framework_weight > 0 AND v_hazard_weight = 0 AND v_uv_weight = 0 AND framework_score IS NOT NULL 
        THEN framework_score
      WHEN v_framework_weight = 0 AND v_hazard_weight > 0 AND v_uv_weight = 0 AND hazard_score IS NOT NULL 
        THEN hazard_score
      WHEN v_framework_weight = 0 AND v_hazard_weight = 0 AND v_uv_weight > 0 AND uv_score IS NOT NULL 
        THEN uv_score
      -- Otherwise, use weighted average
      WHEN total_weight > 0 THEN ROUND((weighted_sum / total_weight)::NUMERIC, 4)
      WHEN component_count > 0 THEN ROUND(((COALESCE(framework_score, 0) + COALESCE(hazard_score, 0) + COALESCE(uv_score, 0)) / component_count)::NUMERIC, 4)
      ELSE NULL
    END AS final_score
  FROM final_scores
  WHERE (
    CASE
      -- If only one category has a non-zero weight and a score, use that score directly
      WHEN v_framework_weight > 0 AND v_hazard_weight = 0 AND v_uv_weight = 0 AND framework_score IS NOT NULL 
        THEN framework_score
      WHEN v_framework_weight = 0 AND v_hazard_weight > 0 AND v_uv_weight = 0 AND hazard_score IS NOT NULL 
        THEN hazard_score
      WHEN v_framework_weight = 0 AND v_hazard_weight = 0 AND v_uv_weight > 0 AND uv_score IS NOT NULL 
        THEN uv_score
      -- Otherwise, use weighted average
      WHEN total_weight > 0 THEN ROUND((weighted_sum / total_weight)::NUMERIC, 4)
      WHEN component_count > 0 THEN ROUND(((COALESCE(framework_score, 0) + COALESCE(hazard_score, 0) + COALESCE(uv_score, 0)) / component_count)::NUMERIC, 4)
      ELSE NULL
    END
  ) IS NOT NULL
  ON CONFLICT (instance_id, category, admin_pcode)
  DO UPDATE SET 
    score = EXCLUDED.score,
    computed_at = NOW();
  
  GET DIAGNOSTICS v_upserted_rows = ROW_COUNT;
  
  -- Calculate statistics
  SELECT 
    COUNT(*),
    COALESCE(SUM(score), 0)
  INTO v_location_count, v_total_score
  FROM instance_category_scores
  WHERE instance_id = in_instance_id
    AND category = 'Overall';

  -- Return results
  RETURN jsonb_build_object(
    'status', 'done',
    'upserted_rows', v_upserted_rows,
    'final_avg', CASE WHEN v_location_count > 0 THEN v_total_score / v_location_count ELSE 0 END
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.score_final_aggregate(UUID) TO anon, authenticated;

COMMENT ON FUNCTION public.score_final_aggregate IS 'Aggregates framework category scores (SSC Framework, Hazard, Underlying Vulnerability) into final overall scores for each admin area, with country isolation';
