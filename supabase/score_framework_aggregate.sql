-- ==============================
-- SCORE FRAMEWORK AGGREGATE RPC FUNCTION (OPTIMIZED VERSION)
-- ==============================
-- Aggregates category scores (P1, P2, P3, Hazard, Underlying Vulnerability) 
-- into framework rollup scores. Now includes hazard events in Hazard category.
-- OPTIMIZED: Uses bulk operations instead of row-by-row processing

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

CREATE OR REPLACE FUNCTION public.score_framework_aggregate(
  in_config JSONB DEFAULT NULL,
  in_instance_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_instance_id UUID;
  v_config JSONB;
  v_category_key TEXT;
  v_method TEXT;
  v_weights JSONB;
  v_upserted_rows INTEGER := 0;
  v_total_score NUMERIC := 0;
  v_location_count INTEGER := 0;
  v_weights_map JSONB;
  v_category_config JSONB;
BEGIN
  -- Handle function overloading: determine which parameters were provided
  IF in_instance_id IS NULL AND in_config IS NOT NULL AND jsonb_typeof(in_config) = 'object' AND in_config ? 'instance_id' THEN
    -- Legacy signature: (jsonb with instance_id inside)
    v_instance_id := (in_config->>'instance_id')::UUID;
    v_config := in_config;
  ELSIF in_instance_id IS NOT NULL AND in_config IS NULL THEN
    -- Simple signature: (in_instance_id)
    v_instance_id := in_instance_id;
    v_config := NULL;
  ELSIF in_instance_id IS NOT NULL AND in_config IS NOT NULL THEN
    -- Full signature: (in_config, in_instance_id)
    v_instance_id := in_instance_id;
    v_config := in_config;
  ELSE
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Invalid parameters: instance_id is required'
    );
  END IF;

  IF v_instance_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Instance ID is required'
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
            AND metadata IS NOT NULL
            AND metadata ? 'weight'
        ),
        '{}'::jsonb
      )
    INTO v_weights_map
    FROM instance_scoring_weights
    WHERE instance_id = v_instance_id;

    -- Build config with weighted_mean method and loaded weights
    v_config := jsonb_build_object(
      'categories', jsonb_build_array(
        jsonb_build_object('key', 'SSC Framework - P1', 'method', 'weighted_mean', 'weights', COALESCE(v_weights_map, '{}'::jsonb)),
        jsonb_build_object('key', 'SSC Framework - P2', 'method', 'weighted_mean', 'weights', COALESCE(v_weights_map, '{}'::jsonb)),
        jsonb_build_object('key', 'SSC Framework - P3', 'method', 'weighted_mean', 'weights', COALESCE(v_weights_map, '{}'::jsonb)),
        jsonb_build_object('key', 'Hazard', 'method', 'weighted_mean', 'weights', COALESCE(v_weights_map, '{}'::jsonb)),
        jsonb_build_object('key', 'Underlying Vulnerability', 'method', 'weighted_mean', 'weights', COALESCE(v_weights_map, '{}'::jsonb))
      )
    );
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
          WHEN (v_method = 'custom_weighted' OR v_method = 'weighted_mean') AND v_weights ? ids.dataset_id::TEXT 
          THEN (v_weights->ids.dataset_id::TEXT)::NUMERIC
          ELSE 1.0
        END AS weight
      FROM instance_dataset_scores ids
      INNER JOIN instance_datasets id ON id.dataset_id = ids.dataset_id
      INNER JOIN datasets d ON d.id = ids.dataset_id
      WHERE ids.instance_id = v_instance_id
        AND id.instance_id = v_instance_id
        AND d.category = v_category_key
      
      UNION ALL
      
      -- Hazard event scores (only for Hazard category)
      SELECT 
        hes.admin_pcode,
        hes.score,
        CASE 
          WHEN (v_method = 'custom_weighted' OR v_method = 'weighted_mean') AND v_weights ? ('hazard_event_' || hes.hazard_event_id::TEXT)
          THEN (v_weights->('hazard_event_' || hes.hazard_event_id::TEXT))::NUMERIC
          ELSE 1.0
        END AS weight
      FROM hazard_event_scores hes
      INNER JOIN hazard_events he ON he.id = hes.hazard_event_id
      WHERE hes.instance_id = v_instance_id
        AND he.instance_id = v_instance_id
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

