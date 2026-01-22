# Sri Lanka Dataset Health Metrics Explanation

## Overview

Sri Lanka datasets show mixed health metrics. Two datasets are perfect (100% alignment), but one shows 0% due to missing administrative boundaries.

## Dataset Status

### ✅ Ready Datasets (100% Alignment)

1. **Sri Lanka Population Density - ADM1**
   - Alignment: 100%
   - Coverage: 100%
   - Completeness: 100%
   - Status: Ready ✅
   - **Note**: This is an aggregated dataset that combines ADM2 population data to ADM1 level

2. **Sri Lanka Poverty Rate (Headcount Ratio) - ADM1**
   - Alignment: 100%
   - Coverage: 100%
   - Completeness: 100%
   - Status: Ready ✅

### ❌ Needs Attention Dataset (0% Alignment)

**Sri Lanka Population - ADM2**
- Alignment: 0%
- Coverage: 0%
- Completeness: 0%
- Status: Needs attention ⚠️

## Root Cause: Missing ADM2 Boundaries

**The Problem:**
- Population data exists: **25 values** at ADM2 level
- Administrative boundaries: **0 boundaries** at ADM2 level
- **Result**: 0% alignment because there are no boundaries to match the data against

**Available Admin Levels in Sri Lanka:**
- ADM1: 9 boundaries ✅
- ADM2: **0 boundaries** ❌ (missing)
- ADM3: 39 boundaries ✅
- ADM4: 50 boundaries ✅

## Why This Happens

Sri Lanka's administrative structure doesn't include ADM2 boundaries in the database. The population data was imported at ADM2 level (likely from HDX or another source), but the corresponding boundaries were never imported or don't exist in the source data.

## Solutions

### Option 1: Use ADM1 Aggregated Dataset ✅ Recommended
- **Use**: "Sri Lanka Population Density - ADM1"
- This dataset already aggregates ADM2 population to ADM1 level
- Works perfectly with 100% alignment
- **This is the current workaround**

### Option 2: Import ADM2 Boundaries
- If ADM2 boundaries are available from HDX or another source
- Import them using the `import_admin_boundaries` RPC function
- This would enable the ADM2 population dataset to work

### Option 3: Aggregate ADM2 Population to ADM1
- Create a new dataset that aggregates the 25 ADM2 population values to ADM1
- Similar to what was done for the density dataset
- Would provide ADM1-level population data

## Summary Table

| Dataset | Alignment | Status | Issue | Solution |
|---------|-----------|--------|-------|----------|
| Population Density - ADM1 | 100% | Ready ✅ | None | Use this one |
| Poverty Rate - ADM1 | 100% | Ready ✅ | None | Perfect |
| Population - ADM2 | 0% | Needs attention ⚠️ | No ADM2 boundaries | Use ADM1 density dataset instead |

## Technical Details

**Why Completeness is 0%:**
- When there are no boundaries at a given admin level, the health calculation can't determine completeness
- The dataset has 25 values, but with 0 boundaries, the calculation results in 0/0 = undefined, which defaults to 0%

**Why This is Different from Bangladesh:**
- **Bangladesh**: Boundaries exist but pcode formats don't match (BD1 vs BD2)
- **Sri Lanka**: Boundaries simply don't exist at ADM2 level
- **Solution**: Bangladesh needs pcode mapping; Sri Lanka needs boundary import or aggregation

## Recommendation

✅ **Use "Sri Lanka Population Density - ADM1"** for all analysis. It's already aggregated and works perfectly.

❌ **Do not use "Sri Lanka Population - ADM2"** until ADM2 boundaries are imported or the data is aggregated to ADM1.
