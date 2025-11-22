-- ==============================
-- SCORE FINAL AGGREGATE RPC FUNCTION (OPTIMIZED)
-- ==============================
-- Aggregates framework category scores (SSC Framework, Hazard, Underlying Vulnerability)
-- into final overall scores for each admin area.
-- Uses bulk operations and stores results in instance_category_scores with category = 'Overall'

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
BEGIN
  -- Get category weights from instance_scoring_weights
  -- Category weights are stored with each dataset entry, and all datasets in a category have the same category_weight
  -- These represent the weight of the category in the overall score calculation
  
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
  
  -- Debug: Log the weights being used
  RAISE NOTICE 'Category weights - Framework: %, Hazard: %, UV: %', v_framework_weight, v_hazard_weight, v_uv_weight;
  
  -- If all weights are 0, use equal weights as fallback (shouldn't happen if weights are saved)
  IF v_framework_weight = 0.0 AND v_hazard_weight = 0.0 AND v_uv_weight = 0.0 THEN
    RAISE NOTICE 'All category weights are 0, using equal weights as fallback';
    v_framework_weight := 1.0;
    v_hazard_weight := 1.0;
    v_uv_weight := 1.0;
  END IF;

  -- Calculate and store final scores for ALL admin areas at once using bulk query
  -- This is much more efficient than row-by-row processing
  WITH final_scores AS (
    SELECT 
      admin_pcode,
      MAX(framework_score) AS framework_score,
      MAX(hazard_score) AS hazard_score,
      MAX(uv_score) AS uv_score,
      (MAX(CASE WHEN framework_score IS NOT NULL THEN framework_score * v_framework_weight ELSE 0 END) +
       MAX(CASE WHEN hazard_score IS NOT NULL THEN hazard_score * v_hazard_weight ELSE 0 END) +
       MAX(CASE WHEN uv_score IS NOT NULL THEN uv_score * v_uv_weight ELSE 0 END)) AS weighted_sum,
      (CASE WHEN MAX(framework_score) IS NOT NULL THEN v_framework_weight ELSE 0 END +
       CASE WHEN MAX(hazard_score) IS NOT NULL THEN v_hazard_weight ELSE 0 END +
       CASE WHEN MAX(uv_score) IS NOT NULL THEN v_uv_weight ELSE 0 END) AS total_weight,
      (CASE WHEN MAX(framework_score) IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN MAX(hazard_score) IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN MAX(uv_score) IS NOT NULL THEN 1 ELSE 0 END) AS component_count
    FROM (
      -- Get framework score (aggregate of P1, P2, P3 or 'SSC Framework')
      SELECT 
        admin_pcode,
        score AS framework_score,
        NULL::NUMERIC AS hazard_score,
        NULL::NUMERIC AS uv_score
      FROM instance_category_scores
      WHERE instance_id = in_instance_id
        AND category = 'SSC Framework'
      
      UNION ALL
      
      -- If no 'SSC Framework', calculate from P1, P2, P3
      SELECT 
        admin_pcode,
        AVG(score) AS framework_score,
        NULL::NUMERIC AS hazard_score,
        NULL::NUMERIC AS uv_score
      FROM instance_category_scores
      WHERE instance_id = in_instance_id
        AND category IN ('SSC Framework - P1', 'SSC Framework - P2', 'SSC Framework - P3')
      GROUP BY admin_pcode
      
      UNION ALL
      
      -- Get hazard score
      SELECT 
        admin_pcode,
        NULL::NUMERIC AS framework_score,
        score AS hazard_score,
        NULL::NUMERIC AS uv_score
      FROM instance_category_scores
      WHERE instance_id = in_instance_id
        AND category = 'Hazard'
      
      UNION ALL
      
      -- Get underlying vulnerability score
      SELECT 
        admin_pcode,
        NULL::NUMERIC AS framework_score,
        NULL::NUMERIC AS hazard_score,
        score AS uv_score
      FROM instance_category_scores
      WHERE instance_id = in_instance_id
        AND category = 'Underlying Vulnerability'
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
      WHEN total_weight > 0 THEN weighted_sum / total_weight
      WHEN component_count > 0 THEN (COALESCE(framework_score, 0) + COALESCE(hazard_score, 0) + COALESCE(uv_score, 0)) / component_count
      ELSE NULL
    END AS final_score
  FROM final_scores
  WHERE (
    CASE
      WHEN total_weight > 0 THEN weighted_sum / total_weight
      WHEN component_count > 0 THEN (COALESCE(framework_score, 0) + COALESCE(hazard_score, 0) + COALESCE(uv_score, 0)) / component_count
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
