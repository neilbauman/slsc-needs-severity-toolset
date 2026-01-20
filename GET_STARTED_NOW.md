# Get Started - Simple Step-by-Step Guide

## Current Status
✅ Code is written and should compile
✅ Environment is configured (dev Supabase project: SLSCToolset)
⏳ Database migrations need to be run
⏳ Test user needs to be created

## What You Need to Do Right Now

### Step 1: Check if Dev Server is Running

Open terminal and run:
```bash
cd "/Users/neilbauman/Desktop/Philippines SSC Toolset/philippines-ssc-toolset"
npm run dev
```

**What you should see:**
- Server starting message
- "Ready" message with localhost URL
- No error messages

**If you see errors:**
- Share the error message with me
- Don't proceed until server starts successfully

---

### Step 2: Open the App in Browser

Once server is running, open:
**http://localhost:3000**

**What you should see:**
- Either the home page with countries
- OR a loading spinner
- OR an error message about database

**If you see a white screen:**
- Open browser console (F12 → Console tab)
- Share any red error messages

---

### Step 3: Run Database Migrations (If Needed)

**Only do this if:**
- You see an error about "countries table not set up"
- OR the page shows "No Countries Configured"

**How to do it:**

1. Go to your Supabase dashboard:
   https://supabase.com/dashboard/project/yzxmxwppzpwfolkdiuuo

2. Click **"SQL Editor"** in the left sidebar

3. Click **"New query"**

4. Open the file: `supabase/migrations/01_complete_schema_setup.sql`
   - Copy the entire file
   - Paste into SQL Editor
   - Click **"Run"** (or press Cmd/Ctrl + Enter)
   - Wait for success message

5. Then run: `supabase/migrations/00_run_all_migrations.sql`
   - Copy entire file
   - Paste into SQL Editor
   - Click **"Run"**
   - Check for success messages

---

### Step 4: Create a Test User

1. In Supabase dashboard, go to **"Authentication"** → **"Users"**

2. Click **"Add User"** → **"Create new user"**

3. Enter:
   - Email: `test@example.com` (or your email)
   - Password: (choose something - save it!)
   - ✅ Check **"Auto Confirm User"**

4. Click **"Create user"**

5. **Copy the User ID** (you'll need it)

---

### Step 5: Assign Country to User

1. In Supabase SQL Editor, run this (replace `YOUR_USER_ID_HERE` with the User ID from Step 4):

```sql
DO $$
DECLARE
  user_uuid UUID := 'YOUR_USER_ID_HERE'::UUID;  -- Replace with your user ID
  phl_country_id UUID;
BEGIN
  SELECT id INTO phl_country_id FROM countries WHERE iso_code = 'PHL';
  
  INSERT INTO user_countries (user_id, country_id, role)
  VALUES (user_uuid, phl_country_id, 'user')
  ON CONFLICT (user_id, country_id) DO NOTHING;
  
  RAISE NOTICE '✅ Assigned Philippines to user';
END $$;
```

2. Click **"Run"**

---

### Step 6: Test the App

1. Go to: http://localhost:3000

2. You should see:
   - Home page with country cards
   - "Sign In" button (if not logged in)
   - OR redirect to login

3. Click **"Sign In"** or go to: http://localhost:3000/login

4. Login with your test user

5. After login, you should see:
   - Country selector in header
   - Can click on "Philippines" to see dashboard

---

## Quick Troubleshooting

### "Countries table not set up"
→ Run Step 3 (database migrations)

### "No countries available"
→ Run Step 5 (assign country to user)

### "Authentication failed"
→ Check email/password are correct
→ Check Email provider is enabled in Supabase

### Still white screen?
→ Check browser console (F12) for errors
→ Share error messages with me

### Server won't start?
→ Share the error message
→ Make sure you're in the right directory

---

## What Success Looks Like

✅ Dev server running without errors
✅ Can open http://localhost:3000
✅ See home page (even if empty)
✅ Can login
✅ See country selector after login
✅ Can click country to see dashboard

---

## Need Help?

Tell me:
1. What step are you on?
2. What error do you see? (if any)
3. What does the browser show?

I'll help you fix it!
