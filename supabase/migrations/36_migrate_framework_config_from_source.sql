-- ==============================
-- MIGRATE FRAMEWORK CONFIG FROM SOURCE DATABASE
-- ==============================
-- This script provides queries to export framework configuration from the source database
-- and import it into the target database.
--
-- Source: https://ssc-toolset.vercel.app/ (Supabase project: yzxmxwppzpwfolkdiuuo)
-- Target: Current database
--
-- INSTRUCTIONS:
-- 1. First, check if the source database has a framework_config table or similar
-- 2. Run the export queries in the SOURCE database SQL Editor
-- 3. Copy the JSON output
-- 4. Run the import queries in the TARGET database SQL Editor with the copied data

-- ==============================
-- STEP 1: Check source database schema
-- ==============================
-- Run this in the SOURCE database to see what framework-related tables exist:

-- Check for framework_config table
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name LIKE '%framework%' OR table_name LIKE '%config%'
ORDER BY table_name, ordinal_position;

-- Check for any tables with framework-related data
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (table_name LIKE '%framework%' OR table_name LIKE '%pillar%' OR table_name LIKE '%ssc%')
ORDER BY table_name;

-- ==============================
-- STEP 2: Export from source (if framework_config table exists)
-- ==============================
-- Run this in the SOURCE database:

-- Export active framework configuration
-- SELECT 
--   name,
--   description,
--   category_config,
--   ssc_rollup_config,
--   overall_rollup_config
-- FROM framework_config
-- WHERE is_active = true
-- ORDER BY updated_at DESC
-- LIMIT 1;

-- ==============================
-- STEP 3: Import into target
-- ==============================
-- Run this in the TARGET database with the exported data:

-- Example import (replace with actual values from source):
-- INSERT INTO public.framework_config (
--   name,
--   description,
--   category_config,
--   ssc_rollup_config,
--   overall_rollup_config,
--   is_active
-- )
-- VALUES (
--   'Migrated Framework Configuration',
--   'Configuration migrated from source database',
--   '{
--     "SSC Framework - P1": {
--       "enabled": true,
--       "method": "weighted_normalized_sum",
--       "default_weight": 1.0,
--       "description": "The Shelter - Structural safety & direct exposure of homes"
--     },
--     "SSC Framework - P2": {
--       "enabled": true,
--       "method": "weighted_normalized_sum",
--       "default_weight": 1.0,
--       "description": "The Living Conditions - Physical & socioeconomic fragility factors"
--     },
--     "SSC Framework - P3": {
--       "enabled": true,
--       "method": "weighted_normalized_sum",
--       "default_weight": 1.0,
--       "description": "The Settlement - Readiness of services, governance & access"
--     },
--     "Hazard": {
--       "enabled": true,
--       "method": "weighted_normalized_sum",
--       "default_weight": 1.0,
--       "description": "Recent hazard footprints & alerts"
--     },
--     "Underlying Vulnerability": {
--       "enabled": true,
--       "method": "weighted_normalized_sum",
--       "default_weight": 1.0,
--       "description": "Chronic structural drivers"
--     }
--   }'::jsonb,
--   '{
--     "method": "worst_case",
--     "weights": {
--       "SSC Framework - P1": 0.333,
--       "SSC Framework - P2": 0.333,
--       "SSC Framework - P3": 0.334
--     },
--     "description": "How to aggregate P1, P2, P3 into SSC Framework score"
--   }'::jsonb,
--   '{
--     "method": "average",
--     "weights": {
--       "SSC Framework": 0.6,
--       "Hazard": 0.2,
--       "Underlying Vulnerability": 0.2
--     },
--     "description": "How to aggregate categories into final overall score"
--   }'::jsonb,
--   true
-- );

-- ==============================
-- ALTERNATIVE: If source uses different structure
-- ==============================
-- If the source database stores framework config in a different format,
-- you may need to query instance_dataset_config or similar tables:

-- Check for instance-level configs that might contain framework settings
-- SELECT DISTINCT
--   score_config->'categories' as categories,
--   score_config->'ssc_overall' as ssc_rollup,
--   score_config->'overall' as overall_rollup
-- FROM instance_dataset_config
-- WHERE score_config IS NOT NULL
-- LIMIT 10;

-- ==============================
-- VERIFICATION
-- ==============================
-- After importing, verify the configuration:

SELECT 
  id,
  name,
  description,
  is_active,
  created_at,
  updated_at
FROM public.framework_config
ORDER BY updated_at DESC;

-- Test the get_framework_config function
SELECT * FROM public.get_framework_config();
