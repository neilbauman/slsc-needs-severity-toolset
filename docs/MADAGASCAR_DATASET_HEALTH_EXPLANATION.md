# Madagascar Dataset Health Metrics Explanation

## Overview

Most Madagascar datasets show excellent health metrics (100% alignment), but there are two issues that needed clarification:

## Fixed Issues

### 1. Madagascar Population - ADM4: Status Mismatch ✅ FIXED

**Before:**
- Alignment: 100%
- Coverage: 100%
- Completeness: 100%
- **Status: "In cleaning"** ❌ (incorrect)

**After:**
- Alignment: 100%
- Coverage: 100%
- Completeness: 100%
- **Status: "Ready"** ✅ (correct)

**Root Cause:** The dataset had 100% health metrics but the status was manually set to "in_progress" in metadata. The health calculation script now automatically updates status to "ready" when alignment ≥ 95% and completeness ≥ 95%.

### 2. Madagascar Poverty Rate - ADM2: Mislabeled Dataset ⚠️ IDENTIFIED

**Current Status:**
- Alignment: 0%
- Coverage: 0%
- Completeness: 100%
- **Status: "Needs attention"** ✅ (correct)

**Root Cause:** This dataset is **mislabeled**. It contains **ADM1 level data** (22 values with pcodes like `MG11`, `MG12`, `MG13`) but is labeled as **ADM2**. 

**Evidence:**
- Dataset has 22 values with ADM1 pcodes: `MG11`, `MG12`, `MG13`, etc.
- There are 119 ADM2 boundaries with pcodes like `MG52516`, `MG52518`, etc.
- None of the poverty pcodes match ADM2 boundaries (0% alignment)
- All poverty pcodes match ADM1 boundaries (100% match with ADM1)

**Recommendation:**
- ✅ **Use "Madagascar Poverty Rate - ADM1"** instead (this one is correct)
- ❌ **Do not use "Madagascar Poverty Rate - ADM2"** (mislabeled, contains ADM1 data)
- Consider deleting the mislabeled ADM2 dataset or correcting it with actual ADM2-level poverty data

## Summary Table

| Dataset | Alignment | Status | Notes |
|---------|-----------|--------|-------|
| **Population - ADM4** | 100% | Ready ✅ | Fixed: Status now correctly shows "Ready" |
| **Population Density - ADM4** | 100% | Ready ✅ | Perfect health metrics |
| **Poverty Rate - ADM1** | 100% | Ready ✅ | Correct dataset, use this one |
| **Poverty Rate - ADM2** | 0% | Needs attention ⚠️ | Mislabeled: Contains ADM1 data, not ADM2 |

## Technical Details

### Status Determination Logic

The health calculation script now:
1. Calculates health metrics (alignment, coverage, completeness)
2. Determines status based on metrics
3. **Overrides existing status** if health metrics indicate ready (≥95% alignment and completeness)

This ensures that datasets with perfect health metrics always show "Ready" status, even if they were previously marked as "in cleaning" or "in progress".

### PCode Format

**ADM1 pcodes:** `MG11`, `MG12`, `MG13` (4 characters)
**ADM2 pcodes:** `MG52516`, `MG52518` (6 characters)
**ADM4 pcodes:** `MG11101006023` (14 characters)

The poverty dataset labeled as "ADM2" contains ADM1 pcodes, confirming it's mislabeled.
