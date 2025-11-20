# Supabase Database Schema Documentation

This document provides comprehensive documentation of the Supabase database schema, tables, and RPC functions used in the Philippines SSC Toolset application.

## Table of Contents
- [Core Tables](#core-tables)
- [RPC Functions](#rpc-functions)
- [Data Relationships](#data-relationships)
- [Common Queries](#common-queries)

## Core Tables

### `datasets`
Primary table storing dataset metadata.

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique dataset identifier |
| `name` | TEXT | NOT NULL | Dataset name |
| `description` | TEXT | NULL | Optional description |
| `admin_level` | TEXT | NOT NULL, CHECK (char_length > 0) | Administrative level (ADM1-ADM4) |
| `type` | TEXT | NOT NULL, CHECK (IN ('numeric', 'categorical')) | Dataset type |
| `indicator_id` | UUID | NULL | Optional indicator reference |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| `is_baseline` | BOOLEAN | NULL | Whether this is a baseline dataset |
| `is_derived` | BOOLEAN | NULL | Whether dataset is derived from others |
| `metadata` | JSONB | NULL | Additional metadata (flexible structure) |
| `uploaded_by` | UUID | NULL | User ID who uploaded |
| `collected_at` | DATE | NULL | Data collection date |
| `source` | TEXT | NULL | Data source information |

**Indexes:** (Assumed - verify in Supabase dashboard)
- Primary key on `id`
- Consider indexes on `type`, `admin_level`, `is_derived` for common queries

### `dataset_values_numeric`
Stores numeric values for numeric-type datasets.

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique row identifier |
| `dataset_id` | UUID | NOT NULL, FK → datasets(id) ON DELETE CASCADE | Reference to dataset |
| `admin_pcode` | TEXT | NOT NULL | Administrative area code (e.g., "PH001") |
| `value` | NUMERIC | NOT NULL | The numeric value |

**Indexes:** (Recommended)
- Primary key on `id`
- Index on `dataset_id` for joins
- Composite index on `(dataset_id, admin_pcode)` for lookups

### `dataset_values_categorical`
Stores categorical values for categorical-type datasets.

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique row identifier |
| `dataset_id` | UUID | NOT NULL, FK → datasets(id) ON DELETE CASCADE | Reference to dataset |
| `admin_pcode` | TEXT | NOT NULL | Administrative area code |
| `category` | TEXT | NOT NULL | Category name/label |
| `value` | NUMERIC | NULL | Optional numeric value for category |

**Indexes:** (Recommended)
- Primary key on `id`
- Index on `dataset_id` for joins
- Composite index on `(dataset_id, admin_pcode, category)` for lookups

### Additional Tables (Referenced in Application Code)

These tables are referenced in the codebase but schema definitions should be verified in Supabase:

#### `instances`
Stores instance configurations for scoring and analysis.
- Likely contains: `id`, `name`, `description`, `created_at`, `config` (JSONB)

#### `instance_datasets`
Links datasets to instances.
- Likely contains: `instance_id`, `dataset_id`, `config` (JSONB), `order`

#### `instance_dataset_scores`
Stores computed scores for datasets within instances.
- Likely contains: `instance_id`, `dataset_id`, `admin_pcode`, `score`, `computed_at`

#### `affected_areas`
Stores affected area definitions for instances.
- Likely contains: `instance_id`, `admin_pcode`, `admin_level`, `is_affected`

#### `admin_boundaries`
Stores administrative boundary geometries.
- Likely contains: `admin_pcode`, `admin_level`, `name`, `geometry` (PostGIS), `parent_pcode`

## RPC Functions

### Dataset Management

#### `derive_dataset`
Creates a derived dataset from one or more base datasets.

**Parameters:** (Accepts flexible JSON body)
- Base dataset IDs
- Formula/expression
- Target admin level
- Weighting configuration
- Alignment method

**Returns:** Created dataset information

**Usage Location:** `app/api/deriveDataset/route.ts`

---

#### `preview_derived_dataset`
Preview a derived dataset calculation without creating it.

**Parameters:**
- `base_dataset_ids` (UUID[]): Array of base dataset IDs
- `formula` (TEXT): Mathematical formula (e.g., "A + B", "A * 0.5")
- `target_level` (TEXT): Target admin level (ADM1-ADM4)
- `weight_dataset_id` (UUID, optional): Dataset ID to use for weighting
- `alignment_method` (TEXT, default: 'keep'): How to handle level mismatches

**Returns:** Array of preview rows with calculated values

**Usage Location:** `components/DerivedDatasetPreviewModal.tsx`

---

#### `preview_derived_dataset_v3`
Enhanced version of preview with additional features.

**Parameters:** Similar to `preview_derived_dataset` with additional options

**Usage Location:** `components/DeriveDatasetModal.tsx`

---

#### `materialize_derived_dataset_v3`
Creates the actual derived dataset after preview.

**Parameters:** Same as preview functions, plus:
- `name` (TEXT): Name for the new dataset
- `description` (TEXT, optional): Description

**Returns:** Created dataset ID and metadata

**Usage Location:** `components/DeriveDatasetModal.tsx`

---

#### `transform_admin_level`
Transforms a dataset to a different administrative level.

**Parameters:**
- `source_id` (UUID): Source dataset ID
- `target_admin_level` (TEXT): Target level ('ADM1', 'ADM2', 'ADM3', 'ADM4')
- `method` (TEXT): Transformation method
  - `'sum'`: Aggregate up by summing values
  - `'average'`: Aggregate up by averaging values
  - `'distribute'`: Disaggregate down by distributing values

**Returns:** Transformation result with new dataset ID or updated rows

**Usage Location:** `components/TransformDatasetModal.tsx`

---

### Dataset Cleaning

#### `preview_numeric_cleaning_v2`
Preview cleaning operations for numeric datasets.

**Parameters:**
- `_dataset_id` (UUID): Dataset ID to preview cleaning for

**Returns:** Array of preview data showing:
- Original values
- Proposed cleaned values
- Cleaning rules applied
- Statistics (outliers, missing values, etc.)

**Usage Locations:**
- `lib/supabasePreview.ts`
- `components/CleanDatasetModal.tsx`

---

#### `preview_categorical_cleaning`
Preview cleaning operations for categorical datasets.

**Parameters:**
- Dataset ID

**Returns:** Preview of cleaning operations

**Usage Location:** `components/CleanDatasetModal.tsx`

---

#### `preview_categorical_cleaning_v2`
Enhanced preview for categorical cleaning.

**Parameters:**
- Dataset ID
- Cleaning configuration (optional)

**Usage Location:** `components/CleanCategoricalDatasetModal.tsx`

---

#### `clean_numeric_dataset`
Applies cleaning operations to a numeric dataset.

**Parameters:**
- `dataset_id` (UUID): Dataset to clean
- `rules` (JSONB): Cleaning rules configuration
  - Outlier detection thresholds
  - Missing value handling
  - Value normalization rules

**Returns:** Cleaning result with statistics

**Usage Location:** `components/CleanNumericDatasetModal.tsx`

---

#### `clean_categorical_dataset`
Applies cleaning operations to a categorical dataset.

**Parameters:**
- `dataset_id` (UUID): Dataset to clean
- `rules` (JSONB): Cleaning rules
  - Category standardization
  - Missing category handling
  - Value normalization

**Returns:** Cleaning result

**Usage Location:** `components/CleanCategoricalDatasetModal.tsx`

---

### Scoring Functions

#### `score_numeric_auto`
Automatically scores numeric datasets using configurable methods.

**Parameters:**
- `in_instance_id` (UUID): Instance ID
- `in_dataset_id` (UUID): Dataset ID to score
- `in_method` (TEXT): Scoring method
  - `'threshold'`: Threshold-based scoring
  - `'minmax'`: Min-max normalization
  - `'zscore'`: Z-score normalization
- `in_thresholds` (JSONB): Array of threshold objects
  ```json
  [
    { "min": 0, "max": 10, "score": 1 },
    { "min": 10, "max": 20, "score": 2 }
  ]
  ```
- `in_scale_max` (NUMERIC): Maximum score value (e.g., 5, 10, 100)
- `in_inverse` (BOOLEAN): Whether to invert scores (higher values = lower scores)
- `in_limit_to_affected` (BOOLEAN): Only score affected areas

**Returns:** Scoring result with statistics

**Usage Location:** `components/NumericScoringModal.tsx`

---

#### `score_building_typology`
Scores categorical datasets using building typology method.

**Parameters:**
- `in_category_scores` (JSONB): Category to score mappings
  ```json
  [
    { "category": "Concrete", "score": 5 },
    { "category": "Wood", "score": 3 },
    { "category": "Mixed", "score": 4 }
  ]
  ```
- `in_dataset_id` (UUID): Dataset ID
- `in_instance_id` (UUID): Instance ID
- `in_method` (TEXT): Aggregation method
- `in_threshold` (NUMERIC): Threshold value for scoring

**Returns:** Scoring result

**Usage Location:** `components/CategoricalScoringModal.tsx`

---

#### `score_framework_aggregate`
Aggregates pillar scores (P1, P2, P3) into framework rollup dataset.

**Parameters:**
- `in_instance_id` (UUID): Instance ID
- `in_config` (JSONB, optional): Configuration object
  ```json
  {
    "methods": {
      "P1": "weighted_mean",
      "P2": "weighted_mean",
      "P3": "weighted_mean"
    },
    "weights": {
      "P1": 1,
      "P2": 1,
      "P3": 1
    }
  }
  ```

**Returns:**
```json
{
  "status": "done",
  "upserted_rows": 150,
  "framework_avg": 3.45
}
```

**Usage Locations:**
- `components/ComputeFrameworkRollupButton.tsx`
- `components/FrameworkScoringModal.tsx`
- `components/InstanceRecomputePanel.tsx`

**Notes:**
- Supports two signatures: `(in_instance_id)` and `(in_config, in_instance_id)`
- Falls back to default config if simple signature fails

---

#### `score_final_aggregate`
Aggregates framework scores into final rollup dataset.

**Parameters:**
- `in_instance_id` (UUID): Instance ID

**Returns:**
```json
{
  "status": "done",
  "upserted_rows": 150,
  "final_avg": 3.50
}
```

**Usage Locations:**
- `components/ComputeFinalRollupButton.tsx`
- `components/InstanceRecomputePanel.tsx`

---

#### `score_instance_overall`
Computes overall instance score.

**Parameters:**
- `in_instance_id` (UUID): Instance ID

**Returns:** Overall score and statistics

**Usage Location:** `components/InstanceScoringModal.tsx`

---

### Administrative & Geographic Functions

#### `get_affected_adm3`
Retrieves affected ADM3 administrative areas for an instance.

**Parameters:**
- Instance ID or area configuration

**Returns:** Array of affected ADM3 codes and metadata

**Usage Location:** `components/DefineAffectedAreaModal.tsx`

---

#### `get_admin_boundaries_list`
Lists administrative boundaries with metadata.

**Parameters:**
- `admin_level` (TEXT, optional): Filter by level
- `parent_pcode` (TEXT, optional): Filter by parent
- `search` (TEXT, optional): Search by name

**Returns:** Array of boundary objects:
```json
[
  {
    "admin_pcode": "PH001",
    "admin_level": "ADM3",
    "name": "Manila",
    "parent_pcode": "PH001001"
  }
]
```

**Usage Location:** `components/AffectedAreaModal.tsx`

---

#### `get_admin_boundaries_geojson`
Retrieves administrative boundaries as GeoJSON for mapping.

**Parameters:**
- `admin_pcodes` (TEXT[], optional): Specific codes to retrieve
- `admin_level` (TEXT, optional): Filter by level
- `parent_pcode` (TEXT, optional): Filter by parent

**Returns:** GeoJSON FeatureCollection

**Usage Location:** `components/AffectedAreaModal.tsx`

---

## Data Relationships

```
datasets (1) ──< (many) dataset_values_numeric
datasets (1) ──< (many) dataset_values_categorical
instances (1) ──< (many) instance_datasets ──> (many) datasets
instances (1) ──< (many) instance_dataset_scores ──> (many) datasets
instances (1) ──< (many) affected_areas
```

## Common Queries

### Get all numeric values for a dataset
```sql
SELECT admin_pcode, value
FROM dataset_values_numeric
WHERE dataset_id = $1
ORDER BY admin_pcode;
```

### Get categorical values grouped by area
```sql
SELECT admin_pcode, category, value
FROM dataset_values_categorical
WHERE dataset_id = $1
ORDER BY admin_pcode, category;
```

### Get scores for an instance
```sql
SELECT ids.admin_pcode, ids.score, d.name as dataset_name
FROM instance_dataset_scores ids
JOIN datasets d ON d.id = ids.dataset_id
WHERE ids.instance_id = $1
ORDER BY d.name, ids.admin_pcode;
```

## Notes for Development

1. **Always verify RPC signatures** in Supabase dashboard before using
2. **Handle errors gracefully** - RPCs may return errors for invalid parameters
3. **Use transactions** where multiple related operations are needed
4. **Consider performance** - Some RPCs may be computationally expensive
5. **Cache results** where appropriate for frequently accessed data
6. **Validate admin levels** - Ensure consistency (ADM1 > ADM2 > ADM3 > ADM4)
7. **Check data types** - Numeric vs categorical datasets require different handling

## Schema Evolution

When adding new tables or modifying existing ones:
1. Update `supabase/schema.sql` with the changes
2. Update this documentation
3. Update `.cursorrules` if new patterns emerge
4. Test migrations in development before production

