# ✅ Quick Start Checklist

Use this checklist to get your application running step by step.

## Pre-Flight Checks

- [ ] **Node.js installed?**
  - Open Terminal: `node --version`
  - Should show v18 or higher
  - If not: Download from https://nodejs.org/

- [ ] **Supabase account created?**
  - Go to https://supabase.com/
  - Sign up or sign in
  - Create a new project

## Setup Steps

### Step 1: Install Dependencies
- [ ] Open Terminal
- [ ] Navigate to project: `cd "/Users/neilbauman/Desktop/Philippines SSC Toolset/philippines-ssc-toolset"`
- [ ] Run: `npm install`
- [ ] Wait for completion (2-5 minutes)
- [ ] No error messages

### Step 2: Supabase Setup
- [ ] Created Supabase project
- [ ] Copied Project URL
- [ ] Copied anon public key
- [ ] Opened SQL Editor in Supabase
- [ ] Copied code from `supabase/schema.sql`
- [ ] Pasted and ran SQL in Supabase
- [ ] Saw "Success" message

### Step 3: Environment Variables
- [ ] Created `.env.local` file in project root
- [ ] Added `NEXT_PUBLIC_SUPABASE_URL=your-url`
- [ ] Added `NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key`
- [ ] Saved the file
- [ ] File is NOT committed to git (it's in .gitignore)

### Step 4: Start Server
- [ ] In Terminal, run: `npm run dev`
- [ ] See message: "Local: http://localhost:3000"
- [ ] Server is running (Terminal shows it's active)

### Step 5: Test Application
- [ ] Open browser
- [ ] Go to: http://localhost:3000
- [ ] Page loads (even if there are errors, page should show)
- [ ] Check browser console (F12) for errors
- [ ] Note any red error messages

## Troubleshooting

If something doesn't work:

1. **Check the error message** - What does it say?
2. **Check which step failed** - Go back to that step
3. **Ask Cursor** - Copy the error and ask for help
4. **Check the detailed guide** - See `docs/BEGINNER_DEBUGGING_GUIDE.md`

## Common Issues

| Issue | Quick Fix |
|-------|-----------|
| "Command not found: npm" | Install Node.js |
| "Port 3000 in use" | Close other apps or change port |
| "Cannot find module" | Run `npm install` again |
| "Environment variable not found" | Check `.env.local` file exists and has correct values |
| "Table doesn't exist" | Run SQL schema in Supabase again |
| Blank page | Check browser console (F12) for errors |

## Success Indicators

✅ **You're ready when:**
- Server is running
- Browser shows http://localhost:3000
- Page loads (even with some errors is okay for now)
- You can click around the interface

## Next Steps After It's Running

1. [ ] Explore the homepage
2. [ ] Try clicking "Manage Datasets"
3. [ ] Try clicking "View Instances"
4. [ ] Note what works and what doesn't
5. [ ] Share background material in `docs/SSC_BACKGROUND.md`
6. [ ] Start debugging specific features

---

**Remember:** It's okay if not everything works perfectly at first. That's what debugging is for! 🐛→✨

