-- ==============================
-- EXPORT FRAMEWORK STRUCTURE FROM SOURCE DATABASE
-- ==============================
-- Run this in the SOURCE database SQL Editor (project: yzxmxwppzpwfolkdiuuo)
-- This will export all pillars, themes, sub-themes, and indicators

-- Step 1: Check what framework structure tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (table_name LIKE '%pillar%' 
       OR table_name LIKE '%theme%' 
       OR table_name LIKE '%indicator%'
       OR table_name LIKE '%framework%'
       OR table_name LIKE '%ssc%')
ORDER BY table_name;

-- Step 2: Export Pillars (try various possible table names)
-- IMPORTANT: First run scripts/discover_source_schema.sql to find actual column names!

-- Option A: If table is called 'pillars' with standard columns
-- SELECT 
--   id,
--   code,
--   name,
--   description,
--   "order" as order_index,
--   is_active
-- FROM pillars
-- WHERE is_active = true
-- ORDER BY "order";

-- Option A1: If columns have different names (e.g., pillar_code, pillar_name)
-- SELECT 
--   id,
--   pillar_code as code,
--   pillar_name as name,
--   pillar_description as description,
--   pillar_order as order_index,
--   active as is_active
-- FROM pillars
-- WHERE active = true
-- ORDER BY pillar_order;

-- Option A2: If no code column, use id or name
-- SELECT 
--   id,
--   COALESCE(pillar_code, 'P' || id::text) as code,
--   pillar_name as name,
--   pillar_description as description,
--   COALESCE(pillar_order, 0) as order_index,
--   COALESCE(active, true) as is_active
-- FROM pillars
-- WHERE COALESCE(active, true) = true
-- ORDER BY COALESCE(pillar_order, 0);

-- Option B: If table is called 'framework_pillars'
-- SELECT 
--   id,
--   code,
--   name,
--   description,
--   order_index,
--   is_active
-- FROM framework_pillars
-- WHERE is_active = true
-- ORDER BY order_index;

-- Option C: If pillars are in a different structure
-- SELECT DISTINCT
--   pillar_code as code,
--   pillar_name as name,
--   pillar_description as description
-- FROM some_other_table
-- ORDER BY pillar_code;

-- Step 3: Export Themes
-- Option A: If table is called 'themes'
SELECT 
  id,
  pillar_id,
  pillar_code,
  code,
  name,
  description,
  "order" as order_index,
  is_active
FROM themes
WHERE is_active = true
ORDER BY pillar_code, "order";

-- Option B: If table is called 'framework_themes'
-- SELECT 
--   id,
--   pillar_id,
--   code,
--   name,
--   description,
--   order_index,
--   is_active
-- FROM framework_themes
-- WHERE is_active = true
-- ORDER BY order_index;

-- Step 4: Export Sub-themes
-- Option A: If table is called 'subthemes' or 'sub_themes'
SELECT 
  id,
  theme_id,
  theme_code,
  code,
  name,
  description,
  "order" as order_index,
  is_active
FROM subthemes  -- or sub_themes
WHERE is_active = true
ORDER BY theme_code, "order";

-- Step 5: Export Indicators
-- Option A: If table is called 'indicators'
SELECT 
  id,
  subtheme_id,
  subtheme_code,
  code,
  name,
  description,
  data_type,
  type as data_type,  -- if column is called 'type' instead
  unit,
  "order" as order_index,
  is_active
FROM indicators
WHERE is_active = true
ORDER BY subtheme_code, "order";

-- Step 6: Export dataset-indicator links (if they exist)
SELECT 
  dataset_id,
  indicator_id,
  indicator_code
FROM dataset_indicators
ORDER BY dataset_id;

-- Alternative: Check if indicator_id is in datasets table
SELECT 
  id as dataset_id,
  name as dataset_name,
  indicator_id
FROM datasets
WHERE indicator_id IS NOT NULL
ORDER BY indicator_id;

-- Step 7: Export as JSON (PostgreSQL 9.3+)
-- This creates a single JSON export of the entire structure
SELECT jsonb_build_object(
  'pillars', (
    SELECT jsonb_agg(
      jsonb_build_object(
        'code', code,
        'name', name,
        'description', description,
        'order_index', COALESCE(order_index, "order", 0)
      ) ORDER BY COALESCE(order_index, "order", 0)
    )
    FROM pillars  -- adjust table name
    WHERE is_active = true
  ),
  'themes', (
    SELECT jsonb_agg(
      jsonb_build_object(
        'pillar_code', pillar_code,
        'code', code,
        'name', name,
        'description', description,
        'order_index', COALESCE(order_index, "order", 0)
      ) ORDER BY pillar_code, COALESCE(order_index, "order", 0)
    )
    FROM themes  -- adjust table name
    WHERE is_active = true
  ),
  'subthemes', (
    SELECT jsonb_agg(
      jsonb_build_object(
        'theme_code', theme_code,
        'code', code,
        'name', name,
        'description', description,
        'order_index', COALESCE(order_index, "order", 0)
      ) ORDER BY theme_code, COALESCE(order_index, "order", 0)
    )
    FROM subthemes  -- adjust table name
    WHERE is_active = true
  ),
  'indicators', (
    SELECT jsonb_agg(
      jsonb_build_object(
        'subtheme_code', subtheme_code,
        'code', code,
        'name', name,
        'description', description,
        'data_type', COALESCE(data_type, type),
        'unit', unit,
        'order_index', COALESCE(order_index, "order", 0)
      ) ORDER BY subtheme_code, COALESCE(order_index, "order", 0)
    )
    FROM indicators  -- adjust table name
    WHERE is_active = true
  )
) as framework_structure;
