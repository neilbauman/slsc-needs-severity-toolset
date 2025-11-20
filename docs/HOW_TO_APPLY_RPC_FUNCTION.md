# How to Apply the score_numeric_auto RPC Function

## Overview

The `score_numeric_auto` RPC function has been generated to fix the normalization issue when using "Affected Area Only" scope. This document explains how to apply it to your Supabase database.

## Method 1: Using Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Navigate to SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New query"

3. **Copy and Paste the SQL**
   - Open the file: `supabase/score_numeric_auto.sql`
   - Copy the entire contents
   - Paste into the SQL Editor

4. **Run the Query**
   - Click "Run" or press `Ctrl+Enter` (Windows/Linux) or `Cmd+Enter` (Mac)
   - You should see "Success. No rows returned"

5. **Verify the Function**
   - Go to "Database" → "Functions" in the left sidebar
   - You should see `score_numeric_auto` listed
   - Click on it to view the function definition

## Method 2: Using Supabase CLI

If you have Supabase CLI installed:

```bash
# Make sure you're in the project directory
cd /path/to/philippines-ssc-toolset

# Link to your Supabase project (if not already linked)
supabase link --project-ref your-project-ref

# Apply the migration
supabase db push

# Or apply the SQL file directly
supabase db execute -f supabase/score_numeric_auto.sql
```

## Method 3: Using psql (PostgreSQL client)

If you have direct database access:

```bash
# Connect to your Supabase database
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Run the SQL file
\i supabase/score_numeric_auto.sql

# Or copy-paste the contents directly
```

## What the Function Does

The updated function:

1. **Correctly calculates min/max for affected areas:**
   - When `in_limit_to_affected = true`, it calculates min/max from ONLY the affected ADM3 areas
   - When `in_limit_to_affected = false`, it uses the entire country's min/max

2. **Properly normalizes scores:**
   - Scores will span the full range (1 to scaleMax)
   - Minimum value in scope → score of 1 (or scaleMax if inverse)
   - Maximum value in scope → score of scaleMax (or 1 if inverse)

3. **Handles edge cases:**
   - All values the same → middle score
   - No data → raises exception
   - Invalid method → raises exception

## Testing After Application

1. **Open your application**
2. **Navigate to a dataset scoring modal**
3. **Select "Affected Area Only" scope**
4. **Set scale to 1-5**
5. **Click "Apply Scoring"**
6. **Check the preview:**
   - Min should be 1.00
   - Max should be 5.00
   - All scores should span this range

## Troubleshooting

### Error: "function already exists"
If you get this error, you need to drop the old function first:

```sql
DROP FUNCTION IF EXISTS public.score_numeric_auto(UUID, UUID, TEXT, JSONB, NUMERIC, BOOLEAN, BOOLEAN);
```

Then run the CREATE OR REPLACE statement again.

### Error: "permission denied"
Make sure you're using a database user with sufficient permissions (typically the `postgres` role or a user with `CREATE FUNCTION` permission).

### Error: "relation does not exist"
Verify that these tables exist:
- `datasets`
- `dataset_values_numeric`
- `instances`
- `instance_dataset_scores`
- `admin_boundaries`

### Scores still not spanning full range
1. Check that `in_limit_to_affected` is being passed as `true` in the frontend
2. Verify that `admin_scope` in the `instances` table contains valid ADM2 codes
3. Check that `admin_boundaries` table has proper `parent_pcode` relationships
4. Review Supabase logs for any errors during function execution

## Rollback (if needed)

If you need to rollback to a previous version:

```sql
-- Drop the function
DROP FUNCTION IF EXISTS public.score_numeric_auto(UUID, UUID, TEXT, JSONB, NUMERIC, BOOLEAN, BOOLEAN);

-- Then restore your previous version from backup or version control
```

## Next Steps

After successfully applying the function:
1. Test with a dataset using "Affected Area Only" scope
2. Verify scores span 1 to scaleMax
3. Test with "Entire Country" scope to ensure it still works
4. Test with different scale values (1-4, 1-5, 1-10, etc.)
5. Test with inverse scoring enabled

