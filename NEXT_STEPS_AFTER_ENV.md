# Next Steps - After Environment Configuration

## ✅ Completed
- [x] Dev Supabase project created: **SLSCToolset**
- [x] Project URL configured: `https://yzxmxwppzpwfolkdiuuo.supabase.co`
- [x] Anon key configured in `.env.local`

## 📋 Next Steps

### Step 1: Copy Production Schema to Dev (IMPORTANT)

Before running the multi-country migrations, you need to copy your existing database structure to dev.

**Option A: If you have SQL schema files**
1. In dev Supabase dashboard, go to **SQL Editor**
2. Run your existing SQL migrations from `supabase/` folder
3. Start with `schema.sql` if you have it
4. Then run other SQL files in order

**Option B: Export from Production**
1. In production Supabase, go to **SQL Editor**
2. Export or copy your table definitions
3. Run them in dev Supabase SQL Editor

**Option C: Quick Check - What tables do you have?**
Run this in your production Supabase to see what tables exist:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

### Step 2: Run Multi-Country Migrations

Once your schema is in dev:

1. In dev Supabase dashboard, go to **SQL Editor**
2. Open the file: `supabase/migrations/00_run_all_migrations.sql`
3. Copy the **entire contents**
4. Paste into SQL Editor
5. Click **"Run"** (or Cmd/Ctrl + Enter)
6. Check the output - you should see:
   - ✅ "Step 1 complete: Countries table created"
   - ✅ "Step 2 complete: User countries table created"
   - ✅ "Step 3 complete: Country isolation columns added"
   - ✅ "Step 4 complete: Data migrated to Philippines"
   - ✅ "Step 5 complete: Verification done"
   - ✅ "SUCCESS: All records have country_id assigned"

7. **If Step 5 shows SUCCESS**, uncomment Step 6 in the script and run it again

### Step 3: Enable Email Authentication

1. In dev Supabase dashboard, go to **Authentication** → **Providers**
2. Find **"Email"** provider
3. Make sure it's **Enabled**
4. For testing, you can disable "Enable email confirmations"
5. Click **"Save"**

### Step 4: Create Test User

**Via Dashboard** (easiest):
1. Go to **Authentication** → **Users**
2. Click **"Add User"** → **"Create new user"**
3. Enter:
   - **Email**: `test@example.com` (or your email)
   - **Password**: (choose a password - save it!)
   - **Auto Confirm User**: ✅ Check this (for easier testing)
4. Click **"Create user"**
5. **Copy the User ID** (you'll need it for next step)

**Via Signup Page** (after starting app):
1. Start dev server: `npm run dev`
2. Go to http://localhost:3000/signup
3. Create account
4. Get User ID from Supabase dashboard

### Step 5: Assign Country to User

1. In dev Supabase, go to **SQL Editor**
2. First, get your user ID:
   ```sql
   SELECT id, email FROM auth.users;
   ```
3. Copy the user ID (UUID format)
4. Open: `scripts/quick-assign-user.sql`
5. Replace `YOUR_EMAIL_HERE` with your email (or use the user ID directly)
6. Run the script

**Or use this quick script** (replace with your email or user ID):

```sql
-- Quick assignment by email
DO $$
DECLARE
  user_email TEXT := 'test@example.com';  -- Replace with your email
  user_uuid UUID;
  phl_country_id UUID;
BEGIN
  SELECT id INTO user_uuid FROM auth.users WHERE email = user_email;
  SELECT id INTO phl_country_id FROM countries WHERE iso_code = 'PHL';
  
  INSERT INTO user_countries (user_id, country_id, role)
  VALUES (user_uuid, phl_country_id, 'user')
  ON CONFLICT (user_id, country_id) DO NOTHING;
  
  RAISE NOTICE '✅ Assigned Philippines to user: %', user_email;
END $$;
```

### Step 6: Verify Setup

Run the verification script:

1. Open: `scripts/verify-setup.sql`
2. Copy and paste into SQL Editor
3. Run it
4. Check the output - should show:
   - Countries exist
   - User has country assignment
   - No errors

### Step 7: Test the Application

1. Start dev server:
   ```bash
   npm run dev
   ```

2. Open browser: http://localhost:3000

3. You should be redirected to `/login`

4. Test login with your test user

5. After login, verify:
   - ✅ Header shows your email
   - ✅ Country selector appears in header
   - ✅ Can see "Philippines" in dropdown
   - ✅ Logout button works

## 🐛 Troubleshooting

### "No countries available"
- Check `user_countries` table has entries
- Run: `SELECT * FROM user_countries;`
- Make sure you assigned a country to your user

### "Authentication failed"
- Check Email provider is enabled in Supabase
- Verify `.env.local` has correct credentials
- Check browser console for errors

### "Cannot read property 'id' of null"
- User has no countries assigned
- Run the assignment script again

### Migration errors
- Make sure you copied production schema first
- Some tables might not exist (migrations handle this)
- Check error messages for specific issues

## 📝 Quick Reference

**Project Details:**
- Name: SLSCToolset
- URL: https://yzxmxwppzpwfolkdiuuo.supabase.co
- Environment: Development

**Files to Use:**
- Migration: `supabase/migrations/00_run_all_migrations.sql`
- User Assignment: `scripts/quick-assign-user.sql`
- Verification: `scripts/verify-setup.sql`

**Commands:**
```bash
# Start dev server
npm run dev

# Check environment
cat .env.local
```

## ⚠️ Important Notes

- **This is DEV only** - Don't run migrations in production yet!
- **Data pages won't work yet** - Queries need country filtering (Phase 4)
- **Test incrementally** - Verify auth works before moving forward

## 🎯 What's Next After Testing

Once you've verified the foundation works:
1. Continue with Phase 4: Update queries (see `QUERY_UPDATE_GUIDE.md`)
2. Start with `app/datasets/page.tsx` as first test case
3. Update queries incrementally
