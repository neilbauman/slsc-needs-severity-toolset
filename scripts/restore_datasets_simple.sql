-- ==============================
-- SIMPLE SQL-BASED RESTORATION
-- ==============================
-- Since direct API access may be complex, here's a simpler approach:
-- Copy and paste these queries directly into Supabase SQL Editor

-- ==============================
-- PART 1: EXPORT FROM SOURCE (vxoyzgsxiqwpufrtnerf)
-- ==============================

-- Export Dataset 1: Building Typologies (adm3)
-- Copy the results and save as CSV or JSON
SELECT 
  admin_pcode,
  category,
  value
FROM dataset_values_categorical_raw
WHERE dataset_id = 'a017b4a4-b958-4ede-ab9d-8f4124188d4c'
ORDER BY admin_pcode, category;

-- If above returns 0 rows, use cleaned table:
-- SELECT admin_pcode, category, value
-- FROM dataset_values_categorical
-- WHERE dataset_id = 'a017b4a4-b958-4ede-ab9d-8f4124188d4c'
-- ORDER BY admin_pcode, category;

-- Export Dataset 2: Building Typology
SELECT 
  admin_pcode,
  category,
  value
FROM dataset_values_categorical_raw
WHERE dataset_id = '59abe182-73c6-47f5-8e7b-752a1168bf06'
ORDER BY admin_pcode, category;

-- If above returns 0 rows, use cleaned table:
-- SELECT admin_pcode, category, value
-- FROM dataset_values_categorical
-- WHERE dataset_id = '59abe182-73c6-47f5-8e7b-752a1168bf06'
-- ORDER BY admin_pcode, category;

-- ==============================
-- PART 2: IMPORT TO TARGET (yzxmxwppzpwfolkdiuuo)
-- ==============================

-- Step 1: Find target dataset IDs
SELECT id, name, type 
FROM datasets 
WHERE name IN ('Building Typologies (adm3)', 'Building Typology')
ORDER BY name;

-- Step 2: After you have the target IDs and exported CSV data,
-- use Supabase Table Editor to import:
-- 1. Go to Table Editor → dataset_values_categorical_raw
-- 2. Click "Insert" → "Import data from CSV"
-- 3. Upload your CSV
-- 4. Add dataset_id column mapping to the target dataset ID
-- 5. Import

-- Step 3: After importing, restore cleaned data:
-- Replace 'target-dataset-id-1' and 'target-dataset-id-2' with actual IDs from Step 1

-- SELECT * FROM restore_dataset_from_raw('target-dataset-id-1'); -- Building Typologies (adm3)
-- SELECT * FROM restore_dataset_from_raw('target-dataset-id-2'); -- Building Typology
