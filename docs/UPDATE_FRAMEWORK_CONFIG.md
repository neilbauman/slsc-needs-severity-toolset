# Updating Framework Configuration

## Current Configuration

Your database currently has a default framework configuration. To update it with the actual configuration from the source database (ssc-toolset.vercel.app), follow these steps:

## Quick Update via UI

The easiest way to update the configuration is through the UI:

1. **Log in as a site administrator**
2. **Go to the home page** (`/`)
3. **Click the "Framework Config" button** (visible only to site administrators)
4. **Edit the configuration** as needed
5. **Click "Save Configuration"**

## Manual Update via SQL

If you need to update the configuration directly via SQL:

### Step 1: Export from Source Database

1. Go to the **source database** (project: yzxmxwppzpwfolkdiuuo) SQL Editor
2. Run the queries in `scripts/export_framework_config_from_source.sql`
3. Copy the JSON values for:
   - `category_config`
   - `ssc_rollup_config`
   - `overall_rollup_config`

### Step 2: Update Target Database

1. Go to your **target database** SQL Editor
2. Use the script in `scripts/import_framework_config_to_target.sql`
3. Replace the placeholder JSON with the actual values from Step 1
4. Run the script

### Alternative: Direct Update

If you already have the configuration values, you can update directly:

```sql
-- Deactivate current config
UPDATE framework_config 
SET is_active = false 
WHERE is_active = true;

-- Insert new config (replace JSON values with your actual data)
INSERT INTO framework_config (
  name,
  description,
  category_config,
  ssc_rollup_config,
  overall_rollup_config,
  is_active
)
VALUES (
  'Your Configuration Name',
  'Description of this configuration',
  '{"SSC Framework - P1": {...}, ...}'::jsonb,  -- Your category_config
  '{"method": "...", "weights": {...}}'::jsonb,  -- Your ssc_rollup_config
  '{"method": "...", "weights": {...}}'::jsonb,  -- Your overall_rollup_config
  true
);
```

## Configuration Structure Reference

### Category Config Format

```json
{
  "SSC Framework - P1": {
    "enabled": true,
    "method": "weighted_normalized_sum",
    "default_weight": 1.0,
    "description": "The Shelter - Structural safety & direct exposure of homes"
  },
  "SSC Framework - P2": {
    "enabled": true,
    "method": "weighted_normalized_sum",
    "default_weight": 1.0,
    "description": "The Living Conditions - Physical & socioeconomic fragility factors"
  },
  "SSC Framework - P3": {
    "enabled": true,
    "method": "weighted_normalized_sum",
    "default_weight": 1.0,
    "description": "The Settlement - Readiness of services, governance & access"
  },
  "Hazard": {
    "enabled": true,
    "method": "weighted_normalized_sum",
    "default_weight": 1.0,
    "description": "Recent hazard footprints & alerts"
  },
  "Underlying Vulnerability": {
    "enabled": true,
    "method": "weighted_normalized_sum",
    "default_weight": 1.0,
    "description": "Chronic structural drivers"
  }
}
```

### SSC Rollup Config Format

```json
{
  "method": "worst_case",
  "weights": {
    "SSC Framework - P1": 0.333,
    "SSC Framework - P2": 0.333,
    "SSC Framework - P3": 0.334
  },
  "description": "How to aggregate P1, P2, P3 into SSC Framework score"
}
```

### Overall Rollup Config Format

```json
{
  "method": "average",
  "weights": {
    "SSC Framework": 0.6,
    "Hazard": 0.2,
    "Underlying Vulnerability": 0.2
  },
  "description": "How to aggregate categories into final overall score"
}
```

## Available Methods

- `average`: Simple average of all scores
- `weighted_normalized_sum`: Weighted sum with normalization
- `worst_case`: Takes the highest (worst) score
- `median`: Median value of all scores
- `custom_weighted`: Custom weights per dataset/category

## Verification

After updating, verify the configuration:

```sql
-- Check active configuration
SELECT * FROM public.get_framework_config();

-- View formatted JSON
SELECT 
  name,
  jsonb_pretty(category_config) as categories,
  jsonb_pretty(ssc_rollup_config) as ssc_rollup,
  jsonb_pretty(overall_rollup_config) as overall_rollup
FROM framework_config
WHERE is_active = true;
```

## Troubleshooting

### Configuration not saving
- Check that you're logged in as a site administrator
- Verify the JSON is valid (use a JSON validator)
- Check browser console for errors

### Invalid JSON errors
- Ensure all JSON strings are properly escaped
- Use `::jsonb` cast in SQL
- Validate JSON structure matches expected format

### Configuration not appearing
- Verify `is_active = true`
- Check that only one config is active at a time
- Test `get_framework_config()` function
