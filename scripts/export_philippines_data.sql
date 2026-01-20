-- ==============================
-- EXPORT PHILIPPINES DATA
-- ==============================
-- Run this in your SOURCE database (original Philippines database)
-- This generates INSERT statements to copy data to the new multi-country database
--
-- IMPORTANT: 
-- 1. Run this in the SOURCE database SQL Editor
-- 2. Copy the output SQL statements
-- 3. Paste and run them in the TARGET database
-- 4. Then run import_philippines_data.sql in the target database

-- ==============================
-- STEP 1: Export Datasets
-- ==============================
-- Copy the output and run in target database

SELECT 
  'INSERT INTO public.datasets (id, name, description, admin_level, type, indicator_id, created_at, is_baseline, is_derived, metadata, uploaded_by, collected_at, source) VALUES (' ||
  quote_literal(id::text) || ', ' ||
  quote_literal(name) || ', ' ||
  COALESCE(quote_literal(description), 'NULL') || ', ' ||
  quote_literal(admin_level) || ', ' ||
  quote_literal(type) || ', ' ||
  COALESCE(quote_literal(indicator_id::text), 'NULL') || ', ' ||
  quote_literal(created_at::text) || ', ' ||
  COALESCE(is_baseline::text, 'NULL') || ', ' ||
  COALESCE(is_derived::text, 'NULL') || ', ' ||
  COALESCE(metadata::text, 'NULL') || ', ' ||
  COALESCE(quote_literal(uploaded_by::text), 'NULL') || ', ' ||
  COALESCE(quote_literal(collected_at::text), 'NULL') || ', ' ||
  COALESCE(quote_literal(source), 'NULL') ||
  ');' as insert_statement
FROM public.datasets
ORDER BY created_at;

-- ==============================
-- STEP 2: Export Dataset Values (Numeric)
-- ==============================

SELECT 
  'INSERT INTO public.dataset_values_numeric (id, dataset_id, admin_pcode, value) VALUES (' ||
  quote_literal(id::text) || ', ' ||
  quote_literal(dataset_id::text) || ', ' ||
  quote_literal(admin_pcode) || ', ' ||
  value::text ||
  ');' as insert_statement
FROM public.dataset_values_numeric
ORDER BY dataset_id, admin_pcode;

-- ==============================
-- STEP 3: Export Dataset Values (Categorical)
-- ==============================

SELECT 
  'INSERT INTO public.dataset_values_categorical (id, dataset_id, admin_pcode, category, value) VALUES (' ||
  quote_literal(id::text) || ', ' ||
  quote_literal(dataset_id::text) || ', ' ||
  quote_literal(admin_pcode) || ', ' ||
  quote_literal(category) || ', ' ||
  COALESCE(value::text, 'NULL') ||
  ');' as insert_statement
FROM public.dataset_values_categorical
ORDER BY dataset_id, admin_pcode, category;

-- ==============================
-- STEP 4: Export Admin Boundaries
-- ==============================
-- Note: Geometry column might be named 'geom' or 'geometry'
-- First, check which column exists by running:
--   SELECT column_name FROM information_schema.columns 
--   WHERE table_name = 'admin_boundaries' AND column_name IN ('geom', 'geometry');
--
-- Then use the appropriate query below:

-- OPTION A: If your geometry column is named 'geom' (most common):
SELECT 
  'INSERT INTO public.admin_boundaries (admin_pcode, admin_level, name, parent_pcode, geometry) VALUES (' ||
  quote_literal(admin_pcode) || ', ' ||
  quote_literal(admin_level) || ', ' ||
  quote_literal(name) || ', ' ||
  COALESCE(quote_literal(parent_pcode), 'NULL') || ', ' ||
  CASE 
    WHEN geom IS NOT NULL THEN 'ST_GeomFromGeoJSON(' || quote_literal(ST_AsGeoJSON(geom)::text) || ')'
    ELSE 'NULL'
  END ||
  ');' as insert_statement
FROM public.admin_boundaries
ORDER BY admin_level, admin_pcode;

-- OPTION B: If your geometry column is named 'geometry', uncomment and use this instead:
-- SELECT 
--   'INSERT INTO public.admin_boundaries (admin_pcode, admin_level, name, parent_pcode, geometry) VALUES (' ||
--   quote_literal(admin_pcode) || ', ' ||
--   quote_literal(admin_level) || ', ' ||
--   quote_literal(name) || ', ' ||
--   COALESCE(quote_literal(parent_pcode), 'NULL') || ', ' ||
--   CASE 
--     WHEN geometry IS NOT NULL THEN 'ST_GeomFromGeoJSON(' || quote_literal(ST_AsGeoJSON(geometry)::text) || ')'
--     ELSE 'NULL'
--   END ||
--   ');' as insert_statement
-- FROM public.admin_boundaries
-- ORDER BY admin_level, admin_pcode;

