# Deploy Dataset Cleaning Functions

This guide explains how to deploy the new dataset cleaning RPC functions to your Supabase database.

## Prerequisites

1. **Enable pg_trgm extension** (required for fuzzy matching):
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   ```

## Required Functions

Deploy these functions in order:

### 1. Compute Data Health Metrics
**File**: `compute_data_health.sql`

This function calculates comprehensive health metrics for datasets.

**Deploy**:
```sql
-- Copy and paste the entire contents of supabase/compute_data_health.sql
-- into your Supabase SQL Editor and run it
```

### 2. Preview PCode Alignment
**File**: `preview_pcode_alignment.sql`

This function previews how raw PCodes will be matched to admin boundaries.

**Deploy**:
```sql
-- Copy and paste the entire contents of supabase/preview_pcode_alignment.sql
-- into your Supabase SQL Editor and run it
```

**Note**: Requires `pg_trgm` extension (see Prerequisites above).

### 3. Clean Numeric Dataset v3
**File**: `clean_numeric_dataset_v3.sql`

Enhanced cleaning function for numeric datasets with configurable matching strategies.

**Deploy**:
```sql
-- Copy and paste the entire contents of supabase/clean_numeric_dataset_v3.sql
-- into your Supabase SQL Editor and run it
```

### 4. Clean Categorical Dataset v3
**File**: `clean_categorical_dataset_v3.sql`

Enhanced cleaning function for categorical datasets with configurable matching strategies.

**Deploy**:
```sql
-- Copy and paste the entire contents of supabase/clean_categorical_dataset_v3.sql
-- into your Supabase SQL Editor and run it
```

## Quick Deploy Script

You can deploy all functions at once by running this in your Supabase SQL Editor:

```sql
-- Step 1: Enable extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Step 2: Deploy compute_data_health
-- (Copy contents of compute_data_health.sql here)

-- Step 3: Deploy preview_pcode_alignment
-- (Copy contents of preview_pcode_alignment.sql here)

-- Step 4: Deploy clean_numeric_dataset_v3
-- (Copy contents of clean_numeric_dataset_v3.sql here)

-- Step 5: Deploy clean_categorical_dataset_v3
-- (Copy contents of clean_categorical_dataset_v3.sql here)
```

## Verification

After deploying, verify the functions exist:

```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'compute_data_health',
    'preview_pcode_alignment',
    'clean_numeric_dataset_v3',
    'clean_categorical_dataset_v3'
  )
ORDER BY routine_name;
```

You should see all 4 functions listed.

## Troubleshooting

### Error: "function does not exist"
- Make sure you've run the SQL files in your Supabase SQL Editor
- Check that the function names match exactly (case-sensitive)
- Verify you're connected to the correct database

### Error: "function similarity does not exist"
- You need to enable the `pg_trgm` extension
- Run: `CREATE EXTENSION IF NOT EXISTS pg_trgm;`

### Error: "relation admin_boundaries does not exist"
- Make sure your `admin_boundaries` table exists
- The functions depend on this table for matching

