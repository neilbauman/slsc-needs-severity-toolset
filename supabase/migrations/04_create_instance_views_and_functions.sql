-- ==============================
-- CREATE INSTANCE VIEWS AND FUNCTIONS
-- ==============================
-- Creates the missing views and functions needed for instance pages
-- Run this in the TARGET database

-- ==============================
-- 0. Ensure instance_category_scores table exists
-- ==============================
CREATE TABLE IF NOT EXISTS public.instance_category_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  admin_pcode TEXT NOT NULL,
  score NUMERIC NOT NULL CHECK (score >= 1 AND score <= 5),
  computed_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(instance_id, category, admin_pcode)
);

CREATE INDEX IF NOT EXISTS idx_instance_category_scores_instance_id ON public.instance_category_scores(instance_id);
CREATE INDEX IF NOT EXISTS idx_instance_category_scores_category ON public.instance_category_scores(category);
CREATE INDEX IF NOT EXISTS idx_instance_category_scores_admin_pcode ON public.instance_category_scores(admin_pcode);
CREATE INDEX IF NOT EXISTS idx_instance_category_scores_composite ON public.instance_category_scores(instance_id, category, admin_pcode);

-- ==============================
-- 1. Create v_instance_admin_scores view
-- ==============================
DROP VIEW IF EXISTS public.v_instance_admin_scores;

CREATE OR REPLACE VIEW public.v_instance_admin_scores AS
SELECT 
  ics.instance_id,
  ics.admin_pcode,
  ab.name,
  ics.score AS avg_score,
  ics.computed_at
FROM public.instance_category_scores ics
LEFT JOIN public.admin_boundaries ab ON ab.admin_pcode = ics.admin_pcode AND ab.admin_level = 'ADM3'
INNER JOIN public.instances i ON i.id = ics.instance_id
WHERE ics.category = 'Overall';

-- Grant permissions
GRANT SELECT ON public.v_instance_admin_scores TO anon, authenticated;

COMMENT ON VIEW public.v_instance_admin_scores IS 'Provides overall vulnerability scores (absolute severity) for each admin area, reading from instance_category_scores with category = Overall. Use for PIN calculations. For relative prioritization, use category = Priority.';

-- ==============================
-- 2. Create v_instance_admin_scores_geojson view
-- ==============================
-- Note: Handles both 'geom' and 'geometry' column names
DROP VIEW IF EXISTS public.v_instance_admin_scores_geojson;

-- Check which geometry column exists and create view accordingly
DO $$
DECLARE
  geom_col_name TEXT;
BEGIN
  -- Detect geometry column name
  SELECT column_name INTO geom_col_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'admin_boundaries'
    AND column_name IN ('geom', 'geometry')
  ORDER BY CASE column_name WHEN 'geom' THEN 1 ELSE 2 END
  LIMIT 1;
  
  IF geom_col_name = 'geom' THEN
    EXECUTE '
    CREATE OR REPLACE VIEW public.v_instance_admin_scores_geojson AS
    SELECT 
      ics.instance_id,
      ics.admin_pcode,
      ST_AsGeoJSON(ab.geom)::jsonb AS geojson
    FROM public.instance_category_scores ics
    INNER JOIN public.admin_boundaries ab ON ab.admin_pcode = ics.admin_pcode AND ab.admin_level = ''ADM3''
    INNER JOIN public.instances i ON i.id = ics.instance_id
    WHERE ics.category = ''Overall''
      AND ab.geom IS NOT NULL
      AND ab.country_id = i.country_id';
  ELSE
    EXECUTE '
    CREATE OR REPLACE VIEW public.v_instance_admin_scores_geojson AS
    SELECT 
      ics.instance_id,
      ics.admin_pcode,
      ST_AsGeoJSON(ab.geometry)::jsonb AS geojson
    FROM public.instance_category_scores ics
    INNER JOIN public.admin_boundaries ab ON ab.admin_pcode = ics.admin_pcode AND ab.admin_level = ''ADM3''
    INNER JOIN public.instances i ON i.id = ics.instance_id
    WHERE ics.category = ''Overall''
      AND ab.geometry IS NOT NULL
      AND ab.country_id = i.country_id';
  END IF;
END $$;

-- Grant permissions
GRANT SELECT ON public.v_instance_admin_scores_geojson TO anon, authenticated;

COMMENT ON VIEW public.v_instance_admin_scores_geojson IS 'Provides GeoJSON geometry for admin areas with overall scores, for map display';

