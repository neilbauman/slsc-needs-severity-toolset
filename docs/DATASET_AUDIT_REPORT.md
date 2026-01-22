# Dataset Audit Report

## Executive Summary

**Total Datasets Audited:** 32  
**Status:**
- ✓ OK: 10 datasets (31%)
- ⚠️ Warnings: 3 datasets (9%)
- ❌ Errors: 19 datasets (59%)

## Key Findings

### 1. Duplicate Datasets
- **Palestine**: 2 duplicate "Palestine Population - ADM1" datasets
- **Madagascar**: 2 duplicate "Madagascar Population - ADM4" datasets

**Recommendation:** Remove duplicate datasets, keeping the most recent or most complete version.

### 2. Coverage Issues

#### Bangladesh (BGD)
- **Population - ADM3**: 0% coverage (0/507 boundaries)
  - **Issue**: PCode format mismatch
  - Population pcodes: `BD100409`, `BD100419` (8-9 characters)
  - Boundary pcodes: `BD20030004`, `BD20030014` (10 characters)
  - **Root Cause**: Different pcode schemas between population data and boundaries

#### Madagascar (MDG)
- **Population - ADM4**: 6.1% - 12.9% coverage (61-129/1000 boundaries)
  - **Issue**: Significant pcode mismatch
  - Population dataset has 17,465 values but only 61-129 match boundaries
  - **Root Cause**: PCode format differences or missing boundaries

#### Philippines (PHL)
- **Population Density - ADM4**: 1.0% coverage (10/1000 boundaries)
- **Population 2020 Adm4**: 0% coverage (0/1000 boundaries)
- **Population Density (Adm4)**: 35.7% coverage (357/1000 boundaries)
- **Multiple datasets with lowercase admin_level**: `adm2`, `adm3`, `adm4`
  - Boundaries use uppercase: `ADM2`, `ADM3`, `ADM4`
  - **Root Cause**: Case sensitivity mismatch

#### Sri Lanka (LKA)
- **Population - ADM2**: No boundaries at ADM2 level
  - Population data exists at ADM2, but boundaries only at ADM1, ADM3, ADM4
  - **Note**: Density dataset correctly uses ADM1 with aggregated data

### 3. PCode Alignment Issues

#### Bangladesh
- Complete mismatch between population and boundary pcodes
- Requires pcode mapping or re-import with correct pcode format

#### Madagascar
- Partial mismatch - only 6-13% of population pcodes match boundaries
- May require pcode normalization or boundary re-import

#### Mozambique
- 97.5% coverage - missing 4 boundaries: `MZ1112`, `MZ0807`, `MZ0804`, `MZ0805`
- **Recommendation**: Add missing population values for these boundaries

#### Philippines
- Case sensitivity issues with admin_level
- Some datasets have orphaned pcodes (data without boundaries)
- **Recommendation**: Normalize admin_level to uppercase

### 4. Data Quality Issues

#### Empty Datasets
- **Bangladesh Population Density - ADM3**: No values (due to pcode mismatch)
- **Building Typology (ADM3)**: No values

#### Missing Boundaries
Multiple datasets reference admin levels that don't have boundaries:
- Philippines: `adm2`, `adm3`, `adm4` (lowercase) - boundaries exist at uppercase levels
- Sri Lanka: `ADM2` - no boundaries at this level

### 5. Uniqueness Issues

#### Duplicate Datasets
- Palestine: 2 identical population datasets
- Madagascar: 2 identical population datasets

#### Duplicate Values
- No duplicate pcode values found within individual datasets (good!)

## Recommendations by Priority

### High Priority

1. **Fix Bangladesh PCode Alignment**
   - Investigate pcode schema differences
   - Create mapping table or re-import with consistent pcode format
   - **Impact**: Enables population density calculation

2. **Normalize Philippines Admin Levels**
   - Update all datasets with lowercase `adm*` to uppercase `ADM*`
   - **Impact**: Fixes 12 datasets with "no boundaries found" errors

3. **Remove Duplicate Datasets**
   - Delete duplicate Palestine and Madagascar population datasets
   - **Impact**: Reduces confusion and data inconsistency

4. **Fix Madagascar Coverage**
   - Investigate pcode format differences
   - Re-import boundaries or normalize pcodes
   - **Impact**: Improves coverage from 6-13% to near 100%

### Medium Priority

5. **Add Missing Mozambique Values**
   - Add population data for 4 missing boundaries: `MZ1112`, `MZ0807`, `MZ0804`, `MZ0805`
   - **Impact**: Improves coverage from 97.5% to 100%

6. **Fix Philippines Coverage Issues**
   - Investigate why population density has only 1-36% coverage
   - Check pcode alignment for ADM4 datasets
   - **Impact**: Enables accurate density calculations

7. **Clean Up Empty Datasets**
   - Remove or fix datasets with no values
   - **Impact**: Reduces clutter and confusion

### Low Priority

8. **Standardize Admin Level Naming**
   - Ensure all datasets use consistent admin level format (ADM1, ADM2, etc.)
   - **Impact**: Prevents future case sensitivity issues

9. **Add Missing Boundaries**
   - Import ADM2 boundaries for Sri Lanka if available
   - **Impact**: Enables direct ADM2 population density calculation

## Country-by-Country Status

### Bangladesh (BGD)
- **Status**: ❌ Critical Issues
- **Issues**: PCode mismatch (0% coverage)
- **Action Required**: PCode alignment/mapping

### Madagascar (MDG)
- **Status**: ❌ Critical Issues
- **Issues**: Low coverage (6-13%), duplicate datasets
- **Action Required**: PCode alignment, remove duplicates

### Mozambique (MOZ)
- **Status**: ⚠️ Minor Issues
- **Issues**: 97.5% coverage (missing 4 boundaries)
- **Action Required**: Add missing values

### Palestine (PSE)
- **Status**: ✓ Good
- **Issues**: Duplicate datasets (non-critical)
- **Action Required**: Remove duplicates

### Philippines (PHL)
- **Status**: ❌ Critical Issues
- **Issues**: Case sensitivity, low coverage, orphaned pcodes
- **Action Required**: Normalize admin levels, fix coverage

### Sri Lanka (LKA)
- **Status**: ⚠️ Minor Issues
- **Issues**: No ADM2 boundaries (but ADM1 density works)
- **Action Required**: Optional - import ADM2 boundaries

## Next Steps

1. Run pcode alignment scripts for Bangladesh and Madagascar
2. Normalize Philippines admin levels (lowercase → uppercase)
3. Remove duplicate datasets
4. Add missing Mozambique values
5. Re-run audit to verify fixes
