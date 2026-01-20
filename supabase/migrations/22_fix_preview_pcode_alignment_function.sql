-- ==============================
-- FIX preview_pcode_alignment FUNCTION
-- ==============================
-- Fixes column name issues and parameter ambiguity
-- The raw tables use admin_pcode (not admin_pcode_raw) and value (not value_raw)

-- Drop ALL existing versions of the function to avoid conflicts
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT oid::regprocedure AS func_signature
    FROM pg_proc
    WHERE proname = 'preview_pcode_alignment'
      AND pronamespace = 'public'::regnamespace
  ) LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
  END LOOP;
END $$;

-- Create extension if needed
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION public.preview_pcode_alignment(
  dataset_id UUID,
  matching_config JSONB DEFAULT '{}'::JSONB,
  preview_limit INTEGER DEFAULT 500
)
RETURNS TABLE (
  raw_pcode TEXT,
  raw_name TEXT,
  matched_pcode TEXT,
  matched_name TEXT,
  match_strategy TEXT,
  confidence NUMERIC,
  value_raw TEXT,
  row_count BIGINT
) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_dataset_id UUID; -- Store parameter in local variable to avoid ambiguity
  v_dataset_type TEXT;
  v_admin_level TEXT;
  v_country_id UUID;
  v_exact_match BOOLEAN := COALESCE((matching_config->>'exact_match')::BOOLEAN, true);
  v_fuzzy_pcode BOOLEAN := COALESCE((matching_config->>'fuzzy_pcode')::BOOLEAN, true);
  v_name_match BOOLEAN := COALESCE((matching_config->>'name_match')::BOOLEAN, true);
  v_fuzzy_name BOOLEAN := COALESCE((matching_config->>'fuzzy_name')::BOOLEAN, true);
  v_parent_code BOOLEAN := COALESCE((matching_config->>'parent_code')::BOOLEAN, true);
  v_prefix_match BOOLEAN := COALESCE((matching_config->>'prefix_match')::BOOLEAN, true);
  v_fuzzy_threshold NUMERIC := COALESCE((matching_config->>'fuzzy_threshold')::NUMERIC, 0.8);
