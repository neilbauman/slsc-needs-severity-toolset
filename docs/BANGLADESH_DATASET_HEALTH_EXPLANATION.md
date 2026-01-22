# Bangladesh Dataset Health Metrics Explanation

## Overview

The Bangladesh datasets show different health metrics at ADM2 vs ADM3 levels due to a **pcode format mismatch** between the population data and administrative boundaries.

## The Problem

### ADM3 Datasets (0% Alignment)

**Bangladesh Population - ADM3** and **Bangladesh Population Density - ADM3** show:
- **Alignment: 0%**
- **Coverage: 0%**
- **Completeness: 100%** (for population - data exists but doesn't match)
- **Status: Needs attention**

**Root Cause:**
- Population data uses **BD1 prefix** format: `BD100409`, `BD100419`, `BD100428` (8-9 characters)
- Administrative boundaries use **BD2 prefix** format: `BD20030004`, `BD20030014` (10 characters)
- These are **completely different pcode schemas** that don't match

**What this means:**
- The population data **exists** (544 values for ADM3)
- The boundaries **exist** (507 ADM3 boundaries)
- But **none of the pcodes match**, so alignment = 0%

### ADM2 Datasets (100% Alignment)

**Bangladesh Population - ADM2 (Aggregated)** and **Bangladesh Population Density - ADM2** show:
- **Alignment: 100%**
- **Coverage: 100%**
- **Completeness: 100%**
- **Status: Ready**

**Why this works:**
- This is a **workaround** that aggregates ADM3 population data to ADM2 level
- ADM2 pcodes (first 6 characters: `BD1004`) **do match** the boundary format
- Example: `BD100409` → aggregated to `BD1004` (ADM2) → matches boundary `BD1004`

## Health Metrics Definitions

### Alignment
- **Definition**: Percentage of boundaries that have matching data values
- **Calculation**: `(matched pcodes) / (total boundaries) × 100`
- **ADM3**: 0/507 = 0% (no matches)
- **ADM2**: 64/64 = 100% (all match)

### Coverage
- **Definition**: Same as alignment for numeric datasets
- **ADM3**: 0% (no boundaries covered)
- **ADM2**: 100% (all boundaries covered)

### Completeness
- **Definition**: Percentage of data values that are non-null and non-zero
- **ADM3 Population**: 100% (all 544 values are valid numbers)
- **ADM3 Density**: 0% (no values because can't calculate without matching boundaries)

## Why "100% Complete but 0% Coverage"?

For **Bangladesh Population - ADM3**:
- **Completeness: 100%** = All 544 population values are valid numbers (not null, not zero)
- **Coverage: 0%** = None of those 544 pcodes match any of the 507 boundary pcodes
- **Result**: Data is "complete" (all values are good), but "coverage" is 0% because pcodes don't align

## Recommendations

### For Analysis
✅ **Use ADM2 datasets** - They work correctly with 100% alignment
- `Bangladesh Population - ADM2 (Aggregated)`
- `Bangladesh Population Density - ADM2`

### To Fix ADM3 Datasets
1. **Option 1**: Create a pcode mapping table to translate BD1 format → BD2 format
2. **Option 2**: Re-import population data with BD2 format pcodes
3. **Option 3**: Re-import boundaries with BD1 format pcodes

## Summary Table

| Dataset | Alignment | Coverage | Completeness | Status | Use? |
|---------|-----------|----------|--------------|--------|------|
| Population - ADM2 (Aggregated) | 100% | 100% | 100% | Ready | ✅ Yes |
| Population Density - ADM2 | 100% | 100% | 100% | Ready | ✅ Yes |
| Population - ADM3 | 0% | 0% | 100% | Needs attention | ❌ No (use ADM2) |
| Population Density - ADM3 | 0% | 0% | 0% | Needs attention | ❌ No (use ADM2) |
| Poverty Rate - ADM1 | 100% | 100% | 100% | Ready | ✅ Yes |

## Technical Details

**PCode Format Comparison:**
```
Population Data (BD1):  BD100409
                        ││││││││
                        ││││││└─ ADM3 suffix (09)
                        ││││└─── ADM2 code (1004)
                        ││└───── ADM1 code (10)
                        └─────── Country (BD)

Boundary Data (BD2):    BD20030004
                        ││││││││││
                        ││││││││└─ Upazila (0004)
                        │││││││└── District (003)
                        ││││││└─── Division (00)
                        │││││└──── Region (2)
                        └─────── Country (BD)
```

These are fundamentally different administrative coding systems that cannot be automatically matched.
