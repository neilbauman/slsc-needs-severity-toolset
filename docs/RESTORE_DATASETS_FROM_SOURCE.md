# Restoring Datasets from Source Database

If your datasets exist in the original source database, follow these steps to restore them.

## Option 1: Using Supabase SQL Editor (Recommended)

### Step 1: Find Dataset IDs in Source Database

1. Open your **SOURCE** Supabase project SQL Editor
2. Run this query to find your datasets:

```sql
SELECT 
  id,
  name,
  type,
  admin_level,
  created_at
FROM datasets
WHERE name IN ('Building Typology', 'Population')  -- Replace with your actual dataset names
ORDER BY name;
```

3. Copy the `id` values for each dataset

### Step 2: Check Source Database Schema

**IMPORTANT:** First check what columns exist in your source database:

```sql
-- Run this in SOURCE database to see actual column names
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('dataset_values_numeric_raw', 'dataset_values_categorical_raw')
ORDER BY table_name, ordinal_position;
```

### Step 3: Export Raw Data from Source

**If columns are named `admin_pcode` and `value`** (standard):

For **numeric** datasets, run in SOURCE database:

```sql
-- Replace 'source-dataset-id' with the actual ID from Step 1
SELECT 
  admin_pcode,
  value
FROM dataset_values_numeric_raw
WHERE dataset_id = 'source-dataset-id'
ORDER BY admin_pcode;
```

For **categorical** datasets, run in SOURCE database:

```sql
-- Replace 'source-dataset-id' with the actual ID from Step 1
SELECT 
  admin_pcode,
  category,
  value
FROM dataset_values_categorical_raw
WHERE dataset_id = 'source-dataset-id'
ORDER BY admin_pcode, category;
```

**If columns are named differently** (e.g., `admin_pcode_raw`, `value_raw`):

For **numeric**:
```sql
SELECT 
  admin_pcode_raw as admin_pcode,  -- Adjust column name as needed
  value_raw as value
FROM dataset_values_numeric_raw
WHERE dataset_id = 'source-dataset-id'
ORDER BY admin_pcode_raw;
```

For **categorical**:
```sql
SELECT 
  admin_pcode_raw as admin_pcode,  -- Adjust column name as needed
  category,
  value_raw as value
FROM dataset_values_categorical_raw
WHERE dataset_id = 'source-dataset-id'
ORDER BY admin_pcode_raw, category;
```

**If raw tables don't exist**, use the cleaned tables instead:
```sql
-- For numeric
SELECT admin_pcode, value
FROM dataset_values_numeric
WHERE dataset_id = 'source-dataset-id'
ORDER BY admin_pcode;

-- For categorical
SELECT admin_pcode, category, value
FROM dataset_values_categorical
WHERE dataset_id = 'source-dataset-id'
ORDER BY admin_pcode, category;
```

**Export the results** as CSV or copy the data.

### Step 3: Find/Create Target Dataset IDs

1. Open your **TARGET** Supabase project SQL Editor
2. Check if the datasets already exist:

```sql
SELECT id, name, type FROM datasets 
WHERE name IN ('Building Typology', 'Population');
```

3. If they don't exist, you'll need to create them first (or use the dataset creation UI)

### Step 4: Import Raw Data to Target

**For numeric datasets:**

```sql
-- Replace 'target-dataset-id' with the ID from Step 3
-- Replace the VALUES with your exported data
INSERT INTO dataset_values_numeric_raw (dataset_id, admin_pcode, value)
VALUES
  ('target-dataset-id', 'PCODE1', 123.45),
  ('target-dataset-id', 'PCODE2', 678.90)
  -- ... add all your rows
ON CONFLICT DO NOTHING;
```

**For categorical datasets:**

```sql
-- Replace 'target-dataset-id' with the ID from Step 3
-- Replace the VALUES with your exported data
INSERT INTO dataset_values_categorical_raw (dataset_id, admin_pcode, category, value)
VALUES
  ('target-dataset-id', 'PCODE1', 'Category1', 123.45),
  ('target-dataset-id', 'PCODE1', 'Category2', 678.90)
  -- ... add all your rows
ON CONFLICT DO NOTHING;
```

### Step 5: Run Cleaning to Restore Cleaned Data

After importing raw data, run the restoration function:

```sql
SELECT * FROM restore_dataset_from_raw('target-dataset-id');
```

## Option 2: Using Database Link (If Available)

If you have `dblink` extension enabled, you can copy directly:

```sql
-- First, create a connection to source database
-- (This requires dblink extension and connection credentials)

-- Then copy the data directly
INSERT INTO dataset_values_numeric_raw (dataset_id, admin_pcode, value)
SELECT 
  'target-dataset-id'::UUID,
  admin_pcode,
  value
FROM dblink(
  'host=source-db-host dbname=postgres user=postgres password=your-password',
  'SELECT admin_pcode, value FROM dataset_values_numeric_raw WHERE dataset_id = ''source-dataset-id'''
) AS t(admin_pcode TEXT, value NUMERIC);
```

## Option 3: Manual CSV Import

1. Export data from source database as CSV
2. Use Supabase's table editor or import tool to upload the CSV
3. Map columns correctly (dataset_id, admin_pcode, value/category)
4. Run cleaning workflow

## Quick Check Script

After importing, verify the data:

```sql
-- Check raw data count
SELECT 
  'Raw Numeric' as table_name,
  COUNT(*) as row_count
FROM dataset_values_numeric_raw
WHERE dataset_id = 'target-dataset-id'
UNION ALL
SELECT 
  'Raw Categorical',
  COUNT(*)
FROM dataset_values_categorical_raw
WHERE dataset_id = 'target-dataset-id';
```

## Troubleshooting

- **If you get foreign key errors**: Make sure the target dataset exists first
- **If data doesn't match**: Check that country_id matches between source and target
- **If cleaning fails**: Run the diagnostic: `SELECT * FROM diagnose_alignment_issue('dataset-id')`
