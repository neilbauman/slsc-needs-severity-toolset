-- ============================================
-- OPTIMIZE BASELINE MAP SCORES (ADM3 rollup)
-- ============================================
-- Philippines pcodes: ADM3 = 9 chars, ADM4 = 11 chars.
-- baseline_scores may contain ADM4 pcodes; map needs ADM3 polygons.
-- Roll up baseline_scores to ADM3 by taking LEFT(admin_pcode, 9) and joining by equality.

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
  )
  SELECT
    ab.admin_pcode,
    AVG(bs.score)::numeric AS avg_score,
    COUNT(*) AS row_count
  FROM b
  JOIN public.admin_boundaries ab
    ON ab.country_id = b.country_id
   AND ab.admin_level = in_admin_level
  JOIN bs
    ON bs.adm3_pcode = ab.admin_pcode
  WHERE
    CASE
      WHEN lower(in_layer) = 'overall' THEN true
      WHEN in_layer = 'P1' THEN bs.category ILIKE 'P1%'
      WHEN in_layer = 'P2' THEN bs.category ILIKE 'P2%'
      WHEN in_layer = 'P3' THEN (bs.category ILIKE 'P3%' AND bs.category NOT ILIKE 'P3.1%' AND bs.category NOT ILIKE 'P3.2%')
      WHEN in_layer = 'Hazard' THEN (bs.category ILIKE 'P3.2%' OR bs.category ILIKE '%hazard%')
      WHEN in_layer = 'Underlying Vulnerability' THEN (bs.category ILIKE 'P3.1%' OR bs.category ILIKE 'UV%' OR bs.category ILIKE '%underlying%' OR bs.category ILIKE '%vuln%')
      ELSE bs.category = in_layer
    END
  GROUP BY ab.admin_pcode
  ORDER BY ab.admin_pcode;
$$;

GRANT EXECUTE ON FUNCTION public.get_baseline_map_scores(UUID,TEXT,TEXT) TO authenticated;

COMMENT ON FUNCTION public.get_baseline_map_scores(UUID,TEXT,TEXT) IS
  'Optimized per-boundary map scores for a baseline by admin_level and layer. Rolls baseline_scores to ADM3 using LEFT(admin_pcode,9) then aggregates.';

