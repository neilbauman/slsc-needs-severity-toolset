# Agent Setup Checklist

## ✅ Automated Steps (Completed by Agent)

- [x] Created git branch: `feature/multi-country-auth`
- [x] Created consolidated migration script: `supabase/migrations/00_run_all_migrations.sql`
- [x] Created user assignment script: `supabase/migrations/assign_test_user_countries.sql`
- [x] Created setup script: `scripts/setup-dev-env.sh`
- [x] Verified no TypeScript/linter errors in new code

## ⚠️ Manual Steps (You Need to Do)

### Step 1: Create Dev Supabase Project
- [ ] Go to https://app.supabase.com
- [ ] Click "New Project"
- [ ] Name: `philippines-ssc-toolset-dev`
- [ ] Choose region
- [ ] Set database password (save it!)
- [ ] Wait for project creation (~2 minutes)
- [ ] **Save these credentials:**
  - Project URL: `https://xxxxx.supabase.co`
  - Anon Key: (from Settings → API)

### Step 2: Copy Production Schema to Dev
- [ ] In dev Supabase, go to SQL Editor
- [ ] Run your existing schema migrations from `supabase/` folder
- [ ] Verify tables exist: `datasets`, `instances`, `admin_boundaries`, etc.

### Step 3: Configure Dev Environment
- [ ] Run: `bash scripts/setup-dev-env.sh`
- [ ] OR manually update `.env.local` with dev credentials:
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://your-dev-project.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-dev-anon-key
  ```

### Step 4: Run Migrations in Dev
- [ ] In dev Supabase SQL Editor
- [ ] Open: `supabase/migrations/00_run_all_migrations.sql`
- [ ] Run the entire script
- [ ] Check output for any errors
- [ ] Verify Step 5 shows "SUCCESS: All records have country_id assigned"
- [ ] If verification passed, uncomment Step 6 and run it

### Step 5: Enable Email Auth
- [ ] In dev Supabase, go to Authentication → Settings
- [ ] Enable "Email" provider
- [ ] Configure email settings (or use default for testing)

### Step 6: Create Test Users
**Option A: Via Dashboard**
- [ ] Go to Authentication → Users
- [ ] Click "Add User" → "Create new user"
- [ ] Enter email: `test@example.com`
- [ ] Enter password: (save it!)
- [ ] Copy the User ID

**Option B: Via Signup Page**
- [ ] Start dev server: `npm run dev`
- [ ] Go to http://localhost:3000/signup
- [ ] Create account
- [ ] Get User ID from Supabase dashboard

### Step 7: Assign Countries to Users
- [ ] In dev Supabase SQL Editor
- [ ] Open: `supabase/migrations/assign_test_user_countries.sql`
- [ ] Get user IDs: `SELECT id, email FROM auth.users;`
- [ ] Update the script with actual user IDs
- [ ] Run the script
- [ ] Verify: `SELECT * FROM user_countries;`

### Step 8: Test the Application
- [ ] Start dev server: `npm run dev`
- [ ] Go to http://localhost:3000
- [ ] Verify redirect to `/login` (if not authenticated)
- [ ] Login with test user
- [ ] Verify header shows:
  - [ ] User email
  - [ ] Country selector dropdown
  - [ ] Logout button
- [ ] Click country selector - verify country appears
- [ ] Test logout
- [ ] Test signup flow

## 🐛 Troubleshooting

### "No countries available"
- Check `user_countries` table has entries
- Verify user ID matches in `auth.users` and `user_countries`

### "Authentication failed"
- Check Supabase Auth is enabled
- Verify email/password are correct
- Check browser console for errors

### "Cannot read property 'id' of null"
- User has no countries assigned
- Run `assign_test_user_countries.sql` again

### Migrations fail
- Check table names match your schema
- Some tables might not exist (migrations handle this)
- Run migrations in order

## 📝 Quick Commands

```bash
# Start dev server
npm run dev

# Check git status
git status

# View migration files
ls -la supabase/migrations/

# Run setup script
bash scripts/setup-dev-env.sh
```

## 🎯 What to Test

1. **Authentication**
   - [ ] Can login
   - [ ] Can logout
   - [ ] Can signup
   - [ ] Protected routes redirect to login

2. **Country Context**
   - [ ] Country selector appears in header
   - [ ] Can see assigned country(ies)
   - [ ] Country persists after refresh
   - [ ] Site admin sees all countries

3. **UI Elements**
   - [ ] Header shows user info
   - [ ] Logout works
   - [ ] Country selector dropdown works

## ⚠️ Expected Issues (Until Phase 4 Complete)

- Dataset pages won't show data (queries need country filter)
- Instance pages won't show data (queries need country filter)
- Any data fetching will fail (needs country_id in queries)

**This is normal!** We've built the foundation, but haven't updated queries yet.

## Next: Phase 4

After testing foundation works:
1. Update queries (see `QUERY_UPDATE_GUIDE.md`)
2. Start with `app/datasets/page.tsx`
3. Test incrementally
