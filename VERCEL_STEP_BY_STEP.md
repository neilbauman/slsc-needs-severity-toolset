# Vercel Deployment - Step by Step (No CLI Needed)

## ✅ Step 1: Code is Ready
Your code is now committed and pushed to GitHub.

## 📋 Step 2: Get Your Supabase Credentials

Before going to Vercel, get these ready:

1. **Open your Supabase Dashboard**: https://supabase.com/dashboard
2. **Select your project**
3. **Go to Settings → API**
4. **Copy these two values:**
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public key** (long JWT token starting with `eyJ...`)

**Keep these handy - you'll paste them into Vercel!**

## 🚀 Step 3: Deploy via Vercel Dashboard

### A. Go to Vercel

1. Open: https://vercel.com
2. **Sign in** (or create account if needed)
3. Click **"Add New..."** → **"Project"** (or the big "+ New Project" button)

### B. Connect GitHub (if not already connected)

1. You'll see a list of Git providers (GitHub, GitLab, Bitbucket)
2. If GitHub shows "Connect" or "Configure":
   - Click **"Connect"** or **"Import from GitHub"**
   - Authorize Vercel to access your GitHub account
   - Grant access to repositories (you can select "All repositories" or just this one)

### C. Find Your Repository

1. **Search for**: `philippines-ssc-toolset`
   - Or look for: `neilbauman/philippines-ssc-toolset`
2. **Click "Import"** next to your repository

### D. Configure Project

Vercel should auto-detect Next.js. Verify these settings:

- **Framework Preset**: Next.js ✅
- **Root Directory**: `./` ✅
- **Build Command**: `npm run build` ✅
- **Output Directory**: `.next` ✅
- **Install Command**: `npm install` ✅

**Don't click Deploy yet!**

### E. Add Environment Variables (CRITICAL!)

1. **Scroll down** to find **"Environment Variables"** section
2. **Click "Add"** or the "+" button
3. **Add first variable:**
   - **Name**: `NEXT_PUBLIC_SUPABASE_URL`
   - **Value**: Paste your Supabase Project URL
   - **Environment**: Select all three (Production, Preview, Development)
   - Click **"Save"**

4. **Add second variable:**
   - **Name**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Value**: Paste your Supabase anon public key
   - **Environment**: Select all three (Production, Preview, Development)
   - Click **"Save"**

### F. Deploy!

1. **Scroll to bottom** and click **"Deploy"**
2. **Wait 2-5 minutes** for the build to complete
3. **Watch the build logs** - you'll see it installing dependencies and building

### G. Get Your URL

Once deployment completes:
- You'll see: **"Congratulations! Your project has been deployed"**
- Your URL will be: `https://philippines-ssc-toolset-xxxxx.vercel.app` (or similar)
- **Click the URL** to visit your app!

## 🔧 Step 4: Configure Supabase (After Deployment)

### A. Add CORS for Vercel Domain

1. Go to **Supabase Dashboard** → Your Project → **Settings → API**
2. Scroll to **"CORS"** or **"Allowed Origins"**
3. **Add your Vercel domain:**
   - `https://your-project.vercel.app`
   - `https://*.vercel.app` (for preview deployments)
4. **Save**

### B. Configure Auth Redirects (if using authentication)

1. Go to **Supabase Dashboard** → **Authentication → URL Configuration**
2. **Add Site URL**: `https://your-project.vercel.app`
3. **Add Redirect URLs**:
   - `https://your-project.vercel.app/**`
   - `https://*.vercel.app/**` (for previews)
4. **Save**

## ✅ Step 5: Test Your Deployment

1. Visit your Vercel URL
2. Check that:
   - Home page loads
   - No console errors (F12 → Console tab)
   - Can navigate to countries
   - App functions correctly

## 🆘 Troubleshooting

### "Repository not found"
- Make sure you pushed your code: `git push`
- Check you're logged into the correct GitHub account in Vercel
- Try refreshing the Vercel page

### "Build failed"
- Check the build logs in Vercel
- Make sure environment variables are set
- Verify your Supabase credentials are correct

### "App loads but shows errors"
- Open browser console (F12)
- Check for Supabase connection errors
- Verify environment variables are set correctly
- Check Supabase CORS settings

### "Can't connect to Supabase"
- Double-check `NEXT_PUBLIC_SUPABASE_URL` is correct
- Double-check `NEXT_PUBLIC_SUPABASE_ANON_KEY` is correct
- Verify Supabase project is active
- Check CORS settings in Supabase

## 📞 Need Help?

If you're still stuck, tell me:
- What step you're on
- What you see on screen
- Any error messages
- Screenshot if possible

I can help troubleshoot!
