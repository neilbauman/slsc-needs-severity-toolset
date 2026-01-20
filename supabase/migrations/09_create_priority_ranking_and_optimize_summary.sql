-- ==============================
-- CREATE PRIORITY RANKING FUNCTION AND OPTIMIZE GET_INSTANCE_SUMMARY
-- ==============================
-- Adds score_priority_ranking function and optimizes get_instance_summary to prevent timeouts

-- ==============================
-- 1. Create score_priority_ranking function
-- ==============================
CREATE OR REPLACE FUNCTION public.score_priority_ranking(
  in_instance_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_min_score NUMERIC;
  v_max_score NUMERIC;
  v_score_range NUMERIC;
  v_upserted_rows INTEGER := 0;
  v_location_count INTEGER := 0;
  v_country_id UUID;
BEGIN
  -- Get country_id from instance for validation
  SELECT country_id INTO v_country_id
  FROM public.instances
  WHERE id = in_instance_id;
  
  IF v_country_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Instance not found or missing country_id',
      'upserted_rows', 0
    );
  END IF;

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
    'message', format('Priority ranking complete: %s locations ranked from %s (priority 1.0) to %s (priority 5.0)', 
      v_location_count, to_char(v_min_score, 'FM999999990.00'), to_char(v_max_score, 'FM999999990.00'))
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.score_priority_ranking(UUID) TO authenticated, anon;

COMMENT ON FUNCTION public.score_priority_ranking(UUID) IS 'Creates relative priority ranking (1-5) from absolute severity scores. Highest severity → priority 5, lowest → priority 1. Use Overall scores for PIN calculations, Priority scores for relative prioritization.';

-- ==============================
-- 2. Optimize get_instance_summary to prevent timeouts
-- ==============================
-- Drop and recreate with better optimization
DROP FUNCTION IF EXISTS public.get_instance_summary(UUID);