-- OPTION C: If you don't have a geometry column, use this:
-- SELECT 
--   'INSERT INTO public.admin_boundaries (admin_pcode, admin_level, name, parent_pcode) VALUES (' ||
--   quote_literal(admin_pcode) || ', ' ||
--   quote_literal(admin_level) || ', ' ||
--   quote_literal(name) || ', ' ||
--   COALESCE(quote_literal(parent_pcode), 'NULL') ||
--   ');' as insert_statement
-- FROM public.admin_boundaries
-- ORDER BY admin_level, admin_pcode;

-- ==============================
-- STEP 5: Export Instances
-- ==============================

SELECT 
  'INSERT INTO public.instances (id, name, description, created_at, config) VALUES (' ||
  quote_literal(id::text) || ', ' ||
  quote_literal(name) || ', ' ||
  COALESCE(quote_literal(description), 'NULL') || ', ' ||
  quote_literal(created_at::text) || ', ' ||
  COALESCE(config::text, 'NULL') ||
  ');' as insert_statement
FROM public.instances
ORDER BY created_at;

-- ==============================
-- STEP 6: Export Instance Datasets
-- ==============================

SELECT 
  'INSERT INTO public.instance_datasets (instance_id, dataset_id, config, "order") VALUES (' ||
  quote_literal(instance_id::text) || ', ' ||
  quote_literal(dataset_id::text) || ', ' ||
  COALESCE(config::text, 'NULL') || ', ' ||
  COALESCE("order"::text, 'NULL') ||
  ');' as insert_statement
FROM public.instance_datasets
ORDER BY instance_id, "order";

-- ==============================
-- STEP 7: Export Instance Dataset Scores
-- ==============================

SELECT 
  'INSERT INTO public.instance_dataset_scores (instance_id, dataset_id, admin_pcode, score, computed_at) VALUES (' ||
  quote_literal(instance_id::text) || ', ' ||
  quote_literal(dataset_id::text) || ', ' ||
  quote_literal(admin_pcode) || ', ' ||
  score::text || ', ' ||
  quote_literal(computed_at::text) ||
  ');' as insert_statement
FROM public.instance_dataset_scores
ORDER BY instance_id, dataset_id, admin_pcode;

-- ==============================
-- STEP 8: Export Affected Areas
-- ==============================

SELECT 
  'INSERT INTO public.affected_areas (instance_id, admin_pcode, admin_level, is_affected) VALUES (' ||
  quote_literal(instance_id::text) || ', ' ||
  quote_literal(admin_pcode) || ', ' ||
  quote_literal(admin_level) || ', ' ||
  is_affected::text ||
  ');' as insert_statement
FROM public.affected_areas
ORDER BY instance_id, admin_pcode;

-- ==============================
-- STEP 9: Export Hazard Events
-- ==============================
-- Note: Geometry column might be named 'geom' or 'geometry'
-- First, check which column exists by running:
--   SELECT column_name FROM information_schema.columns 
--   WHERE table_name = 'hazard_events' AND column_name IN ('geom', 'geometry');
--
-- Then use the appropriate query below:

-- OPTION A: If your geometry column is named 'geom' (most common):
SELECT 
  'INSERT INTO public.hazard_events (id, instance_id, name, description, event_type, geometry, metadata, magnitude_field, created_at, uploaded_by, is_shared) VALUES (' ||
  quote_literal(id::text) || ', ' ||
  quote_literal(instance_id::text) || ', ' ||
  quote_literal(name) || ', ' ||
  COALESCE(quote_literal(description), 'NULL') || ', ' ||
  quote_literal(event_type) || ', ' ||
  CASE 
    WHEN geom IS NOT NULL THEN 'ST_GeomFromGeoJSON(' || quote_literal(ST_AsGeoJSON(geom)::text) || ')'
    ELSE 'NULL'
  END || ', ' ||
  COALESCE(metadata::text, 'NULL') || ', ' ||
  quote_literal(magnitude_field) || ', ' ||
  quote_literal(created_at::text) || ', ' ||
  COALESCE(quote_literal(uploaded_by::text), 'NULL') || ', ' ||
  is_shared::text ||
  ');' as insert_statement
FROM public.hazard_events
ORDER BY created_at;

-- OPTION B: If your geometry column is named 'geometry', uncomment and use this instead:
-- SELECT 
--   'INSERT INTO public.hazard_events (id, instance_id, name, description, event_type, geometry, metadata, magnitude_field, created_at, uploaded_by, is_shared) VALUES (' ||
--   quote_literal(id::text) || ', ' ||
--   quote_literal(instance_id::text) || ', ' ||
--   quote_literal(name) || ', ' ||
--   COALESCE(quote_literal(description), 'NULL') || ', ' ||
--   quote_literal(event_type) || ', ' ||
--   CASE 
--     WHEN geometry IS NOT NULL THEN 'ST_GeomFromGeoJSON(' || quote_literal(ST_AsGeoJSON(geometry)::text) || ')'
--     ELSE 'NULL'
--   END || ', ' ||
--   COALESCE(metadata::text, 'NULL') || ', ' ||
--   quote_literal(magnitude_field) || ', ' ||
--   quote_literal(created_at::text) || ', ' ||
--   COALESCE(quote_literal(uploaded_by::text), 'NULL') || ', ' ||
--   is_shared::text ||
--   ');' as insert_statement
-- FROM public.hazard_events
-- ORDER BY created_at;

