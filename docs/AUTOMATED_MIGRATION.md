# Automated Data Migration

This guide explains how to automatically migrate data from your original Philippines database to the new multi-country database using the automated migration script.

## Quick Start

### Option 1: Interactive Script (Easiest)

```bash
cd /Users/neilbauman/Desktop/Philippines\ SSC\ Toolset/philippines-ssc-toolset
./scripts/migrate-data.sh
```

The script will prompt you for:
- Source database URL (old Philippines database)
- Source database anon key
- Target database URL (new multi-country database)
- Target database anon key

### Option 2: Environment Variables

```bash
export SOURCE_SUPABASE_URL="https://your-old-project.supabase.co"
export SOURCE_SUPABASE_KEY="your-source-anon-key"
export TARGET_SUPABASE_URL="https://your-new-project.supabase.co"
export TARGET_SUPABASE_KEY="your-target-anon-key"

node scripts/migrate-data.js
```

## What Gets Migrated

The script automatically migrates:

1. ✅ **datasets** - All dataset metadata (with `country_id` assigned)
2. ✅ **dataset_values_numeric** - All numeric values
3. ✅ **dataset_values_categorical** - All categorical values
4. ✅ **admin_boundaries** - All boundary geometries (with `country_id` assigned)
5. ✅ **instances** - All instance configurations (with `country_id` assigned)
6. ✅ **instance_datasets** - All instance-dataset links
7. ✅ **instance_dataset_scores** - All computed scores
8. ✅ **affected_areas** - All affected area definitions
9. ✅ **hazard_events** - All hazard event data (with `country_id` assigned)
10. ✅ **hazard_event_scores** - All hazard event scores

## Prerequisites

1. **Both databases must have the multi-country schema**:
   - Run `supabase/migrations/00_run_all_migrations.sql` in the TARGET database first
   - The source database can be the old schema (script handles it)

2. **Node.js installed**:
   ```bash
   node --version  # Should show v18 or higher
   ```

3. **Dependencies installed**:
   ```bash
   npm install
   ```

## How It Works

1. **Connects to both databases** using Supabase client libraries
2. **Gets or creates Philippines country** in target database
3. **Migrates each table** in batches of 1000 rows
4. **Assigns `country_id`** automatically to tables that need it
5. **Uses upsert** to handle conflicts (won't duplicate data)
6. **Shows progress** for each table
7. **Verifies migration** at the end

## Example Output

```
========================================
  Data Migration Script
========================================

[1] Getting Philippines country ID from target database...
✓ Found Philippines country ID: abc123-def456-...

[Migrating datasets...]
  Found 15 rows to migrate
  Progress: 15/15 rows migrated
✓ Migrated 15 rows from datasets

[Migrating dataset_values_numeric...]
  Found 1250 rows to migrate
  Progress: 1000/1250 rows migrated
  Progress: 1250/1250 rows migrated
✓ Migrated 1250 rows from dataset_values_numeric

...

========================================
  Migration Complete!
========================================

[Verification] Verifying migration...
✓ datasets: 15 rows
✓ dataset_values_numeric: 1250 rows
✓ dataset_values_categorical: 320 rows
...
```

## Troubleshooting

### Error: "Missing required environment variables"

Make sure you've set all four environment variables or run the interactive script.

### Error: "Failed to create Philippines country"

The target database might not have the `countries` table. Run the migrations first:
```sql
-- In target database SQL Editor:
-- Run: supabase/migrations/00_run_all_migrations.sql
```

### Error: "Failed to insert into [table]"

This usually means:
1. The target table doesn't exist - run migrations first
2. There's a schema mismatch - check that both databases have similar schemas
3. Foreign key constraint violation - make sure parent tables are migrated first

The script migrates tables in the correct order to avoid foreign key issues.

### Error: "Could not count [table]"

The table might not exist in the source database. This is okay - the script will skip it and continue.

## Safety Features

- ✅ **Uses upsert** - Won't create duplicates if you run it multiple times
- ✅ **Batch processing** - Handles large datasets efficiently
- ✅ **Error handling** - Stops on errors and shows what went wrong
- ✅ **Progress tracking** - Shows progress for each table
- ✅ **Verification** - Counts rows after migration to verify success

## Manual Verification

After migration, verify the data:

```sql
-- In target database SQL Editor:
SELECT COUNT(*) FROM datasets WHERE country_id IS NOT NULL;
SELECT COUNT(*) FROM instances WHERE country_id IS NOT NULL;
SELECT COUNT(*) FROM admin_boundaries WHERE country_id IS NOT NULL;
```

All counts should match your source database.

## Next Steps

After migration:

1. **Assign users to Philippines**:
   ```sql
   -- See: scripts/assign_test_user_countries.sql
   ```

2. **Test the application**:
   - Log in and verify you can see Philippines data
   - Check that datasets, instances, and boundaries load correctly

3. **Verify data isolation**:
   - All queries should filter by `country_id`
   - Test that you can only see Philippines data when logged in
