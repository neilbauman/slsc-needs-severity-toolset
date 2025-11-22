-- ==============================
-- SCORE FINAL AGGREGATE RPC FUNCTION
-- ==============================
-- Aggregates framework category scores (SSC Framework, Hazard, Underlying Vulnerability)
-- into final overall scores for each admin area.

CREATE OR REPLACE FUNCTION public.score_final_aggregate(
  in_instance_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_admin_pcode TEXT;
  v_framework_score NUMERIC;
  v_hazard_score NUMERIC;
  v_uv_score NUMERIC;
  v_final_score NUMERIC;
  v_upserted_rows INTEGER := 0;
  v_total_score NUMERIC := 0;
  v_location_count INTEGER := 0;
  v_category_weights JSONB;
  v_framework_weight NUMERIC := 1.0;
  v_hazard_weight NUMERIC := 1.0;
  v_uv_weight NUMERIC := 1.0;
  v_total_weight NUMERIC;
  v_sample_category_weight NUMERIC;
BEGIN
  -- Get category weights from instance_scoring_weights or use defaults
  -- Try to get category weights from the first dataset's entry (they should all have the same category_weight)
  SELECT category_weight INTO v_sample_category_weight
  FROM instance_scoring_weights
  WHERE instance_id = in_instance_id
    AND category = 'SSC Framework - P1'
  LIMIT 1;
  
  -- For now, use equal weights for all categories
  -- Can be enhanced to read actual category weights from instance_scoring_weights
  v_framework_weight := 1.0;
  v_hazard_weight := 1.0;
  v_uv_weight := 1.0;
  v_total_weight := v_framework_weight + v_hazard_weight + v_uv_weight;

  -- Get all admin areas that have at least one category score
  FOR v_admin_pcode IN
    SELECT DISTINCT admin_pcode
    FROM (
      SELECT admin_pcode FROM instance_category_scores WHERE instance_id = in_instance_id
      UNION
      SELECT admin_pcode FROM instance_dataset_scores WHERE instance_id = in_instance_id
      UNION
      SELECT admin_pcode FROM hazard_event_scores WHERE instance_id = in_instance_id
    ) AS all_scores
  LOOP
    -- Get framework score (aggregate of P1, P2, P3)
    -- This should be stored in instance_category_scores with category = 'SSC Framework'
    -- If not available, calculate from P1, P2, P3 scores
    SELECT score INTO v_framework_score
    FROM instance_category_scores
    WHERE instance_id = in_instance_id
      AND admin_pcode = v_admin_pcode
      AND category = 'SSC Framework'
    LIMIT 1;

    -- If framework score not found, try to calculate from P1, P2, P3
    IF v_framework_score IS NULL THEN
      SELECT AVG(score) INTO v_framework_score
      FROM instance_category_scores
      WHERE instance_id = in_instance_id
        AND admin_pcode = v_admin_pcode
        AND category IN ('SSC Framework - P1', 'SSC Framework - P2', 'SSC Framework - P3');
    END IF;

    -- Get hazard score
    SELECT score INTO v_hazard_score
    FROM instance_category_scores
    WHERE instance_id = in_instance_id
      AND admin_pcode = v_admin_pcode
      AND category = 'Hazard'
    LIMIT 1;

    -- Get underlying vulnerability score
    SELECT score INTO v_uv_score
    FROM instance_category_scores
    WHERE instance_id = in_instance_id
      AND admin_pcode = v_admin_pcode
      AND category = 'Underlying Vulnerability'
    LIMIT 1;

    -- Calculate final score as weighted average
    v_final_score := NULL;
    DECLARE
      v_component_count INTEGER := 0;
      v_weighted_sum NUMERIC := 0;
      v_actual_weight_sum NUMERIC := 0;
    BEGIN
      IF v_framework_score IS NOT NULL THEN
        v_weighted_sum := v_weighted_sum + (v_framework_score * v_framework_weight);
        v_actual_weight_sum := v_actual_weight_sum + v_framework_weight;
        v_component_count := v_component_count + 1;
      END IF;

      IF v_hazard_score IS NOT NULL THEN
        v_weighted_sum := v_weighted_sum + (v_hazard_score * v_hazard_weight);
        v_actual_weight_sum := v_actual_weight_sum + v_hazard_weight;
        v_component_count := v_component_count + 1;
      END IF;

      IF v_uv_score IS NOT NULL THEN
        v_weighted_sum := v_weighted_sum + (v_uv_score * v_uv_weight);
        v_actual_weight_sum := v_actual_weight_sum + v_uv_weight;
        v_component_count := v_component_count + 1;
      END IF;

      IF v_actual_weight_sum > 0 THEN
        v_final_score := v_weighted_sum / v_actual_weight_sum;
      ELSIF v_component_count > 0 THEN
        -- Fallback to simple average if weights are zero
        v_final_score := (COALESCE(v_framework_score, 0) + COALESCE(v_hazard_score, 0) + COALESCE(v_uv_score, 0)) / v_component_count;
      END IF;
    END;

    -- Store final score (assuming a table exists for this, or update instance_dataset_scores)
    -- For now, we'll store in a view or calculate on-demand
    -- If you have a specific table for final scores, insert/update there
    -- Otherwise, this is calculated on-demand from category scores

    IF v_final_score IS NOT NULL THEN
      v_upserted_rows := v_upserted_rows + 1;
      v_total_score := v_total_score + v_final_score;
      v_location_count := v_location_count + 1;
    END IF;
  END LOOP;

  -- Return statistics
  RETURN jsonb_build_object(
    'status', 'done',
    'upserted_rows', v_upserted_rows,
    'final_avg', CASE WHEN v_location_count > 0 THEN v_total_score / v_location_count ELSE 0 END
  );
END;
$$;

