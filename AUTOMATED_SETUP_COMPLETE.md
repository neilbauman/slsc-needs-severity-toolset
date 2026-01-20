# Automated Setup - Complete Guide

## ✅ What I've Prepared

I've created all the SQL files and scripts you need. Here's what's ready:

### 1. Complete Schema Setup
**File**: `supabase/migrations/01_complete_schema_setup.sql`
- Creates all base tables (datasets, instances, admin_boundaries, etc.)
- Sets up indexes
- Enables PostGIS
- **Run this FIRST** in your dev Supabase SQL Editor

### 2. Multi-Country Migrations
**File**: `supabase/migrations/00_run_all_migrations.sql`
- Adds countries table
- Adds user_countries table
- Adds country_id columns
- Migrates existing data
- **Run this SECOND** after schema setup

### 3. User Assignment Script
**File**: `scripts/quick-assign-user.sql`
- Easy script to assign countries to users
- Can use email or user ID
- **Run this AFTER** creating test users

### 4. Verification Script
**File**: `scripts/verify-setup.sql`
- Verifies everything is set up correctly
- Shows what's missing
- **Run this LAST** to check everything

### 5. Interactive Setup Script
**File**: `scripts/complete-setup.sh`
- Guides you through all steps
- Interactive prompts
- **Run this** to get step-by-step guidance

## 🚀 Quick Start

### Option A: Use the Interactive Script

```bash
bash scripts/complete-setup.sh
```

This will guide you through each step with prompts.

### Option B: Manual Steps

Follow these steps in order:

#### Step 1: Enable Email Auth
1. Go to: https://yzxmxwppzpwfolkdiuuo.supabase.co
2. Authentication → Providers → Enable "Email"
3. (Optional) Disable email confirmations for testing

#### Step 2: Run Schema Setup
1. SQL Editor → New Query
2. Open: `supabase/migrations/01_complete_schema_setup.sql`
3. Copy entire file → Paste → Run
4. Check for success messages

#### Step 3: Run Multi-Country Migrations
1. SQL Editor → New Query
2. Open: `supabase/migrations/00_run_all_migrations.sql`
3. Copy entire file → Paste → Run
4. Check output - should see all "Step X complete" messages
5. If Step 5 shows SUCCESS, uncomment Step 6 and run again

#### Step 4: Create Test User
**Via Dashboard:**
1. Authentication → Users → Add User
2. Email: `test@example.com`
3. Password: (save it!)
4. Check "Auto Confirm User"
5. Copy the User ID

**Via Signup:**
1. `npm run dev`
2. Go to http://localhost:3000/signup
3. Create account
4. Get User ID from dashboard

#### Step 5: Assign Country to User
1. SQL Editor → New Query
2. Open: `scripts/quick-assign-user.sql`
3. Replace `YOUR_EMAIL_HERE` with your email
4. Run the script
5. Should see success message

#### Step 6: Verify Setup
1. SQL Editor → New Query
2. Open: `scripts/verify-setup.sql`
3. Copy entire file → Paste → Run
4. Check output for any warnings

#### Step 7: Test Application
```bash
npm run dev
```

Then:
1. Go to http://localhost:3000
2. Should redirect to /login
3. Login with test user
4. Verify:
   - Header shows email
   - Country selector appears
   - Can see "Philippines"
   - Logout works

## 📋 File Checklist

- [x] `supabase/migrations/01_complete_schema_setup.sql` - Base schema
- [x] `supabase/migrations/00_run_all_migrations.sql` - Multi-country migrations
- [x] `scripts/quick-assign-user.sql` - User assignment
- [x] `scripts/verify-setup.sql` - Verification
- [x] `scripts/complete-setup.sh` - Interactive guide
- [x] `.env.local` - Environment configured

## 🐛 Troubleshooting

### "Table already exists" errors
- This is fine - the scripts use `IF NOT EXISTS`
- Continue with next step

### "User not found" when assigning country
- Verify user exists: `SELECT id, email FROM auth.users;`
- Make sure you're using the correct email/UUID

### "No countries available" in app
- Check: `SELECT * FROM user_countries;`
- Make sure you assigned a country to your user

### Migration errors
- Check which step failed
- Some tables might not exist (migrations handle this)
- Share the error message for help

## 📊 Expected Results

After running all scripts, you should have:

✅ Countries table with 3 countries (PHL, BGD, MMR)
✅ User countries table with your user assigned
✅ All tables have country_id columns
✅ All existing data (if any) assigned to Philippines
✅ Test user can login
✅ Country selector works in app

## 🎯 What's Next

Once setup is complete and tested:
1. Continue with Phase 4: Update queries
2. See `QUERY_UPDATE_GUIDE.md` for patterns
3. Start with `app/datasets/page.tsx`

## 💡 Tips

- Run scripts in order
- Check output after each step
- Use verification script to catch issues early
- Test incrementally - verify auth before moving forward

## ❓ Need Help?

If you encounter issues:
1. Run `scripts/verify-setup.sql` and share output
2. Check browser console for errors
3. Share specific error messages
4. I can help troubleshoot!
