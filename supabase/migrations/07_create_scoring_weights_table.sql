-- ==============================
-- CREATE INSTANCE_SCORING_WEIGHTS TABLE
-- ==============================
-- This table stores dataset weights and category weights for instances
-- Run this in the TARGET database if the table doesn't exist

CREATE TABLE IF NOT EXISTS public.instance_scoring_weights (
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  category TEXT,
  dataset_weight NUMERIC DEFAULT 1.0,
  category_weight NUMERIC DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (instance_id, dataset_id)
);

CREATE INDEX IF NOT EXISTS idx_instance_scoring_weights_instance_id ON public.instance_scoring_weights(instance_id);
CREATE INDEX IF NOT EXISTS idx_instance_scoring_weights_dataset_id ON public.instance_scoring_weights(dataset_id);
CREATE INDEX IF NOT EXISTS idx_instance_scoring_weights_category ON public.instance_scoring_weights(category);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.instance_scoring_weights TO anon, authenticated;

COMMENT ON TABLE public.instance_scoring_weights IS 'Stores dataset weights and category weights for instances, used in scoring calculations';
