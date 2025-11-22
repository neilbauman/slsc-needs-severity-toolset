-- ==============================
-- CREATE OR REPLACE v_instance_admin_scores VIEW
-- ==============================
-- This view provides overall scores for each admin area in an instance
-- It reads from instance_category_scores with category = 'Overall'

DROP VIEW IF EXISTS public.v_instance_admin_scores;

CREATE OR REPLACE VIEW public.v_instance_admin_scores AS
SELECT 
  ics.instance_id,
  ics.admin_pcode,
  ab.name,
  ics.score AS avg_score,
  ics.computed_at
FROM instance_category_scores ics
LEFT JOIN admin_boundaries ab ON ab.admin_pcode = ics.admin_pcode AND ab.admin_level = 'ADM3'
WHERE ics.category = 'Overall';

-- Grant permissions
GRANT SELECT ON public.v_instance_admin_scores TO anon, authenticated;

-- Comments
COMMENT ON VIEW public.v_instance_admin_scores IS 'Provides overall vulnerability scores for each admin area, reading from instance_category_scores with category = Overall';

