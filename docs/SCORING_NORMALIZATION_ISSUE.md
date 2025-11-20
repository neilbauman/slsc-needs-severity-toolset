# Scoring Normalization Issue - Affected Area Scope

## Problem

When using "Affected Area Only" normalization scope with `score_numeric_auto` RPC:
- **Expected**: Scores should span the full range (1 to scaleMax, e.g., 1-5)
- **Actual**: Scores only span a subset (e.g., 3-4 instead of 1-5)

## Root Cause

The `score_numeric_auto` RPC function is not correctly calculating min/max values when `in_limit_to_affected = true`.

## Current Behavior

Based on console output and testing:
- Parameters are being sent correctly:
  - `method: 'minmax'`
  - `scaleMax: 5`
  - `limitToAffected: true`
  - `inverse: true`
- But scores range from 3.00 to 4.00 instead of 1.00 to 5.00

## Expected RPC Behavior

When `in_limit_to_affected = true` and `in_method = 'minmax'`:

1. **Calculate min/max from ONLY affected area data:**
   ```sql
   -- Get affected ADM3 codes from instance's admin_scope (ADM2 codes)
   WITH affected_adm3 AS (
     SELECT admin_pcode 
     FROM admin_boundaries 
     WHERE admin_level = 'ADM3' 
     AND parent_pcode IN (SELECT unnest(in_instance.admin_scope))
   )
   SELECT MIN(value), MAX(value)
   FROM dataset_values_numeric
   WHERE dataset_id = in_dataset_id
     AND admin_pcode IN (SELECT admin_pcode FROM affected_adm3)
   ```

2. **Normalize using affected area's min/max:**
   ```sql
   -- For each value in affected area:
   score = 1 + (value - min_affected) / (max_affected - min_affected) * (in_scale_max - 1)
   
   -- If in_inverse = true:
   score = in_scale_max - (score - 1)  -- Invert the range
   ```

3. **Result should span 1 to scaleMax:**
   - Minimum value in affected area → score of 1 (or scaleMax if inverse)
   - Maximum value in affected area → score of scaleMax (or 1 if inverse)

## Current RPC Issue

The RPC is likely:
- Using the entire country's min/max for normalization, OR
- Not properly filtering to affected areas when calculating min/max, OR
- Applying normalization incorrectly

## How to Fix

The RPC function `score_numeric_auto` in Supabase needs to be updated to:

1. **When `in_limit_to_affected = true`:**
   - First, get affected ADM3 codes from the instance's `admin_scope`
   - Calculate min/max from ONLY those affected ADM3 areas
   - Use those min/max values for normalization

2. **When `in_limit_to_affected = false`:**
   - Calculate min/max from entire country
   - Use those for normalization

## Testing

After fixing the RPC:

1. Select "Affected Area Only" scope
2. Set scale to 1-5
3. Apply scoring
4. Preview should show:
   - Min: 1.00
   - Max: 5.00
   - All scores should span this range

## Related Files

- `components/NumericScoringModal.tsx` - Frontend component (parameters are correct)
- Supabase RPC: `score_numeric_auto` - Needs to be fixed

## Console Output Reference

```
Applying scoring with: {
  method: 'minmax',
  scaleMax: 5,
  inverse: true,
  scope: 'affected',
  limitToAffected: true
}

Preview scores: {
  scope: 'affected',
  count: 53,
  min: 3,        // ❌ Should be 1
  max: 4,        // ❌ Should be 5
  avg: 3.58
}
```

