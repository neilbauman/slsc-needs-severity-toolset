-- ==============================
-- GENERIC FRAMEWORK STRUCTURE EXPORT
-- ==============================
-- This script uses generic column discovery to export framework structure
-- Run this AFTER running discover_source_schema.sql to identify actual column names

-- Step 1: First, identify the actual table and column names
-- Run this to see what columns exist in potential pillar tables:
SELECT 
  table_name,
  string_agg(column_name, ', ' ORDER BY ordinal_position) as columns
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name ILIKE '%pillar%'
GROUP BY table_name;

-- Step 2: Based on the columns found, construct the export query
-- Example patterns below - adjust based on actual column names

-- PATTERN 1: Standard naming (code, name, description, order, is_active)
-- Uncomment and adjust table name:
/*
SELECT 
  id,
  code,
  name,
  description,
  COALESCE("order", order_index, 0) as order_index,
  COALESCE(is_active, active, true) as is_active
FROM your_pillars_table_name
WHERE COALESCE(is_active, active, true) = true
ORDER BY COALESCE("order", order_index, 0);
*/

-- PATTERN 2: Prefixed naming (pillar_code, pillar_name, etc.)
-- Uncomment and adjust:
/*
SELECT 
  id,
  pillar_code as code,
  pillar_name as name,
  pillar_description as description,
  COALESCE(pillar_order, "order", 0) as order_index,
  COALESCE(active, is_active, true) as is_active
FROM your_pillars_table_name
WHERE COALESCE(active, is_active, true) = true
ORDER BY COALESCE(pillar_order, "order", 0);
*/

-- PATTERN 3: Minimal columns (just id and name)
-- Uncomment and adjust:
/*
SELECT 
  id,
  COALESCE(code, 'P' || ROW_NUMBER() OVER (ORDER BY id)) as code,
  name,
  NULL as description,
  0 as order_index,
  true as is_active
FROM your_pillars_table_name
ORDER BY id;
*/

-- Step 3: Export with dynamic column mapping
-- This query tries to find and map columns automatically
-- Adjust table_name in the WHERE clause:

WITH pillar_columns AS (
  SELECT 
    column_name,
    data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'pillars'  -- CHANGE THIS to your actual table name
)
SELECT 
  'Available columns:' as info,
  string_agg(column_name || ' (' || data_type || ')', ', ') as columns
FROM pillar_columns;

-- Step 4: Once you know the columns, use this template:
-- Replace 'your_table_name' and column names with actual values

/*
-- Export Pillars
SELECT 
  id,
  [code_column] as code,
  [name_column] as name,
  [description_column] as description,
  [order_column] as order_index,
  [active_column] as is_active
FROM [your_pillars_table]
WHERE [active_column] = true
ORDER BY [order_column];

-- Export Themes (similar pattern)
SELECT 
  id,
  [pillar_reference_column] as pillar_id,
  [code_column] as code,
  [name_column] as name,
  [description_column] as description,
  [order_column] as order_index,
  [active_column] as is_active
FROM [your_themes_table]
WHERE [active_column] = true
ORDER BY [pillar_reference_column], [order_column];

-- Export Sub-themes (similar pattern)
SELECT 
  id,
  [theme_reference_column] as theme_id,
  [code_column] as code,
  [name_column] as name,
  [description_column] as description,
  [order_column] as order_index,
  [active_column] as is_active
FROM [your_subthemes_table]
WHERE [active_column] = true
ORDER BY [theme_reference_column], [order_column];

-- Export Indicators (similar pattern)
SELECT 
  id,
  [subtheme_reference_column] as subtheme_id,
  [code_column] as code,
  [name_column] as name,
  [description_column] as description,
  [data_type_column] as data_type,
  [unit_column] as unit,
  [order_column] as order_index,
  [active_column] as is_active
FROM [your_indicators_table]
WHERE [active_column] = true
ORDER BY [subtheme_reference_column], [order_column];
*/