-- OPTION C: If you don't have a geometry column, use this:
-- SELECT 
--   'INSERT INTO public.hazard_events (id, instance_id, name, description, event_type, metadata, magnitude_field, created_at, uploaded_by, is_shared) VALUES (' ||
--   quote_literal(id::text) || ', ' ||
--   quote_literal(instance_id::text) || ', ' ||
--   quote_literal(name) || ', ' ||
--   COALESCE(quote_literal(description), 'NULL') || ', ' ||
--   quote_literal(event_type) || ', ' ||
--   COALESCE(metadata::text, 'NULL') || ', ' ||
--   quote_literal(magnitude_field) || ', ' ||
--   quote_literal(created_at::text) || ', ' ||
--   COALESCE(quote_literal(uploaded_by::text), 'NULL') || ', ' ||
--   is_shared::text ||
--   ');' as insert_statement
-- FROM public.hazard_events
-- ORDER BY created_at;

-- ==============================
-- STEP 10: Export Hazard Event Scores
-- ==============================

SELECT 
  'INSERT INTO public.hazard_event_scores (hazard_event_id, instance_id, admin_pcode, score, magnitude_value, computed_at) VALUES (' ||
  quote_literal(hazard_event_id::text) || ', ' ||
  quote_literal(instance_id::text) || ', ' ||
  quote_literal(admin_pcode) || ', ' ||
  score::text || ', ' ||
  COALESCE(magnitude_value::text, 'NULL') || ', ' ||
  quote_literal(computed_at::text) ||
  ');' as insert_statement
FROM public.hazard_event_scores
ORDER BY hazard_event_id, instance_id, admin_pcode;

-- ==============================
-- STEP 11: Export Instance Dataset Config (Scoring Configuration)
-- ==============================
-- Note: This table may not exist in older databases. If you get an error, skip this step.

SELECT 
  'INSERT INTO public.instance_dataset_config (instance_id, dataset_id, scoring_method, score_config, created_at, updated_at) VALUES (' ||
  quote_literal(instance_id::text) || ', ' ||
  quote_literal(dataset_id::text) || ', ' ||
  COALESCE(quote_literal(scoring_method), 'NULL') || ', ' ||
  COALESCE(score_config::text, 'NULL') || ', ' ||
  COALESCE(quote_literal(created_at::text), 'NOW()') || ', ' ||
  COALESCE(quote_literal(updated_at::text), 'NOW()') ||
  ');' as insert_statement
FROM public.instance_dataset_config
ORDER BY instance_id, dataset_id;

-- ==============================
-- STEP 12: Export Instance Scoring Weights
-- ==============================
-- Note: This table stores dataset weights and category weights for instances.
-- If this table doesn't exist in your source database, skip this step.

SELECT 
  'INSERT INTO public.instance_scoring_weights (instance_id, dataset_id, category, dataset_weight, category_weight, created_at, updated_at) VALUES (' ||
  quote_literal(instance_id::text) || ', ' ||
  quote_literal(dataset_id::text) || ', ' ||
  COALESCE(quote_literal(category), 'NULL') || ', ' ||
  COALESCE(dataset_weight::text, 'NULL') || ', ' ||
  COALESCE(category_weight::text, 'NULL') || ', ' ||
  COALESCE(quote_literal(created_at::text), 'NOW()') || ', ' ||
  COALESCE(quote_literal(updated_at::text), 'NOW()') ||
  ');' as insert_statement
FROM public.instance_scoring_weights
ORDER BY instance_id, category, dataset_id;

-- ==============================
-- ALTERNATIVE: Use COPY for Large Datasets
-- ==============================
-- For very large datasets, use COPY instead of INSERT statements
-- Run these in psql or Supabase CLI:

-- COPY public.datasets TO STDOUT WITH CSV HEADER;
-- COPY public.dataset_values_numeric TO STDOUT WITH CSV HEADER;
-- COPY public.dataset_values_categorical TO STDOUT WITH CSV HEADER;
-- COPY public.admin_boundaries TO STDOUT WITH CSV HEADER;
-- COPY public.instances TO STDOUT WITH CSV HEADER;
-- COPY public.instance_datasets TO STDOUT WITH CSV HEADER;
-- COPY public.instance_dataset_scores TO STDOUT WITH CSV HEADER;
-- COPY public.affected_areas TO STDOUT WITH CSV HEADER;
-- COPY public.hazard_events TO STDOUT WITH CSV HEADER;
-- COPY public.hazard_event_scores TO STDOUT WITH CSV HEADER;
