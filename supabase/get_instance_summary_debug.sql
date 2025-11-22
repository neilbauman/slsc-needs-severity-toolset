-- ==============================
-- DEBUG VERSION: Returns diagnostic info
-- ==============================
-- This version returns diagnostic columns to help troubleshoot

CREATE OR REPLACE FUNCTION public.get_instance_summary_debug(
  in_instance_id UUID
)
RETURNS TABLE (
  total_population NUMERIC,
  people_concern NUMERIC,
  people_need NUMERIC,
  debug_info JSONB
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
  v_affected_codes TEXT[];
  v_debug JSONB := '{}'::JSONB;
BEGIN
  -- Get instance configuration
  SELECT 
    population_dataset_id,
    admin_scope
  INTO v_instance
  FROM public.instances
  WHERE id = in_instance_id;
  
  IF NOT FOUND THEN
    v_debug := jsonb_build_object(
      'error', 'Instance not found',
      'instance_id', in_instance_id
    );
    RETURN QUERY SELECT 
      0::NUMERIC AS total_population, 
      0::NUMERIC AS people_concern, 
      0::NUMERIC AS people_need, 
      v_debug AS debug_info;
    RETURN;
  END IF;
  
  v_population_dataset_id := v_instance.population_dataset_id;
  v_admin_scope := v_instance.admin_scope;
  
  v_debug := v_debug || jsonb_build_object(
    'configured_population_dataset_id', v_population_dataset_id,
    'admin_scope', v_admin_scope,
    'admin_scope_count', array_length(v_admin_scope, 1)
  );

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
    
    v_debug := v_debug || jsonb_build_object(
      'auto_detected_population_dataset_id', v_population_dataset_id
    );
  END IF;

  -- Find poverty rate dataset
  SELECT id INTO v_poverty_dataset_id
  FROM public.datasets
  WHERE name ILIKE '%poverty%'
  LIMIT 1;

  -- Get affected ADM3 codes
  IF v_admin_scope IS NOT NULL AND array_length(v_admin_scope, 1) > 0 THEN
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

  v_debug := v_debug || jsonb_build_object(
    'affected_codes_count', COALESCE(array_length(v_affected_codes, 1), 0),
    'affected_codes_sample', (
      SELECT jsonb_agg(admin_pcode ORDER BY admin_pcode)
      FROM unnest(COALESCE(v_affected_codes, ARRAY[]::TEXT[])) AS admin_pcode
      LIMIT 5
    )
  );

  -- If no affected codes, return with debug info
  IF v_affected_codes IS NULL OR array_length(v_affected_codes, 1) = 0 THEN
    v_debug := v_debug || jsonb_build_object(
      'error', 'No affected ADM3 codes found',
      'admin_scope', v_admin_scope
    );
    RETURN QUERY SELECT 
      0::NUMERIC AS total_population, 
      0::NUMERIC AS people_concern, 
      0::NUMERIC AS people_need, 
      v_debug AS debug_info;
    RETURN;
  END IF;

  -- Calculate total population in affected areas
  IF v_population_dataset_id IS NOT NULL THEN
    SELECT COALESCE(SUM(value), 0) INTO v_total_pop
    FROM public.dataset_values_numeric
    WHERE dataset_id = v_population_dataset_id
      AND admin_pcode = ANY(v_affected_codes);
    
    v_debug := v_debug || jsonb_build_object(
      'population_dataset_id', v_population_dataset_id,
      'population_dataset_name', (
        SELECT name FROM datasets WHERE id = v_population_dataset_id
      ),
      'codes_with_population_data', (
        SELECT COUNT(DISTINCT admin_pcode)
        FROM dataset_values_numeric
        WHERE dataset_id = v_population_dataset_id
          AND admin_pcode = ANY(v_affected_codes)
      ),
      'total_population', v_total_pop
    );
  ELSE
    v_debug := v_debug || jsonb_build_object(
      'error', 'No population dataset found or configured'
    );
  END IF;

  -- Calculate people of concern
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

  -- Calculate people in need
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

  RETURN QUERY SELECT 
    COALESCE(v_total_pop, 0)::NUMERIC AS total_population,
    COALESCE(v_people_concern, 0)::NUMERIC AS people_concern,
    COALESCE(v_people_need, 0)::NUMERIC AS people_need,
    v_debug AS debug_info;
END;
$$;

-- Test it:
-- SELECT * FROM get_instance_summary_debug('5197ced7-a93e-4548-a482-07a5f1c123ed'::UUID);

