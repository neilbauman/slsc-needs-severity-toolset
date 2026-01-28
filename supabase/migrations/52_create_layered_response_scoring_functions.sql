-- ============================================
-- LAYERED RESPONSE SCORING FUNCTIONS
-- ============================================
-- RPC functions for computing scores in the layered response architecture:
-- 1. score_baseline - Compute baseline scores for a country baseline
-- 2. score_response_baseline - Compute baseline scores within a response's affected area
-- 3. score_response_layer - Compute scores for a response layer
-- 4. compute_response_scores - Aggregate baseline + layers into final response scores

-- ============================================
-- 1. SCORE_BASELINE: Compute national baseline scores
-- ============================================
-- Scores all datasets in a country baseline using national normalization

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
    ORDER BY bd.order_index
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
    
    -- Score categorical datasets (average of category scores)
    IF v_dataset.dataset_type = 'categorical' THEN
      -- For categorical, we need predefined category scores
      -- Use scoring_config if available, otherwise default to equal distribution
      INSERT INTO baseline_scores (baseline_id, admin_pcode, category, score, computed_at)
      SELECT 
        in_baseline_id,
        dvc.admin_pcode,
        COALESCE(v_dataset.category, 'Uncategorized'),
        -- Default categorical scoring: weighted average
        COALESCE(
          (
            SELECT AVG(
              CASE 
                WHEN v_dataset.scoring_config IS NOT NULL 
                     AND v_dataset.scoring_config ? dvc.category 
                THEN (v_dataset.scoring_config->>dvc.category)::NUMERIC
                ELSE 3.0  -- Default to middle score
              END * COALESCE(dvc.value, 1.0)
            ) / NULLIF(SUM(COALESCE(dvc.value, 1.0)), 0)
          ),
          3.0
        ),
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
  'Computes baseline scores for all datasets in a country baseline using national normalization';

-- ============================================
-- 2. SCORE_RESPONSE_BASELINE: Compute baseline scores for a response
-- ============================================
-- Scores baseline datasets within a response's affected area
-- Supports both national and affected_area normalization scopes

