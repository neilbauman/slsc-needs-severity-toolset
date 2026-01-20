-- ==============================
-- COMPLETE SCHEMA SETUP FOR DEV
-- ==============================
-- This script sets up the complete database schema in dev
-- Run this FIRST before running the multi-country migrations
-- 
-- Run in: Dev Supabase SQL Editor
-- Project: SLSCToolset
-- ==============================

-- ==============================
-- STEP 1: Core Tables
-- ==============================

-- Datasets table
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

-- Dataset values tables
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

-- Indexes for dataset values
CREATE INDEX IF NOT EXISTS idx_dataset_values_numeric_dataset_id ON public.dataset_values_numeric(dataset_id);
CREATE INDEX IF NOT EXISTS idx_dataset_values_categorical_dataset_id ON public.dataset_values_categorical(dataset_id);

-- ==============================
-- STEP 2: Instances Table (if needed)
-- ==============================

-- Note: This is a basic instances table structure
-- Adjust based on your actual production schema
CREATE TABLE IF NOT EXISTS public.instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  config JSONB,
  created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_instances_created_at ON public.instances(created_at);

-- ==============================
-- STEP 3: Admin Boundaries (if needed)
-- ==============================

-- Enable PostGIS if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Admin boundaries table (basic structure - adjust as needed)
CREATE TABLE IF NOT EXISTS public.admin_boundaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_pcode TEXT NOT NULL UNIQUE,
  admin_level TEXT NOT NULL,
  name TEXT,
  parent_pcode TEXT,
  geometry GEOGRAPHY(GEOMETRY, 4326),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_boundaries_pcode ON public.admin_boundaries(admin_pcode);
CREATE INDEX IF NOT EXISTS idx_admin_boundaries_level ON public.admin_boundaries(admin_level);
CREATE INDEX IF NOT EXISTS idx_admin_boundaries_geometry ON public.admin_boundaries USING GIST(geometry);

-- ==============================
-- STEP 4: Instance-related Tables
-- ==============================

-- Instance datasets (links datasets to instances)
CREATE TABLE IF NOT EXISTS public.instance_datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  config JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(instance_id, dataset_id)
);

CREATE INDEX IF NOT EXISTS idx_instance_datasets_instance_id ON public.instance_datasets(instance_id);
CREATE INDEX IF NOT EXISTS idx_instance_datasets_dataset_id ON public.instance_datasets(dataset_id);

-- Instance dataset scores
CREATE TABLE IF NOT EXISTS public.instance_dataset_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  admin_pcode TEXT NOT NULL,
  score NUMERIC NOT NULL CHECK (score >= 1 AND score <= 5),
  computed_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(instance_id, dataset_id, admin_pcode)
);

CREATE INDEX IF NOT EXISTS idx_instance_dataset_scores_instance_id ON public.instance_dataset_scores(instance_id);
CREATE INDEX IF NOT EXISTS idx_instance_dataset_scores_dataset_id ON public.instance_dataset_scores(dataset_id);
CREATE INDEX IF NOT EXISTS idx_instance_dataset_scores_admin_pcode ON public.instance_dataset_scores(admin_pcode);

-- Affected areas
CREATE TABLE IF NOT EXISTS public.affected_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  admin_pcode TEXT NOT NULL,
  admin_level TEXT NOT NULL,
  is_affected BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(instance_id, admin_pcode)
);

CREATE INDEX IF NOT EXISTS idx_affected_areas_instance_id ON public.affected_areas(instance_id);
CREATE INDEX IF NOT EXISTS idx_affected_areas_admin_pcode ON public.affected_areas(admin_pcode);

-- Instance category scores
CREATE TABLE IF NOT EXISTS public.instance_category_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  admin_pcode TEXT NOT NULL,
  score NUMERIC NOT NULL CHECK (score >= 1 AND score <= 5),
  computed_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(instance_id, category, admin_pcode)
);

CREATE INDEX IF NOT EXISTS idx_instance_category_scores_instance_id ON public.instance_category_scores(instance_id);
CREATE INDEX IF NOT EXISTS idx_instance_category_scores_category ON public.instance_category_scores(category);
CREATE INDEX IF NOT EXISTS idx_instance_category_scores_admin_pcode ON public.instance_category_scores(admin_pcode);

-- ==============================
-- STEP 5: Hazard Events Tables
-- ==============================

CREATE TABLE IF NOT EXISTS public.hazard_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL DEFAULT 'earthquake',
  geometry GEOGRAPHY(GEOMETRY, 4326),
  metadata JSONB,
  magnitude_field TEXT NOT NULL DEFAULT 'value',
  created_at TIMESTAMP DEFAULT NOW(),
  uploaded_by UUID,
  is_shared BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.hazard_event_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hazard_event_id UUID NOT NULL REFERENCES public.hazard_events(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  admin_pcode TEXT NOT NULL,
  score NUMERIC NOT NULL CHECK (score >= 1 AND score <= 5),
  magnitude_value NUMERIC,
  computed_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(hazard_event_id, instance_id, admin_pcode)
);

CREATE INDEX IF NOT EXISTS idx_hazard_events_instance_id ON public.hazard_events(instance_id);
CREATE INDEX IF NOT EXISTS idx_hazard_events_geometry ON public.hazard_events USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_hazard_event_scores_hazard_event_id ON public.hazard_event_scores(hazard_event_id);
CREATE INDEX IF NOT EXISTS idx_hazard_event_scores_instance_id ON public.hazard_event_scores(instance_id);

-- ==============================
-- STEP 6: Raw Dataset Tables (if used)
-- ==============================

CREATE TABLE IF NOT EXISTS public.dataset_values_numeric_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID REFERENCES public.datasets(id) ON DELETE CASCADE,
  admin_pcode TEXT NOT NULL,
  value NUMERIC NOT NULL
);

CREATE TABLE IF NOT EXISTS public.dataset_values_categorical_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID REFERENCES public.datasets(id) ON DELETE CASCADE,
  admin_pcode TEXT NOT NULL,
  category TEXT NOT NULL,
  value NUMERIC
);

CREATE INDEX IF NOT EXISTS idx_dataset_values_numeric_raw_dataset_id ON public.dataset_values_numeric_raw(dataset_id);
CREATE INDEX IF NOT EXISTS idx_dataset_values_categorical_raw_dataset_id ON public.dataset_values_categorical_raw(dataset_id);

-- ==============================
-- VERIFICATION
-- ==============================

DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE';
  
  RAISE NOTICE 'Total tables created: %', table_count;
  RAISE NOTICE '✅ Schema setup complete!';
  RAISE NOTICE 'Next step: Run 00_run_all_migrations.sql to add multi-country support';
END $$;
