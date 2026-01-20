-- ==============================
-- ADD PAGINATION SUPPORT TO get_affected_adm3
-- ==============================
-- This allows fetching ADM3 data in chunks to avoid timeouts and memory issues

-- Drop the old function first to avoid overload conflicts
DROP FUNCTION IF EXISTS public.get_affected_adm3(TEXT[]);

CREATE OR REPLACE FUNCTION public.get_affected_adm3(
  in_scope TEXT[] DEFAULT NULL,
  in_limit INTEGER DEFAULT NULL,
  in_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  admin_pcode TEXT,
  name TEXT,
  geom JSONB,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_country_id UUID;
  v_geom_col TEXT;
  v_scope_filtered TEXT[];
  v_total_count BIGINT;
BEGIN
  -- Handle NULL or empty scope
  IF in_scope IS NULL THEN
    RETURN;
  END IF;
  
  -- Filter out NULL and empty strings from scope array
  SELECT ARRAY_AGG(DISTINCT elem) INTO v_scope_filtered
  FROM unnest(in_scope) AS elem
  WHERE elem IS NOT NULL AND trim(elem) != '';
  
  -- If no valid codes after filtering, return empty
  IF v_scope_filtered IS NULL OR array_length(v_scope_filtered, 1) = 0 THEN
    RETURN;
  END IF;
  
  -- Get country_id from first admin boundary in scope (they should all be same country)
  SELECT ab.country_id INTO v_country_id
  FROM public.admin_boundaries ab
  WHERE ab.admin_pcode = ANY(v_scope_filtered)
  LIMIT 1;
  
  -- Detect geometry column name (cache it to avoid repeated queries)
  SELECT column_name INTO v_geom_col
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'admin_boundaries'
    AND column_name IN ('geom', 'geometry')
  ORDER BY CASE column_name WHEN 'geom' THEN 1 ELSE 2 END
  LIMIT 1;
  
  -- Default to 'geometry' if neither column found
  IF v_geom_col IS NULL THEN
    v_geom_col := 'geometry';
  END IF;
  
  -- Get total count first (for pagination info)
  IF v_geom_col = 'geom' THEN
    SELECT COUNT(*) INTO v_total_count
    FROM public.admin_boundaries ab
    WHERE UPPER(TRIM(ab.admin_level)) = 'ADM3'
      AND (
        ab.parent_pcode = ANY(v_scope_filtered)
        OR EXISTS (
          SELECT 1 
          FROM (SELECT unnest(v_scope_filtered) AS scope_val) AS scope_table
          WHERE ab.admin_pcode LIKE scope_table.scope_val || '%'
        )
      )
      AND (v_country_id IS NULL OR ab.country_id = v_country_id)
      AND ab.geom IS NOT NULL;
  ELSE
    SELECT COUNT(*) INTO v_total_count
    FROM public.admin_boundaries ab
    WHERE UPPER(TRIM(ab.admin_level)) = 'ADM3'
      AND (
        ab.parent_pcode = ANY(v_scope_filtered)
        OR EXISTS (
          SELECT 1 
          FROM (SELECT unnest(v_scope_filtered) AS scope_val) AS scope_table
          WHERE ab.admin_pcode LIKE scope_table.scope_val || '%'
        )
      )
      AND (v_country_id IS NULL OR ab.country_id = v_country_id)
      AND ab.geometry IS NOT NULL;
  END IF;
  
  -- Get ADM3 codes from affected ADM2 areas with pagination
  IF v_geom_col = 'geom' THEN
    RETURN QUERY
    SELECT 
      ab.admin_pcode,
      ab.name,
      CASE WHEN ab.geom IS NOT NULL THEN ST_AsGeoJSON(ab.geom)::jsonb ELSE NULL END AS geom,
      v_total_count AS total_count
    FROM public.admin_boundaries ab
    WHERE UPPER(TRIM(ab.admin_level)) = 'ADM3'
      AND (
        ab.parent_pcode = ANY(v_scope_filtered)
        OR EXISTS (
          SELECT 1 
          FROM (SELECT unnest(v_scope_filtered) AS scope_val) AS scope_table
          WHERE ab.admin_pcode LIKE scope_table.scope_val || '%'
        )
      )
      AND (v_country_id IS NULL OR ab.country_id = v_country_id)
      AND ab.geom IS NOT NULL
    ORDER BY ab.admin_pcode
    LIMIT COALESCE(in_limit, 10000)
    OFFSET in_offset;
  ELSE
    RETURN QUERY
    SELECT 
      ab.admin_pcode,
      ab.name,
      CASE WHEN ab.geometry IS NOT NULL THEN ST_AsGeoJSON(ab.geometry)::jsonb ELSE NULL END AS geom,
      v_total_count AS total_count
    FROM public.admin_boundaries ab
    WHERE UPPER(TRIM(ab.admin_level)) = 'ADM3'
      AND (
        ab.parent_pcode = ANY(v_scope_filtered)
        OR EXISTS (
          SELECT 1 
          FROM (SELECT unnest(v_scope_filtered) AS scope_val) AS scope_table
          WHERE ab.admin_pcode LIKE scope_table.scope_val || '%'
        )
      )
      AND (v_country_id IS NULL OR ab.country_id = v_country_id)
      AND ab.geometry IS NOT NULL
    ORDER BY ab.admin_pcode
    LIMIT COALESCE(in_limit, 10000)
    OFFSET in_offset;
  END IF;
END;
$$;

-- Grant permissions (specify full signature to avoid ambiguity)
GRANT EXECUTE ON FUNCTION public.get_affected_adm3(TEXT[], INTEGER, INTEGER) TO anon, authenticated;

COMMENT ON FUNCTION public.get_affected_adm3(TEXT[], INTEGER, INTEGER) IS 'Retrieves affected ADM3 administrative areas for given ADM2 scope with pagination support, with country isolation';
