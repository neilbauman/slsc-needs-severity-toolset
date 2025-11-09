-- ==============================
-- PHILIPPINES SSC TOOLSET SCHEMA
-- ==============================

CREATE TABLE IF NOT EXISTS public.datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  admin_level TEXT NOT NULL CHECK (char_length(admin_level) > 0),
  type TEXT NOT NULL CHECK (type IN ('numeric', 'categorical')),
  indicator_id UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  is_baseline BOOLEAN,
  is_derived BOOLEAN,
  metadata JSONB,
  uploaded_by UUID,
  collected_at DATE,
  source TEXT
);

CREATE TABLE IF NOT EXISTS public.dataset_values_numeric (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID REFERENCES public.datasets(id) ON DELETE CASCADE,
  admin_pcode TEXT NOT NULL,
  value NUMERIC NOT NULL
);

CREATE TABLE IF NOT EXISTS public.dataset_values_categorical (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID REFERENCES public.datasets(id) ON DELETE CASCADE,
  admin_pcode TEXT NOT NULL,
  category TEXT NOT NULL,
  value NUMERIC
);
