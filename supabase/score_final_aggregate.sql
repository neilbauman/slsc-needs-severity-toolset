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
  
  -- Debug: Log how many scores exist for each category
  SELECT COUNT(*) INTO v_location_count FROM instance_category_scores 
    WHERE instance_id = in_instance_id AND category = 'SSC Framework';
  RAISE NOTICE 'SSC Framework scores found: %', v_location_count;
  
  SELECT COUNT(*) INTO v_location_count FROM instance_category_scores 
    WHERE instance_id = in_instance_id AND category IN ('SSC Framework - P1', 'SSC Framework - P2', 'SSC Framework - P3');
  RAISE NOTICE 'P1/P2/P3 scores found: %', v_location_count;
  
  SELECT COUNT(*) INTO v_location_count FROM instance_category_scores 
    WHERE instance_id = in_instance_id AND category = 'Hazard';
  RAISE NOTICE 'Hazard scores found: %', v_location_count;
  
  SELECT COUNT(*) INTO v_location_count FROM instance_category_scores 
    WHERE instance_id = in_instance_id AND category = 'Underlying Vulnerability';
  RAISE NOTICE 'UV scores found: %', v_location_count;
  
  -- If all weights are 0, use equal weights as fallback (shouldn't happen if weights are saved)
  IF v_framework_weight = 0.0 AND v_hazard_weight = 0.0 AND v_uv_weight = 0.0 THEN
    RAISE NOTICE 'All category weights are 0, using equal weights as fallback';
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
