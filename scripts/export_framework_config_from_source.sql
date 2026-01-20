-- ==============================
-- EXPORT FRAMEWORK CONFIG FROM SOURCE DATABASE
-- ==============================
-- Run this in the SOURCE database SQL Editor
-- Source: https://ssc-toolset.vercel.app/ (project: yzxmxwppzpwfolkdiuuo)
--
-- This will help you identify what framework configuration exists in the source

-- Option 1: Check if framework_config table exists
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'framework_config'
ORDER BY ordinal_position;

-- Option 2: If framework_config exists, export it
SELECT 
  name,
  description,
  category_config,
  ssc_rollup_config,
  overall_rollup_config,
  is_active,
  created_at,
  updated_at
FROM framework_config
WHERE is_active = true
ORDER BY updated_at DESC
LIMIT 1;

-- Option 3: Check for framework config in instance_dataset_config
-- (Some systems store framework config at the instance level)
SELECT DISTINCT
  instance_id,
  score_config->'categories' as categories,
  score_config->'ssc_overall' as ssc_rollup,
  score_config->'overall' as overall_rollup
FROM instance_dataset_config
WHERE score_config IS NOT NULL
  AND (score_config->'categories' IS NOT NULL 
       OR score_config->'ssc_overall' IS NOT NULL 
       OR score_config->'overall' IS NOT NULL)
LIMIT 10;

-- Option 4: Check for any configuration tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (table_name LIKE '%framework%' 
       OR table_name LIKE '%config%' 
       OR table_name LIKE '%pillar%'
       OR table_name LIKE '%ssc%')
ORDER BY table_name;

-- Option 5: Check instance_scoring_weights for framework weights
SELECT DISTINCT
  category,
  weight
FROM instance_scoring_weights
WHERE category IN ('SSC Framework - P1', 'SSC Framework - P2', 'SSC Framework - P3', 
                   'Hazard', 'Underlying Vulnerability', 'SSC Framework')
ORDER BY category;
