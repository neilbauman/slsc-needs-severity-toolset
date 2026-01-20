# Deploy to Vercel - Right Now

## Quickest Path: Use Vercel CLI

This is often faster than the dashboard. Let's do it step by step:

### Step 1: Install Vercel CLI (if not installed)

```bash
npm install -g vercel
```

### Step 2: Login to Vercel

```bash
vercel login
```

This will open your browser to authenticate.

### Step 3: Navigate to your project

```bash
cd "/Users/neilbauman/Desktop/Philippines SSC Toolset/philippines-ssc-toolset"
```

### Step 4: Deploy (first time)

```bash
vercel
```

You'll be prompted:
- **Set up and deploy?** → Type `Y` and press Enter
- **Which scope?** → Select your account/team
- **Link to existing project?** → Type `N` (create new) or `Y` (if you already have one)
- **Project name?** → Press Enter for default or type a name
- **Directory?** → Press Enter (use current directory)

### Step 5: Add Environment Variables

After first deploy, add your Supabase credentials:

```bash
# Add Supabase URL
vercel env add NEXT_PUBLIC_SUPABASE_URL

# When prompted:
# - Value: Paste your Supabase URL (e.g., https://xyz.supabase.co)
# - Environment: Select "Production", "Preview", and "Development" (or just Production)

# Add Supabase Anon Key
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY

# When prompted:
# - Value: Paste your Supabase anon key
# - Environment: Select all environments
```

### Step 6: Deploy to Production

```bash
vercel --prod
```

### Step 7: Get Your URL

After deployment, Vercel will show you:
- Production URL: `https://your-project.vercel.app`
- Visit it to test!

---

## Alternative: Dashboard Method (If CLI Doesn't Work)

### If you're stuck on "Import Git Repository":

1. **Make sure your code is pushed to GitHub:**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push
   ```

2. **In Vercel Dashboard:**
   - Go to https://vercel.com/new
   - If you don't see GitHub, click "Connect GitHub" or "Import from GitHub"
   - Authorize Vercel (if prompted)
   - Search for: `philippines-ssc-toolset`
   - Click "Import"

3. **Before clicking Deploy:**
   - Scroll down to "Environment Variables"
   - Click "Add" and add:
     - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase URL
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key

4. **Then click "Deploy"**

---

## What's Your Supabase Info?

You'll need these from your Supabase project:

1. **Project URL**: 
   - Go to Supabase Dashboard → Settings → API
   - Copy "Project URL" (looks like: `https://xxxxx.supabase.co`)

2. **Anon Key**:
   - Same page, copy "anon public" key (long JWT token)

---

## Still Stuck?

Tell me:
1. What step are you on? (CLI or Dashboard?)
2. What error message do you see? (if any)
3. Are you logged into Vercel?
4. Is your code pushed to GitHub?

I can help troubleshoot the specific issue!
