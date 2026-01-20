-- ==============================
-- CREATE MISSING VIEWS AND TABLES
-- ==============================
-- Creates v_instance_datasets_view and instance_dataset_config table
-- Run this in the TARGET database

-- ==============================
-- 1. Create instance_dataset_config table
-- ==============================
CREATE TABLE IF NOT EXISTS public.instance_dataset_config (
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  scoring_method TEXT,
  score_config JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (instance_id, dataset_id)
);

CREATE INDEX IF NOT EXISTS idx_instance_dataset_config_instance_id ON public.instance_dataset_config(instance_id);
CREATE INDEX IF NOT EXISTS idx_instance_dataset_config_dataset_id ON public.instance_dataset_config(dataset_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.instance_dataset_config TO anon, authenticated;

COMMENT ON TABLE public.instance_dataset_config IS 'Stores scoring configuration for datasets within instances';

-- ==============================
-- 2. Create v_instance_datasets_view
-- ==============================
DROP VIEW IF EXISTS public.v_instance_datasets_view;

CREATE OR REPLACE VIEW public.v_instance_datasets_view AS
SELECT 
  id.instance_id,
  id.dataset_id,
  d.name AS dataset_name,
  d.type AS dataset_type,
  d.admin_level AS dataset_admin_level,
  COALESCE(
    d.metadata->>'category',
    'Uncategorized'
  ) AS dataset_category,
  id.config AS instance_dataset_config,
  COALESCE(
    (id.config->>'order')::INTEGER,
    NULL
  ) AS dataset_order,
  ic.score_config AS score_config,
  ic.scoring_method AS scoring_method
FROM public.instance_datasets id
INNER JOIN public.datasets d ON d.id = id.dataset_id
LEFT JOIN public.instance_dataset_config ic ON ic.instance_id = id.instance_id AND ic.dataset_id = id.dataset_id
INNER JOIN public.instances i ON i.id = id.instance_id
WHERE d.country_id = i.country_id; -- Country isolation

-- Grant permissions
GRANT SELECT ON public.v_instance_datasets_view TO anon, authenticated;

COMMENT ON VIEW public.v_instance_datasets_view IS 'Provides a convenient view of datasets linked to instances with their configuration and scoring settings';
