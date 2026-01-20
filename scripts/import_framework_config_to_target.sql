-- ==============================
-- IMPORT FRAMEWORK CONFIG TO TARGET DATABASE
-- ==============================
-- Run this in the TARGET database SQL Editor
-- After exporting data from the source database
--
-- INSTRUCTIONS:
-- 1. First, export the configuration from the source using export_framework_config_from_source.sql
-- 2. Copy the JSON values for category_config, ssc_rollup_config, and overall_rollup_config
-- 3. Replace the placeholder JSON below with the actual values
-- 4. Run this script

-- Step 1: Deactivate existing configurations
UPDATE framework_config 
SET is_active = false 
WHERE is_active = true;

-- Step 2: Insert the migrated configuration
-- REPLACE THE JSON VALUES BELOW WITH YOUR ACTUAL CONFIGURATION FROM THE SOURCE
INSERT INTO public.framework_config (
  name,
  description,
  category_config,
  ssc_rollup_config,
  overall_rollup_config,
  is_active
)
VALUES (
  'Migrated from Source Database',
  'Configuration migrated from ssc-toolset.vercel.app on ' || CURRENT_TIMESTAMP::text,
  
  -- PASTE YOUR category_config JSON HERE
  -- Example format (replace with actual data):
  '{
    "SSC Framework - P1": {
      "enabled": true,
      "method": "weighted_normalized_sum",
      "default_weight": 1.0,
      "description": "The Shelter - Structural safety & direct exposure of homes"
    },
    "SSC Framework - P2": {
      "enabled": true,
      "method": "weighted_normalized_sum",
      "default_weight": 1.0,
      "description": "The Living Conditions - Physical & socioeconomic fragility factors"
    },
    "SSC Framework - P3": {
      "enabled": true,
      "method": "weighted_normalized_sum",
      "default_weight": 1.0,
      "description": "The Settlement - Readiness of services, governance & access"
    },
    "Hazard": {
      "enabled": true,
      "method": "weighted_normalized_sum",
      "default_weight": 1.0,
      "description": "Recent hazard footprints & alerts"
    },
    "Underlying Vulnerability": {
      "enabled": true,
      "method": "weighted_normalized_sum",
      "default_weight": 1.0,
      "description": "Chronic structural drivers"
    }
  }'::jsonb,
  
  -- PASTE YOUR ssc_rollup_config JSON HERE
  -- Example format (replace with actual data):
  '{
    "method": "worst_case",
    "weights": {
      "SSC Framework - P1": 0.333,
      "SSC Framework - P2": 0.333,
      "SSC Framework - P3": 0.334
    },
    "description": "How to aggregate P1, P2, P3 into SSC Framework score"
  }'::jsonb,
  
  -- PASTE YOUR overall_rollup_config JSON HERE
  -- Example format (replace with actual data):
  '{
    "method": "average",
    "weights": {
      "SSC Framework": 0.6,
      "Hazard": 0.2,
      "Underlying Vulnerability": 0.2
    },
    "description": "How to aggregate categories into final overall score"
  }'::jsonb,
  
  true
);

-- Step 3: Verify the import
SELECT 
  id,
  name,
  description,
  is_active,
  created_at,
  updated_at,
  jsonb_pretty(category_config) as category_config_preview,
  jsonb_pretty(ssc_rollup_config) as ssc_rollup_preview,
  jsonb_pretty(overall_rollup_config) as overall_rollup_preview
FROM framework_config
WHERE is_active = true;

-- Step 4: Test the get_framework_config function
SELECT * FROM public.get_framework_config();
