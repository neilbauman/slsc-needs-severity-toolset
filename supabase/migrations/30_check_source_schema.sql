-- ==============================
-- CHECK SOURCE DATABASE SCHEMA
-- ==============================
-- Run these queries in your SOURCE database to check the actual column names

-- Check what columns exist in the raw tables
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('dataset_values_numeric_raw', 'dataset_values_categorical_raw')
ORDER BY table_name, ordinal_position;

-- Check if the tables exist at all
SELECT 
  table_schema,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%raw%'
ORDER BY table_name;

-- If columns are different, here are alternative queries:

-- Option 1: If columns are named differently (e.g., admin_pcode_raw, value_raw)
-- For numeric:
/*
SELECT 
  admin_pcode_raw as admin_pcode,  -- or whatever the column is named
  value_raw as value               -- or whatever the column is named
FROM dataset_values_numeric_raw
WHERE dataset_id = 'your-dataset-id'
ORDER BY admin_pcode_raw;
*/

-- For categorical:
/*
SELECT 
  admin_pcode_raw as admin_pcode,  -- or whatever the column is named
  category,
  value_raw as value               -- or whatever the column is named
FROM dataset_values_categorical_raw
WHERE dataset_id = 'your-dataset-id'
ORDER BY admin_pcode_raw, category;
*/

-- Option 2: If the table structure is completely different, 
-- you might need to check the cleaned tables instead:
-- For numeric:
/*
SELECT 
  admin_pcode,
  value
FROM dataset_values_numeric
WHERE dataset_id = 'your-dataset-id'
ORDER BY admin_pcode;
*/

-- For categorical:
/*
SELECT 
  admin_pcode,
  category,
  value
FROM dataset_values_categorical
WHERE dataset_id = 'your-dataset-id'
ORDER BY admin_pcode, category;
*/
