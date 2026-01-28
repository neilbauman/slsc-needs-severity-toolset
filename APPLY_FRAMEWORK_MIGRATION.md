# Apply Framework Indicators Migration

## Quick Steps

To enable adding indicators to Pillars, Themes, or Subthemes, you need to apply the database migration.

### Method 1: Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project (SLSCToolset)

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

3. **Copy and Paste the Migration**
   - Open the file: `supabase/migrations/53_enhance_framework_indicators_for_all_levels.sql`
   - Copy the entire contents (all 142 lines)
   - Paste into the Supabase SQL Editor

4. **Run the Query**
   - Click "Run" or press `Cmd+Enter` (Mac) / `Ctrl+Enter` (Windows/Linux)
   - You should see "Success. No rows returned"

5. **Verify It Worked**
   - Go to "Database" → "Tables" → "framework_indicators"
   - Check the columns - you should see `pillar_id` and `theme_id` columns
   - Go to "Database" → "Functions" 
   - You should see `get_framework_structure` function updated

### What This Migration Does

- Adds `pillar_id` and `theme_id` columns to `framework_indicators` table
- Makes `subtheme_id` nullable (so indicators can be at any level)
- Adds constraint ensuring each indicator belongs to exactly one parent
- Updates `get_framework_structure()` RPC to include indicators at all levels
- Creates indexes for performance

### After Applying

Once applied, you'll be able to:
- Add indicators directly to Pillars
- Add indicators directly to Themes  
- Add indicators to Subthemes (existing functionality)
- The Framework Structure Manager will show indicators at all levels
