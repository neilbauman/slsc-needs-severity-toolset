-- ============================================
-- FIX BASELINE MAP SCORES: REMOVE LIMIT & FIX CATEGORY MAPPING
-- ============================================
-- Issue 1: Ensure all admin boundaries render (map component shows grey for boundaries without scores)
-- Issue 2: Fix category filtering to ensure P3.1.2 Market and similar categories map correctly
--
-- Note: This function returns only admin areas WITH scores for the selected layer.
-- The map component merges these scores with the full GeoJSON boundaries, showing
-- grey for boundaries without scores. This approach is efficient and avoids hitting
-- row limits while still displaying all boundaries.

CREATE OR REPLACE FUNCTION public.get_baseline_map_scores(
  in_baseline_id UUID,
  in_admin_level TEXT DEFAULT 'ADM3',
  in_layer TEXT DEFAULT 'overall'
)
RETURNS TABLE (
  admin_pcode TEXT,
  avg_score NUMERIC,
  row_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  WITH b AS (
    SELECT id, country_id
    FROM public.country_baselines
    WHERE id = in_baseline_id
  ),
  bs AS (
    SELECT
      LEFT(bs0.admin_pcode, 9) AS adm3_pcode,
      bs0.score,
      bs0.category
    FROM public.baseline_scores bs0
    WHERE bs0.baseline_id = in_baseline_id
      AND bs0.admin_pcode IS NOT NULL
      AND LENGTH(bs0.admin_pcode) >= 9
  ),
  -- Filter scores by layer first (more efficient than filtering after join)
  filtered_bs AS (
    SELECT bs.adm3_pcode, bs.score
    FROM bs
    WHERE
      CASE
        WHEN lower(in_layer) = 'overall' THEN true
        WHEN in_layer = 'P1' THEN bs.category ILIKE 'P1%' AND bs.category NOT ILIKE 'P3%' AND bs.category NOT ILIKE 'P2%'
        WHEN in_layer = 'P2' THEN bs.category ILIKE 'P2%' AND bs.category NOT ILIKE 'P3%' AND bs.category NOT ILIKE 'P1%'
        WHEN in_layer = 'P3' THEN (
          bs.category ILIKE 'P3%' 
          AND bs.category NOT ILIKE 'P3.1%' 
          AND bs.category NOT ILIKE 'P3.2%'
          -- Exclude categories that should be in Hazard or UV groups
          AND bs.category NOT ILIKE '%hazard%'
          AND bs.category NOT ILIKE '%underlying%'
          AND bs.category NOT ILIKE '%vuln%'
        )
        WHEN in_layer = 'Hazard' THEN (
          (bs.category ILIKE 'P3.2%' OR bs.category ILIKE '%hazard%')
          AND bs.category NOT ILIKE 'P3.1%'
          AND bs.category NOT ILIKE '%underlying%'
          AND bs.category NOT ILIKE '%vuln%'
          AND bs.category NOT ILIKE 'UV%'
        )
        WHEN in_layer = 'Underlying Vulnerability' THEN (
          bs.category ILIKE 'P3.1%' 
          OR bs.category ILIKE 'UV%' 
          OR bs.category ILIKE '%underlying%' 
          OR (bs.category ILIKE '%vuln%' AND bs.category NOT ILIKE '%hazard%')
        )
        ELSE bs.category = in_layer
      END
  )
  SELECT
    ab.admin_pcode,
    AVG(fbs.score)::numeric AS avg_score,
    COUNT(fbs.score) AS row_count
  FROM b
  JOIN public.admin_boundaries ab
    ON ab.country_id = b.country_id
   AND ab.admin_level = in_admin_level
  LEFT JOIN filtered_bs fbs
    ON fbs.adm3_pcode = ab.admin_pcode
  GROUP BY ab.admin_pcode
  -- Return all admin boundaries; those without scores will have NULL avg_score
  -- The map component will display grey for boundaries without scores
  ORDER BY ab.admin_pcode;
$$;

GRANT EXECUTE ON FUNCTION public.get_baseline_map_scores(UUID,TEXT,TEXT) TO authenticated;

COMMENT ON FUNCTION public.get_baseline_map_scores(UUID,TEXT,TEXT) IS
  'Optimized per-boundary map scores for a baseline by admin_level and layer. Rolls baseline_scores to ADM3 using LEFT(admin_pcode,9) then aggregates. Filters scores by category BEFORE joining with admin_boundaries to reduce result set and avoid 1000-row limits. Fixed category filtering for P3.1.x (UV) vs P3.2.x (Hazard).';