CREATE OR REPLACE FUNCTION public.score_response_baseline(
  in_response_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_response RECORD;
  v_baseline RECORD;
  v_dataset RECORD;
  v_affected_adm3_codes TEXT[];
  v_scope TEXT;
  v_scored_count INTEGER := 0;
BEGIN
  -- Get response info
  SELECT * INTO v_response
  FROM responses
  WHERE id = in_response_id;
  
  IF v_response IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Response not found');
  END IF;
  
  IF v_response.baseline_id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Response has no baseline configured');
  END IF;
  
  -- Get baseline info
  SELECT * INTO v_baseline
  FROM country_baselines
  WHERE id = v_response.baseline_id;
  
  -- Determine normalization scope
  v_scope := COALESCE(v_response.normalization_scope::TEXT, 'affected_area');
  
  -- Get affected ADM3 codes from admin_scope (ADM2 -> ADM3)
  IF v_response.admin_scope IS NOT NULL AND array_length(v_response.admin_scope, 1) > 0 THEN
    SELECT ARRAY_AGG(DISTINCT admin_pcode) INTO v_affected_adm3_codes
    FROM admin_boundaries
    WHERE admin_level = 'ADM3'
      AND (parent_pcode = ANY(v_response.admin_scope)
           OR EXISTS (
             SELECT 1 FROM unnest(v_response.admin_scope) AS adm2_code
             WHERE admin_pcode LIKE adm2_code || '%'
           ));
  END IF;
  
  -- Clear existing response baseline scores (layer_id = NULL indicates baseline)
  DELETE FROM response_scores 
  WHERE response_id = in_response_id 
    AND layer_id IS NULL;
  
  -- Score each baseline dataset
  FOR v_dataset IN
    SELECT 
      bd.dataset_id,
      bd.category,
      bd.weight,
      bd.scoring_config,
      d.name AS dataset_name,
      d.type AS dataset_type,
      d.admin_level
    FROM baseline_datasets bd
    JOIN datasets d ON d.id = bd.dataset_id
    WHERE bd.baseline_id = v_response.baseline_id
    ORDER BY bd.order_index
  LOOP
    -- Score numeric datasets
    IF v_dataset.dataset_type = 'numeric' THEN
      INSERT INTO response_scores (
        response_id, admin_pcode, category, score, 
        baseline_component, layer_component, layer_id, computed_at
      )
      SELECT 
        in_response_id,
        dvn.admin_pcode,
        COALESCE(v_dataset.category, 'Uncategorized'),
        -- Min-max normalization based on scope
        CASE 
          WHEN stats.max_val = stats.min_val THEN 3.0
          ELSE LEAST(5.0, GREATEST(1.0, 
            1.0 + ((dvn.value - stats.min_val) / NULLIF(stats.max_val - stats.min_val, 0)) * 4.0
          ))
        END,
        -- baseline_component = the score itself for baseline
        CASE 
          WHEN stats.max_val = stats.min_val THEN 3.0
          ELSE LEAST(5.0, GREATEST(1.0, 
            1.0 + ((dvn.value - stats.min_val) / NULLIF(stats.max_val - stats.min_val, 0)) * 4.0
          ))
        END,
        0.0,  -- layer_component = 0 for baseline
        NULL, -- layer_id = NULL for baseline scores
        NOW()
      FROM dataset_values_numeric dvn
      CROSS JOIN (
        SELECT 
          MIN(value) AS min_val,
          MAX(value) AS max_val
        FROM dataset_values_numeric
        WHERE dataset_id = v_dataset.dataset_id
          -- Normalization scope: national or affected_area
          AND (
            v_scope = 'national' 
            OR v_affected_adm3_codes IS NULL 
            OR admin_pcode = ANY(v_affected_adm3_codes)
          )
      ) AS stats
      WHERE dvn.dataset_id = v_dataset.dataset_id
        AND dvn.value IS NOT NULL
        -- Only include affected areas in the response
        AND (v_affected_adm3_codes IS NULL OR dvn.admin_pcode = ANY(v_affected_adm3_codes))
      ON CONFLICT (response_id, admin_pcode, category, layer_id)
      DO UPDATE SET 
        score = EXCLUDED.score,
        baseline_component = EXCLUDED.baseline_component,
        layer_component = EXCLUDED.layer_component,
        computed_at = NOW();
      
      v_scored_count := v_scored_count + 1;
    END IF;
  END LOOP;
  
  -- Update response timestamp
  UPDATE responses SET updated_at = NOW() WHERE id = in_response_id;
  
  RETURN jsonb_build_object(
    'status', 'done',
    'response_id', in_response_id,
    'normalization_scope', v_scope,
    'affected_areas', COALESCE(array_length(v_affected_adm3_codes, 1), 0),
    'datasets_scored', v_scored_count,
    'total_scores', (SELECT COUNT(*) FROM response_scores WHERE response_id = in_response_id AND layer_id IS NULL)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.score_response_baseline(UUID) TO authenticated;
COMMENT ON FUNCTION public.score_response_baseline IS 
  'Computes baseline scores for a response using the configured normalization scope';

-- ============================================
-- 3. SCORE_RESPONSE_LAYER: Compute scores for a single layer
-- ============================================
-- Scores hazard events and datasets within a layer, computing adjustments relative to baseline

CREATE OR REPLACE FUNCTION public.score_response_layer(
  in_layer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_layer RECORD;
  v_response RECORD;
  v_affected_adm3_codes TEXT[];
  v_hazard_event RECORD;
  v_scored_count INTEGER := 0;
  v_effect_multiplier NUMERIC;
BEGIN
  -- Get layer info
  SELECT * INTO v_layer
  FROM response_layers
  WHERE id = in_layer_id;
  
  IF v_layer IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Layer not found');
  END IF;
  
  -- Get response info
  SELECT * INTO v_response
  FROM responses
  WHERE id = v_layer.response_id;
  
  -- Get affected ADM3 codes
  IF v_response.admin_scope IS NOT NULL AND array_length(v_response.admin_scope, 1) > 0 THEN
    SELECT ARRAY_AGG(DISTINCT admin_pcode) INTO v_affected_adm3_codes
    FROM admin_boundaries
    WHERE admin_level = 'ADM3'
      AND (parent_pcode = ANY(v_response.admin_scope)
           OR EXISTS (
             SELECT 1 FROM unnest(v_response.admin_scope) AS adm2_code
             WHERE admin_pcode LIKE adm2_code || '%'
           ));
  END IF;
  
  -- Determine effect multiplier based on direction
  v_effect_multiplier := CASE v_layer.effect_direction
    WHEN 'increase' THEN 1.0
    WHEN 'decrease' THEN -1.0
    ELSE 1.0  -- 'mixed' defaults to increase
  END;
  
  -- Clear existing layer scores
  DELETE FROM layer_scores WHERE layer_id = in_layer_id;
  
  -- Score hazard events linked to this layer
  FOR v_hazard_event IN
    SELECT 
      lhe.hazard_event_id,
      lhe.weight,
      lhe.scoring_config,
      he.name AS event_name,
      he.event_type
    FROM layer_hazard_events lhe
    JOIN hazard_events he ON he.id = lhe.hazard_event_id
    WHERE lhe.layer_id = in_layer_id
  LOOP
    -- Check if hazard event scores exist
    INSERT INTO layer_scores (
      layer_id, admin_pcode, category, score, 
      baseline_score, adjustment_value, computed_at
    )
    SELECT 
      in_layer_id,
      hes.admin_pcode,
      'Hazard',
      hes.score,
      -- Get baseline score for this category and location
      COALESCE(
        (SELECT rs.score FROM response_scores rs 
         WHERE rs.response_id = v_response.id 
           AND rs.admin_pcode = hes.admin_pcode 
           AND rs.category = 'Hazard' 
           AND rs.layer_id IS NULL
         LIMIT 1),
        3.0  -- Default baseline if not found
      ),
      -- Adjustment = difference from baseline
      hes.score - COALESCE(
        (SELECT rs.score FROM response_scores rs 
         WHERE rs.response_id = v_response.id 
           AND rs.admin_pcode = hes.admin_pcode 
           AND rs.category = 'Hazard' 
           AND rs.layer_id IS NULL
         LIMIT 1),
        3.0
      ),
      NOW()
    FROM hazard_event_scores hes
    WHERE hes.hazard_event_id = v_hazard_event.hazard_event_id
      AND hes.instance_id = (SELECT legacy_instance_id FROM responses WHERE id = v_response.id)
      AND (v_affected_adm3_codes IS NULL OR hes.admin_pcode = ANY(v_affected_adm3_codes))
    ON CONFLICT (layer_id, admin_pcode, category)
    DO UPDATE SET 
      score = EXCLUDED.score,
      baseline_score = EXCLUDED.baseline_score,
      adjustment_value = EXCLUDED.adjustment_value,
      computed_at = NOW();
    
    v_scored_count := v_scored_count + 1;
  END LOOP;
  
  -- Update layer timestamp
  UPDATE response_layers SET updated_at = NOW() WHERE id = in_layer_id;
  
  RETURN jsonb_build_object(
    'status', 'done',
    'layer_id', in_layer_id,
    'layer_name', v_layer.name,
    'layer_type', v_layer.layer_type,
    'effect_direction', v_layer.effect_direction,
    'hazard_events_scored', v_scored_count,
    'total_scores', (SELECT COUNT(*) FROM layer_scores WHERE layer_id = in_layer_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.score_response_layer(UUID) TO authenticated;
COMMENT ON FUNCTION public.score_response_layer IS 
  'Computes scores for a response layer including hazard events and adjustment calculations';

-- ============================================
-- 4. COMPUTE_RESPONSE_SCORES: Aggregate all scores for a response
-- ============================================
-- Combines baseline scores with layer adjustments to compute final response scores

CREATE OR REPLACE FUNCTION public.compute_response_scores(
  in_response_id UUID,
  in_up_to_layer_id UUID DEFAULT NULL  -- Optional: compute up to a specific layer
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_response RECORD;
  v_layer RECORD;
  v_affected_adm3_codes TEXT[];
  v_max_layer_order INTEGER;
BEGIN
  -- Get response info
  SELECT * INTO v_response
  FROM responses
  WHERE id = in_response_id;
  
  IF v_response IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Response not found');
  END IF;
  
  -- Determine which layers to include
  IF in_up_to_layer_id IS NOT NULL THEN
    SELECT order_index INTO v_max_layer_order
    FROM response_layers
    WHERE id = in_up_to_layer_id;
  ELSE
    SELECT MAX(order_index) INTO v_max_layer_order
    FROM response_layers
    WHERE response_id = in_response_id;
  END IF;
  
  -- Get affected ADM3 codes
  IF v_response.admin_scope IS NOT NULL THEN
    SELECT ARRAY_AGG(DISTINCT admin_pcode) INTO v_affected_adm3_codes
    FROM admin_boundaries
    WHERE admin_level = 'ADM3'
      AND (parent_pcode = ANY(v_response.admin_scope)
           OR EXISTS (
             SELECT 1 FROM unnest(v_response.admin_scope) AS adm2_code
             WHERE admin_pcode LIKE adm2_code || '%'
           ));
  END IF;
  
  -- First, ensure baseline scores are computed
  IF NOT EXISTS (SELECT 1 FROM response_scores WHERE response_id = in_response_id AND layer_id IS NULL LIMIT 1) THEN
    PERFORM score_response_baseline(in_response_id);
  END IF;
  
  -- Score each layer up to the target
  FOR v_layer IN
    SELECT *
    FROM response_layers
    WHERE response_id = in_response_id
      AND (v_max_layer_order IS NULL OR order_index <= v_max_layer_order)
    ORDER BY order_index
  LOOP
    -- Check if layer needs scoring
    IF NOT EXISTS (SELECT 1 FROM layer_scores WHERE layer_id = v_layer.id LIMIT 1) THEN
      PERFORM score_response_layer(v_layer.id);
    END IF;
  END LOOP;
  
  -- Now compute aggregated response scores
  -- Delete existing aggregated scores for the target layer
  DELETE FROM response_scores 
  WHERE response_id = in_response_id 
    AND layer_id = in_up_to_layer_id;
  
  -- Insert aggregated scores: baseline + sum of layer adjustments
  INSERT INTO response_scores (
    response_id, admin_pcode, category, score,
    baseline_component, layer_component, layer_id, computed_at
  )
  SELECT 
    in_response_id,
    admin_pcode,
    category,
    -- Final score = baseline + weighted sum of adjustments, clamped to 1-5
    LEAST(5.0, GREATEST(1.0, baseline_score + total_adjustment)),
    baseline_score,
    total_adjustment,
    in_up_to_layer_id,
    NOW()
  FROM (
    SELECT 
      COALESCE(b.admin_pcode, l.admin_pcode) AS admin_pcode,
      COALESCE(b.category, l.category) AS category,
      COALESCE(b.score, 3.0) AS baseline_score,
      COALESCE(SUM(l.adjustment_value * rl.weight), 0) AS total_adjustment
    FROM (
      -- Baseline scores (layer_id IS NULL)
      SELECT admin_pcode, category, score
      FROM response_scores
      WHERE response_id = in_response_id AND layer_id IS NULL
    ) b
    FULL OUTER JOIN (
      -- Layer adjustments
      SELECT ls.admin_pcode, ls.category, ls.adjustment_value, ls.layer_id
      FROM layer_scores ls
      JOIN response_layers rl ON rl.id = ls.layer_id
      WHERE rl.response_id = in_response_id
        AND (v_max_layer_order IS NULL OR rl.order_index <= v_max_layer_order)
    ) l ON b.admin_pcode = l.admin_pcode AND b.category = l.category
    LEFT JOIN response_layers rl ON rl.id = l.layer_id
    GROUP BY COALESCE(b.admin_pcode, l.admin_pcode), COALESCE(b.category, l.category), COALESCE(b.score, 3.0)
  ) AS aggregated
  ON CONFLICT (response_id, admin_pcode, category, layer_id)
  DO UPDATE SET 
    score = EXCLUDED.score,
    baseline_component = EXCLUDED.baseline_component,
    layer_component = EXCLUDED.layer_component,
    computed_at = NOW();
  
  -- Compute Overall score by averaging categories
  INSERT INTO response_scores (
    response_id, admin_pcode, category, score,
    baseline_component, layer_component, layer_id, computed_at
  )
  SELECT 
    in_response_id,
    admin_pcode,
    'Overall',
    AVG(score),
    AVG(baseline_component),
    AVG(layer_component),
    in_up_to_layer_id,
    NOW()
  FROM response_scores
  WHERE response_id = in_response_id
    AND layer_id IS NOT DISTINCT FROM in_up_to_layer_id
    AND category != 'Overall'
  GROUP BY admin_pcode
  ON CONFLICT (response_id, admin_pcode, category, layer_id)
  DO UPDATE SET 
    score = EXCLUDED.score,
    baseline_component = EXCLUDED.baseline_component,
    layer_component = EXCLUDED.layer_component,
    computed_at = NOW();
  
  RETURN jsonb_build_object(
    'status', 'done',
    'response_id', in_response_id,
    'up_to_layer_id', in_up_to_layer_id,
    'layers_included', v_max_layer_order,
    'total_scores', (
      SELECT COUNT(*) FROM response_scores 
      WHERE response_id = in_response_id 
        AND layer_id IS NOT DISTINCT FROM in_up_to_layer_id
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_response_scores(UUID, UUID) TO authenticated;
COMMENT ON FUNCTION public.compute_response_scores IS 
  'Aggregates baseline and layer scores into final response scores';

-- ============================================
-- 5. HELPER: Get response score summary
-- ============================================

CREATE OR REPLACE FUNCTION public.get_response_score_summary(
  in_response_id UUID,
  in_layer_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'response_id', in_response_id,
    'layer_id', in_layer_id,
    'categories', (
      SELECT jsonb_agg(cat_stats) FROM (
        SELECT jsonb_build_object(
          'category', category,
          'avg_score', ROUND(AVG(score)::NUMERIC, 2),
          'min_score', ROUND(MIN(score)::NUMERIC, 2),
          'max_score', ROUND(MAX(score)::NUMERIC, 2),
          'avg_baseline', ROUND(AVG(baseline_component)::NUMERIC, 2),
          'avg_adjustment', ROUND(AVG(layer_component)::NUMERIC, 2),
          'area_count', COUNT(*)
        ) AS cat_stats
        FROM response_scores
        WHERE response_id = in_response_id
          AND layer_id IS NOT DISTINCT FROM in_layer_id
        GROUP BY category
      ) AS category_agg
    ),
    'total_areas', (
      SELECT COUNT(DISTINCT admin_pcode)
      FROM response_scores
      WHERE response_id = in_response_id
        AND layer_id IS NOT DISTINCT FROM in_layer_id
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_response_score_summary(UUID, UUID) TO authenticated;
COMMENT ON FUNCTION public.get_response_score_summary IS 
  'Returns summary statistics for response scores at a given layer point';

-- ============================================
-- Grant permissions
-- ============================================
GRANT ALL ON TABLE public.baseline_scores TO authenticated;
GRANT ALL ON TABLE public.layer_scores TO authenticated;
GRANT ALL ON TABLE public.response_scores TO authenticated;
