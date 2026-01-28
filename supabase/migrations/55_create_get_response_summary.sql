-- ==============================
-- GET_RESPONSE_SUMMARY RPC
-- ==============================
-- Summary metrics for a response at a given layer (or baseline).
-- Returns: total_population, people_concern (PoC), people_need (PiN),
--          total_affected_locations, areas_of_concern_count, avg_severity.
-- Logic ported from get_instance_summary; uses response_scores for severity ≥ 3.
-- PoC = population in affected area with severity ≥ 3.
-- PiN = humanitarian caseload (e.g. PoC × poverty rate).

CREATE OR REPLACE FUNCTION public.get_response_summary(
  in_response_id UUID,
  in_layer_id UUID DEFAULT NULL
)
RETURNS TABLE (
  total_population NUMERIC,
  people_concern NUMERIC,
  people_need NUMERIC,
  total_affected_locations INTEGER,
  areas_of_concern_count INTEGER,
  avg_severity NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_response RECORD;
  v_population_dataset_id UUID;
  v_poverty_dataset_id UUID;
  v_total_pop NUMERIC := 0;
  v_people_concern NUMERIC := 0;
  v_people_need NUMERIC := 0;
  v_admin_scope TEXT[];
  v_affected_codes TEXT[];
  v_total_affected INTEGER := 0;
  v_areas_of_concern INTEGER := 0;
  v_avg_severity NUMERIC := NULL;
BEGIN
  -- Get response configuration
  SELECT
    population_dataset_id,
    poverty_dataset_id,
    admin_scope,
    country_id
  INTO v_response
  FROM public.responses
  WHERE id = in_response_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::INTEGER, 0::INTEGER, NULL::NUMERIC;
    RETURN;
  END IF;

  v_population_dataset_id := v_response.population_dataset_id;
  v_poverty_dataset_id := v_response.poverty_dataset_id;
  v_admin_scope := v_response.admin_scope;

  -- Auto-resolve population dataset (scoped by country when possible)
  IF v_population_dataset_id IS NULL THEN
    SELECT id INTO v_population_dataset_id
    FROM public.datasets
    WHERE (name ILIKE '%population%' OR name ILIKE '%pop%')
      AND type = 'numeric'
      AND admin_level IN ('ADM3', 'ADM4')
      AND (v_response.country_id IS NULL OR country_id = v_response.country_id)
    ORDER BY
      CASE WHEN name ILIKE '%population%' THEN 1 ELSE 2 END,
      created_at DESC
    LIMIT 1;
    -- Fallback without country filter if still null
    IF v_population_dataset_id IS NULL THEN
      SELECT id INTO v_population_dataset_id
      FROM public.datasets
      WHERE (name ILIKE '%population%' OR name ILIKE '%pop%')
        AND type = 'numeric'
        AND admin_level IN ('ADM3', 'ADM4')
      ORDER BY created_at DESC
      LIMIT 1;
    END IF;
  END IF;

  -- Auto-resolve poverty dataset (scoped by country when possible)
  IF v_poverty_dataset_id IS NULL THEN
    SELECT id INTO v_poverty_dataset_id
    FROM public.datasets
    WHERE name ILIKE '%poverty%'
      AND (v_response.country_id IS NULL OR country_id = v_response.country_id)
    LIMIT 1;
    IF v_poverty_dataset_id IS NULL THEN
      SELECT id INTO v_poverty_dataset_id
      FROM public.datasets
      WHERE name ILIKE '%poverty%'
      LIMIT 1;
    END IF;
  END IF;

  -- Resolve affected ADM3 codes from admin_scope
  IF v_admin_scope IS NOT NULL AND array_length(v_admin_scope, 1) > 0 THEN
    SELECT ARRAY_AGG(DISTINCT admin_pcode) INTO v_affected_codes
    FROM public.admin_boundaries
    WHERE UPPER(TRIM(admin_level)) = 'ADM3'
      AND parent_pcode = ANY(v_admin_scope);

    IF v_affected_codes IS NULL OR array_length(v_affected_codes, 1) = 0 THEN
      SELECT ARRAY_AGG(DISTINCT admin_pcode) INTO v_affected_codes
      FROM public.admin_boundaries
      WHERE UPPER(TRIM(admin_level)) = 'ADM3'
        AND EXISTS (
          SELECT 1 FROM unnest(v_admin_scope) AS adm2_code
          WHERE admin_pcode LIKE adm2_code || '%'
        );
    END IF;
  END IF;

  IF v_affected_codes IS NULL OR array_length(v_affected_codes, 1) = 0 THEN
    RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::INTEGER, 0::INTEGER, NULL::NUMERIC;
    RETURN;
  END IF;

  v_total_affected := array_length(v_affected_codes, 1);

  -- Areas of concern (count of admin units with severity ≥ 3) and avg severity from response_scores
  SELECT
    COUNT(*) FILTER (WHERE rs.score >= 3.0),
    ROUND(AVG(rs.score)::NUMERIC, 2)
  INTO v_areas_of_concern, v_avg_severity
  FROM public.response_scores rs
  WHERE rs.response_id = in_response_id
    AND ((in_layer_id IS NULL AND rs.layer_id IS NULL) OR (in_layer_id IS NOT NULL AND rs.layer_id = in_layer_id))
    AND rs.category = 'Overall'
    AND rs.admin_pcode = ANY(v_affected_codes);

  -- Total population in affected areas
  IF v_population_dataset_id IS NOT NULL THEN
    DECLARE v_pop_admin_level TEXT;
    BEGIN
      SELECT UPPER(TRIM(admin_level)) INTO v_pop_admin_level
      FROM public.datasets WHERE id = v_population_dataset_id;

      IF v_pop_admin_level = 'ADM4' THEN
        SELECT COALESCE(SUM(dvn.value), 0) INTO v_total_pop
        FROM public.dataset_values_numeric dvn
        INNER JOIN public.admin_boundaries ab4 ON ab4.admin_pcode = dvn.admin_pcode
        INNER JOIN public.admin_boundaries ab3 ON ab3.admin_pcode = ab4.parent_pcode
        WHERE dvn.dataset_id = v_population_dataset_id
          AND UPPER(TRIM(ab4.admin_level)) = 'ADM4'
          AND UPPER(TRIM(ab3.admin_level)) = 'ADM3'
          AND ab3.admin_pcode = ANY(v_affected_codes);
      ELSIF v_pop_admin_level IN ('ADM3', 'adm3') THEN
        SELECT COALESCE(SUM(value), 0) INTO v_total_pop
        FROM public.dataset_values_numeric
        WHERE dataset_id = v_population_dataset_id
          AND admin_pcode = ANY(v_affected_codes);
      END IF;
    END;
  END IF;

  -- PoC: population in areas with severity ≥ 3 (from response_scores for this response/layer)
  IF v_population_dataset_id IS NOT NULL THEN
    DECLARE v_pop_admin_level TEXT;
    BEGIN
      SELECT UPPER(TRIM(admin_level)) INTO v_pop_admin_level
      FROM public.datasets WHERE id = v_population_dataset_id;

      IF v_pop_admin_level = 'ADM4' THEN
        SELECT COALESCE(SUM(dvn.value), 0) INTO v_people_concern
        FROM public.dataset_values_numeric dvn
        INNER JOIN public.admin_boundaries ab4 ON ab4.admin_pcode = dvn.admin_pcode
        INNER JOIN public.admin_boundaries ab3 ON ab3.admin_pcode = ab4.parent_pcode
        INNER JOIN public.response_scores rs ON rs.admin_pcode = ab3.admin_pcode
        WHERE dvn.dataset_id = v_population_dataset_id
          AND UPPER(TRIM(ab4.admin_level)) = 'ADM4'
          AND UPPER(TRIM(ab3.admin_level)) = 'ADM3'
          AND ab3.admin_pcode = ANY(v_affected_codes)
          AND rs.response_id = in_response_id
          AND ((in_layer_id IS NULL AND rs.layer_id IS NULL) OR (in_layer_id IS NOT NULL AND rs.layer_id = in_layer_id))
          AND rs.category = 'Overall'
          AND rs.score >= 3.0;
      ELSIF v_pop_admin_level IN ('ADM3', 'adm3') THEN
        SELECT COALESCE(SUM(dvn.value), 0) INTO v_people_concern
        FROM public.dataset_values_numeric dvn
        INNER JOIN public.response_scores rs ON rs.admin_pcode = dvn.admin_pcode
        WHERE dvn.dataset_id = v_population_dataset_id
          AND dvn.admin_pcode = ANY(v_affected_codes)
          AND rs.response_id = in_response_id
          AND ((in_layer_id IS NULL AND rs.layer_id IS NULL) OR (in_layer_id IS NOT NULL AND rs.layer_id = in_layer_id))
          AND rs.category = 'Overall'
          AND rs.score >= 3.0;
      END IF;
    END;
  END IF;

  -- PiN: PoC × poverty rate (for areas with severity ≥ 3)
  IF v_population_dataset_id IS NOT NULL AND v_poverty_dataset_id IS NOT NULL THEN
    DECLARE v_pop_admin_level TEXT;
    v_pov_admin_level TEXT;
    BEGIN
      SELECT UPPER(TRIM(admin_level)) INTO v_pop_admin_level FROM public.datasets WHERE id = v_population_dataset_id;
      SELECT UPPER(TRIM(admin_level)) INTO v_pov_admin_level FROM public.datasets WHERE id = v_poverty_dataset_id;

      IF v_pop_admin_level = 'ADM4' THEN
        SELECT COALESCE(SUM(dvn_pop.value * COALESCE(dvn_pov.value, 0) / 100.0), 0) INTO v_people_need
        FROM public.dataset_values_numeric dvn_pop
        INNER JOIN public.admin_boundaries ab4_pop ON ab4_pop.admin_pcode = dvn_pop.admin_pcode
        INNER JOIN public.admin_boundaries ab3_pop ON ab3_pop.admin_pcode = ab4_pop.parent_pcode
        INNER JOIN public.response_scores rs ON rs.admin_pcode = ab3_pop.admin_pcode
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
          AND rs.response_id = in_response_id
          AND ((in_layer_id IS NULL AND rs.layer_id IS NULL) OR (in_layer_id IS NOT NULL AND rs.layer_id = in_layer_id))
          AND rs.category = 'Overall'
          AND rs.score >= 3.0;
      ELSIF v_pop_admin_level = 'ADM3' THEN
        SELECT COALESCE(SUM(dvn_pop.value * COALESCE(dvn_pov.value, 0) / 100.0), 0) INTO v_people_need
        FROM public.dataset_values_numeric dvn_pop
        INNER JOIN public.response_scores rs ON rs.admin_pcode = dvn_pop.admin_pcode
        LEFT JOIN public.dataset_values_numeric dvn_pov
          ON dvn_pov.dataset_id = v_poverty_dataset_id AND dvn_pov.admin_pcode = dvn_pop.admin_pcode
        WHERE dvn_pop.dataset_id = v_population_dataset_id
          AND dvn_pop.admin_pcode = ANY(v_affected_codes)
          AND rs.response_id = in_response_id
          AND ((in_layer_id IS NULL AND rs.layer_id IS NULL) OR (in_layer_id IS NOT NULL AND rs.layer_id = in_layer_id))
          AND rs.category = 'Overall'
          AND rs.score >= 3.0;
      END IF;
    END;
  END IF;

  RETURN QUERY SELECT
    COALESCE(v_total_pop, 0)::NUMERIC,
    COALESCE(v_people_concern, 0)::NUMERIC,
    COALESCE(v_people_need, 0)::NUMERIC,
    COALESCE(v_total_affected, 0)::INTEGER,
    COALESCE(v_areas_of_concern, 0)::INTEGER,
    v_avg_severity;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_response_summary(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_response_summary(UUID, UUID) TO anon;

COMMENT ON FUNCTION public.get_response_summary(UUID, UUID) IS
  'Returns total_population, PoC, PiN, total_affected_locations, areas_of_concern_count, avg_severity for a response at a given layer. in_layer_id NULL = baseline.';
