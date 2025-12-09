-- ==============================
-- SCORE PRIORITY RANKING RPC FUNCTION
-- ==============================
-- Creates a relative prioritization ranking from absolute severity scores
-- Maps the highest priority location to 5, lowest to 1, with others distributed proportionally
-- This is percentile-based ranking for prioritization, distinct from absolute severity
--
-- The absolute 'Overall' score is used for PIN calculations (predicted severity)
-- The 'Priority' score is used for relative prioritization (ranking)

CREATE OR REPLACE FUNCTION public.score_priority_ranking(
  in_instance_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_min_score NUMERIC;
  v_max_score NUMERIC;
  v_score_range NUMERIC;
  v_upserted_rows INTEGER := 0;
  v_location_count INTEGER := 0;
BEGIN
  -- Get min and max overall scores for this instance
  SELECT 
    MIN(score),
    MAX(score),
    COUNT(*)
  INTO v_min_score, v_max_score, v_location_count
  FROM instance_category_scores
  WHERE instance_id = in_instance_id
    AND category = 'Overall'
    AND score IS NOT NULL;
  
  -- If no scores found, return error
  IF v_location_count = 0 THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'No Overall scores found. Please compute Overall scores first using score_final_aggregate.',
      'upserted_rows', 0
    );
  END IF;
  
  -- Calculate score range
  v_score_range := v_max_score - v_min_score;
  
  -- If all scores are the same, assign all to 3.0 (middle priority)
  IF v_score_range = 0 OR v_score_range IS NULL THEN
    INSERT INTO instance_category_scores (instance_id, category, admin_pcode, score)
    SELECT 
      in_instance_id,
      'Priority' AS category,
      admin_pcode,
      3.0 AS priority_score
    FROM instance_category_scores
    WHERE instance_id = in_instance_id
      AND category = 'Overall'
      AND score IS NOT NULL
    ON CONFLICT (instance_id, category, admin_pcode)
    DO UPDATE SET
      score = EXCLUDED.score,
      computed_at = NOW();
    
    GET DIAGNOSTICS v_upserted_rows = ROW_COUNT;
    
    RETURN jsonb_build_object(
      'status', 'done',
      'message', 'All locations have the same severity score. Assigned priority 3.0 to all.',
      'upserted_rows', v_upserted_rows,
      'min_score', v_min_score,
      'max_score', v_max_score
    );
  END IF;
  
  -- Calculate priority scores using percentile-based ranking
  -- Formula: priority = 1 + ((score - min_score) / (max_score - min_score)) * 4
  -- This maps: min_score → 1, max_score → 5, with linear distribution
  INSERT INTO instance_category_scores (instance_id, category, admin_pcode, score)
  SELECT 
    in_instance_id,
    'Priority' AS category,
    overall.admin_pcode,
    -- Map score to 1-5 range using percentile ranking
    -- Highest score (max) → 5, lowest score (min) → 1
    LEAST(5.0, GREATEST(1.0,
      ROUND(
        (1.0 + ((overall.score - v_min_score) / v_score_range) * 4.0)::NUMERIC,
        4
      )
    )) AS priority_score
  FROM instance_category_scores overall
  WHERE overall.instance_id = in_instance_id
    AND overall.category = 'Overall'
    AND overall.score IS NOT NULL
  ON CONFLICT (instance_id, category, admin_pcode)
  DO UPDATE SET
    score = EXCLUDED.score,
    computed_at = NOW();
  
  GET DIAGNOSTICS v_upserted_rows = ROW_COUNT;
  
  -- Return results
  RETURN jsonb_build_object(
    'status', 'done',
    'upserted_rows', v_upserted_rows,
    'min_severity', v_min_score,
    'max_severity', v_max_score,
    'priority_range', '1.0 to 5.0',
    'message', format('Priority ranking complete: %s locations ranked from %.2f (priority 1.0) to %.2f (priority 5.0)', 
      v_location_count, v_min_score, v_max_score)
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.score_priority_ranking(UUID) TO authenticated, anon;

-- Comments
COMMENT ON FUNCTION public.score_priority_ranking(UUID) IS 'Creates relative priority ranking (1-5) from absolute severity scores. Highest severity → priority 5, lowest → priority 1. Use Overall scores for PIN calculations, Priority scores for relative prioritization.';

