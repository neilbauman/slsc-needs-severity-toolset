# Quick Start - What to Do Right Now

## ✅ I Just Started Your Dev Server

The server should be starting. Wait about 10-20 seconds, then:

1. **Open your browser**
2. **Go to:** http://localhost:3000
3. **See what happens**

---

## What You'll See (and what to do)

### Scenario A: You see a home page with country cards
✅ **Great!** The app is working. You can:
- Click "Sign In" to login
- Or click a country card (will ask you to login)

### Scenario B: You see "No Countries Configured" or error about database
→ **You need to run database migrations** (see below)

### Scenario C: White screen or errors
→ **Check browser console** (F12 → Console tab)
→ **Share the error** with me

### Scenario D: Page says "Loading..." forever
→ **Database might not be set up**
→ **Run migrations** (see below)

---

## If You Need to Set Up Database

### Quick Migration Steps:

1. **Go to Supabase:**
   https://supabase.com/dashboard/project/yzxmxwppzpwfolkdiuuo/sql/new

2. **Run this first** (copy entire file):
   - File: `supabase/migrations/01_complete_schema_setup.sql`
   - Copy → Paste → Run

3. **Then run this** (copy entire file):
   - File: `supabase/migrations/00_run_all_migrations.sql`
   - Copy → Paste → Run

4. **Create a test user:**
   - Go to: Authentication → Users → Add User
   - Email: `test@example.com`
   - Password: (save it!)
   - Check "Auto Confirm User"
   - Copy the User ID

5. **Assign country to user** (in SQL Editor):
```sql
-- Replace YOUR_USER_ID_HERE with actual user ID
DO $$
DECLARE
  user_uuid UUID := 'YOUR_USER_ID_HERE'::UUID;
  phl_country_id UUID;
BEGIN
  SELECT id INTO phl_country_id FROM countries WHERE iso_code = 'PHL';
  INSERT INTO user_countries (user_id, country_id, role)
  VALUES (user_uuid, phl_country_id, 'user')
  ON CONFLICT (user_id, country_id) DO NOTHING;
  RAISE NOTICE '✅ Done!';
END $$;
```

6. **Refresh browser** - should see countries now!

---

## Current Status Checklist

- [ ] Dev server running? (I just started it)
- [ ] Can you open http://localhost:3000?
- [ ] What do you see? (home page / error / white screen?)
- [ ] Have you run database migrations?
- [ ] Have you created a test user?
- [ ] Have you assigned country to user?

---

## Tell Me:

1. **What do you see** when you go to http://localhost:3000?
2. **Any error messages?** (in browser or terminal)
3. **Have you run the database migrations yet?**

Then I can help you with the next step!
