# Deploy Method Comparison Functions

To enable the method comparison feature, you need to deploy the following SQL functions to your Supabase database.

## Quick Deployment Steps

1. **Open Supabase SQL Editor**
   - Go to your Supabase Dashboard
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

2. **Deploy in this order:**

   a. **Create Comparison Table**
      - Open `supabase/create_instance_category_scores_comparison_table.sql`
      - Copy entire contents
      - Paste into SQL Editor
      - Click "Run"
      - Should see "Success. No rows returned"

   b. **Create Comparison Calculation Function**
      - Open `supabase/score_final_aggregate_all_methods.sql`
      - Copy entire contents
      - Paste into SQL Editor
      - Click "Run"
      - Should see "Success. No rows returned"

   c. **Create Comparison Retrieval Function**
      - Open `supabase/get_method_comparison.sql`
      - Copy entire contents
      - Paste into SQL Editor
      - Click "Run"
      - Should see "Success. No rows returned"

3. **Verify Functions**
   - Go to "Database" → "Functions" in Supabase Dashboard
   - You should see:
     - `score_final_aggregate_all_methods`
     - `get_method_comparison`

## What These Functions Do

- **`instance_category_scores_comparison` table**: Stores scores calculated using different methods for comparison
- **`score_final_aggregate_all_methods`**: Calculates overall scores using all available methods (weighted_mean, geometric_mean, power_mean, owa_optimistic, owa_pessimistic)
- **`get_method_comparison`**: Retrieves comparison data for display in the UI

## Troubleshooting

If you get errors:
- Make sure you're running the SQL files in order
- Check that the `instance_category_scores` table exists
- Verify that you have the required permissions on your Supabase project

