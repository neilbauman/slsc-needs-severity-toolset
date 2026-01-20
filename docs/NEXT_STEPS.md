# Next Steps: Testing & Setup Guide

## Immediate Next Steps

### Step 1: Set Up Dev Environment (REQUIRED BEFORE TESTING)

**⚠️ IMPORTANT**: Do NOT run migrations in production yet! Set up a dev environment first.

#### 1.1 Create Dev Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click "New Project"
3. Name it: `philippines-ssc-toolset-dev` (or similar)
4. Choose a region close to you
5. Set a database password (save it!)
6. Wait for project to be created (~2 minutes)

#### 1.2 Copy Production Schema to Dev

You need to replicate your production database structure in dev:

**Option A: Export/Import Schema**
1. In production Supabase, go to SQL Editor
2. Export your current schema (or use existing SQL files)
3. In dev Supabase, go to SQL Editor
4. Run all your existing migrations from `supabase/` folder first
5. Then run the new multi-country migrations

**Option B: Use Supabase CLI** (if you have it set up)
```bash
# Pull production schema
supabase db pull

# Push to dev (after configuring dev project)
supabase link --project-ref <dev-project-ref>
supabase db push
```

#### 1.3 Configure Dev Environment Variables

Create or update `.env.local` with dev credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-dev-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-dev-anon-key
```

**Get these from**: Dev Supabase project → Settings → API

#### 1.4 Create Git Branch (Optional but Recommended)

```bash
git checkout -b feature/multi-country-auth
git add .
git commit -m "Add multi-country authentication foundation"
```

### Step 2: Run Migrations in Dev

Run these migrations **in order** in your dev Supabase SQL Editor:

1. **`supabase/migrations/add_countries.sql`**
   - Creates countries table
   - Inserts initial countries (PHL, BGD, MMR)

2. **`supabase/migrations/add_user_countries.sql`**
   - Creates user_countries junction table

3. **`supabase/migrations/add_country_isolation.sql`**
   - Adds country_id columns (nullable initially)

4. **`supabase/migrations/migrate_philippines_data.sql`**
   - Assigns existing data to Philippines
   - Only run this if you have sample data in dev

5. **`supabase/migrations/make_country_id_not_null.sql`**
   - Makes country_id NOT NULL
   - **Only run after verifying all data has country_id!**

**Verification Query** (run before step 5):
```sql
-- Check for NULL country_id values
SELECT 
  (SELECT COUNT(*) FROM datasets WHERE country_id IS NULL) as null_datasets,
  (SELECT COUNT(*) FROM instances WHERE country_id IS NULL) as null_instances,
  (SELECT COUNT(*) FROM admin_boundaries WHERE country_id IS NULL) as null_boundaries;
```

All should return 0 before running step 5.

### Step 3: Create Test Users

#### 3.1 Enable Email Auth in Supabase

1. Go to dev Supabase → Authentication → Settings
2. Enable "Email" provider
3. Configure email settings (or use Supabase's default for testing)

#### 3.2 Create Test Users

**Option A: Via Supabase Dashboard**
1. Go to Authentication → Users
2. Click "Add User" → "Create new user"
3. Enter email and password
4. Save the user ID

**Option B: Via Signup Page**
1. Start your dev server: `npm run dev`
2. Go to `http://localhost:3000/signup`
3. Create a test user account

#### 3.3 Assign Countries to Users

Run this SQL in dev Supabase (replace with actual user IDs):

```sql
-- Get country IDs
SELECT id, iso_code, name FROM countries;

-- Assign Philippines to a user (replace USER_ID_HERE)
INSERT INTO user_countries (user_id, country_id, role)
VALUES (
  'USER_ID_HERE',  -- Replace with actual user ID from auth.users
  (SELECT id FROM countries WHERE iso_code = 'PHL'),
  'user'  -- or 'admin' for site admin
);

-- Create a site admin (can access all countries)
INSERT INTO user_countries (user_id, country_id, role)
VALUES (
  'ADMIN_USER_ID_HERE',  -- Replace with admin user ID
  (SELECT id FROM countries WHERE iso_code = 'PHL'),
  'admin'
);
```

**To get user IDs:**
```sql
SELECT id, email FROM auth.users;
```

### Step 4: Test What We've Built

#### 4.1 Test Authentication

1. Start dev server: `npm run dev`
2. Go to `http://localhost:3000/login`
3. Try logging in with test user
4. Verify you're redirected to home page
5. Check Header shows user email and logout button

#### 4.2 Test Country Selection

1. After login, verify country selector appears in header
2. Click country selector dropdown
3. Verify you see your assigned country(ies)
4. Try switching countries (if you have multiple)
5. Verify country persists after page refresh

#### 4.3 Test Signup

1. Go to `http://localhost:3000/signup`
2. Create a new user account
3. Verify account is created
4. **Note**: New users won't have countries assigned yet - you'll need to assign them via SQL

#### 4.4 Test Protected Routes

1. Logout
2. Try accessing `http://localhost:3000/datasets`
3. Verify you're redirected to `/login`
4. Login again
5. Verify you can access protected pages

### Step 5: What's NOT Working Yet (Expected)

**⚠️ These will fail until Phase 4 is complete:**

- Dataset pages won't show data (queries need country filter)
- Instance pages won't show data (queries need country filter)
- Any data fetching will fail (needs country_id in queries)

**This is expected!** We've built the foundation, but haven't updated the queries yet.

### Step 6: Continue with Phase 4 (After Testing Foundation)

Once you've verified auth and country context work:

1. **Update queries** - See `QUERY_UPDATE_GUIDE.md`
2. **Start with one page** - Update `app/datasets/page.tsx` first
3. **Test incrementally** - Update one component, test it, move to next
4. **Update RPC functions** - Add country parameters where needed

## Quick Test Checklist

- [ ] Dev Supabase project created
- [ ] Migrations run successfully in dev
- [ ] Test user created and countries assigned
- [ ] Can login via `/login` page
- [ ] Header shows user email and country selector
- [ ] Country selector works
- [ ] Protected routes redirect to login when not authenticated
- [ ] Can logout successfully

## Troubleshooting

### "No countries available"
- Check `user_countries` table has entries for your user
- Verify country assignment SQL ran successfully

### "Authentication failed"
- Check Supabase Auth is enabled in dev project
- Verify email/password are correct
- Check browser console for errors

### "Cannot read property 'id' of null"
- Country context not loaded yet - add loading check
- Verify user has countries assigned in `user_countries` table

### Migrations fail
- Check table names match your schema
- Some tables might not exist yet (migrations handle this with `IF EXISTS`)
- Run migrations in order

## Next: Phase 4 Implementation

After testing the foundation, see:
- `QUERY_UPDATE_GUIDE.md` - How to update queries
- `MULTI_COUNTRY_IMPLEMENTATION.md` - Full implementation status

Start with updating `app/datasets/page.tsx` as your first test case!
