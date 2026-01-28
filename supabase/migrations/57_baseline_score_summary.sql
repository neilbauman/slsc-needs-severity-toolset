-- ============================================
-- BASELINE SCORE SUMMARY (UI helper)
-- ============================================
-- Returns category-level summary stats for baseline_scores so the UI can show
-- computed scores without downloading the full baseline_scores table.

CREATE OR REPLACE FUNCTION public.get_baseline_score_summary(
  in_baseline_id UUID
)
RETURNS TABLE (
  category TEXT,
  avg_score NUMERIC,
  admin_count BIGINT,
  row_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    bs.category,
    AVG(bs.score)::numeric AS avg_score,
    COUNT(DISTINCT bs.admin_pcode) AS admin_count,
    COUNT(*) AS row_count
  FROM public.baseline_scores bs
  WHERE bs.baseline_id = in_baseline_id
  GROUP BY bs.category
  ORDER BY bs.category;
$$;

GRANT EXECUTE ON FUNCTION public.get_baseline_score_summary(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_baseline_score_summary(UUID) IS
  'Category-level summary for baseline_scores (avg score, distinct admin count, row count) for a given baseline_id.';

