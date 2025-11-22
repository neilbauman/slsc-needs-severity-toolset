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
      SELECT array_agg(admin_pcode) INTO v_affected_codes
      FROM public.get_affected_adm3(v_admin_scope);
    END IF;

    -- If no affected codes, return zeros
    IF v_affected_codes IS NULL OR array_length(v_affected_codes, 1) = 0 THEN
      RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC, 0::NUMERIC;
      RETURN;
    END IF;

    -- Calculate total population in affected areas
    IF v_population_dataset_id IS NOT NULL THEN
      SELECT COALESCE(SUM(value), 0) INTO v_total_pop
      FROM public.dataset_values_numeric
      WHERE dataset_id = v_population_dataset_id
        AND admin_pcode = ANY(v_affected_codes);
    END IF;

    -- Calculate people of concern (population in areas with severity ≥ 3)
    -- Join population data with overall scores
    IF v_population_dataset_id IS NOT NULL THEN
      SELECT COALESCE(SUM(dvn.value), 0) INTO v_people_concern
      FROM public.dataset_values_numeric dvn
      INNER JOIN public.instance_category_scores ics ON ics.admin_pcode = dvn.admin_pcode
      WHERE dvn.dataset_id = v_population_dataset_id
        AND dvn.admin_pcode = ANY(v_affected_codes)
        AND ics.instance_id = in_instance_id
        AND ics.category = 'Overall'
        AND ics.score >= 3.0;
    END IF;

    -- Calculate people in need (people of concern × poverty rate)
    -- This is a weighted average: sum(population × poverty_rate) for areas with severity ≥ 3
    IF v_population_dataset_id IS NOT NULL AND v_poverty_dataset_id IS NOT NULL THEN
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
    END IF;
  END;

  RETURN QUERY SELECT 
    COALESCE(v_total_pop, 0)::NUMERIC,
    COALESCE(v_people_concern, 0)::NUMERIC,
    COALESCE(v_people_need, 0)::NUMERIC;
END;
$$;

