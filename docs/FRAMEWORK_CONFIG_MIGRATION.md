# SSC Framework Configuration Migration Guide

This guide explains how to migrate SSC Framework configuration from the source database (https://ssc-toolset.vercel.app/) into the SLSC Needs Severity Toolset.

## Overview

The framework configuration system allows site administrators to configure:
- **Category configurations**: Settings for P1, P2, P3, Hazard, and Underlying Vulnerability categories
- **SSC Rollup**: How to aggregate P1, P2, P3 into the SSC Framework score
- **Overall Rollup**: How to aggregate all categories into the final overall score

## Migration Steps

### Step 1: Run Database Migration

First, apply the database migration to create the `framework_config` table:

```sql
-- Run this in your target Supabase SQL Editor
-- File: supabase/migrations/35_create_framework_config_table.sql
```

### Step 2: Check Source Database Structure

In the **source database** (project: yzxmxwppzpwfolkdiuuo), run these queries to understand the existing structure:

```sql
-- Check for framework-related tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (table_name LIKE '%framework%' OR table_name LIKE '%pillar%' OR table_name LIKE '%ssc%')
ORDER BY table_name;
```

### Step 3: Export Configuration from Source

If the source has a `framework_config` table:

```sql
-- Run in SOURCE database
SELECT 
  name,
  description,
  category_config,
  ssc_rollup_config,
  overall_rollup_config
FROM framework_config
WHERE is_active = true
ORDER BY updated_at DESC
LIMIT 1;
```

If the source stores config differently (e.g., in `instance_dataset_config`):

```sql
-- Check for framework config in instance configs
SELECT DISTINCT
  score_config->'categories' as categories,
  score_config->'ssc_overall' as ssc_rollup,
  score_config->'overall' as overall_rollup
FROM instance_dataset_config
WHERE score_config IS NOT NULL
LIMIT 10;
```

### Step 4: Import into Target Database

Once you have the configuration data, import it into the target database:

```sql
-- Run in TARGET database
-- First, deactivate any existing configs
UPDATE framework_config SET is_active = false WHERE is_active = true;

-- Insert the migrated configuration
INSERT INTO public.framework_config (
  name,
  description,
  category_config,
  ssc_rollup_config,
  overall_rollup_config,
  is_active
)
VALUES (
  'Migrated from Source Database',
  'Configuration migrated from ssc-toolset.vercel.app',
  -- Paste the category_config JSON here
  '{}'::jsonb,
  -- Paste the ssc_rollup_config JSON here
  '{}'::jsonb,
  -- Paste the overall_rollup_config JSON here
  '{}'::jsonb,
  true
);
```

### Step 5: Verify Configuration

Test that the configuration was imported correctly:

```sql
-- Check the active configuration
SELECT * FROM public.get_framework_config();
```

## Using the Framework Configuration UI

After migration, site administrators can:

1. **Access the configuration**: On the home page, click the "Framework Config" button (visible only to site administrators)
2. **Edit settings**: Modify category methods, weights, and rollup configurations
3. **Save changes**: Click "Save Configuration" to make it active

## Configuration Structure

### Category Configuration

Each category (P1, P2, P3, Hazard, Underlying Vulnerability) has:
- `enabled`: Whether the category is active
- `method`: Aggregation method (average, weighted_normalized_sum, worst_case, median, custom_weighted)
- `default_weight`: Default weight for the category
- `description`: Human-readable description

### SSC Rollup Configuration

Controls how P1, P2, P3 are aggregated into the SSC Framework score:
- `method`: Aggregation method
- `weights`: Custom weights for each pillar (if method is custom_weighted)

### Overall Rollup Configuration

Controls how all categories are aggregated into the final overall score:
- `method`: Aggregation method
- `weights`: Custom weights for SSC Framework, Hazard, and Underlying Vulnerability (if method is custom_weighted)

## Next Steps

After migration, you may want to:
1. Update framework aggregation functions to use global defaults when instance-specific config isn't provided
2. Test the configuration with a sample instance
3. Document any custom configurations for your organization

## Troubleshooting

### Configuration not appearing
- Check that `is_active = true` for the configuration
- Verify the `get_framework_config()` function returns data
- Check browser console for errors

### Import errors
- Ensure JSON is valid JSONB format
- Check that all required fields are present
- Verify category keys match expected values (P1, P2, P3, Hazard, Underlying Vulnerability)

### UI not accessible
- Verify user has site administrator role
- Check that `isSiteAdmin` is true in the country context
- Ensure the FrameworkConfigModal component is imported correctly
