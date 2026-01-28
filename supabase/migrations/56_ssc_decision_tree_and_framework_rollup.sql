-- ============================================
-- SSC DECISION TREE & FRAMEWORK ROLLUP
-- ============================================
-- 1. Lookup table from "SSC Decision tree.xlsx": (P1,P2,P3) -> overall severity score.
--    P1 = shelter (1-5), P2 = NFI/domestic functions (1-4), P3 = access to services (1-4).
-- 2. Helper ssc_decision_tree_score(p1,p2,p3) for use in aggregating pillars.
-- 3. score_framework_aggregate: when config has ssc_overall with method 'ssc_decision_tree'
--    (or average/worst_case/custom_weighted), compute 'SSC Framework' from P1,P2,P3 and insert it.
--    Hazard and Underlying Vulnerability stay separate; overall rollup (SSC + Hazard + UV) is unchanged.

-- 1. Lookup table (P1 1-5, P2 1-4, P3 1-4 -> score 1-5)
CREATE TABLE IF NOT EXISTS public.ssc_decision_tree_lookup (
  p1 SMALLINT NOT NULL,
  p2 SMALLINT NOT NULL,
  p3 SMALLINT NOT NULL,
  score SMALLINT NOT NULL,
  PRIMARY KEY (p1, p2, p3)
);

INSERT INTO public.ssc_decision_tree_lookup (p1, p2, p3, score) VALUES
  (1,1,1,1),(1,1,2,1),(1,1,3,2),(1,1,4,1),(1,2,1,1),(1,2,2,1),(1,2,3,2),(1,2,4,2),
  (1,3,1,2),(1,3,2,2),(1,3,3,2),(1,3,4,3),(1,4,1,2),(1,4,2,2),(1,4,3,2),(1,4,4,3),
  (2,1,1,2),(2,1,2,2),(2,1,3,2),(2,1,4,2),(2,2,1,2),(2,2,2,2),(2,2,3,2),(2,2,4,2),
  (2,3,1,2),(2,3,2,2),(2,3,3,2),(2,3,4,3),(2,4,1,2),(2,4,2,2),(2,4,3,3),(2,4,4,3),
  (3,1,1,3),(3,1,2,3),(3,1,3,3),(3,1,4,3),(3,2,1,3),(3,2,2,3),(3,2,3,3),(3,2,4,3),
  (3,3,1,3),(3,3,2,3),(3,3,3,3),(3,3,4,3),(3,4,1,3),(3,4,2,3),(3,4,3,3),(3,4,4,4),
  (4,1,1,3),(4,1,2,3),(4,1,3,3),(4,1,4,3),(4,2,1,3),(4,2,2,3),(4,2,3,3),(4,2,4,3),
  (4,3,1,4),(4,3,2,4),(4,3,3,4),(4,3,4,4),(4,4,1,4),(4,4,2,4),(4,4,3,4),(4,4,4,4),
  (5,1,1,5),(5,1,2,5),(5,1,3,5),(5,1,4,5),(5,2,1,5),(5,2,2,5),(5,2,3,5),(5,2,4,5),
  (5,3,1,5),(5,3,2,5),(5,3,3,5),(5,3,4,5),(5,4,1,5),(5,4,2,5),(5,4,3,5),(5,4,4,5)
ON CONFLICT (p1, p2, p3) DO UPDATE SET score = EXCLUDED.score;

COMMENT ON TABLE public.ssc_decision_tree_lookup IS 'SSC decision tree: (P1 shelter, P2 NFI, P3 access) -> overall severity 1-5. Source: SSC Decision tree.xlsx';

-- 2. Helper: (p1,p2,p3) -> score; clamps to table range (P2,P3 1-4); fallback = average
CREATE OR REPLACE FUNCTION public.ssc_decision_tree_score(
  in_p1 NUMERIC, in_p2 NUMERIC, in_p3 NUMERIC
) RETURNS NUMERIC
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    (SELECT score::numeric FROM public.ssc_decision_tree_lookup
     WHERE p1 = LEAST(5, GREATEST(1, ROUND(in_p1)::int))
       AND p2 = LEAST(4, GREATEST(1, ROUND(in_p2)::int))
       AND p3 = LEAST(4, GREATEST(1, ROUND(in_p3)::int))),
    (in_p1 + in_p2 + in_p3) / 3.0
  );
$$;

COMMENT ON FUNCTION public.ssc_decision_tree_score(NUMERIC,NUMERIC,NUMERIC) IS
  'Returns SSC framework severity 1-5 from pillar scores using decision tree lookup (P1 1-5, P2/P3 1-4).';

