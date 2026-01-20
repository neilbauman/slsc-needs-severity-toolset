# Quick Database Migration Guide

Your app is deployed! 🎉 But you need to run database migrations in Supabase to fix the warning.

## Step 1: Open Supabase SQL Editor

1. Go to: https://supabase.com/dashboard/project/yzxmxwppzpwfolkdiuuo
2. Click **SQL Editor** (left sidebar)
3. Click **New Query**

## Step 2: Run Essential Migrations

Run these migrations **in order**:

### Migration 1: Countries Table
Run the contents of: `supabase/migrations/add_countries.sql`

This creates the `countries` table and adds initial countries (Philippines, Bangladesh, Myanmar).

### Migration 2: Complete Schema Setup
Run the contents of: `supabase/migrations/01_complete_schema_setup.sql`

This creates all core tables (datasets, instances, admin_boundaries, etc.).

### Migration 3: Country Isolation
Run the contents of: `supabase/migrations/add_country_isolation.sql`

This adds `country_id` columns to existing tables.

### Migration 4: All Other Migrations
Run the contents of: `supabase/migrations/00_run_all_migrations.sql`

This runs all remaining migrations in order.

## Alternative: Run All at Once

If you want to run everything in one go, you can:

1. Open `supabase/migrations/00_run_all_migrations.sql`
2. Copy the entire file
3. Paste into Supabase SQL Editor
4. Click **Run** (or press Cmd/Ctrl + Enter)

## Verify It Worked

After running migrations:

1. Go back to your Vercel app: `https://slsc-needs-severity-toolset.vercel.app`
2. Refresh the page
3. The warning banner should disappear
4. Countries should load quickly

## Need Help?

If you see errors:
- Check which migration failed
- Make sure you're running them in order
- Some migrations might already be applied (that's okay - they use `IF NOT EXISTS`)