BEGIN
  -- Store parameter in local variable to avoid column name ambiguity
  -- In PL/pgSQL, we can reference the parameter directly in assignments
  v_dataset_id := dataset_id;
  
  -- Get dataset metadata and country_id for data isolation
  SELECT d.type, d.admin_level, d.country_id INTO v_dataset_type, v_admin_level, v_country_id
  FROM datasets d
  WHERE d.id = v_dataset_id;
  
  IF v_dataset_type IS NULL THEN
    RAISE EXCEPTION 'Dataset not found: %', v_dataset_id;
  END IF;

  -- Process numeric datasets
  IF v_dataset_type = 'numeric' THEN
    RETURN QUERY
    WITH raw_data AS (
      SELECT DISTINCT
        TRIM(COALESCE(dvnr.admin_pcode, '')) AS pcode,
        ''::TEXT AS name, -- Numeric raw table doesn't have name column
        COALESCE(dvnr.value::TEXT, '') AS value_raw,
        COUNT(*) AS cnt
      FROM dataset_values_numeric_raw dvnr
      WHERE dvnr.dataset_id = v_dataset_id
        AND dvnr.admin_pcode IS NOT NULL
        AND dvnr.admin_pcode != ''
      GROUP BY TRIM(COALESCE(dvnr.admin_pcode, '')), dvnr.value
      LIMIT GREATEST(1, COALESCE(preview_limit, 500))
    ),
    matches AS (
      SELECT DISTINCT
        rd.pcode AS raw_pcode,
        rd.name AS raw_name,
        rd.value_raw,
        rd.cnt,
        -- Exact PCode match (with country isolation)
        CASE 
          WHEN v_exact_match AND rd.pcode != '' THEN
            (SELECT ab.admin_pcode FROM admin_boundaries ab 
             WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(rd.pcode)
               AND (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
               AND (v_country_id IS NULL OR ab.country_id = v_country_id)
             LIMIT 1)
          ELSE NULL
        END AS exact_pcode,
        CASE 
          WHEN v_exact_match AND rd.pcode != '' THEN
            (SELECT ab.name FROM admin_boundaries ab 
             WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(rd.pcode)
               AND (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
               AND (v_country_id IS NULL OR ab.country_id = v_country_id)
             LIMIT 1)
          ELSE NULL
        END AS exact_name,
        -- Fuzzy PCode match (using similarity)
        CASE 
          WHEN v_fuzzy_pcode AND rd.pcode != '' AND 
               NOT EXISTS (SELECT 1 FROM admin_boundaries ab 
                          WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(rd.pcode)
                            AND (v_country_id IS NULL OR ab.country_id = v_country_id)) THEN
            (SELECT ab.admin_pcode FROM admin_boundaries ab 
             WHERE (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
               AND (v_country_id IS NULL OR ab.country_id = v_country_id)
               AND similarity(UPPER(TRIM(ab.admin_pcode)), UPPER(rd.pcode)) >= v_fuzzy_threshold
             ORDER BY similarity(UPPER(TRIM(ab.admin_pcode)), UPPER(rd.pcode)) DESC
             LIMIT 1)
          ELSE NULL
        END AS fuzzy_pcode,
        CASE 
          WHEN v_fuzzy_pcode AND rd.pcode != '' AND 
               NOT EXISTS (SELECT 1 FROM admin_boundaries ab 
                          WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(rd.pcode)
                            AND (v_country_id IS NULL OR ab.country_id = v_country_id)) THEN
            (SELECT ab.name FROM admin_boundaries ab 
             WHERE (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
               AND (v_country_id IS NULL OR ab.country_id = v_country_id)
               AND similarity(UPPER(TRIM(ab.admin_pcode)), UPPER(rd.pcode)) >= v_fuzzy_threshold
             ORDER BY similarity(UPPER(TRIM(ab.admin_pcode)), UPPER(rd.pcode)) DESC
             LIMIT 1)
          ELSE NULL
        END AS fuzzy_pcode_name,
        -- Prefix match (with country isolation)
        CASE 
          WHEN v_prefix_match AND rd.pcode != '' AND 
               NOT EXISTS (SELECT 1 FROM admin_boundaries ab 
                          WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(rd.pcode)
                            AND (v_country_id IS NULL OR ab.country_id = v_country_id)) THEN
            (SELECT ab.admin_pcode FROM admin_boundaries ab 
             WHERE (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
               AND (v_country_id IS NULL OR ab.country_id = v_country_id)
               AND ab.admin_pcode LIKE rd.pcode || '%'
             LIMIT 1)
          ELSE NULL
        END AS prefix_pcode,
        CASE 
          WHEN v_prefix_match AND rd.pcode != '' AND 
               NOT EXISTS (SELECT 1 FROM admin_boundaries ab 
                          WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(rd.pcode)
                            AND (v_country_id IS NULL OR ab.country_id = v_country_id)) THEN
            (SELECT ab.name FROM admin_boundaries ab 
             WHERE (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
               AND (v_country_id IS NULL OR ab.country_id = v_country_id)
               AND ab.admin_pcode LIKE rd.pcode || '%'
             LIMIT 1)
          ELSE NULL
        END AS prefix_name
      FROM raw_data rd
    )
    SELECT 
      COALESCE(m.raw_pcode, ''::TEXT) AS raw_pcode,
      COALESCE(m.raw_name, ''::TEXT) AS raw_name,
      COALESCE(
        m.exact_pcode,
        m.fuzzy_pcode,
        m.prefix_pcode,
        ''::TEXT
      ) AS matched_pcode,
      COALESCE(
        m.exact_name,
        m.fuzzy_pcode_name,
        m.prefix_name,
        ''::TEXT
      ) AS matched_name,
      CASE 
        WHEN m.exact_pcode IS NOT NULL THEN 'exact_match'::TEXT
        WHEN m.fuzzy_pcode IS NOT NULL THEN 'fuzzy_pcode'::TEXT
        WHEN m.prefix_pcode IS NOT NULL THEN 'prefix_match'::TEXT
        ELSE 'no_match'::TEXT
      END AS match_strategy,
      CASE 
        WHEN m.exact_pcode IS NOT NULL THEN 1.0::NUMERIC
        WHEN m.fuzzy_pcode IS NOT NULL THEN 
          COALESCE(
            (SELECT similarity(UPPER(TRIM(ab.admin_pcode)), UPPER(m.raw_pcode))::NUMERIC
             FROM admin_boundaries ab 
             WHERE ab.admin_pcode = m.fuzzy_pcode 
               AND (v_country_id IS NULL OR ab.country_id = v_country_id)
             LIMIT 1),
            0.0::NUMERIC
          )
        WHEN m.prefix_pcode IS NOT NULL THEN 0.7::NUMERIC
        ELSE 0.0::NUMERIC
      END AS confidence,
      COALESCE(m.value_raw, ''::TEXT) AS value_raw,
      m.cnt::BIGINT AS row_count
    FROM matches m
    ORDER BY m.raw_pcode, m.raw_name;
    
  -- Process categorical datasets
  ELSIF v_dataset_type = 'categorical' THEN
    RETURN QUERY
    WITH raw_data AS (
      SELECT DISTINCT
        TRIM(COALESCE(dvcr.admin_pcode, '')) AS pcode,
        ''::TEXT AS name, -- Categorical raw table doesn't have name column
        NULL::TEXT AS value_raw,
        COUNT(*) AS cnt
      FROM dataset_values_categorical_raw dvcr
      WHERE dvcr.dataset_id = v_dataset_id
        AND dvcr.admin_pcode IS NOT NULL
        AND dvcr.admin_pcode != ''
      GROUP BY TRIM(COALESCE(dvcr.admin_pcode, ''))
      LIMIT GREATEST(1, COALESCE(preview_limit, 500))
    ),
    matches AS (
      SELECT DISTINCT
        rd.pcode AS raw_pcode,
        rd.name AS raw_name,
        rd.value_raw,
        rd.cnt,
        -- Exact PCode match (with country isolation)
        CASE 
          WHEN v_exact_match AND rd.pcode != '' THEN
            (SELECT ab.admin_pcode FROM admin_boundaries ab 
             WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(rd.pcode)
               AND (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
               AND (v_country_id IS NULL OR ab.country_id = v_country_id)
             LIMIT 1)
          ELSE NULL
        END AS exact_pcode,
        CASE 
          WHEN v_exact_match AND rd.pcode != '' THEN
            (SELECT ab.name FROM admin_boundaries ab 
             WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(rd.pcode)
               AND (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
               AND (v_country_id IS NULL OR ab.country_id = v_country_id)
             LIMIT 1)
          ELSE NULL
        END AS exact_name,
        -- Fuzzy PCode match
        CASE 
          WHEN v_fuzzy_pcode AND rd.pcode != '' AND 
               NOT EXISTS (SELECT 1 FROM admin_boundaries ab 
                          WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(rd.pcode)
                            AND (v_country_id IS NULL OR ab.country_id = v_country_id)) THEN
            (SELECT ab.admin_pcode FROM admin_boundaries ab 
             WHERE (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
               AND (v_country_id IS NULL OR ab.country_id = v_country_id)
               AND similarity(UPPER(TRIM(ab.admin_pcode)), UPPER(rd.pcode)) >= v_fuzzy_threshold
             ORDER BY similarity(UPPER(TRIM(ab.admin_pcode)), UPPER(rd.pcode)) DESC
             LIMIT 1)
          ELSE NULL
        END AS fuzzy_pcode,
        CASE 
          WHEN v_fuzzy_pcode AND rd.pcode != '' AND 
               NOT EXISTS (SELECT 1 FROM admin_boundaries ab 
                          WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(rd.pcode)
                            AND (v_country_id IS NULL OR ab.country_id = v_country_id)) THEN
            (SELECT ab.name FROM admin_boundaries ab 
             WHERE (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
               AND (v_country_id IS NULL OR ab.country_id = v_country_id)
               AND similarity(UPPER(TRIM(ab.admin_pcode)), UPPER(rd.pcode)) >= v_fuzzy_threshold
             ORDER BY similarity(UPPER(TRIM(ab.admin_pcode)), UPPER(rd.pcode)) DESC
             LIMIT 1)
          ELSE NULL
        END AS fuzzy_pcode_name,
        -- Prefix match
        CASE 
          WHEN v_prefix_match AND rd.pcode != '' AND 
               NOT EXISTS (SELECT 1 FROM admin_boundaries ab 
                          WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(rd.pcode)
                            AND (v_country_id IS NULL OR ab.country_id = v_country_id)) THEN
            (SELECT ab.admin_pcode FROM admin_boundaries ab 
             WHERE (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
               AND (v_country_id IS NULL OR ab.country_id = v_country_id)
               AND ab.admin_pcode LIKE rd.pcode || '%'
             LIMIT 1)
          ELSE NULL
        END AS prefix_pcode,
        CASE 
          WHEN v_prefix_match AND rd.pcode != '' AND 
               NOT EXISTS (SELECT 1 FROM admin_boundaries ab 
                          WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(rd.pcode)
                            AND (v_country_id IS NULL OR ab.country_id = v_country_id)) THEN
            (SELECT ab.name FROM admin_boundaries ab 
             WHERE (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
               AND (v_country_id IS NULL OR ab.country_id = v_country_id)
               AND ab.admin_pcode LIKE rd.pcode || '%'
             LIMIT 1)
          ELSE NULL
        END AS prefix_name
      FROM raw_data rd
    )
    SELECT 
      COALESCE(m.raw_pcode, ''::TEXT) AS raw_pcode,
      COALESCE(m.raw_name, ''::TEXT) AS raw_name,
      COALESCE(
        m.exact_pcode,
        m.fuzzy_pcode,
        m.prefix_pcode,
        ''::TEXT
      ) AS matched_pcode,
      COALESCE(
        m.exact_name,
        m.fuzzy_pcode_name,
        m.prefix_name,
        ''::TEXT
      ) AS matched_name,
      CASE 
        WHEN m.exact_pcode IS NOT NULL THEN 'exact_match'::TEXT
        WHEN m.fuzzy_pcode IS NOT NULL THEN 'fuzzy_pcode'::TEXT
        WHEN m.prefix_pcode IS NOT NULL THEN 'prefix_match'::TEXT
        ELSE 'no_match'::TEXT
      END AS match_strategy,
      CASE 
        WHEN m.exact_pcode IS NOT NULL THEN 1.0::NUMERIC
        WHEN m.fuzzy_pcode IS NOT NULL THEN 
          COALESCE(
            (SELECT similarity(UPPER(TRIM(ab.admin_pcode)), UPPER(m.raw_pcode))::NUMERIC
             FROM admin_boundaries ab 
             WHERE ab.admin_pcode = m.fuzzy_pcode 
               AND (v_country_id IS NULL OR ab.country_id = v_country_id)
             LIMIT 1),
            0.0::NUMERIC
          )
        WHEN m.prefix_pcode IS NOT NULL THEN 0.7::NUMERIC
        ELSE 0.0::NUMERIC
      END AS confidence,
      COALESCE(m.value_raw, ''::TEXT) AS value_raw,
      m.cnt::BIGINT AS row_count
    FROM matches m
    ORDER BY m.raw_pcode, m.raw_name;
  END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.preview_pcode_alignment(UUID, JSONB, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_pcode_alignment(UUID, JSONB, INTEGER) TO anon;

-- Note: This function requires the pg_trgm extension for similarity() function
-- The extension is created at the top of this migration
