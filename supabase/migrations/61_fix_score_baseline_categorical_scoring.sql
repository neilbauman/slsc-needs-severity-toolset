-- ============================================
-- FIX SCORE_BASELINE CATEGORICAL SCORING
-- ============================================
-- Fix bug where categorical scoring doesn't read category_scores correctly
-- The scoring_config structure is: { "category_scores": { "category": score } }
-- But the function was trying to read scoring_config->>category directly

CREATE OR REPLACE FUNCTION public.score_baseline(
  in_baseline_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_baseline RECORD;
  v_dataset RECORD;
  v_scored_count INTEGER := 0;
  v_category_scores JSONB := '{}';
BEGIN
  -- Get baseline info
  SELECT * INTO v_baseline
  FROM country_baselines
  WHERE id = in_baseline_id;
  
  IF v_baseline IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Baseline not found'
    );
  END IF;
  
  -- Clear existing baseline scores
  DELETE FROM baseline_scores WHERE baseline_id = in_baseline_id;
  
  -- Score each dataset in the baseline
  FOR v_dataset IN
    SELECT 
      bd.id,
      bd.dataset_id,
      bd.category,
      bd.weight,
      bd.scoring_config,
      d.name AS dataset_name,
      d.type AS dataset_type,
      d.admin_level
    FROM baseline_datasets bd
    JOIN datasets d ON d.id = bd.dataset_id
    WHERE bd.baseline_id = in_baseline_id
    ORDER BY bd.category, d.name
  LOOP
    -- Score numeric datasets using min-max normalization (national scope)
    IF v_dataset.dataset_type = 'numeric' THEN
      INSERT INTO baseline_scores (baseline_id, admin_pcode, category, score, computed_at)
      SELECT 
        in_baseline_id,
        dvn.admin_pcode,
        COALESCE(v_dataset.category, 'Uncategorized'),
        -- Min-max normalization to 1-5 scale
        CASE 
          WHEN max_val = min_val THEN 3.0  -- Default to middle if no variance
          ELSE LEAST(5.0, GREATEST(1.0, 
            1.0 + ((dvn.value - min_val) / NULLIF(max_val - min_val, 0)) * 4.0
          ))
        END,
        NOW()
      FROM dataset_values_numeric dvn
      CROSS JOIN (
        SELECT 
          MIN(value) AS min_val,
          MAX(value) AS max_val
        FROM dataset_values_numeric
        WHERE dataset_id = v_dataset.dataset_id
      ) AS stats
      WHERE dvn.dataset_id = v_dataset.dataset_id
        AND dvn.value IS NOT NULL
      ON CONFLICT (baseline_id, admin_pcode, category)
      DO UPDATE SET 
        score = EXCLUDED.score,
        computed_at = NOW();
      
      v_scored_count := v_scored_count + 1;
    END IF;
    
    -- Score categorical datasets using category_scores from scoring_config
    IF v_dataset.dataset_type = 'categorical' THEN
      INSERT INTO baseline_scores (baseline_id, admin_pcode, category, score, computed_at)
      SELECT 
        in_baseline_id,
        dvc.admin_pcode,
        COALESCE(v_dataset.category, 'Uncategorized'),
        -- Weighted average of category scores
        CASE
          WHEN SUM(COALESCE(dvc.value, 1.0)) > 0 THEN
            SUM(
              COALESCE(
                (v_dataset.scoring_config->'category_scores'->>dvc.category)::NUMERIC,
                3.0  -- Default to middle score if category not in config
              ) * COALESCE(dvc.value, 1.0)
            ) / SUM(COALESCE(dvc.value, 1.0))
          ELSE 3.0  -- Default if no values
        END,
        NOW()
      FROM dataset_values_categorical dvc
      WHERE dvc.dataset_id = v_dataset.dataset_id
      GROUP BY dvc.admin_pcode
      ON CONFLICT (baseline_id, admin_pcode, category)
      DO UPDATE SET 
        score = EXCLUDED.score,
        computed_at = NOW();
      
      v_scored_count := v_scored_count + 1;
    END IF;
  END LOOP;
  
  -- Update baseline computed_at timestamp
  UPDATE country_baselines 
  SET computed_at = NOW(), updated_at = NOW()
  WHERE id = in_baseline_id;
  
  -- Return results
  RETURN jsonb_build_object(
    'status', 'done',
    'baseline_id', in_baseline_id,
    'datasets_scored', v_scored_count,
    'total_scores', (SELECT COUNT(*) FROM baseline_scores WHERE baseline_id = in_baseline_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.score_baseline(UUID) TO authenticated;

COMMENT ON FUNCTION public.score_baseline IS 
  'Computes baseline scores for all datasets in a country baseline using national normalization. Fixed categorical scoring to read from scoring_config->category_scores.';