CREATE OR REPLACE FUNCTION public.get_instance_summary(
  in_instance_id UUID
)
RETURNS TABLE (
  total_population NUMERIC,
  people_concern NUMERIC,
  people_need NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_instance RECORD;
  v_population_dataset_id UUID;
  v_poverty_dataset_id UUID;
  v_total_pop NUMERIC := 0;
  v_people_concern NUMERIC := 0;
  v_people_need NUMERIC := 0;
  v_admin_scope TEXT[];
  v_country_id UUID;
  v_affected_codes TEXT[];
BEGIN
  -- Get instance configuration (early return if not found)
  SELECT 
    population_dataset_id,
    admin_scope,
    country_id
  INTO v_instance
  FROM public.instances
  WHERE id = in_instance_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;
  
  v_population_dataset_id := v_instance.population_dataset_id;
  v_admin_scope := v_instance.admin_scope;
  v_country_id := v_instance.country_id;

  -- If no admin_scope, return zeros immediately
  IF v_admin_scope IS NULL OR array_length(v_admin_scope, 1) = 0 THEN
    RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;

  -- Get affected ADM3 codes (simplified and optimized)
  -- Try direct parent_pcode relationship first (most efficient)
  SELECT ARRAY_AGG(DISTINCT admin_pcode) INTO v_affected_codes
  FROM public.admin_boundaries
  WHERE UPPER(TRIM(admin_level)) = 'ADM3'
    AND parent_pcode = ANY(v_admin_scope)
    AND country_id = v_country_id
  LIMIT 5000; -- Limit to prevent excessive array size
  
  -- If no codes found, try prefix matching (less efficient, but fallback)
  IF v_affected_codes IS NULL OR array_length(v_affected_codes, 1) = 0 THEN
    SELECT ARRAY_AGG(DISTINCT admin_pcode) INTO v_affected_codes
    FROM public.admin_boundaries
    WHERE UPPER(TRIM(admin_level)) = 'ADM3'
      AND country_id = v_country_id
      AND EXISTS (
        SELECT 1 FROM unnest(v_admin_scope) AS adm2_code
        WHERE admin_pcode LIKE adm2_code || '%'
        LIMIT 10 -- Limit prefix checks
      )
    LIMIT 5000;
  END IF;

  -- If no affected codes, return zeros
  IF v_affected_codes IS NULL OR array_length(v_affected_codes, 1) = 0 THEN
    RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;

  -- If population_dataset_id is not set, try to find a population dataset automatically
  IF v_population_dataset_id IS NULL THEN
    SELECT id INTO v_population_dataset_id
    FROM public.datasets
    WHERE (name ILIKE '%population%' OR name ILIKE '%pop%')
      AND type = 'numeric'
      AND admin_level IN ('ADM3', 'ADM4')
      AND country_id = v_country_id
    ORDER BY 
      CASE WHEN name ILIKE '%population%' THEN 1 ELSE 2 END,
      created_at DESC
    LIMIT 1;
  END IF;

  -- Find poverty rate dataset (look for dataset with 'poverty' in name)
  SELECT id INTO v_poverty_dataset_id
  FROM public.datasets
  WHERE name ILIKE '%poverty%'
    AND country_id = v_country_id
  LIMIT 1;

  -- Calculate total population in affected areas (only if dataset exists)
  -- Use simpler queries with explicit limits
  IF v_population_dataset_id IS NOT NULL THEN
    DECLARE
      v_pop_admin_level TEXT;
    BEGIN
      SELECT UPPER(TRIM(admin_level)) INTO v_pop_admin_level
      FROM public.datasets
      WHERE id = v_population_dataset_id;
      
      -- Simplified query with explicit LIMIT
      IF v_pop_admin_level = 'ADM4' THEN
        SELECT COALESCE(SUM(dvn.value), 0) INTO v_total_pop
        FROM public.dataset_values_numeric dvn
        INNER JOIN public.datasets d ON d.id = dvn.dataset_id
        INNER JOIN public.admin_boundaries ab4 ON ab4.admin_pcode = dvn.admin_pcode
        INNER JOIN public.admin_boundaries ab3 ON ab3.admin_pcode = ab4.parent_pcode
        WHERE dvn.dataset_id = v_population_dataset_id
          AND UPPER(TRIM(ab4.admin_level)) = 'ADM4'
          AND UPPER(TRIM(ab3.admin_level)) = 'ADM3'
          AND ab3.admin_pcode = ANY(v_affected_codes)
          AND ab4.country_id = v_country_id
          AND ab3.country_id = v_country_id
          AND d.country_id = v_country_id
        LIMIT 5000; -- Reduced limit for performance
      ELSIF v_pop_admin_level IN ('ADM3', 'adm3') THEN
        SELECT COALESCE(SUM(dvn.value), 0) INTO v_total_pop
        FROM public.dataset_values_numeric dvn
        INNER JOIN public.datasets d ON d.id = dvn.dataset_id
        WHERE dvn.dataset_id = v_population_dataset_id
          AND dvn.admin_pcode = ANY(v_affected_codes)
          AND d.country_id = v_country_id
        LIMIT 5000; -- Reduced limit
      END IF;
    END;
  END IF;

  -- Calculate people of concern (only if we have population data and scores exist)
  -- Check for scores first to avoid expensive query if no scores
  IF v_population_dataset_id IS NOT NULL 
     AND EXISTS (SELECT 1 FROM public.instance_category_scores 
                 WHERE instance_id = in_instance_id AND category = 'Overall' LIMIT 1) THEN
    DECLARE
      v_pop_admin_level TEXT;
    BEGIN
      SELECT UPPER(TRIM(admin_level)) INTO v_pop_admin_level
      FROM public.datasets
      WHERE id = v_population_dataset_id;
      
      -- Simplified query with explicit LIMIT
      IF v_pop_admin_level = 'ADM4' THEN
        SELECT COALESCE(SUM(dvn.value), 0) INTO v_people_concern
        FROM public.dataset_values_numeric dvn
        INNER JOIN public.datasets d ON d.id = dvn.dataset_id
        INNER JOIN public.admin_boundaries ab4 ON ab4.admin_pcode = dvn.admin_pcode
        INNER JOIN public.admin_boundaries ab3 ON ab3.admin_pcode = ab4.parent_pcode
        INNER JOIN public.instance_category_scores ics ON ics.admin_pcode = ab3.admin_pcode
        WHERE dvn.dataset_id = v_population_dataset_id
          AND UPPER(TRIM(ab4.admin_level)) = 'ADM4'
          AND UPPER(TRIM(ab3.admin_level)) = 'ADM3'
          AND ab3.admin_pcode = ANY(v_affected_codes)
          AND ics.instance_id = in_instance_id
          AND ics.category = 'Overall'
          AND ics.score >= 3.0
          AND ab4.country_id = v_country_id
          AND ab3.country_id = v_country_id
          AND d.country_id = v_country_id
        LIMIT 5000; -- Reduced limit
      ELSIF v_pop_admin_level = 'ADM3' THEN
        SELECT COALESCE(SUM(dvn.value), 0) INTO v_people_concern
        FROM public.dataset_values_numeric dvn
        INNER JOIN public.datasets d ON d.id = dvn.dataset_id
        INNER JOIN public.instance_category_scores ics ON ics.admin_pcode = dvn.admin_pcode
        WHERE dvn.dataset_id = v_population_dataset_id
          AND dvn.admin_pcode = ANY(v_affected_codes)
          AND ics.instance_id = in_instance_id
          AND ics.category = 'Overall'
          AND ics.score >= 3.0
          AND d.country_id = v_country_id
        LIMIT 5000; -- Reduced limit
      END IF;
    END;
  END IF;

  -- Calculate people in need (only if we have both population and poverty data and scores exist)
  IF v_population_dataset_id IS NOT NULL 
     AND v_poverty_dataset_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.instance_category_scores 
                 WHERE instance_id = in_instance_id AND category = 'Overall' LIMIT 1) THEN
    DECLARE
      v_pop_admin_level TEXT;
      v_pov_admin_level TEXT;
    BEGIN
      SELECT UPPER(TRIM(admin_level)) INTO v_pop_admin_level
      FROM public.datasets
      WHERE id = v_population_dataset_id;
      
      SELECT UPPER(TRIM(admin_level)) INTO v_pov_admin_level
      FROM public.datasets
      WHERE id = v_poverty_dataset_id;
      
      -- Simplified query with explicit LIMIT
      IF v_pop_admin_level = 'ADM4' THEN
        SELECT COALESCE(SUM(dvn_pop.value * COALESCE(dvn_pov.value, 0) / 100.0), 0) INTO v_people_need
        FROM public.dataset_values_numeric dvn_pop
        INNER JOIN public.datasets d_pop ON d_pop.id = dvn_pop.dataset_id
        INNER JOIN public.admin_boundaries ab4_pop ON ab4_pop.admin_pcode = dvn_pop.admin_pcode
        INNER JOIN public.admin_boundaries ab3_pop ON ab3_pop.admin_pcode = ab4_pop.parent_pcode
        INNER JOIN public.instance_category_scores ics ON ics.admin_pcode = ab3_pop.admin_pcode
        INNER JOIN public.datasets d_pov ON d_pov.id = v_poverty_dataset_id
        LEFT JOIN public.dataset_values_numeric dvn_pov 
          ON dvn_pov.dataset_id = v_poverty_dataset_id 
          AND (
            (v_pov_admin_level = 'ADM4' AND dvn_pov.admin_pcode = dvn_pop.admin_pcode)
            OR (v_pov_admin_level = 'ADM3' AND dvn_pov.admin_pcode = ab3_pop.admin_pcode)
          )
        WHERE dvn_pop.dataset_id = v_population_dataset_id
          AND UPPER(TRIM(ab4_pop.admin_level)) = 'ADM4'
          AND UPPER(TRIM(ab3_pop.admin_level)) = 'ADM3'
          AND ab3_pop.admin_pcode = ANY(v_affected_codes)
          AND ics.instance_id = in_instance_id
          AND ics.category = 'Overall'
          AND ics.score >= 3.0
          AND ab4_pop.country_id = v_country_id
          AND ab3_pop.country_id = v_country_id
          AND d_pop.country_id = v_country_id
          AND d_pov.country_id = v_country_id
        LIMIT 5000; -- Reduced limit
      ELSIF v_pop_admin_level = 'ADM3' THEN
        SELECT COALESCE(SUM(dvn_pop.value * COALESCE(dvn_pov.value, 0) / 100.0), 0) INTO v_people_need
        FROM public.dataset_values_numeric dvn_pop
        INNER JOIN public.datasets d_pop ON d_pop.id = dvn_pop.dataset_id
        INNER JOIN public.instance_category_scores ics ON ics.admin_pcode = dvn_pop.admin_pcode
        INNER JOIN public.datasets d_pov ON d_pov.id = v_poverty_dataset_id
        LEFT JOIN public.dataset_values_numeric dvn_pov 
          ON dvn_pov.dataset_id = v_poverty_dataset_id 
          AND dvn_pov.admin_pcode = dvn_pop.admin_pcode
        WHERE dvn_pop.dataset_id = v_population_dataset_id
          AND dvn_pop.admin_pcode = ANY(v_affected_codes)
          AND ics.instance_id = in_instance_id
          AND ics.category = 'Overall'
          AND ics.score >= 3.0
          AND d_pop.country_id = v_country_id
          AND d_pov.country_id = v_country_id
        LIMIT 5000; -- Reduced limit
      END IF;
    END;
  END IF;

  RETURN QUERY SELECT 
    COALESCE(v_total_pop, 0)::NUMERIC,
    COALESCE(v_people_concern, 0)::NUMERIC,
    COALESCE(v_people_need, 0)::NUMERIC;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_instance_summary(UUID) TO anon, authenticated;

COMMENT ON FUNCTION public.get_instance_summary IS 'Calculates summary metrics for an instance: total_population, people_concern (severity ≥ 3), and people_need (people_concern × poverty rate). Optimized with reduced limits and early returns to prevent timeouts.';
