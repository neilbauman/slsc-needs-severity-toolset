# Framework Structure Migration Guide

This guide explains how to migrate the complete SSC Framework structure (pillars → themes → sub-themes → indicators) from the source database into the SLSC Needs Severity Toolset.

## Overview

The framework structure is hierarchical:
- **Pillars** (P1, P2, P3) → **Themes** → **Sub-themes** → **Indicators**

This structure allows for detailed categorization of datasets and provides a comprehensive framework taxonomy.

## Migration Steps

### Step 1: Run Database Migration

First, create the framework structure tables in your target database:

```sql
-- Run this in your target Supabase SQL Editor
-- File: supabase/migrations/37_create_framework_structure_tables.sql
```

This creates:
- `framework_pillars` - Stores P1, P2, P3
- `framework_themes` - Themes within each pillar
- `framework_subthemes` - Sub-themes within each theme
- `framework_indicators` - Indicators within each sub-theme
- `dataset_indicators` - Links datasets to indicators

### Step 2: Discover Structure in Source Database

#### Option A: Using SQL Queries (Recommended)

1. Go to the **source database** SQL Editor (project: yzxmxwppzpwfolkdiuuo)
2. Run the queries in `scripts/export_framework_structure_from_source.sql`
3. This will help you identify:
   - What tables exist
   - What the column names are
   - The data structure

#### Option B: Using Python Script

1. Install Python 3.8+
2. Run the discovery script:
   ```bash
   python scripts/discover_framework_structure.py
   ```
3. This will create `framework_structure_discovery.json` with all discovered data

### Step 3: Export Data from Source

Once you've identified the table structure, export the data:

#### Manual Export via SQL

Run these queries in the **source database** and save the results:

```sql
-- Export pillars
SELECT * FROM pillars WHERE is_active = true ORDER BY "order";

-- Export themes  
SELECT * FROM themes WHERE is_active = true ORDER BY pillar_code, "order";

-- Export sub-themes
SELECT * FROM subthemes WHERE is_active = true ORDER BY theme_code, "order";

-- Export indicators
SELECT * FROM indicators WHERE is_active = true ORDER BY subtheme_code, "order";
```

#### JSON Export (Single Query)

If your source database supports JSON aggregation:

```sql
SELECT jsonb_build_object(
  'pillars', (SELECT jsonb_agg(...) FROM pillars),
  'themes', (SELECT jsonb_agg(...) FROM themes),
  'subthemes', (SELECT jsonb_agg(...) FROM subthemes),
  'indicators', (SELECT jsonb_agg(...) FROM indicators)
) as framework_structure;
```

### Step 4: Import to Target Database

#### Option A: Using Python Script (Automated)

1. Set your target database credentials:
   ```bash
   export NEXT_PUBLIC_SUPABASE_PROJECT_ID=your_project_id
   export NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

2. Ensure `framework_structure_discovery.json` exists (from discovery step)

3. Run the import script:
   ```bash
   python scripts/import_framework_structure.py
   ```

The script will:
- Import pillars first
- Then themes (linked to pillars)
- Then sub-themes (linked to themes)
- Finally indicators (linked to sub-themes)

#### Option B: Manual SQL Import

If you have the exported data, you can import manually:

```sql
-- 1. Import Pillars
INSERT INTO framework_pillars (code, name, description, order_index, is_active)
VALUES 
  ('P1', 'The Shelter', 'Structural safety & direct exposure of homes', 1, true),
  ('P2', 'The Living Conditions', 'Physical & socioeconomic fragility factors', 2, true),
  ('P3', 'The Settlement', 'Readiness of services, governance & access', 3, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  order_index = EXCLUDED.order_index;

-- 2. Get pillar IDs for reference
SELECT id, code FROM framework_pillars;

-- 3. Import Themes (replace pillar_id with actual IDs)
INSERT INTO framework_themes (pillar_id, code, name, description, order_index, is_active)
VALUES 
  ((SELECT id FROM framework_pillars WHERE code = 'P1'), 'P1-T1', 'Theme Name', 'Description', 1, true)
ON CONFLICT (pillar_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  order_index = EXCLUDED.order_index;

-- 4. Import Sub-themes (similar pattern)
-- 5. Import Indicators (similar pattern)
```

### Step 5: Link Datasets to Indicators

After importing the structure, link existing datasets to indicators:

```sql
-- Link datasets based on indicator_id in datasets table
INSERT INTO dataset_indicators (dataset_id, indicator_id)
SELECT 
  d.id as dataset_id,
  i.id as indicator_id
FROM datasets d
JOIN framework_indicators i ON d.indicator_id = i.id
WHERE d.indicator_id IS NOT NULL
ON CONFLICT (dataset_id, indicator_id) DO NOTHING;
```

### Step 6: Verify Import

Check that everything imported correctly:

```sql
-- View complete structure
SELECT * FROM get_framework_structure();

-- Count by level
SELECT 
  (SELECT COUNT(*) FROM framework_pillars WHERE is_active = true) as pillars,
  (SELECT COUNT(*) FROM framework_themes WHERE is_active = true) as themes,
  (SELECT COUNT(*) FROM framework_subthemes WHERE is_active = true) as subthemes,
  (SELECT COUNT(*) FROM framework_indicators WHERE is_active = true) as indicators;

-- View structure hierarchy
SELECT 
  p.code as pillar,
  t.code as theme,
  st.code as subtheme,
  i.code as indicator,
  i.name as indicator_name
FROM framework_pillars p
LEFT JOIN framework_themes t ON t.pillar_id = p.id
LEFT JOIN framework_subthemes st ON st.theme_id = t.id
LEFT JOIN framework_indicators i ON i.subtheme_id = st.id
WHERE p.is_active = true
ORDER BY p.order_index, t.order_index, st.order_index, i.order_index;
```

## Data Structure Reference

### Pillar Structure
```json
{
  "code": "P1",
  "name": "The Shelter",
  "description": "Structural safety & direct exposure of homes",
  "order_index": 1
}
```

### Theme Structure
```json
{
  "pillar_code": "P1",
  "code": "P1-T1",
  "name": "Theme Name",
  "description": "Theme description",
  "order_index": 1
}
```

### Sub-theme Structure
```json
{
  "theme_code": "P1-T1",
  "code": "P1-T1-ST1",
  "name": "Sub-theme Name",
  "description": "Sub-theme description",
  "order_index": 1
}
```

### Indicator Structure
```json
{
  "subtheme_code": "P1-T1-ST1",
  "code": "P1-T1-ST1-I1",
  "name": "Indicator Name",
  "description": "Indicator description",
  "data_type": "numeric",
  "unit": "percentage",
  "order_index": 1
}
```

## Troubleshooting

### No tables found in source
- The source database might use different table names
- Check for variations: `ssc_pillars`, `framework_pillars`, `pillars`
- Check if structure is stored in JSONB columns in other tables

### Import errors
- Verify foreign key relationships (pillar → theme → subtheme → indicator)
- Check that codes match between levels
- Ensure `order_index` values are provided

### Missing relationships
- If themes/sub-themes/indicators reference parent by code instead of ID, you'll need to map codes to IDs during import
- The Python script handles this automatically

### Data type mismatches
- Ensure `data_type` values are: 'numeric', 'categorical', or 'both'
- Check that `order_index` is an integer

## Next Steps

After migration:
1. Review the imported structure in the UI (when framework management UI is built)
2. Link existing datasets to indicators
3. Use the framework structure for dataset categorization
4. Build UI components to browse/edit the framework structure
