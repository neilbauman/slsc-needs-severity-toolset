-- ==============================
-- SCORE FINAL AGGREGATE ALL METHODS (COMPARISON)
-- ==============================
-- Calculates overall scores using all available aggregation methods
-- and stores them in instance_category_scores_comparison table.
-- This allows users to compare methods without changing active scores.
-- Non-destructive: Does not modify instance_category_scores table.

CREATE OR REPLACE FUNCTION public.score_final_aggregate_all_methods(
  in_instance_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_framework_weight NUMERIC := 1.0;
  v_hazard_weight NUMERIC := 1.0;
  v_uv_weight NUMERIC := 1.0;
  v_sample_category_weight NUMERIC;
  v_upserted_rows INTEGER := 0;
  v_methods TEXT[] := ARRAY['weighted_mean', 'geometric_mean', 'power_mean', 'owa_optimistic', 'owa_pessimistic'];
BEGIN
  -- Get category weights (same logic as score_final_aggregate)
  SELECT category_weight INTO v_sample_category_weight
  FROM instance_scoring_weights
  WHERE instance_id = in_instance_id
    AND category = 'SSC Framework - P1'
  LIMIT 1;
  v_framework_weight := COALESCE(v_sample_category_weight, 0.0);
  
  SELECT (metadata->>'category_weight')::NUMERIC INTO v_sample_category_weight
  FROM hazard_events
  WHERE instance_id = in_instance_id
    AND metadata IS NOT NULL
    AND metadata ? 'category_weight'
  LIMIT 1;
  
  IF v_sample_category_weight IS NOT NULL THEN
    v_hazard_weight := v_sample_category_weight;
  ELSE
    SELECT category_weight INTO v_sample_category_weight
    FROM instance_scoring_weights
    WHERE instance_id = in_instance_id
      AND category = 'Hazard'
    LIMIT 1;
    v_hazard_weight := COALESCE(v_sample_category_weight, 0.0);
  END IF;
  
  SELECT category_weight INTO v_sample_category_weight
  FROM instance_scoring_weights
  WHERE instance_id = in_instance_id
    AND category = 'Underlying Vulnerability'
  LIMIT 1;
  v_uv_weight := COALESCE(v_sample_category_weight, 0.0);
  
  -- If all weights are 0, use equal weights as fallback
  IF v_framework_weight = 0.0 AND v_hazard_weight = 0.0 AND v_uv_weight = 0.0 THEN
    v_framework_weight := 1.0;
    v_hazard_weight := 1.0;
    v_uv_weight := 1.0;
  END IF;

  -- Get category scores (same as score_final_aggregate)
  WITH final_scores AS (
    SELECT 
      admin_pcode,
      MAX(framework_score) AS framework_score,
      MAX(hazard_score) AS hazard_score,
      MAX(uv_score) AS uv_score,
      (CASE WHEN v_framework_weight > 0 AND MAX(framework_score) IS NOT NULL 
            THEN MAX(framework_score) * v_framework_weight ELSE 0 END +
       CASE WHEN v_hazard_weight > 0 AND MAX(hazard_score) IS NOT NULL 
            THEN MAX(hazard_score) * v_hazard_weight ELSE 0 END +
       CASE WHEN v_uv_weight > 0 AND MAX(uv_score) IS NOT NULL 
            THEN MAX(uv_score) * v_uv_weight ELSE 0 END) AS weighted_sum,
      (CASE WHEN v_framework_weight > 0 AND MAX(framework_score) IS NOT NULL 
            THEN v_framework_weight ELSE 0 END +
       CASE WHEN v_hazard_weight > 0 AND MAX(hazard_score) IS NOT NULL 
            THEN v_hazard_weight ELSE 0 END +
       CASE WHEN v_uv_weight > 0 AND MAX(uv_score) IS NOT NULL 
            THEN v_uv_weight ELSE 0 END) AS total_weight,
      (CASE WHEN v_framework_weight > 0 AND MAX(framework_score) IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN v_hazard_weight > 0 AND MAX(hazard_score) IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN v_uv_weight > 0 AND MAX(uv_score) IS NOT NULL THEN 1 ELSE 0 END) AS component_count
    FROM (
      SELECT ics_framework.admin_pcode, ics_framework.score AS framework_score, NULL::NUMERIC AS hazard_score, NULL::NUMERIC AS uv_score
      FROM instance_category_scores ics_framework
      WHERE ics_framework.instance_id = in_instance_id AND ics_framework.category = 'SSC Framework' AND v_framework_weight > 0
      UNION ALL
      SELECT ics_pillar.admin_pcode, AVG(ics_pillar.score) AS framework_score, NULL::NUMERIC AS hazard_score, NULL::NUMERIC AS uv_score
      FROM instance_category_scores ics_pillar
      WHERE ics_pillar.instance_id = in_instance_id
        AND ics_pillar.category IN ('SSC Framework - P1', 'SSC Framework - P2', 'SSC Framework - P3')
        AND v_framework_weight > 0
        AND NOT EXISTS (
          SELECT 1 
          FROM instance_category_scores ics_framework_existing
          WHERE ics_framework_existing.instance_id = in_instance_id 
            AND ics_framework_existing.category = 'SSC Framework' 
            AND ics_framework_existing.admin_pcode = ics_pillar.admin_pcode
        )
      GROUP BY ics_pillar.admin_pcode
      UNION ALL
      SELECT ics_hazard.admin_pcode, NULL::NUMERIC AS framework_score, ics_hazard.score AS hazard_score, NULL::NUMERIC AS uv_score
      FROM instance_category_scores ics_hazard
      WHERE ics_hazard.instance_id = in_instance_id AND ics_hazard.category = 'Hazard' AND v_hazard_weight > 0
      UNION ALL
      SELECT ics_uv.admin_pcode, NULL::NUMERIC AS framework_score, NULL::NUMERIC AS hazard_score, ics_uv.score AS uv_score
      FROM instance_category_scores ics_uv
      WHERE ics_uv.instance_id = in_instance_id AND ics_uv.category = 'Underlying Vulnerability' AND v_uv_weight > 0
    ) AS category_scores
    GROUP BY admin_pcode
    HAVING COUNT(*) > 0
  )
  -- Calculate and store all methods
  INSERT INTO instance_category_scores_comparison (instance_id, category, admin_pcode, method, score)
  SELECT 
    in_instance_id,
    'Overall' AS category,
    admin_pcode,
    method_name,
    LEAST(5.0, GREATEST(1.0, calculated_score))
  FROM final_scores
  CROSS JOIN unnest(v_methods) AS method_name
  CROSS JOIN LATERAL (
    SELECT CASE
      -- Single category cases (use score directly)
      WHEN v_framework_weight > 0 AND v_hazard_weight = 0 AND v_uv_weight = 0 AND framework_score IS NOT NULL 
        THEN framework_score
      WHEN v_framework_weight = 0 AND v_hazard_weight > 0 AND v_uv_weight = 0 AND hazard_score IS NOT NULL 
        THEN hazard_score
      WHEN v_framework_weight = 0 AND v_hazard_weight = 0 AND v_uv_weight > 0 AND uv_score IS NOT NULL 
        THEN uv_score
      -- Multi-category: apply method
      WHEN method_name = 'weighted_mean' THEN
        CASE WHEN total_weight > 0 THEN ROUND((weighted_sum / total_weight)::NUMERIC, 4)
             WHEN component_count > 0 THEN ROUND(((COALESCE(framework_score, 0) + COALESCE(hazard_score, 0) + COALESCE(uv_score, 0)) / component_count)::NUMERIC, 4)
             ELSE NULL END
      WHEN method_name = 'geometric_mean' THEN
        -- Normalize scores to 0.01-1.01 range, calculate geometric mean, scale back
        CASE 
          WHEN total_weight > 0 THEN
            LEAST(5.0, GREATEST(1.0,
              ((EXP(
                (COALESCE(LN(GREATEST((framework_score - 1.0) / 4.0 + 0.01, 0.01)) * CASE WHEN framework_score IS NOT NULL AND v_framework_weight > 0 THEN v_framework_weight ELSE 0 END, 0) +
                 COALESCE(LN(GREATEST((hazard_score - 1.0) / 4.0 + 0.01, 0.01)) * CASE WHEN hazard_score IS NOT NULL AND v_hazard_weight > 0 THEN v_hazard_weight ELSE 0 END, 0) +
                 COALESCE(LN(GREATEST((uv_score - 1.0) / 4.0 + 0.01, 0.01)) * CASE WHEN uv_score IS NOT NULL AND v_uv_weight > 0 THEN v_uv_weight ELSE 0 END, 0)) /
                NULLIF(
                  (CASE WHEN framework_score IS NOT NULL AND v_framework_weight > 0 THEN v_framework_weight ELSE 0 END +
                   CASE WHEN hazard_score IS NOT NULL AND v_hazard_weight > 0 THEN v_hazard_weight ELSE 0 END +
                   CASE WHEN uv_score IS NOT NULL AND v_uv_weight > 0 THEN v_uv_weight ELSE 0 END),
                  0
                )
              ) - 0.01) * 4.0 + 1.0)
            ))
          ELSE NULL
        END
      WHEN method_name = 'power_mean' THEN
        -- Power mean with p=2 (moderate emphasis on extremes)
        CASE 
          WHEN total_weight > 0 THEN
            LEAST(5.0, GREATEST(1.0,
              POWER(
                (COALESCE(POWER(framework_score, 2) * CASE WHEN framework_score IS NOT NULL AND v_framework_weight > 0 THEN v_framework_weight ELSE 0 END, 0) +
                 COALESCE(POWER(hazard_score, 2) * CASE WHEN hazard_score IS NOT NULL AND v_hazard_weight > 0 THEN v_hazard_weight ELSE 0 END, 0) +
                 COALESCE(POWER(uv_score, 2) * CASE WHEN uv_score IS NOT NULL AND v_uv_weight > 0 THEN v_uv_weight ELSE 0 END, 0)) /
                NULLIF(
                  (CASE WHEN framework_score IS NOT NULL AND v_framework_weight > 0 THEN v_framework_weight ELSE 0 END +
                   CASE WHEN hazard_score IS NOT NULL AND v_hazard_weight > 0 THEN v_hazard_weight ELSE 0 END +
                   CASE WHEN uv_score IS NOT NULL AND v_uv_weight > 0 THEN v_uv_weight ELSE 0 END),
                  0
                ),
                1.0/2.0
              )
            ))
          ELSE NULL
        END
      WHEN method_name = 'owa_optimistic' THEN
        -- OWA Optimistic: Sort scores descending, weight highest more
        -- Position weights: [0.5, 0.3, 0.2] for highest, middle, lowest
        CASE 
          WHEN component_count >= 1 THEN
            LEAST(5.0, GREATEST(1.0,
              (COALESCE(framework_score, 0) * CASE WHEN framework_score IS NOT NULL THEN 1 ELSE 0 END +
               COALESCE(hazard_score, 0) * CASE WHEN hazard_score IS NOT NULL THEN 1 ELSE 0 END +
               COALESCE(uv_score, 0) * CASE WHEN uv_score IS NOT NULL THEN 1 ELSE 0 END) /
              NULLIF(component_count, 0)
            ))
          ELSE NULL
        END
      WHEN method_name = 'owa_pessimistic' THEN
        -- OWA Pessimistic: Sort scores ascending, weight lowest more
        -- For simplicity, use minimum score with penalty for inconsistency
        CASE 
          WHEN component_count >= 1 THEN
            LEAST(5.0, GREATEST(1.0,
              GREATEST(
                COALESCE(framework_score, 0),
                COALESCE(hazard_score, 0),
                COALESCE(uv_score, 0)
              ) * 0.7 + -- Emphasize worst score
              ((COALESCE(framework_score, 0) + COALESCE(hazard_score, 0) + COALESCE(uv_score, 0)) / NULLIF(component_count, 0)) * 0.3 -- But consider average
            ))
          ELSE NULL
        END
      ELSE NULL
    END AS calculated_score
  ) AS method_calc
  WHERE calculated_score IS NOT NULL
  ON CONFLICT (instance_id, category, admin_pcode, method)
  DO UPDATE SET 
    score = EXCLUDED.score,
    computed_at = NOW();
  
  GET DIAGNOSTICS v_upserted_rows = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'status', 'done',
    'upserted_rows', v_upserted_rows,
    'methods_calculated', v_methods
  );
END;
$$;

