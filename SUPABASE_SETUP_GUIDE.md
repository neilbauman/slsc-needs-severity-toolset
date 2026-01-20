# Supabase Dev Project Setup Guide

## Project Naming

**Recommended Name**: `philippines-ssc-toolset-dev`

Or if you prefer shorter: `phl-ssc-dev`

This makes it clear it's:
- For the Philippines SSC Toolset
- A development environment
- Separate from production

## Step-by-Step Setup

### Step 1: Create the Project

1. Go to https://app.supabase.com
2. Click **"New Project"**
3. Fill in:
   - **Name**: `philippines-ssc-toolset-dev`
   - **Database Password**: (choose a strong password - **SAVE THIS!**)
   - **Region**: Choose closest to you
   - **Pricing Plan**: Free tier is fine for dev
4. Click **"Create new project"**
5. Wait ~2 minutes for project to be created

### Step 2: Get Your Credentials

Once project is created:

1. Go to **Settings** → **API**
2. Copy these values (you'll need them):
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: (long string starting with `eyJ...`)
   - **service_role key**: (keep this secret - for admin operations)

3. **Save these in a secure place!**

### Step 3: Configure Environment Variables

Run this command to set up your `.env.local`:

```bash
bash scripts/setup-dev-env.sh
```

Or manually create/update `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### Step 4: Copy Production Schema to Dev

You need to replicate your production database structure in dev.

**Option A: If you have SQL schema files** (recommended):
1. In dev Supabase, go to **SQL Editor**
2. Run all your existing SQL migrations from `supabase/` folder
3. Start with `schema.sql` if you have it
4. Then run other SQL files in order

**Option B: Export from Production**:
1. In production Supabase, go to **SQL Editor**
2. Use "Export schema" or copy your table definitions
3. Run them in dev Supabase SQL Editor

**Option C: Use Supabase CLI** (if installed):
```bash
# Link to production
supabase link --project-ref <production-ref>

# Pull schema
supabase db pull

# Link to dev
supabase link --project-ref <dev-ref>

# Push schema
supabase db push
```

### Step 5: Run Multi-Country Migrations

1. In dev Supabase, go to **SQL Editor**
2. Open the file: `supabase/migrations/00_run_all_migrations.sql`
3. Copy the entire contents
4. Paste into SQL Editor
5. Click **"Run"** (or press Cmd/Ctrl + Enter)
6. Check the output - should see:
   - "Step 1 complete: Countries table created"
   - "Step 2 complete: User countries table created"
   - "Step 3 complete: Country isolation columns added"
   - "Step 4 complete: Data migrated to Philippines"
   - "Step 5 complete: Verification done"
   - "SUCCESS: All records have country_id assigned"

7. If Step 5 shows SUCCESS, uncomment Step 6 in the script and run it again

### Step 6: Enable Email Authentication

1. In dev Supabase, go to **Authentication** → **Providers**
2. Find **"Email"** provider
3. Make sure it's **Enabled**
4. Configure settings:
   - **Enable email confirmations**: Optional (disable for easier testing)
   - **Secure email change**: Optional
5. Click **"Save"**

### Step 7: Create Test Users

**Via Dashboard** (easiest):
1. Go to **Authentication** → **Users**
2. Click **"Add User"** → **"Create new user"**
3. Enter:
   - **Email**: `test@example.com` (or your email)
   - **Password**: (choose a password - save it!)
   - **Auto Confirm User**: ✅ Check this (for testing)
4. Click **"Create user"**
5. **Copy the User ID** (you'll need it)

**Via Signup Page** (after starting app):
1. Start dev server: `npm run dev`
2. Go to http://localhost:3000/signup
3. Create account
4. Get User ID from Supabase dashboard

### Step 8: Assign Countries to Users

1. In dev Supabase, go to **SQL Editor**
2. First, get your user ID:
   ```sql
   SELECT id, email FROM auth.users;
   ```
3. Copy the user ID (UUID format)
4. Open: `supabase/migrations/assign_test_user_countries.sql`
5. Update the script with your user ID
6. Run it

**Quick assignment script** (replace `YOUR_USER_ID_HERE`):

```sql
-- Get Philippines country ID
DO $$
DECLARE
  user_uuid UUID := 'YOUR_USER_ID_HERE'::UUID;  -- Replace with your user ID
  phl_country_id UUID;
BEGIN
  SELECT id INTO phl_country_id FROM countries WHERE iso_code = 'PHL';
  
  -- Assign as regular user
  INSERT INTO user_countries (user_id, country_id, role)
  VALUES (user_uuid, phl_country_id, 'user')
  ON CONFLICT (user_id, country_id) DO NOTHING;
  
  RAISE NOTICE 'Assigned Philippines to user';
END $$;
```

**To create a site admin** (can access all countries):

```sql
DO $$
DECLARE
  user_uuid UUID := 'YOUR_USER_ID_HERE'::UUID;  -- Replace with admin user ID
  phl_country_id UUID;
BEGIN
  SELECT id INTO phl_country_id FROM countries WHERE iso_code = 'PHL';
  
  INSERT INTO user_countries (user_id, country_id, role)
  VALUES (user_uuid, phl_country_id, 'admin')
  ON CONFLICT (user_id, country_id) DO UPDATE SET role = 'admin';
  
  RAISE NOTICE 'Created site admin';
END $$;
```

### Step 9: Verify Setup

Run these queries to verify everything is set up:

```sql
-- Check countries exist
SELECT * FROM countries;

-- Check user has country assignment
SELECT 
  u.email,
  c.name as country_name,
  uc.role
FROM auth.users u
JOIN user_countries uc ON u.id = uc.user_id
JOIN countries c ON uc.country_id = c.id;

-- Check datasets have country_id (if you have data)
SELECT COUNT(*) as total, 
       COUNT(country_id) as with_country,
       COUNT(*) - COUNT(country_id) as missing_country
FROM datasets;
```

## Sharing Information with AI Assistant

Since I can't directly access your Supabase project, here's how to share information:

### What to Share (if you need help):

1. **Error messages** - Copy/paste any SQL errors
2. **Query results** - Share output of verification queries
3. **Project details** (optional):
   - Project name
   - Region
   - Any custom configurations

### What NOT to Share:

- ❌ Database passwords
- ❌ Service role keys
- ❌ Anon keys (unless in private conversation)
- ❌ Production credentials

### Quick Verification Script

Run this and share the output if you need help:

```sql
-- Quick setup verification
SELECT 
  'Countries' as check_type,
  COUNT(*) as count
FROM countries
UNION ALL
SELECT 
  'User Countries',
  COUNT(*)
FROM user_countries
UNION ALL
SELECT 
  'Datasets with country_id',
  COUNT(*)
FROM datasets
WHERE country_id IS NOT NULL
UNION ALL
SELECT 
  'Instances with country_id',
  COUNT(*)
FROM instances
WHERE country_id IS NOT NULL;
```

## Troubleshooting

### "Table doesn't exist" errors
- Make sure you ran your existing schema migrations first
- The migration script handles missing tables gracefully

### "User not found" when assigning countries
- Verify user exists: `SELECT id, email FROM auth.users;`
- Make sure you're using the correct UUID format

### "No countries available" in app
- Check `user_countries` table has entries
- Verify user ID matches between `auth.users` and `user_countries`

### Authentication not working
- Check Email provider is enabled
- Verify `.env.local` has correct credentials
- Check browser console for errors

## Next Steps After Setup

1. ✅ Test authentication: `npm run dev` → http://localhost:3000/login
2. ✅ Verify country selector appears
3. ✅ Test login/logout
4. ⏭️ Continue with Phase 4: Update queries (see `QUERY_UPDATE_GUIDE.md`)

## Security Notes

- **Dev project**: Safe to use for testing
- **Anon key**: Can be shared (it's public by design)
- **Service role key**: Keep secret - never commit to git
- **Database password**: Keep secure
- **Production**: Never run dev migrations in production until tested!
