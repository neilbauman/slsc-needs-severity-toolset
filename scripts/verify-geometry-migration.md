# Geometry Data Migration Verification

The geometry data for the map comes from two sources:

1. **`admin_boundaries` table** - Contains the actual geometry/geom columns with spatial data
2. **`instance_category_scores` table** - Contains scores with `category = 'Overall'`

The view `v_instance_admin_scores_geojson` joins these two tables to provide geometry for the map.

## What to Check

### Step 1: Verify admin_boundaries was migrated
Run this in your TARGET database:
```sql
SELECT COUNT(*) as total, 
       COUNT(geometry) as with_geometry,
       COUNT(geom) as with_geom
FROM admin_boundaries
WHERE country_id = (SELECT id FROM countries WHERE iso_code = 'PHL');
```

If `total` is 0, then `admin_boundaries` was NOT migrated. You need to run the main data migration script.

### Step 2: Verify scores exist
Run this in your TARGET database:
```sql
SELECT COUNT(*) 
FROM instance_category_scores 
WHERE category = 'Overall' 
  AND instance_id = 'fda79464-f087-4ddf-8eee-e6b87ccc9978';
```

If this returns 0, you need to **calculate scores** for the instance.

### Step 3: Check the view
Run this in your TARGET database:
```sql
SELECT COUNT(*) 
FROM v_instance_admin_scores_geojson
WHERE instance_id = 'fda79464-f087-4ddf-8eee-e6b87ccc9978';
```

If this returns 0, either:
- admin_boundaries has no geometry, OR
- instance_category_scores has no 'Overall' scores

## Solution

1. **If admin_boundaries is missing**: Run the main data migration script (`migrate-data.js`)
2. **If scores are missing**: Use the "Adjust Scoring" button in the UI and click "Compute Final Rollup" to calculate overall scores
