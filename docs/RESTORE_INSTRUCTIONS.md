# Step-by-Step Restoration Instructions

## Source and Target Projects

- **Source Project ID**: `vxoyzgsxiqwpufrtnerf` (original database)
- **Target Project ID**: `yzxmxwppzpwfolkdiuuo` (current database)

## Datasets to Restore

1. **Building Typologies (adm3)** - ID: `a017b4a4-b958-4ede-ab9d-8f4124188d4c`
2. **Building Typology** - ID: `59abe182-73c6-47f5-8e7b-752a1168bf06`

## Step 1: Export from Source Database

1. Open your **SOURCE** Supabase project (vxoyzgsxiqwpufrtnerf)
2. Go to SQL Editor
3. Run this to check what data exists:

```sql
-- Check counts
SELECT 
  'Raw Table' as source,
  'Building Typologies (adm3)' as dataset_name,
  COUNT(*) as count
FROM dataset_values_categorical_raw
WHERE dataset_id = 'a017b4a4-b958-4ede-ab9d-8f4124188d4c'
UNION ALL
SELECT 
  'Raw Table' as source,
  'Building Typology' as dataset_name,
  COUNT(*) as count
FROM dataset_values_categorical_raw
WHERE dataset_id = '59abe182-73c6-47f5-8e7b-752a1168bf06'
UNION ALL
SELECT 
  'Cleaned Table' as source,
  'Building Typologies (adm3)' as dataset_name,
  COUNT(*) as count
FROM dataset_values_categorical
WHERE dataset_id = 'a017b4a4-b958-4ede-ab9d-8f4124188d4c'
UNION ALL
SELECT 
  'Cleaned Table' as source,
  'Building Typology' as dataset_name,
  COUNT(*) as count
FROM dataset_values_categorical
WHERE dataset_id = '59abe182-73c6-47f5-8e7b-752a1168bf06';
```

4. Export Dataset 1 (Building Typologies adm3):

```sql
-- Try raw table first
SELECT admin_pcode, category, value
FROM dataset_values_categorical_raw
WHERE dataset_id = 'a017b4a4-b958-4ede-ab9d-8f4124188d4c'
ORDER BY admin_pcode, category;
```

If that returns 0 rows, use cleaned table:
```sql
SELECT admin_pcode, category, value
FROM dataset_values_categorical
WHERE dataset_id = 'a017b4a4-b958-4ede-ab9d-8f4124188d4c'
ORDER BY admin_pcode, category;
```

5. Export Dataset 2 (Building Typology):

```sql
-- Try raw table first
SELECT admin_pcode, category, value
FROM dataset_values_categorical_raw
WHERE dataset_id = '59abe182-73c6-47f5-8e7b-752a1168bf06'
ORDER BY admin_pcode, category;
```

If that returns 0 rows, use cleaned table:
```sql
SELECT admin_pcode, category, value
FROM dataset_values_categorical
WHERE dataset_id = '59abe182-73c6-47f5-8e7b-752a1168bf06'
ORDER BY admin_pcode, category;
```

6. **Export both results as CSV** using Supabase's export feature

## Step 2: Find Target Dataset IDs

1. Open your **TARGET** Supabase project (yzxmxwppzpwfolkdiuuo)
2. Go to SQL Editor
3. Run this:

```sql
SELECT id, name, type 
FROM datasets 
WHERE name IN ('Building Typologies (adm3)', 'Building Typology')
ORDER BY name;
```

4. **Note the `id` values** - these are your target dataset IDs

## Step 3: Import to Target Database

### Option A: Using Supabase Table Editor (Easiest)

1. Go to **Table Editor** in your TARGET project
2. Open the `dataset_values_categorical_raw` table
3. Click **"Insert"** → **"Import data from CSV"**
4. Upload the CSV for Dataset 1 (Building Typologies adm3)
5. **Important**: Before importing, you need to add the `dataset_id`:
   - In the CSV mapping, add a constant column:
   - Column: `dataset_id`
   - Value: `target-dataset-id-from-step-2` (the ID for "Building Typologies (adm3)")
6. Map other columns:
   - `admin_pcode` → `admin_pcode`
   - `category` → `category`
   - `value` → `value`
7. Click Import
8. Repeat for Dataset 2 (Building Typology)

### Option B: Using SQL (If you have data as SQL)

```sql
-- Replace 'target-dataset-id-1' with actual ID from Step 2
INSERT INTO dataset_values_categorical_raw (dataset_id, admin_pcode, category, value)
VALUES
  ('target-dataset-id-1', 'PCODE1', 'Category1', 123.45),
  ('target-dataset-id-1', 'PCODE1', 'Category2', 678.90)
  -- ... all your rows from the export
ON CONFLICT DO NOTHING;
```

## Step 4: Restore Cleaned Data

After importing raw data, run the restoration function for each dataset:

```sql
-- For Building Typologies (adm3) - replace with actual target ID
SELECT * FROM restore_dataset_from_raw('target-dataset-id-1');

-- For Building Typology - replace with actual target ID
SELECT * FROM restore_dataset_from_raw('target-dataset-id-2');
```

This will:
- Verify raw data exists
- Run the cleaning process to match PCodes
- Create cleaned data
- Recompute health metrics

## Step 5: Verify Restoration

```sql
SELECT 
  d.name,
  (SELECT COUNT(*) FROM dataset_values_categorical_raw WHERE dataset_id = d.id) as raw_count,
  (SELECT COUNT(*) FROM dataset_values_categorical WHERE dataset_id = d.id) as cleaned_count,
  d.metadata->>'data_health' as health_status
FROM datasets d
WHERE d.name IN ('Building Typologies (adm3)', 'Building Typology')
ORDER BY d.name;
```

## Troubleshooting

**If export queries return 0 rows:**
- Try the cleaned table queries instead
- Check that the dataset IDs are correct
- Verify you're connected to the source project

**If import fails:**
- Make sure the target dataset exists first
- Verify `dataset_id` is correctly set
- Check that column types match (admin_pcode = TEXT, category = TEXT, value = NUMERIC)

**If cleaning fails:**
- Run diagnostics: `SELECT * FROM diagnose_alignment_issue('dataset-id')`
- Check that admin_boundaries exist for the correct country
- Verify PCodes in raw data match admin_boundaries format
