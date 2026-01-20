-- ==============================
-- ADD MISSING INSTANCE COLUMNS
-- ==============================
-- Adds columns that exist in source database but are missing in target
-- Run this in the TARGET database before re-migrating instances

-- Add admin_scope column (array of admin codes)
ALTER TABLE public.instances
  ADD COLUMN IF NOT EXISTS admin_scope TEXT[];

-- Add active column (boolean flag)
ALTER TABLE public.instances
  ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Add type column (instance type: baseline, response, etc.)
ALTER TABLE public.instances
  ADD COLUMN IF NOT EXISTS type TEXT;

-- Add hazard_layer_id column (reference to hazard layer)
ALTER TABLE public.instances
  ADD COLUMN IF NOT EXISTS hazard_layer_id UUID;

-- Add population_dataset_id column (reference to population dataset)
ALTER TABLE public.instances
  ADD COLUMN IF NOT EXISTS population_dataset_id UUID;

-- Add poverty_dataset_id column (reference to poverty dataset)
ALTER TABLE public.instances
  ADD COLUMN IF NOT EXISTS poverty_dataset_id UUID;

-- Add comments
COMMENT ON COLUMN public.instances.admin_scope IS 'Array of admin area codes defining the affected area scope';
COMMENT ON COLUMN public.instances.active IS 'Whether this instance is active';
COMMENT ON COLUMN public.instances.type IS 'Instance type: baseline, response, etc.';
COMMENT ON COLUMN public.instances.hazard_layer_id IS 'Reference to hazard layer dataset';
COMMENT ON COLUMN public.instances.population_dataset_id IS 'Reference to population dataset for metrics';
COMMENT ON COLUMN public.instances.poverty_dataset_id IS 'Reference to poverty dataset for metrics';