-- 3. Extend score_framework_aggregate: after writing P1,P2,P3,Hazard,UV, if config has ssc_overall
--    then compute and insert 'SSC Framework' from P1,P2,P3 using that method (ssc_decision_tree, average, worst_case, custom_weighted).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT oid::regprocedure AS func_sig
    FROM pg_proc
    WHERE proname = 'score_framework_aggregate' AND pronamespace = 'public'::regnamespace
  ) LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_sig || ' CASCADE';
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
  v_ssc_method TEXT;
  v_ssc_weights JSONB;
BEGIN
  IF in_instance_id IS NULL AND in_config IS NOT NULL AND jsonb_typeof(in_config) = 'object' AND in_config ? 'instance_id' THEN
    v_instance_id := (in_config->>'instance_id')::UUID;
    v_config := in_config;
  ELSIF in_instance_id IS NOT NULL AND in_config IS NULL THEN
    v_instance_id := in_instance_id;
    v_config := NULL;
  ELSIF in_instance_id IS NOT NULL AND in_config IS NOT NULL THEN
    v_instance_id := in_instance_id;
    v_config := in_config;
  ELSE
    RETURN jsonb_build_object('status', 'error', 'message', 'Invalid parameters: instance_id is required');
  END IF;

  IF v_instance_id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Instance ID is required');
  END IF;

  IF v_config IS NULL THEN
    SELECT COALESCE(jsonb_object_agg(dataset_id::TEXT, COALESCE(dataset_weight, 1.0)), '{}'::jsonb)
      || COALESCE((SELECT jsonb_object_agg('hazard_event_' || id::TEXT, COALESCE((metadata->>'weight')::NUMERIC, 1.0))
                   FROM hazard_events WHERE instance_id = v_instance_id AND metadata IS NOT NULL AND metadata ? 'weight'), '{}'::jsonb)
    INTO v_weights_map FROM instance_scoring_weights WHERE instance_id = v_instance_id;

    DECLARE v_hazard_event_count INTEGER; v_hazard_method TEXT;
    BEGIN
      SELECT COUNT(*) INTO v_hazard_event_count FROM hazard_events WHERE instance_id = v_instance_id;
      v_hazard_method := CASE WHEN v_hazard_event_count > 1 THEN 'compounding_hazards' ELSE 'weighted_normalized_sum' END;
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

  FOR v_category_config IN SELECT * FROM jsonb_array_elements(v_config->'categories')
  LOOP
    v_category_key := v_category_config->>'key';
    v_method := COALESCE(v_category_config->>'method', 'average');
    v_weights := COALESCE(v_category_config->'weights', '{}'::jsonb);

    INSERT INTO instance_category_scores (instance_id, category, admin_pcode, score)
    SELECT v_instance_id, v_category_key, admin_pcode,
      CASE
        WHEN v_method = 'average' THEN AVG(score)
        WHEN v_method = 'weighted_mean' OR v_method = 'custom_weighted' THEN
          CASE WHEN SUM(weight) > 0 THEN SUM(score * weight) / SUM(weight) ELSE NULL END
        WHEN v_method = 'weighted_normalized_sum' THEN
          CASE WHEN SUM(weight) > 0 THEN LEAST(5.0, GREATEST(1.0, (SUM((score - 1.0) / 4.0 * weight) / NULLIF(SUM(weight), 0)) * 4.0 + 1.0)) ELSE NULL END
        WHEN v_method = 'compounding_hazards' THEN
          CASE WHEN COUNT(*) > 1 THEN LEAST(5.0, GREATEST(1.0, ((SUM((score - 1.0) / 4.0 * weight) / NULLIF(SUM(weight), 0)) + (EXP(SUM(LN(GREATEST((score - 1.0) / 4.0, 0.01))))) * 0.5) * 4.0 + 1.0))
               ELSE LEAST(5.0, GREATEST(1.0, ((MAX(score) - 1.0) / 4.0) * 4.0 + 1.0)) END
        WHEN v_method = 'worst_case' THEN MAX(score)
        WHEN v_method = 'best_case' THEN MIN(score)
        ELSE AVG(score)
      END
    FROM (
      SELECT ids.admin_pcode, ids.score,
        CASE WHEN (v_method IN ('custom_weighted','weighted_mean','weighted_normalized_sum','compounding_hazards')) AND v_weights ? ids.dataset_id::TEXT THEN (v_weights->ids.dataset_id::TEXT)::NUMERIC ELSE 1.0 END AS weight
      FROM instance_dataset_scores ids
      INNER JOIN instance_datasets id ON id.dataset_id = ids.dataset_id
      INNER JOIN datasets d ON d.id = ids.dataset_id
      WHERE ids.instance_id = v_instance_id AND id.instance_id = v_instance_id AND d.category = v_category_key
      UNION ALL
      SELECT hes.admin_pcode, hes.score,
        CASE WHEN (v_method IN ('custom_weighted','weighted_mean','weighted_normalized_sum','compounding_hazards')) AND v_weights ? ('hazard_event_' || hes.hazard_event_id::TEXT) THEN (v_weights->('hazard_event_' || hes.hazard_event_id::TEXT))::NUMERIC ELSE 1.0 END
      FROM hazard_event_scores hes
      INNER JOIN hazard_events he ON he.id = hes.hazard_event_id
      WHERE hes.instance_id = v_instance_id AND he.instance_id = v_instance_id AND v_category_key = 'Hazard'
    ) AS all_scores
    GROUP BY admin_pcode HAVING COUNT(*) > 0
    ON CONFLICT (instance_id, category, admin_pcode) DO UPDATE SET score = EXCLUDED.score, computed_at = NOW();
    GET DIAGNOSTICS v_upserted_rows = ROW_COUNT;
  END LOOP;

  -- SSC Framework rollup: P1+P2+P3 -> 'SSC Framework' when config has ssc_overall
  IF v_config IS NOT NULL AND v_config ? 'ssc_overall' THEN
    v_ssc_method := COALESCE(v_config->'ssc_overall'->>'method', 'average');
    v_ssc_weights := COALESCE(v_config->'ssc_overall'->'weights', '{}'::jsonb);

    INSERT INTO instance_category_scores (instance_id, category, admin_pcode, score)
    SELECT v_instance_id, 'SSC Framework', pillars.admin_pcode,
      CASE
        WHEN v_ssc_method = 'ssc_decision_tree' THEN ssc_decision_tree_score(pillars.p1, pillars.p2, pillars.p3)
        WHEN v_ssc_method = 'worst_case' THEN GREATEST(pillars.p1, pillars.p2, pillars.p3)
        WHEN v_ssc_method = 'custom_weighted' THEN
          COALESCE(
            (pillars.p1 * COALESCE((v_ssc_weights->>'SSC Framework - P1')::numeric, 1/3.0) +
             pillars.p2 * COALESCE((v_ssc_weights->>'SSC Framework - P2')::numeric, 1/3.0) +
             pillars.p3 * COALESCE((v_ssc_weights->>'SSC Framework - P3')::numeric, 1/3.0))
            / NULLIF(COALESCE((v_ssc_weights->>'SSC Framework - P1')::numeric,0)+COALESCE((v_ssc_weights->>'SSC Framework - P2')::numeric,0)+COALESCE((v_ssc_weights->>'SSC Framework - P3')::numeric,0), 0),
            (pillars.p1 + pillars.p2 + pillars.p3) / 3.0
          )
        ELSE (pillars.p1 + pillars.p2 + pillars.p3) / 3.0
      END
    FROM (
      SELECT admin_pcode,
        MAX(CASE WHEN category = 'SSC Framework - P1' THEN score END) AS p1,
        MAX(CASE WHEN category = 'SSC Framework - P2' THEN score END) AS p2,
        MAX(CASE WHEN category = 'SSC Framework - P3' THEN score END) AS p3
      FROM instance_category_scores
      WHERE instance_id = v_instance_id AND category IN ('SSC Framework - P1', 'SSC Framework - P2', 'SSC Framework - P3')
      GROUP BY admin_pcode
      HAVING COUNT(*) = 3
    ) AS pillars
    ON CONFLICT (instance_id, category, admin_pcode) DO UPDATE SET score = EXCLUDED.score, computed_at = NOW();
  END IF;

  SELECT COUNT(DISTINCT admin_pcode), COALESCE(SUM(score), 0)
  INTO v_location_count, v_total_score
  FROM instance_category_scores WHERE instance_id = v_instance_id;

  RETURN jsonb_build_object(
    'status', 'done',
    'upserted_rows', v_upserted_rows,
    'framework_avg', CASE WHEN v_location_count > 0 THEN v_total_score / v_location_count ELSE 0 END
  );
END;
$$;

COMMENT ON FUNCTION public.score_framework_aggregate(JSONB,UUID) IS
  'Aggregates category scores. When config has ssc_overall.method = ssc_decision_tree, computes SSC Framework from P1,P2,P3 using the decision tree. Hazard and UV remain separate for overall rollup.';
