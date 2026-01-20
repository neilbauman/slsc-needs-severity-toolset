# Fix for Preview PCode Alignment Timeout

## Problem
The `preview_pcode_alignment` function was timing out on large datasets (14K+ rows) because it was trying to process all rows for the preview.

## Solution
Added a `preview_limit` parameter (default: 500) to only process a sample of rows for preview purposes. The preview is just to show how matching will work, so we don't need all rows.

## How to Apply

1. **Apply the updated migration:**
   - Run `supabase/migrations/22_fix_preview_pcode_alignment_function.sql` in your Supabase SQL Editor
   - This adds the `preview_limit` parameter with a default of 500 rows

2. **The preview will now:**
   - Process only the first 500 distinct PCodes (instead of all 14K+)
   - Complete much faster and avoid timeouts
   - Still give you a good sense of how matching works

3. **Note:**
   - The actual cleaning function (`clean_categorical_dataset_v3`) will still process ALL rows
   - The preview limit only affects the preview display
   - You can still skip the preview and go straight to cleaning if needed

## Alternative: Skip Preview

If you still want to skip the preview step:
1. Click "Next" on the PCode Alignment step (even without preview)
2. The cleaning will process all rows regardless of preview
