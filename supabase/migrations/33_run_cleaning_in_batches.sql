-- ==============================
-- RUN CLEANING IN BATCHES
-- ==============================
-- Since the cleaning function times out on large datasets,
-- this script runs it in smaller batches
--
-- Usage: Run these queries one at a time in SQL Editor

-- First, apply the fixed migration 23 if you haven't already
-- Then run the cleaning directly (it will process all data):

-- Option 1: Run cleaning with default config (recommended)
-- This should work if the timeout is increased or run directly
SELECT * FROM clean_categorical_dataset_v3(
  'a017b4a4-b958-4ede-ab9d-8f4124188d4c'::UUID, 
  '{"exact_match": true, "fuzzy_pcode": true, "fuzzy_threshold": 0.7, "prefix_match": true}'::JSONB
);

SELECT * FROM clean_categorical_dataset_v3(
  '59abe182-73c6-47f5-8e7b-752a1168bf06'::UUID, 
  '{"exact_match": true, "fuzzy_pcode": true, "fuzzy_threshold": 0.7, "prefix_match": true}'::JSONB
);

-- Option 2: If still timing out, run directly via psql with increased timeout:
-- psql -h your-db-host -U postgres -d postgres -c "SET statement_timeout = '10min'; SELECT * FROM clean_categorical_dataset_v3(...);"

-- Option 3: Check progress before/after
-- Check raw data count
SELECT 
  'Building Typologies (adm3)' as dataset_name,
  COUNT(*) as raw_count
FROM dataset_values_categorical_raw
WHERE dataset_id = 'a017b4a4-b958-4ede-ab9d-8f4124188d4c'
UNION ALL
SELECT 
  'Building Typology' as dataset_name,
  COUNT(*) as raw_count
FROM dataset_values_categorical_raw
WHERE dataset_id = '59abe182-73c6-47f5-8e7b-752a1168bf06';

-- Check cleaned data count
SELECT 
  'Building Typologies (adm3)' as dataset_name,
  COUNT(*) as cleaned_count
FROM dataset_values_categorical
WHERE dataset_id = 'a017b4a4-b958-4ede-ab9d-8f4124188d4c'
UNION ALL
SELECT 
  'Building Typology' as dataset_name,
  COUNT(*) as cleaned_count
FROM dataset_values_categorical
WHERE dataset_id = '59abe182-73c6-47f5-8e7b-752a1168bf06';

-- After cleaning, recompute health
SELECT compute_data_health('a017b4a4-b958-4ede-ab9d-8f4124188d4c'::UUID);
SELECT compute_data_health('59abe182-73c6-47f5-8e7b-752a1168bf06'::UUID);
