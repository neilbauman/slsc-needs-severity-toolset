# Vercel Deployment Guide

This guide will help you deploy the **SLSC Needs Severity Toolset** (multi-country version) to Vercel for external access.

**Note:** This is the new multi-country version, not the original Philippines-only toolset.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com) if you don't have one
2. **GitHub/GitLab/Bitbucket Account**: Your code should be in a Git repository
3. **Supabase Project**: Your Supabase project should be set up and accessible

## Step 1: Prepare Your Repository

1. **Commit your code** (if not already done):
   ```bash
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push
   ```

2. **Verify `.env.local` is in `.gitignore`** (it should be - never commit secrets!)

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard (Recommended)

1. **Go to [vercel.com](https://vercel.com)** and sign in
2. **Click "Add New..." → "Project"**
3. **Import your Git repository**:
   - Connect your GitHub/GitLab/Bitbucket account if needed
   - Select the repository containing this project
   - Click "Import"

4. **Configure the project**:
   - **Framework Preset**: Should auto-detect as "Next.js"
   - **Root Directory**: Leave as `./` (unless your project is in a subdirectory)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)
   - **Install Command**: `npm install` (default)

5. **Add Environment Variables** (CRITICAL):
   Click "Environment Variables" and add:
   
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```
   
   **Where to find these:**
   - Go to your Supabase project dashboard
   - Navigate to Settings → API
   - Copy the "Project URL" → `NEXT_PUBLIC_SUPABASE_URL`
   - Copy the "anon public" key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

6. **Deploy**:
   - Click "Deploy"
   - Wait for the build to complete (usually 2-5 minutes)

### Option B: Deploy via Vercel CLI

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel
   ```
   
   Follow the prompts:
   - Link to existing project or create new
   - Confirm settings
   - Add environment variables when prompted

4. **Set environment variables**:
   ```bash
   vercel env add NEXT_PUBLIC_SUPABASE_URL
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```

5. **Redeploy with environment variables**:
   ```bash
   vercel --prod
   ```

## Step 3: Configure Production Settings

### After First Deployment

1. **Go to your project settings** in Vercel dashboard
2. **Add a custom domain** (optional):
   - Settings → Domains
   - Add your domain and follow DNS setup instructions

3. **Configure environment variables for all environments**:
   - Make sure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set for:
     - Production
     - Preview
     - Development

4. **Set up automatic deployments**:
   - Already enabled by default when connected to Git
   - Every push to `main`/`master` will deploy to production
   - Pull requests will create preview deployments

## Step 4: Verify Deployment

1. **Check the deployment URL**:
   - Vercel will provide a URL like: `https://your-project.vercel.app`
   - Visit the URL and verify the app loads

2. **Test key functionality**:
   - Home page loads
   - Can navigate to countries
   - Can view datasets
   - Can access instances
   - Authentication works (if enabled)

3. **Check browser console** for any errors

## Step 5: Supabase Configuration

### Enable CORS for Vercel Domain

1. **Go to Supabase Dashboard** → Your Project → Settings → API
2. **Add your Vercel domain** to allowed origins:
   - `https://your-project.vercel.app`
   - `https://*.vercel.app` (for preview deployments)

### Row Level Security (RLS)

Make sure your Supabase tables have appropriate RLS policies:
- Public read access for countries, datasets (if needed)
- Authenticated access for instances, scores, etc.

## Troubleshooting

### Build Fails

1. **Check build logs** in Vercel dashboard
2. **Common issues**:
   - Missing environment variables → Add them in Vercel settings
   - TypeScript errors → Fix in code
   - Missing dependencies → Check `package.json`

### App Loads but Shows Errors

1. **Check browser console** for errors
2. **Verify environment variables** are set correctly
3. **Check Supabase connection**:
   - Verify `NEXT_PUBLIC_SUPABASE_URL` is correct
   - Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` is correct
   - Check Supabase project is active

### Map Not Loading

1. **Check if Leaflet CSS is loading** (network tab)
2. **Verify GeoJSON data** is being fetched
3. **Check CORS settings** in Supabase

### Authentication Issues

1. **Verify Supabase Auth is enabled**
2. **Check redirect URLs** in Supabase Auth settings:
   - Add: `https://your-project.vercel.app/**`
   - Add: `https://*.vercel.app/**` (for previews)

## Environment Variables Reference

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Yes | `https://xyz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key | Yes | `eyJhbGc...` |

## Post-Deployment Checklist

- [ ] App loads at Vercel URL
- [ ] Environment variables are set
- [ ] Supabase CORS is configured
- [ ] Authentication works (if enabled)
- [ ] Can view countries/datasets
- [ ] Map rendering works
- [ ] Custom domain configured (if desired)
- [ ] Monitoring/alerts set up (optional)

## Updating the Deployment

After making changes:

1. **Commit and push** to your Git repository
2. **Vercel will automatically deploy** (if auto-deploy is enabled)
3. **Or manually trigger** via Vercel dashboard or CLI:
   ```bash
   vercel --prod
   ```

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check browser console for errors
3. Verify Supabase project is accessible
4. Review this guide's troubleshooting section
