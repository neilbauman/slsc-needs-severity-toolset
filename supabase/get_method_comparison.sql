-- ==============================
-- GET METHOD COMPARISON RPC FUNCTION
-- ==============================
-- Returns comparison of scores calculated using different aggregation methods
-- for the top N locations. Used for UI comparison view.

CREATE OR REPLACE FUNCTION public.get_method_comparison(
  in_instance_id UUID,
  in_category TEXT DEFAULT 'Overall',
  in_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  admin_pcode TEXT,
  admin_name TEXT,
  weighted_mean NUMERIC,
  geometric_mean NUMERIC,
  power_mean NUMERIC,
  owa_optimistic NUMERIC,
  owa_pessimistic NUMERIC,
  current_method TEXT,
  current_score NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH comparison_data AS (
    SELECT 
      icc.admin_pcode,
      ab.name AS admin_name,
      MAX(CASE WHEN icc.method = 'weighted_mean' THEN icc.score END) AS weighted_mean,
      MAX(CASE WHEN icc.method = 'geometric_mean' THEN icc.score END) AS geometric_mean,
      MAX(CASE WHEN icc.method = 'power_mean' THEN icc.score END) AS power_mean,
      MAX(CASE WHEN icc.method = 'owa_optimistic' THEN icc.score END) AS owa_optimistic,
      MAX(CASE WHEN icc.method = 'owa_pessimistic' THEN icc.score END) AS owa_pessimistic
    FROM instance_category_scores_comparison icc
    LEFT JOIN admin_boundaries ab ON ab.admin_pcode = icc.admin_pcode AND ab.admin_level = 'ADM3'
    WHERE icc.instance_id = in_instance_id
      AND icc.category = in_category
    GROUP BY icc.admin_pcode, ab.name
  ),
  current_scores AS (
    SELECT 
      ics.admin_pcode,
      ics.score,
      'weighted_mean' AS method -- Default method, could be stored in instance metadata
    FROM instance_category_scores ics
    WHERE ics.instance_id = in_instance_id
      AND ics.category = in_category
  )
  SELECT 
    cd.admin_pcode,
    COALESCE(cd.admin_name, cd.admin_pcode) AS admin_name,
    cd.weighted_mean,
    cd.geometric_mean,
    cd.power_mean,
    cd.owa_optimistic,
    cd.owa_pessimistic,
    cs.method AS current_method,
    cs.score AS current_score
  FROM comparison_data cd
  LEFT JOIN current_scores cs ON cs.admin_pcode = cd.admin_pcode
  ORDER BY COALESCE(cd.weighted_mean, 0) DESC, cd.admin_pcode
  LIMIT in_limit;
END;
$$;

