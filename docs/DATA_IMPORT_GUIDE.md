# Data Import Guide: Migrating from Original Philippines Database

This guide explains how to import existing data and configuration from your original Philippines database into the new multi-country database.

## Overview

There are two scenarios:
1. **Same Database Migration**: You're upgrading the existing database (adding country isolation)
2. **Cross-Database Migration**: You're copying data from an old database to a new one

## Scenario 1: Same Database Migration (Recommended)

If you're upgrading your existing database, use the existing migration scripts:

### Steps

1. **Run the multi-country schema migrations** (if not already done):
   ```sql
   -- Run in Supabase SQL Editor:
   -- supabase/migrations/00_run_all_migrations.sql
   ```

2. **Assign existing data to Philippines**:
   ```sql
   -- Run in Supabase SQL Editor:
   -- supabase/migrations/migrate_philippines_data.sql
   ```

3. **Verify the migration**:
   ```sql
   -- Check that all data has country_id
   SELECT COUNT(*) as total, COUNT(country_id) as with_country 
   FROM datasets;
   
   SELECT COUNT(*) as total, COUNT(country_id) as with_country 
   FROM instances;
   
   SELECT COUNT(*) as total, COUNT(country_id) as with_country 
   FROM admin_boundaries;
   ```

That's it! Your existing data is now assigned to Philippines.

---

## Scenario 2: Cross-Database Migration

If you need to copy data from an **old database** to a **new database**, follow these steps:

### Prerequisites

- Access to both databases (source and target)
- Source database: Original Philippines database
- Target database: New multi-country database (with migrations already run)

### Step 1: Export Data from Source Database

Run the export script in your **source database** SQL Editor:

```sql
-- See: scripts/export_philippines_data.sql
```

This will generate SQL INSERT statements that you can copy and run in the target database.

### Step 2: Import Data into Target Database

1. **Ensure Philippines country exists** in target database:
   ```sql
   INSERT INTO public.countries (iso_code, name, active) 
   VALUES ('PHL', 'Philippines', true)
   ON CONFLICT (iso_code) DO NOTHING;
   ```

2. **Run the import script** in your **target database** SQL Editor:
   ```sql
   -- See: scripts/import_philippines_data.sql
   -- Or paste the exported SQL from Step 1
   ```

### Step 3: Verify Import

```sql
-- Check counts match
SELECT 'datasets' as table_name, COUNT(*) as count FROM datasets
UNION ALL
SELECT 'instances', COUNT(*) FROM instances
UNION ALL
SELECT 'admin_boundaries', COUNT(*) FROM admin_boundaries
UNION ALL
SELECT 'dataset_values_numeric', COUNT(*) FROM dataset_values_numeric
UNION ALL
SELECT 'dataset_values_categorical', COUNT(*) FROM dataset_values_categorical;
```

---

## What Gets Migrated

The following tables and data are migrated:

### Core Data Tables
- ✅ `datasets` - All dataset metadata
- ✅ `dataset_values_numeric` - All numeric dataset values
- ✅ `dataset_values_categorical` - All categorical dataset values
- ✅ `admin_boundaries` - All administrative boundary geometries
- ✅ `instances` - All instance configurations
- ✅ `instance_datasets` - All instance-dataset links
- ✅ `instance_dataset_scores` - All computed scores
- ✅ `affected_areas` - All affected area definitions
- ✅ `hazard_events` - All hazard event data
- ✅ `hazard_event_scores` - All hazard event scores

### User Data (Optional)
- ⚠️ `auth.users` - User accounts (requires careful handling)
- ✅ `user_countries` - User-country assignments (created during migration)

### What's NOT Migrated
- ❌ RPC functions (already in target database)
- ❌ Database indexes (recreated automatically)
- ❌ Row Level Security (RLS) policies (need to be set up separately)

---

## Using Supabase Dashboard

### Method 1: Direct SQL Copy (Recommended for Small Databases)

1. **In Source Database**:
   - Go to SQL Editor
   - Run export queries (see `scripts/export_philippines_data.sql`)
   - Copy the results

2. **In Target Database**:
   - Go to SQL Editor
   - Paste and run the INSERT statements
   - Run `scripts/import_philippines_data.sql` to assign country_id

### Method 2: Supabase CLI (For Large Databases)

```bash
# Export from source
supabase db dump --db-url "postgresql://..." -f export.sql

# Import to target (after modifying for country_id)
supabase db reset --db-url "postgresql://..." -f export.sql
```

### Method 3: pg_dump/pg_restore (Advanced)

```bash
# Export
pg_dump "postgresql://..." --data-only --table=datasets --table=instances ... > export.sql

# Modify export.sql to add country_id references

# Import
psql "postgresql://..." < export.sql
```

---

## Troubleshooting

### Issue: Foreign Key Violations

**Problem**: Import fails because of missing referenced records.

**Solution**: Import in this order:
1. `countries` (create Philippines)
2. `datasets` (with country_id)
3. `dataset_values_numeric` / `dataset_values_categorical`
4. `admin_boundaries` (with country_id)
5. `instances` (with country_id)
6. `instance_datasets`
7. `instance_dataset_scores`
8. `affected_areas`
9. `hazard_events` (with country_id)
10. `hazard_event_scores`

### Issue: UUID Conflicts

**Problem**: UUIDs from source database conflict with existing data.

**Solution**: 
- Option A: Let PostgreSQL generate new UUIDs (recommended)
- Option B: Use `ON CONFLICT DO NOTHING` in INSERT statements

### Issue: Missing country_id

**Problem**: Imported data doesn't have country_id assigned.

**Solution**: Run the migration script after import:
```sql
-- Run: supabase/migrations/migrate_philippines_data.sql
```

### Issue: Geometry Import Errors

**Problem**: PostGIS geometries fail to import.

**Solution**: Ensure PostGIS extension is enabled in target database:
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

---

## Next Steps After Import

1. **Assign users to Philippines**:
   ```sql
   -- See: scripts/assign_test_user_countries.sql
   -- Modify to assign your actual users
   ```

2. **Verify data isolation**:
   ```sql
   -- All queries should filter by country_id
   SELECT * FROM datasets WHERE country_id = (SELECT id FROM countries WHERE iso_code = 'PHL');
   ```

3. **Test the application**:
   - Log in and verify you can see Philippines data
   - Check that datasets, instances, and boundaries load correctly
   - Verify scoring functions work

---

## Quick Reference

| Task | Script Location |
|------|----------------|
| Export data | `scripts/export_philippines_data.sql` |
| Import data | `scripts/import_philippines_data.sql` |
| Assign country_id | `supabase/migrations/migrate_philippines_data.sql` |
| Assign users | `scripts/assign_test_user_countries.sql` |
| Verify setup | `scripts/verify-setup.sql` |

---

## Need Help?

If you encounter issues:
1. Check the error message in Supabase SQL Editor
2. Verify both databases have the same schema structure
3. Ensure all foreign key relationships are maintained
4. Check that country_id columns exist in target database