-- ==============================
-- 3. Create get_instance_summary function
-- ==============================
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
      -- Get instance country_id for filtering
      DECLARE
        v_country_id UUID;
      BEGIN
        SELECT country_id INTO v_country_id
        FROM public.instances
        WHERE id = in_instance_id;
        
        -- Get ADM3 codes from affected ADM2 areas
        -- Try direct parent_pcode relationship first
        SELECT ARRAY_AGG(DISTINCT admin_pcode) INTO v_affected_codes
        FROM public.admin_boundaries
        WHERE UPPER(TRIM(admin_level)) = 'ADM3'
          AND parent_pcode = ANY(v_admin_scope)
          AND country_id = v_country_id;
        
        -- If no codes found, try prefix matching
        IF v_affected_codes IS NULL OR array_length(v_affected_codes, 1) = 0 THEN
          SELECT ARRAY_AGG(DISTINCT admin_pcode) INTO v_affected_codes
          FROM public.admin_boundaries
          WHERE UPPER(TRIM(admin_level)) = 'ADM3'
            AND country_id = v_country_id
            AND EXISTS (
              SELECT 1 FROM unnest(v_admin_scope) AS adm2_code
              WHERE admin_pcode LIKE adm2_code || '%'
            );
        END IF;
      END;
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
          INNER JOIN public.datasets d ON d.id = dvn.dataset_id
          INNER JOIN public.admin_boundaries ab4 ON ab4.admin_pcode = dvn.admin_pcode
          INNER JOIN public.admin_boundaries ab3 ON ab3.admin_pcode = ab4.parent_pcode
          INNER JOIN public.instances inst ON inst.id = in_instance_id
          WHERE dvn.dataset_id = v_population_dataset_id
            AND UPPER(TRIM(ab4.admin_level)) = 'ADM4'
            AND UPPER(TRIM(ab3.admin_level)) = 'ADM3'
            AND ab3.admin_pcode = ANY(v_affected_codes)
            AND ab4.country_id = inst.country_id
            AND ab3.country_id = inst.country_id
            AND d.country_id = inst.country_id;
        -- If population is at ADM3, direct match
        ELSIF v_pop_admin_level IN ('ADM3', 'adm3') THEN
          SELECT COALESCE(SUM(dvn.value), 0) INTO v_total_pop
          FROM public.dataset_values_numeric dvn
          INNER JOIN public.datasets d ON d.id = dvn.dataset_id
          INNER JOIN public.instances inst ON inst.id = in_instance_id
          WHERE dvn.dataset_id = v_population_dataset_id
            AND dvn.admin_pcode = ANY(v_affected_codes)
            AND d.country_id = inst.country_id;
        -- If population is at ADM2, we'd need to distribute down (not implemented)
        ELSE
          RAISE NOTICE 'Population dataset admin_level (%) not supported for aggregation', v_pop_admin_level;
          v_total_pop := 0;
        END IF;
      END;
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
          INNER JOIN public.datasets d ON d.id = dvn.dataset_id
          INNER JOIN public.admin_boundaries ab4 ON ab4.admin_pcode = dvn.admin_pcode
          INNER JOIN public.admin_boundaries ab3 ON ab3.admin_pcode = ab4.parent_pcode
          INNER JOIN public.instance_category_scores ics ON ics.admin_pcode = ab3.admin_pcode
          INNER JOIN public.instances inst ON inst.id = in_instance_id
          WHERE dvn.dataset_id = v_population_dataset_id
            AND UPPER(TRIM(ab4.admin_level)) = 'ADM4'
            AND UPPER(TRIM(ab3.admin_level)) = 'ADM3'
            AND ab3.admin_pcode = ANY(v_affected_codes)
            AND ics.instance_id = in_instance_id
            AND ics.category = 'Overall'
            AND ics.score >= 3.0
            AND ab4.country_id = inst.country_id
            AND ab3.country_id = inst.country_id
            AND d.country_id = inst.country_id;
        -- If population is at ADM3, direct match
        ELSIF v_pop_admin_level = 'ADM3' THEN
          SELECT COALESCE(SUM(dvn.value), 0) INTO v_people_concern
          FROM public.dataset_values_numeric dvn
          INNER JOIN public.datasets d ON d.id = dvn.dataset_id
          INNER JOIN public.instance_category_scores ics ON ics.admin_pcode = dvn.admin_pcode
          INNER JOIN public.instances inst ON inst.id = in_instance_id
          WHERE dvn.dataset_id = v_population_dataset_id
            AND dvn.admin_pcode = ANY(v_affected_codes)
            AND ics.instance_id = in_instance_id
            AND ics.category = 'Overall'
            AND ics.score >= 3.0
            AND d.country_id = inst.country_id;
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
          INNER JOIN public.datasets d_pop ON d_pop.id = dvn_pop.dataset_id
          INNER JOIN public.admin_boundaries ab4_pop ON ab4_pop.admin_pcode = dvn_pop.admin_pcode
          INNER JOIN public.admin_boundaries ab3_pop ON ab3_pop.admin_pcode = ab4_pop.parent_pcode
          INNER JOIN public.instance_category_scores ics ON ics.admin_pcode = ab3_pop.admin_pcode
          INNER JOIN public.instances inst ON inst.id = in_instance_id
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
            AND ics.score >= 3.0
            AND ab4_pop.country_id = inst.country_id
            AND ab3_pop.country_id = inst.country_id
            AND d_pop.country_id = inst.country_id;
        -- If population is at ADM3, direct match
        ELSIF v_pop_admin_level = 'ADM3' THEN
          SELECT COALESCE(SUM(dvn_pop.value * COALESCE(dvn_pov.value, 0) / 100.0), 0) INTO v_people_need
          FROM public.dataset_values_numeric dvn_pop
          INNER JOIN public.datasets d_pop ON d_pop.id = dvn_pop.dataset_id
          INNER JOIN public.instance_category_scores ics ON ics.admin_pcode = dvn_pop.admin_pcode
          INNER JOIN public.instances inst ON inst.id = in_instance_id
          LEFT JOIN public.dataset_values_numeric dvn_pov 
            ON dvn_pov.dataset_id = v_poverty_dataset_id 
            AND dvn_pov.admin_pcode = dvn_pop.admin_pcode
          WHERE dvn_pop.dataset_id = v_population_dataset_id
            AND dvn_pop.admin_pcode = ANY(v_affected_codes)
            AND ics.instance_id = in_instance_id
            AND ics.category = 'Overall'
            AND ics.score >= 3.0
            AND d_pop.country_id = inst.country_id;
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_instance_summary(UUID) TO anon, authenticated;

COMMENT ON FUNCTION public.get_instance_summary IS 'Calculates summary metrics for an instance: total_population, people_concern (severity ≥ 3), and people_need (people_concern × poverty rate)';
