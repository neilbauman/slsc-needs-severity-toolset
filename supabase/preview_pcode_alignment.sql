-- Preview PCode Alignment
-- Analyzes raw dataset values and suggests matches to admin_boundaries
-- Supports multiple matching strategies: exact, fuzzy, name-based, parent, prefix
-- Country-agnostic implementation
--
-- REQUIRES: pg_trgm extension for similarity() function
-- Run this first: CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION preview_pcode_alignment(
  dataset_id UUID,
  matching_config JSONB DEFAULT '{}'::JSONB
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
  v_dataset_type TEXT;
  v_admin_level TEXT;
  v_exact_match BOOLEAN := COALESCE((matching_config->>'exact_match')::BOOLEAN, true);
  v_fuzzy_pcode BOOLEAN := COALESCE((matching_config->>'fuzzy_pcode')::BOOLEAN, true);
  v_name_match BOOLEAN := COALESCE((matching_config->>'name_match')::BOOLEAN, true);
  v_fuzzy_name BOOLEAN := COALESCE((matching_config->>'fuzzy_name')::BOOLEAN, true);
  v_parent_code BOOLEAN := COALESCE((matching_config->>'parent_code')::BOOLEAN, true);
  v_prefix_match BOOLEAN := COALESCE((matching_config->>'prefix_match')::BOOLEAN, true);
  v_fuzzy_threshold NUMERIC := COALESCE((matching_config->>'fuzzy_threshold')::NUMERIC, 0.8);
BEGIN
  -- Get dataset metadata
  SELECT type, admin_level INTO v_dataset_type, v_admin_level
  FROM datasets
  WHERE id = dataset_id;
  
  IF v_dataset_type IS NULL THEN
    RAISE EXCEPTION 'Dataset not found: %', dataset_id;
  END IF;

  -- Process numeric datasets
  IF v_dataset_type = 'numeric' THEN
    RETURN QUERY
    WITH raw_data AS (
      SELECT DISTINCT
        TRIM(COALESCE(admin_pcode_raw, '')) AS pcode,
        TRIM(COALESCE(admin_name_raw, '')) AS name,
        value_raw,
        COUNT(*) AS cnt
      FROM dataset_values_numeric_raw
      WHERE dataset_id = preview_pcode_alignment.dataset_id
        AND (admin_pcode_raw IS NOT NULL OR admin_name_raw IS NOT NULL)
      GROUP BY TRIM(COALESCE(admin_pcode_raw, '')), TRIM(COALESCE(admin_name_raw, '')), value_raw
    ),
    matches AS (
      SELECT DISTINCT
        rd.pcode AS raw_pcode,
        rd.name AS raw_name,
        rd.value_raw,
        rd.cnt,
        -- Exact PCode match
        CASE 
          WHEN v_exact_match AND rd.pcode != '' THEN
            (SELECT ab.admin_pcode FROM admin_boundaries ab 
             WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(rd.pcode)
               AND (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
             LIMIT 1)
          ELSE NULL
        END AS exact_pcode,
        CASE 
          WHEN v_exact_match AND rd.pcode != '' THEN
            (SELECT ab.name FROM admin_boundaries ab 
             WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(rd.pcode)
               AND (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
             LIMIT 1)
          ELSE NULL
        END AS exact_name,
        -- Fuzzy PCode match (using similarity)
        CASE 
          WHEN v_fuzzy_pcode AND rd.pcode != '' AND 
               NOT EXISTS (SELECT 1 FROM admin_boundaries ab 
                          WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(rd.pcode)) THEN
            (SELECT ab.admin_pcode FROM admin_boundaries ab 
             WHERE (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
               AND similarity(UPPER(TRIM(ab.admin_pcode)), UPPER(rd.pcode)) >= v_fuzzy_threshold
             ORDER BY similarity(UPPER(TRIM(ab.admin_pcode)), UPPER(rd.pcode)) DESC
             LIMIT 1)
          ELSE NULL
        END AS fuzzy_pcode,
        CASE 
          WHEN v_fuzzy_pcode AND rd.pcode != '' AND 
               NOT EXISTS (SELECT 1 FROM admin_boundaries ab 
                          WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(rd.pcode)) THEN
            (SELECT ab.name FROM admin_boundaries ab 
             WHERE (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
               AND similarity(UPPER(TRIM(ab.admin_pcode)), UPPER(rd.pcode)) >= v_fuzzy_threshold
             ORDER BY similarity(UPPER(TRIM(ab.admin_pcode)), UPPER(rd.pcode)) DESC
             LIMIT 1)
          ELSE NULL
        END AS fuzzy_pcode_name,
        -- Name match (normalized, case-insensitive)
        CASE 
          WHEN v_name_match AND rd.name != '' AND rd.pcode = '' THEN
            (SELECT ab.admin_pcode FROM admin_boundaries ab 
             WHERE UPPER(TRIM(ab.name)) = UPPER(rd.name)
               AND (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
             LIMIT 1)
          WHEN v_name_match AND rd.name != '' THEN
            (SELECT ab.admin_pcode FROM admin_boundaries ab 
             WHERE UPPER(TRIM(ab.name)) = UPPER(rd.name)
               AND (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
               AND NOT EXISTS (SELECT 1 FROM admin_boundaries ab2 
                              WHERE UPPER(TRIM(ab2.admin_pcode)) = UPPER(rd.pcode))
             LIMIT 1)
          ELSE NULL
        END AS name_match_pcode,
        CASE 
          WHEN v_name_match AND rd.name != '' AND rd.pcode = '' THEN
            (SELECT ab.name FROM admin_boundaries ab 
             WHERE UPPER(TRIM(ab.name)) = UPPER(rd.name)
               AND (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
             LIMIT 1)
          WHEN v_name_match AND rd.name != '' THEN
            (SELECT ab.name FROM admin_boundaries ab 
             WHERE UPPER(TRIM(ab.name)) = UPPER(rd.name)
               AND (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
               AND NOT EXISTS (SELECT 1 FROM admin_boundaries ab2 
                              WHERE UPPER(TRIM(ab2.admin_pcode)) = UPPER(rd.pcode))
             LIMIT 1)
          ELSE NULL
        END AS name_match_name,
        -- Fuzzy name match
        CASE 
          WHEN v_fuzzy_name AND rd.name != '' AND 
               NOT EXISTS (SELECT 1 FROM admin_boundaries ab 
                          WHERE UPPER(TRIM(ab.name)) = UPPER(rd.name)) THEN
            (SELECT ab.admin_pcode FROM admin_boundaries ab 
             WHERE (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
               AND similarity(UPPER(TRIM(ab.name)), UPPER(rd.name)) >= v_fuzzy_threshold
             ORDER BY similarity(UPPER(TRIM(ab.name)), UPPER(rd.name)) DESC
             LIMIT 1)
          ELSE NULL
        END AS fuzzy_name_pcode,
        CASE 
          WHEN v_fuzzy_name AND rd.name != '' AND 
               NOT EXISTS (SELECT 1 FROM admin_boundaries ab 
                          WHERE UPPER(TRIM(ab.name)) = UPPER(rd.name)) THEN
            (SELECT ab.name FROM admin_boundaries ab 
             WHERE (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
               AND similarity(UPPER(TRIM(ab.name)), UPPER(rd.name)) >= v_fuzzy_threshold
             ORDER BY similarity(UPPER(TRIM(ab.name)), UPPER(rd.name)) DESC
             LIMIT 1)
          ELSE NULL
        END AS fuzzy_name_name,
        -- Prefix match
        CASE 
          WHEN v_prefix_match AND rd.pcode != '' AND 
               NOT EXISTS (SELECT 1 FROM admin_boundaries ab 
                          WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(rd.pcode)) THEN
            (SELECT ab.admin_pcode FROM admin_boundaries ab 
             WHERE (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
               AND ab.admin_pcode LIKE rd.pcode || '%'
             LIMIT 1)
          ELSE NULL
        END AS prefix_pcode,
        CASE 
          WHEN v_prefix_match AND rd.pcode != '' AND 
               NOT EXISTS (SELECT 1 FROM admin_boundaries ab 
                          WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(rd.pcode)) THEN
            (SELECT ab.name FROM admin_boundaries ab 
             WHERE (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
               AND ab.admin_pcode LIKE rd.pcode || '%'
             LIMIT 1)
          ELSE NULL
        END AS prefix_name
      FROM raw_data rd
    )
    SELECT 
      m.raw_pcode,
      m.raw_name,
      COALESCE(
        m.exact_pcode,
        m.fuzzy_pcode,
        m.name_match_pcode,
        m.fuzzy_name_pcode,
        m.prefix_pcode
      ) AS matched_pcode,
      COALESCE(
        m.exact_name,
        m.fuzzy_pcode_name,
        m.name_match_name,
        m.fuzzy_name_name,
        m.prefix_name
      ) AS matched_name,
      CASE 
        WHEN m.exact_pcode IS NOT NULL THEN 'exact_match'
        WHEN m.fuzzy_pcode IS NOT NULL THEN 'fuzzy_pcode'
        WHEN m.name_match_pcode IS NOT NULL THEN 'name_match'
        WHEN m.fuzzy_name_pcode IS NOT NULL THEN 'fuzzy_name'
        WHEN m.prefix_pcode IS NOT NULL THEN 'prefix_match'
        ELSE 'no_match'
      END AS match_strategy,
      CASE 
        WHEN m.exact_pcode IS NOT NULL THEN 1.0
        WHEN m.fuzzy_pcode IS NOT NULL THEN 
          (SELECT similarity(UPPER(TRIM(ab.admin_pcode)), UPPER(m.raw_pcode))
           FROM admin_boundaries ab WHERE ab.admin_pcode = m.fuzzy_pcode LIMIT 1)
        WHEN m.name_match_pcode IS NOT NULL THEN 0.9
        WHEN m.fuzzy_name_pcode IS NOT NULL THEN 
          (SELECT similarity(UPPER(TRIM(ab.name)), UPPER(m.raw_name))
           FROM admin_boundaries ab WHERE ab.admin_pcode = m.fuzzy_name_pcode LIMIT 1)
        WHEN m.prefix_pcode IS NOT NULL THEN 0.7
        ELSE 0.0
      END AS confidence,
      m.value_raw,
      m.cnt AS row_count
    FROM matches m
    ORDER BY m.raw_pcode, m.raw_name;
    
  -- Process categorical datasets (similar logic)
  ELSIF v_dataset_type = 'categorical' THEN
    RETURN QUERY
    WITH raw_data AS (
      SELECT DISTINCT
        TRIM(COALESCE(admin_pcode_raw, '')) AS pcode,
        TRIM(COALESCE(admin_name_raw, '')) AS name,
        NULL::TEXT AS value_raw,
        COUNT(*) AS cnt
      FROM dataset_values_categorical_raw
      WHERE dataset_id = preview_pcode_alignment.dataset_id
        AND (admin_pcode_raw IS NOT NULL OR admin_name_raw IS NOT NULL)
      GROUP BY TRIM(COALESCE(admin_pcode_raw, '')), TRIM(COALESCE(admin_name_raw, ''))
    ),
    matches AS (
      SELECT DISTINCT
        rd.pcode AS raw_pcode,
        rd.name AS raw_name,
        rd.value_raw,
        rd.cnt,
        -- Same matching logic as numeric
        CASE 
          WHEN v_exact_match AND rd.pcode != '' THEN
            (SELECT ab.admin_pcode FROM admin_boundaries ab 
             WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(rd.pcode)
               AND (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
             LIMIT 1)
          ELSE NULL
        END AS exact_pcode,
        CASE 
          WHEN v_exact_match AND rd.pcode != '' THEN
            (SELECT ab.name FROM admin_boundaries ab 
             WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(rd.pcode)
               AND (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
             LIMIT 1)
          ELSE NULL
        END AS exact_name,
        CASE 
          WHEN v_fuzzy_pcode AND rd.pcode != '' AND 
               NOT EXISTS (SELECT 1 FROM admin_boundaries ab 
                          WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(rd.pcode)) THEN
            (SELECT ab.admin_pcode FROM admin_boundaries ab 
             WHERE (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
               AND similarity(UPPER(TRIM(ab.admin_pcode)), UPPER(rd.pcode)) >= v_fuzzy_threshold
             ORDER BY similarity(UPPER(TRIM(ab.admin_pcode)), UPPER(rd.pcode)) DESC
             LIMIT 1)
          ELSE NULL
        END AS fuzzy_pcode,
        CASE 
          WHEN v_fuzzy_pcode AND rd.pcode != '' AND 
               NOT EXISTS (SELECT 1 FROM admin_boundaries ab 
                          WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(rd.pcode)) THEN
            (SELECT ab.name FROM admin_boundaries ab 
             WHERE (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
               AND similarity(UPPER(TRIM(ab.admin_pcode)), UPPER(rd.pcode)) >= v_fuzzy_threshold
             ORDER BY similarity(UPPER(TRIM(ab.admin_pcode)), UPPER(rd.pcode)) DESC
             LIMIT 1)
          ELSE NULL
        END AS fuzzy_pcode_name,
        CASE 
          WHEN v_name_match AND rd.name != '' THEN
            (SELECT ab.admin_pcode FROM admin_boundaries ab 
             WHERE UPPER(TRIM(ab.name)) = UPPER(rd.name)
               AND (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
             LIMIT 1)
          ELSE NULL
        END AS name_match_pcode,
        CASE 
          WHEN v_name_match AND rd.name != '' THEN
            (SELECT ab.name FROM admin_boundaries ab 
             WHERE UPPER(TRIM(ab.name)) = UPPER(rd.name)
               AND (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
             LIMIT 1)
          ELSE NULL
        END AS name_match_name,
        CASE 
          WHEN v_fuzzy_name AND rd.name != '' AND 
               NOT EXISTS (SELECT 1 FROM admin_boundaries ab 
                          WHERE UPPER(TRIM(ab.name)) = UPPER(rd.name)) THEN
            (SELECT ab.admin_pcode FROM admin_boundaries ab 
             WHERE (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
               AND similarity(UPPER(TRIM(ab.name)), UPPER(rd.name)) >= v_fuzzy_threshold
             ORDER BY similarity(UPPER(TRIM(ab.name)), UPPER(rd.name)) DESC
             LIMIT 1)
          ELSE NULL
        END AS fuzzy_name_pcode,
        CASE 
          WHEN v_fuzzy_name AND rd.name != '' AND 
               NOT EXISTS (SELECT 1 FROM admin_boundaries ab 
                          WHERE UPPER(TRIM(ab.name)) = UPPER(rd.name)) THEN
            (SELECT ab.name FROM admin_boundaries ab 
             WHERE (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
               AND similarity(UPPER(TRIM(ab.name)), UPPER(rd.name)) >= v_fuzzy_threshold
             ORDER BY similarity(UPPER(TRIM(ab.name)), UPPER(rd.name)) DESC
             LIMIT 1)
          ELSE NULL
        END AS fuzzy_name_name,
        CASE 
          WHEN v_prefix_match AND rd.pcode != '' AND 
               NOT EXISTS (SELECT 1 FROM admin_boundaries ab 
                          WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(rd.pcode)) THEN
            (SELECT ab.admin_pcode FROM admin_boundaries ab 
             WHERE (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
               AND ab.admin_pcode LIKE rd.pcode || '%'
             LIMIT 1)
          ELSE NULL
        END AS prefix_pcode,
        CASE 
          WHEN v_prefix_match AND rd.pcode != '' AND 
               NOT EXISTS (SELECT 1 FROM admin_boundaries ab 
                          WHERE UPPER(TRIM(ab.admin_pcode)) = UPPER(rd.pcode)) THEN
            (SELECT ab.name FROM admin_boundaries ab 
             WHERE (v_admin_level IS NULL OR UPPER(TRIM(ab.admin_level)) = UPPER(v_admin_level))
               AND ab.admin_pcode LIKE rd.pcode || '%'
             LIMIT 1)
          ELSE NULL
        END AS prefix_name
      FROM raw_data rd
    )
    SELECT 
      m.raw_pcode,
      m.raw_name,
      COALESCE(
        m.exact_pcode,
        m.fuzzy_pcode,
        m.name_match_pcode,
        m.fuzzy_name_pcode,
        m.prefix_pcode
      ) AS matched_pcode,
      COALESCE(
        m.exact_name,
        m.fuzzy_pcode_name,
        m.name_match_name,
        m.fuzzy_name_name,
        m.prefix_name
      ) AS matched_name,
      CASE 
        WHEN m.exact_pcode IS NOT NULL THEN 'exact_match'
        WHEN m.fuzzy_pcode IS NOT NULL THEN 'fuzzy_pcode'
        WHEN m.name_match_pcode IS NOT NULL THEN 'name_match'
        WHEN m.fuzzy_name_pcode IS NOT NULL THEN 'fuzzy_name'
        WHEN m.prefix_pcode IS NOT NULL THEN 'prefix_match'
        ELSE 'no_match'
      END AS match_strategy,
      CASE 
        WHEN m.exact_pcode IS NOT NULL THEN 1.0
        WHEN m.fuzzy_pcode IS NOT NULL THEN 
          (SELECT similarity(UPPER(TRIM(ab.admin_pcode)), UPPER(m.raw_pcode))
           FROM admin_boundaries ab WHERE ab.admin_pcode = m.fuzzy_pcode LIMIT 1)
        WHEN m.name_match_pcode IS NOT NULL THEN 0.9
        WHEN m.fuzzy_name_pcode IS NOT NULL THEN 
          (SELECT similarity(UPPER(TRIM(ab.name)), UPPER(m.raw_name))
           FROM admin_boundaries ab WHERE ab.admin_pcode = m.fuzzy_name_pcode LIMIT 1)
        WHEN m.prefix_pcode IS NOT NULL THEN 0.7
        ELSE 0.0
      END AS confidence,
      m.value_raw,
      m.cnt AS row_count
    FROM matches m
    ORDER BY m.raw_pcode, m.raw_name;
  END IF;
END;
$$;

-- Note: This function requires the pg_trgm extension for similarity() function
-- Run: CREATE EXTENSION IF NOT EXISTS pg_trgm;

