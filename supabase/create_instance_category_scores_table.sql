-- ==============================
-- CREATE INSTANCE_CATEGORY_SCORES TABLE
-- ==============================
-- Stores aggregated category scores (P1, P2, P3, Hazard, Underlying Vulnerability)
-- for each admin area in an instance.

CREATE TABLE IF NOT EXISTS public.instance_category_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  admin_pcode TEXT NOT NULL,
  score NUMERIC NOT NULL CHECK (score >= 1 AND score <= 5),
  computed_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(instance_id, category, admin_pcode)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_instance_category_scores_instance_id ON public.instance_category_scores(instance_id);
CREATE INDEX IF NOT EXISTS idx_instance_category_scores_category ON public.instance_category_scores(category);
CREATE INDEX IF NOT EXISTS idx_instance_category_scores_admin_pcode ON public.instance_category_scores(admin_pcode);
CREATE INDEX IF NOT EXISTS idx_instance_category_scores_composite ON public.instance_category_scores(instance_id, category, admin_pcode);

-- Comments
COMMENT ON TABLE public.instance_category_scores IS 'Stores aggregated category scores (P1, P2, P3, Hazard, Underlying Vulnerability) for each admin area';
COMMENT ON COLUMN public.instance_category_scores.category IS 'Category name: SSC Framework - P1, SSC Framework - P2, SSC Framework - P3, Hazard, Underlying Vulnerability, or SSC Framework (aggregate)';

