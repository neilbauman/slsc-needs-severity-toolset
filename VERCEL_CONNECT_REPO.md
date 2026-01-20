# Connecting GitHub Repository to Vercel Project

You've created a Vercel project called `slsc-needs-severity-toolset`. Now you need to connect it to your GitHub repository.

## Option 1: Connect Repository in Vercel Dashboard (Recommended)

### Step 1: Go to Your Vercel Project

1. Go to https://vercel.com/dashboard
2. Find and click on your project: **slsc-needs-severity-toolset**

### Step 2: Connect Git Repository

1. In your project, go to **Settings** (top menu)
2. Click on **Git** (left sidebar)
3. Under **"Connected Git Repository"**, you'll see options:
   - If you see "Connect Git Repository" button → Click it
   - If you see "Disconnect" → Repository is already connected

4. **If connecting:**
   - Select **GitHub** as your Git provider
   - Authorize Vercel (if prompted)
   - Search for your repository: `slsc-needs-severity-toolset` (or whatever you named it)
   - Select the repository
   - Choose the branch: `feature/multi-country-auth` (or `main` if you merged)
   - Click **Connect**

### Step 3: Configure Build Settings

After connecting, Vercel will show build settings:
- **Framework Preset**: Next.js (should auto-detect)
- **Root Directory**: `./` (leave as is)
- **Build Command**: `npm run build` (default)
- **Output Directory**: `.next` (default)
- **Install Command**: `npm install` (default)

### Step 4: Add Environment Variables (BEFORE DEPLOYING!)

**CRITICAL:** Add these before your first deploy:

1. Scroll to **"Environment Variables"** section
2. Click **"Add"** or **"Add New"**
3. Add first variable:
   - **Name**: `NEXT_PUBLIC_SUPABASE_URL`
   - **Value**: Your Supabase project URL (from Supabase Dashboard → Settings → API)
   - **Environment**: Select all (Production, Preview, Development)
   - Click **Save**

4. Add second variable:
   - **Name**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Value**: Your Supabase anon public key
   - **Environment**: Select all (Production, Preview, Development)
   - Click **Save**

### Step 5: Deploy

1. Scroll to bottom
2. Click **"Deploy"** or **"Redeploy"**
3. Wait 2-5 minutes for build to complete

## Option 2: Import Repository (If Project is Empty)

If your Vercel project doesn't have a repository connected yet:

1. Go to https://vercel.com/new
2. You should see your existing project `slsc-needs-severity-toolset`
3. Click on it, or click **"Import"** next to it
4. Connect GitHub and select your repository
5. Follow steps 3-5 above

## Option 3: Use Vercel CLI (Alternative)

If the dashboard isn't working, you can use CLI:

```bash
# Install Vercel CLI (if not installed)
npm install -g vercel

# Login
vercel login

# Link to existing project
cd "/Users/neilbauman/Desktop/Philippines SSC Toolset/philippines-ssc-toolset"
vercel link

# When prompted:
# - Select your team/account
# - Select project: slsc-needs-severity-toolset
# - Confirm settings

# Add environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY

# Deploy
vercel --prod
```

## Troubleshooting

### "No repositories found"
- Make sure your GitHub repository exists
- Check you're logged into the correct GitHub account
- Verify Vercel has access to your GitHub account (Settings → Git Providers)

### "Repository already connected to another project"
- You can disconnect it from the old project first
- Or use a different branch
- Or create a new Vercel project

### "Can't find my repository"
- Make sure the repository name matches exactly
- Check if it's private (Vercel needs access to private repos)
- Try refreshing the page

## What You Need

Before connecting, make sure you have:
1. ✅ GitHub repository created (e.g., `slsc-needs-severity-toolset`)
2. ✅ Code pushed to GitHub
3. ✅ Vercel project created (`slsc-needs-severity-toolset`)
4. ✅ Supabase credentials ready (URL and anon key)

## Quick Checklist

- [ ] GitHub repository exists and has code
- [ ] Vercel project created
- [ ] Repository connected in Vercel Settings → Git
- [ ] Environment variables added
- [ ] First deployment triggered
