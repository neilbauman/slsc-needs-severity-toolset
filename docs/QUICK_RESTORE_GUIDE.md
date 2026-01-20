# Quick Restore Guide for Building Typology Datasets

## Source Dataset IDs
- **Building Typologies (adm3)**: `a017b4a4-b958-4ede-ab9d-8f4124188d4c`
- **Building Typology**: `59abe182-73c6-47f5-8e7b-752a1168bf06`

## Step-by-Step Restoration

### Step 1: Export from Source Database

1. Open your **SOURCE** Supabase project SQL Editor
2. First, check what columns exist:
   ```sql
   SELECT column_name 
   FROM information_schema.columns 
   WHERE table_name = 'dataset_values_categorical_raw' 
     AND table_schema = 'public';
   ```

3. Export Dataset 1 (try raw table first):
   ```sql
   SELECT admin_pcode, category, value
   FROM dataset_values_categorical_raw
   WHERE dataset_id = 'a017b4a4-b958-4ede-ab9d-8f4124188d4c'
   ORDER BY admin_pcode, category;
   ```
   
   **If that returns 0 rows**, try the cleaned table:
   ```sql
   SELECT admin_pcode, category, value
   FROM dataset_values_categorical
   WHERE dataset_id = 'a017b4a4-b958-4ede-ab9d-8f4124188d4c'
   ORDER BY admin_pcode, category;
   ```

4. Export Dataset 2:
   ```sql
   SELECT admin_pcode, category, value
   FROM dataset_values_categorical_raw
   WHERE dataset_id = '59abe182-73c6-47f5-8e7b-752a1168bf06'
   ORDER BY admin_pcode, category;
   ```
   
   **If that returns 0 rows**, try the cleaned table:
   ```sql
   SELECT admin_pcode, category, value
   FROM dataset_values_categorical
   WHERE dataset_id = '59abe182-73c6-47f5-8e7b-752a1168bf06'
   ORDER BY admin_pcode, category;
   ```

5. **Export the results as CSV** (use Supabase's export feature)

### Step 2: Find Target Dataset IDs

1. Open your **TARGET** Supabase project SQL Editor
2. Run:
   ```sql
   SELECT id, name, type 
   FROM datasets 
   WHERE name IN ('Building Typologies (adm3)', 'Building Typology')
   ORDER BY name;
   ```
3. Note the `id` values - these are your target dataset IDs

### Step 3: Import to Target Database

**Option A: Using Supabase Table Editor (Easiest)**

1. Open Supabase Table Editor
2. Go to `dataset_values_categorical_raw` table
3. Click "Insert" → "Import data from CSV"
4. Upload your exported CSV
5. **Important**: Before importing, add a column mapping:
   - Map `admin_pcode` → `admin_pcode`
   - Map `category` → `category`  
   - Map `value` → `value`
   - **Add a constant column**: `dataset_id` = `'your-target-dataset-id'`
6. Import the data

**Option B: Using SQL INSERT (If you have the data as SQL)**

1. Convert your CSV to INSERT statements, or use this pattern:
   ```sql
   INSERT INTO dataset_values_categorical_raw (dataset_id, admin_pcode, category, value)
   VALUES
     ('target-dataset-id-1', 'PCODE1', 'Category1', 123.45),
     ('target-dataset-id-1', 'PCODE1', 'Category2', 678.90)
     -- ... all your rows
   ON CONFLICT DO NOTHING;
   ```

### Step 4: Run Cleaning to Restore Cleaned Data

After importing raw data, run:

```sql
-- For dataset 1
SELECT * FROM restore_dataset_from_raw('target-dataset-id-1');

-- For dataset 2  
SELECT * FROM restore_dataset_from_raw('target-dataset-id-2');
```

This will:
- Verify raw data exists
- Run the cleaning process
- Restore cleaned data
- Recompute health metrics

## Troubleshooting

**If you get "column does not exist" errors:**
- The source database might use different column names
- Check the schema first with the query in Step 1
- Adjust column names in export queries accordingly

**If raw tables are empty in source:**
- Use the cleaned tables (`dataset_values_categorical`) instead
- The data will work the same way

**If import fails:**
- Make sure the target dataset exists first
- Check that `dataset_id` is correctly set
- Verify data types match (admin_pcode = TEXT, category = TEXT, value = NUMERIC)
