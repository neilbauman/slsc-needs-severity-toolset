-- ==============================
-- GET INSTANCE SUMMARY RPC FUNCTION
-- ==============================
-- Calculates summary metrics for an instance:
--   - total_population: Sum of population in affected areas
--   - people_concern: Population in areas with severity ≥ 3
--   - people_need: People of concern × poverty rate
-- Uses the latest overall scores from instance_category_scores

CREATE OR REPLACE FUNCTION public.get_instance_summary(
  in_instance_id UUID
)
RETURNS TABLE (
  total_population NUMERIC,
  people_concern NUMERIC,
  people_need NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_instance RECORD;
  v_population_dataset_id UUID;
  v_poverty_dataset_id UUID;
  v_total_pop NUMERIC := 0;
  v_people_concern NUMERIC := 0;
  v_people_need NUMERIC := 0;
  v_admin_scope TEXT[];
BEGIN
  -- Get instance configuration
  SELECT 
    population_dataset_id,
    admin_scope
  INTO v_instance
  FROM public.instances
  WHERE id = in_instance_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;
  
  v_population_dataset_id := v_instance.population_dataset_id;
  v_admin_scope := v_instance.admin_scope;

  -- If population_dataset_id is not set, try to find a population dataset automatically
  IF v_population_dataset_id IS NULL THEN
    SELECT id INTO v_population_dataset_id
    FROM public.datasets
    WHERE (name ILIKE '%population%' OR name ILIKE '%pop%')
      AND type = 'numeric'
      AND admin_level IN ('ADM3', 'ADM4')
    ORDER BY 
      CASE WHEN name ILIKE '%population%' THEN 1 ELSE 2 END,
      created_at DESC
    LIMIT 1;
  END IF;

  -- Find poverty rate dataset (look for dataset with 'poverty' in name)
  SELECT id INTO v_poverty_dataset_id
  FROM public.datasets
  WHERE name ILIKE '%poverty%'
  LIMIT 1;

  -- Get affected ADM3 codes
  DECLARE
    v_affected_codes TEXT[];
  BEGIN
    IF v_admin_scope IS NOT NULL AND array_length(v_admin_scope, 1) > 0 THEN
      -- Get ADM3 codes from affected ADM2 areas
      -- Try direct parent_pcode relationship first
      SELECT ARRAY_AGG(DISTINCT admin_pcode) INTO v_affected_codes
      FROM public.admin_boundaries
      WHERE admin_level = 'ADM3'
        AND parent_pcode = ANY(v_admin_scope);
      
      -- If no codes found, try prefix matching
      IF v_affected_codes IS NULL OR array_length(v_affected_codes, 1) = 0 THEN
        SELECT ARRAY_AGG(DISTINCT admin_pcode) INTO v_affected_codes
        FROM public.admin_boundaries
        WHERE admin_level = 'ADM3'
          AND EXISTS (
            SELECT 1 FROM unnest(v_admin_scope) AS adm2_code
            WHERE admin_pcode LIKE adm2_code || '%'
          );
      END IF;
    END IF;

    -- If no affected codes, return zeros
    IF v_affected_codes IS NULL OR array_length(v_affected_codes, 1) = 0 THEN
      RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC, 0::NUMERIC;
      RETURN;
    END IF;

    -- Calculate total population in affected areas
    -- Handle case where population dataset is at different admin level than affected codes
    IF v_population_dataset_id IS NOT NULL THEN
      DECLARE
        v_pop_admin_level TEXT;
      BEGIN
        -- Get the admin level of the population dataset
        SELECT UPPER(TRIM(admin_level)) INTO v_pop_admin_level
        FROM public.datasets
        WHERE id = v_population_dataset_id;
        
        -- If population is at ADM4 and we need ADM3, aggregate up
        IF v_pop_admin_level = 'ADM4' THEN
          SELECT COALESCE(SUM(dvn.value), 0) INTO v_total_pop
          FROM public.dataset_values_numeric dvn
          INNER JOIN public.admin_boundaries ab4 ON ab4.admin_pcode = dvn.admin_pcode
          INNER JOIN public.admin_boundaries ab3 ON ab3.admin_pcode = ab4.parent_pcode
          WHERE dvn.dataset_id = v_population_dataset_id
            AND UPPER(TRIM(ab4.admin_level)) = 'ADM4'
            AND UPPER(TRIM(ab3.admin_level)) = 'ADM3'
            AND ab3.admin_pcode = ANY(v_affected_codes);
        -- If population is at ADM3, direct match
        ELSIF v_pop_admin_level IN ('ADM3', 'adm3') THEN
          SELECT COALESCE(SUM(value), 0) INTO v_total_pop
          FROM public.dataset_values_numeric
          WHERE dataset_id = v_population_dataset_id
            AND admin_pcode = ANY(v_affected_codes);
        -- If population is at ADM2, we'd need to distribute down (not implemented)
        ELSE
          RAISE NOTICE 'Population dataset admin_level (%) not supported for aggregation', v_pop_admin_level;
          v_total_pop := 0;
        END IF;
        
        -- Debug: Log if no population found
        IF v_total_pop = 0 THEN
          RAISE NOTICE 'No population data found for dataset_id: %, admin_level: %, affected_codes count: %', 
            v_population_dataset_id, v_pop_admin_level, array_length(v_affected_codes, 1);
        END IF;
      END;
    ELSE
      RAISE NOTICE 'No population dataset configured or found for instance: %', in_instance_id;
    END IF;

    -- Calculate people of concern (population in areas with severity ≥ 3)
    -- Join population data with overall scores
    IF v_population_dataset_id IS NOT NULL THEN
      DECLARE
        v_pop_admin_level TEXT;
      BEGIN
        -- Get the admin level of the population dataset
        SELECT UPPER(TRIM(admin_level)) INTO v_pop_admin_level
        FROM public.datasets
        WHERE id = v_population_dataset_id;
        
        -- If population is at ADM4 and we need ADM3, aggregate up
        IF v_pop_admin_level = 'ADM4' THEN
          SELECT COALESCE(SUM(dvn.value), 0) INTO v_people_concern
          FROM public.dataset_values_numeric dvn
          INNER JOIN public.admin_boundaries ab4 ON ab4.admin_pcode = dvn.admin_pcode
          INNER JOIN public.admin_boundaries ab3 ON ab3.admin_pcode = ab4.parent_pcode
          INNER JOIN public.instance_category_scores ics ON ics.admin_pcode = ab3.admin_pcode
          WHERE dvn.dataset_id = v_population_dataset_id
            AND UPPER(TRIM(ab4.admin_level)) = 'ADM4'
            AND UPPER(TRIM(ab3.admin_level)) = 'ADM3'
            AND ab3.admin_pcode = ANY(v_affected_codes)
            AND ics.instance_id = in_instance_id
            AND ics.category = 'Overall'
            AND ics.score >= 3.0;
        -- If population is at ADM3, direct match
        ELSIF v_pop_admin_level = 'ADM3' THEN
          SELECT COALESCE(SUM(dvn.value), 0) INTO v_people_concern
          FROM public.dataset_values_numeric dvn
          INNER JOIN public.instance_category_scores ics ON ics.admin_pcode = dvn.admin_pcode
          WHERE dvn.dataset_id = v_population_dataset_id
            AND dvn.admin_pcode = ANY(v_affected_codes)
            AND ics.instance_id = in_instance_id
            AND ics.category = 'Overall'
            AND ics.score >= 3.0;
        ELSE
          v_people_concern := 0;
        END IF;
      END;
    END IF;

    -- Calculate people in need (people of concern × poverty rate)
    -- This is a weighted average: sum(population × poverty_rate) for areas with severity ≥ 3
    IF v_population_dataset_id IS NOT NULL AND v_poverty_dataset_id IS NOT NULL THEN
      DECLARE
        v_pop_admin_level TEXT;
        v_pov_admin_level TEXT;
      BEGIN
        -- Get the admin levels of both datasets
        SELECT UPPER(TRIM(admin_level)) INTO v_pop_admin_level
        FROM public.datasets
        WHERE id = v_population_dataset_id;
        
        SELECT UPPER(TRIM(admin_level)) INTO v_pov_admin_level
        FROM public.datasets
        WHERE id = v_poverty_dataset_id;
        
        -- If population is at ADM4 and we need ADM3, aggregate up
        IF v_pop_admin_level = 'ADM4' THEN
          SELECT COALESCE(SUM(dvn_pop.value * COALESCE(dvn_pov.value, 0) / 100.0), 0) INTO v_people_need
          FROM public.dataset_values_numeric dvn_pop
          INNER JOIN public.admin_boundaries ab4_pop ON ab4_pop.admin_pcode = dvn_pop.admin_pcode
          INNER JOIN public.admin_boundaries ab3_pop ON ab3_pop.admin_pcode = ab4_pop.parent_pcode
          INNER JOIN public.instance_category_scores ics ON ics.admin_pcode = ab3_pop.admin_pcode
          LEFT JOIN public.dataset_values_numeric dvn_pov 
            ON dvn_pov.dataset_id = v_poverty_dataset_id 
            AND (
              -- If poverty is also ADM4, match directly
              (v_pov_admin_level = 'ADM4' AND dvn_pov.admin_pcode = dvn_pop.admin_pcode)
              -- If poverty is ADM3, match via parent (ADM3)
              OR (v_pov_admin_level = 'ADM3' AND dvn_pov.admin_pcode = ab3_pop.admin_pcode)
            )
          WHERE dvn_pop.dataset_id = v_population_dataset_id
            AND UPPER(TRIM(ab4_pop.admin_level)) = 'ADM4'
            AND UPPER(TRIM(ab3_pop.admin_level)) = 'ADM3'
            AND ab3_pop.admin_pcode = ANY(v_affected_codes)
            AND ics.instance_id = in_instance_id
            AND ics.category = 'Overall'
            AND ics.score >= 3.0;
        -- If population is at ADM3, direct match
        ELSIF v_pop_admin_level = 'ADM3' THEN
          SELECT COALESCE(SUM(dvn_pop.value * COALESCE(dvn_pov.value, 0) / 100.0), 0) INTO v_people_need
          FROM public.dataset_values_numeric dvn_pop
          INNER JOIN public.instance_category_scores ics ON ics.admin_pcode = dvn_pop.admin_pcode
          LEFT JOIN public.dataset_values_numeric dvn_pov 
            ON dvn_pov.dataset_id = v_poverty_dataset_id 
            AND dvn_pov.admin_pcode = dvn_pop.admin_pcode
          WHERE dvn_pop.dataset_id = v_population_dataset_id
            AND dvn_pop.admin_pcode = ANY(v_affected_codes)
            AND ics.instance_id = in_instance_id
            AND ics.category = 'Overall'
            AND ics.score >= 3.0;
        ELSE
          v_people_need := 0;
        END IF;
      END;
    END IF;
  END;

  RETURN QUERY SELECT 
    COALESCE(v_total_pop, 0)::NUMERIC,
    COALESCE(v_people_concern, 0)::NUMERIC,
    COALESCE(v_people_need, 0)::NUMERIC;
END;
$$;

