-- ==============================
-- CREATE INSTANCE_CATEGORY_SCORES_COMPARISON TABLE
-- ==============================
-- Stores aggregated category scores calculated using different methods
-- for comparison purposes. This allows users to see how different
-- aggregation methods affect rankings without changing active scores.

CREATE TABLE IF NOT EXISTS public.instance_category_scores_comparison (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  admin_pcode TEXT NOT NULL,
  method TEXT NOT NULL, -- 'weighted_mean', 'geometric_mean', 'power_mean', 'owa_optimistic', 'owa_pessimistic'
  score NUMERIC NOT NULL CHECK (score >= 1 AND score <= 5),
  computed_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(instance_id, category, admin_pcode, method)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_comparison_instance_category ON public.instance_category_scores_comparison(instance_id, category);
CREATE INDEX IF NOT EXISTS idx_comparison_method ON public.instance_category_scores_comparison(method);
CREATE INDEX IF NOT EXISTS idx_comparison_lookup ON public.instance_category_scores_comparison(instance_id, category, method, admin_pcode);
CREATE INDEX IF NOT EXISTS idx_comparison_admin_pcode ON public.instance_category_scores_comparison(admin_pcode);

-- Comments
COMMENT ON TABLE public.instance_category_scores_comparison IS 'Stores category scores calculated using different aggregation methods for comparison. Does not affect active scores.';
COMMENT ON COLUMN public.instance_category_scores_comparison.method IS 'Aggregation method: weighted_mean, geometric_mean, power_mean, owa_optimistic, owa_pessimistic';
COMMENT ON COLUMN public.instance_category_scores_comparison.category IS 'Category name: SSC Framework - P1, SSC Framework - P2, SSC Framework - P3, Hazard, Underlying Vulnerability, SSC Framework (aggregate), or Overall';

