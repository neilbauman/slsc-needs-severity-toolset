-- ==============================
-- RESTORE BUILDING TYPOLOGY DATASETS
-- ==============================
-- This script restores two datasets from source to target database
-- 
-- Source Project: vxoyzgsxiqwpufrtnerf
-- Target Project: yzxmxwppzpwfolkdiuuo
--
-- Datasets:
-- 1. Building Typologies (adm3) - a017b4a4-b958-4ede-ab9d-8f4124188d4c
-- 2. Building Typology - 59abe182-73c6-47f5-8e7b-752a1168bf06
--
-- INSTRUCTIONS:
-- Part 1: Run in SOURCE database (vxoyzgsxiqwpufrtnerf)
-- Part 2: Copy results and run in TARGET database (yzxmxwppzpwfolkdiuuo)

-- ==============================
-- PART 1: EXPORT FROM SOURCE
-- ==============================
-- Run this section in your SOURCE database (vxoyzgsxiqwpufrtnerf)

-- Step 1: Check schema and data counts
/*
SELECT 
  'Schema Check' as step,
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('dataset_values_categorical_raw', 'dataset_values_categorical')
  AND column_name IN ('admin_pcode', 'category', 'value', 'admin_pcode_raw', 'category_raw', 'value_raw')
ORDER BY table_name, ordinal_position;
*/

-- Step 2: Check data counts
/*
SELECT 
  'Raw Table Counts' as step,
  'Building Typologies (adm3)' as dataset_name,
  COUNT(*) as count
FROM dataset_values_categorical_raw
WHERE dataset_id = 'a017b4a4-b958-4ede-ab9d-8f4124188d4c'
UNION ALL
SELECT 
  'Raw Table Counts' as step,
  'Building Typology' as dataset_name,
  COUNT(*) as count
FROM dataset_values_categorical_raw
WHERE dataset_id = '59abe182-73c6-47f5-8e7b-752a1168bf06'
UNION ALL
SELECT 
  'Cleaned Table Counts' as step,
  'Building Typologies (adm3)' as dataset_name,
  COUNT(*) as count
FROM dataset_values_categorical
WHERE dataset_id = 'a017b4a4-b958-4ede-ab9d-8f4124188d4c'
UNION ALL
SELECT 
  'Cleaned Table Counts' as step,
  'Building Typology' as dataset_name,
  COUNT(*) as count
FROM dataset_values_categorical
WHERE dataset_id = '59abe182-73c6-47f5-8e7b-752a1168bf06';
*/

-- Step 3: Export Dataset 1 - Building Typologies (adm3)
-- Try raw table first, if empty use cleaned table
/*
SELECT 
  admin_pcode,
  category,
  value
FROM dataset_values_categorical_raw
WHERE dataset_id = 'a017b4a4-b958-4ede-ab9d-8f4124188d4c'
ORDER BY admin_pcode, category;
*/
-- If above returns 0 rows, use this instead:
/*
SELECT 
  admin_pcode,
  category,
  value
FROM dataset_values_categorical
WHERE dataset_id = 'a017b4a4-b958-4ede-ab9d-8f4124188d4c'
ORDER BY admin_pcode, category;
*/

-- Step 4: Export Dataset 2 - Building Typology
/*
SELECT 
  admin_pcode,
  category,
  value
FROM dataset_values_categorical_raw
WHERE dataset_id = '59abe182-73c6-47f5-8e7b-752a1168bf06'
ORDER BY admin_pcode, category;
*/
-- If above returns 0 rows, use this instead:
/*
SELECT 
  admin_pcode,
  category,
  value
FROM dataset_values_categorical
WHERE dataset_id = '59abe182-73c6-47f5-8e7b-752a1168bf06'
ORDER BY admin_pcode, category;
*/

-- Export as CSV from Supabase SQL Editor results

-- ==============================
-- PART 2: IMPORT TO TARGET
-- ==============================
-- Run this section in your TARGET database (yzxmxwppzpwfolkdiuuo)

-- Step 1: Find or create target datasets
SELECT id, name, type, country_id
FROM datasets 
WHERE name IN ('Building Typologies (adm3)', 'Building Typology')
ORDER BY name;

-- Note the IDs - you'll need them for the next steps

-- Step 2: Import using Supabase Table Editor (RECOMMENDED)
-- 1. Go to Table Editor in Supabase dashboard
-- 2. Open dataset_values_categorical_raw table
-- 3. Click "Insert" → "Import data from CSV"
-- 4. Upload your exported CSV
-- 5. Map columns:
--    - admin_pcode → admin_pcode
--    - category → category
--    - value → value
--    - Add constant: dataset_id = 'target-dataset-id-from-step-1'
-- 6. Import

-- Step 3: Alternative - Direct SQL Import
-- If you have the data as SQL INSERT statements, use this format:
/*
INSERT INTO dataset_values_categorical_raw (dataset_id, admin_pcode, category, value)
VALUES
  ('target-dataset-id-1', 'PCODE1', 'Category1', 123.45),
  ('target-dataset-id-1', 'PCODE1', 'Category2', 678.90),
  -- ... all your rows
ON CONFLICT DO NOTHING;
*/

-- Step 4: Restore cleaned data
-- After importing raw data, run this for each dataset:

/*
-- For Building Typologies (adm3)
SELECT * FROM restore_dataset_from_raw('target-dataset-id-1');

-- For Building Typology
SELECT * FROM restore_dataset_from_raw('target-dataset-id-2');
*/

-- ==============================
-- PART 3: VERIFICATION
-- ==============================
-- Run this in TARGET database to verify restoration

/*
SELECT 
  d.name,
  (SELECT COUNT(*) FROM dataset_values_categorical_raw WHERE dataset_id = d.id) as raw_count,
  (SELECT COUNT(*) FROM dataset_values_categorical WHERE dataset_id = d.id) as cleaned_count
FROM datasets d
WHERE d.name IN ('Building Typologies (adm3)', 'Building Typology')
ORDER BY d.name;
*/
