-- ==============================
-- EXPORT SCORING CONFIGURATION
-- ==============================
-- Run this in your SOURCE database (original Philippines database)
-- This exports scoring configuration that needs to be migrated
--
-- IMPORTANT: 
-- 1. Run this in the SOURCE database SQL Editor
-- 2. Copy the output SQL statements
-- 3. Paste and run them in the TARGET database

-- ==============================
-- STEP 1: Export Instance Dataset Config
-- ==============================
-- This table stores scoring configuration for individual datasets (method, thresholds, etc.)
-- If this table doesn't exist, skip this section

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
-- STEP 2: Export Instance Scoring Weights
-- ==============================
-- This table stores dataset weights and category weights for instances
-- If this table doesn't exist, skip this section
-- Note: The table schema may vary - adjust column names as needed

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
-- STEP 3: Export Hazard Event Metadata (Scoring Config)
-- ==============================
-- Hazard event scoring configuration is stored in hazard_events.metadata
-- We need to preserve the metadata JSONB which contains score_config and category_weight

SELECT 
  'UPDATE public.hazard_events SET metadata = ' ||
  COALESCE(metadata::text, '''{}''::jsonb') ||
  ' WHERE id = ' || quote_literal(id::text) || ';' as update_statement
FROM public.hazard_events
WHERE metadata IS NOT NULL 
  AND (metadata ? 'score_config' OR metadata ? 'category_weight')
ORDER BY instance_id, created_at;

-- ==============================
-- NOTES
-- ==============================
-- 1. If instance_dataset_config table doesn't exist, the scoring config might be stored
--    in instance_datasets.config JSONB column instead. Check that table.
-- 2. If instance_scoring_weights doesn't exist, weights might be stored in a different
--    table or in the instances.config JSONB column.
-- 3. After importing, verify that the configuration is preserved by checking:
--    - Instance dataset configs are accessible
--    - Weights are loaded correctly
--    - Hazard event scoring configs are preserved
