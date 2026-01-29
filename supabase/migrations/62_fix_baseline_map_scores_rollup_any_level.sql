-- ============================================================
-- BASELINE MAP SCORES: ROLL UP TO ANY ADMIN LEVEL
-- ============================================================
-- Previous version hard-coded ADM3 rollup via LEFT(admin_pcode, 9).
-- This update uses admin_boundaries parent relationships to map any
-- baseline score (ADM1-ADM4) to the requested target admin level.

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
  WITH RECURSIVE b AS (
    SELECT id, country_id
    FROM public.country_baselines
    WHERE id = in_baseline_id
  ),
  bs_raw AS (
    SELECT
      bs0.admin_pcode,
      bs0.score,
      bs0.category
    FROM public.baseline_scores bs0
    WHERE bs0.baseline_id = in_baseline_id
      AND bs0.admin_pcode IS NOT NULL
  ),
  chain AS (
    SELECT
      ab.admin_pcode AS current_pcode,
      ab.admin_level,
      ab.parent_pcode,
      bs_raw.score,
      bs_raw.category,
      bs_raw.admin_pcode AS leaf_pcode
    FROM bs_raw
    JOIN public.admin_boundaries ab
      ON ab.admin_pcode = bs_raw.admin_pcode
    JOIN b
      ON ab.country_id = b.country_id
    UNION ALL
    SELECT
      parent.admin_pcode,
      parent.admin_level,
      parent.parent_pcode,
      chain.score,
      chain.category,
      chain.leaf_pcode
    FROM chain
    JOIN public.admin_boundaries parent
      ON parent.admin_pcode = chain.parent_pcode
    JOIN b
      ON parent.country_id = b.country_id
  ),
  mapped AS (
    SELECT
      chain.leaf_pcode,
      chain.current_pcode AS target_pcode,
      chain.score,
      chain.category
    FROM chain
    WHERE chain.admin_level = in_admin_level
  ),
  filtered_bs AS (
    SELECT mapped.target_pcode, mapped.score
    FROM mapped
    WHERE
      CASE
        WHEN lower(in_layer) = 'overall' THEN true
        WHEN in_layer = 'P1' THEN mapped.category ILIKE 'P1%' AND mapped.category NOT ILIKE 'P3%' AND mapped.category NOT ILIKE 'P2%'
        WHEN in_layer = 'P2' THEN mapped.category ILIKE 'P2%' AND mapped.category NOT ILIKE 'P3%' AND mapped.category NOT ILIKE 'P1%'
        WHEN in_layer = 'P3' THEN (
          mapped.category ILIKE 'P3%' 
          AND mapped.category NOT ILIKE 'P3.1%' 
          AND mapped.category NOT ILIKE 'P3.2%'
          AND mapped.category NOT ILIKE '%hazard%'
          AND mapped.category NOT ILIKE '%underlying%'
          AND mapped.category NOT ILIKE '%vuln%'
        )
        WHEN in_layer = 'Hazard' THEN (
          (mapped.category ILIKE 'P3.2%' OR mapped.category ILIKE '%hazard%')
          AND mapped.category NOT ILIKE 'P3.1%'
          AND mapped.category NOT ILIKE '%underlying%'
          AND mapped.category NOT ILIKE '%vuln%'
          AND mapped.category NOT ILIKE 'UV%'
        )
        WHEN in_layer = 'Underlying Vulnerability' THEN (
          mapped.category ILIKE 'P3.1%' 
          OR mapped.category ILIKE 'UV%' 
          OR mapped.category ILIKE '%underlying%' 
          OR (mapped.category ILIKE '%vuln%' AND mapped.category NOT ILIKE '%hazard%')
        )
        ELSE mapped.category = in_layer
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
    ON fbs.target_pcode = ab.admin_pcode
  GROUP BY ab.admin_pcode
  ORDER BY ab.admin_pcode;
$$;

GRANT EXECUTE ON FUNCTION public.get_baseline_map_scores(UUID,TEXT,TEXT) TO authenticated;

COMMENT ON FUNCTION public.get_baseline_map_scores(UUID,TEXT,TEXT) IS
  'Baseline map scores by admin level and layer. Uses admin_boundaries parent chain to map baseline scores to the requested admin level, then aggregates. Returns all boundaries with NULL scores when no data exists.';
