# Quick Deployment Checklist

## Before Deploying

- [x] Build passes locally (`npm run build`)
- [ ] Code is committed to Git
- [ ] Repository is pushed to GitHub/GitLab/Bitbucket

## Required Environment Variables

You'll need these from your Supabase project (Settings → API):

1. `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon/public key

## Quick Deploy Steps

### Via Vercel Dashboard (Easiest)

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New..." → "Project"**
3. Import your Git repository
4. **Add Environment Variables** (before deploying):
   - Click "Environment Variables"
   - Add `NEXT_PUBLIC_SUPABASE_URL`
   - Add `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Click **"Deploy"**
6. Wait 2-5 minutes for build to complete
7. Visit your deployment URL (e.g., `https://your-project.vercel.app`)

### Via Vercel CLI

```bash
# Install CLI (if not already installed)
npm i -g vercel

# Login
vercel login

# Deploy (first time - will prompt for setup)
vercel

# Add environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY

# Deploy to production
vercel --prod
```

## After Deployment

1. **Test the app** at the Vercel URL
2. **Configure Supabase CORS**:
   - Supabase Dashboard → Settings → API
   - Add your Vercel domain to allowed origins
3. **Configure Supabase Auth** (if using authentication):
   - Supabase Dashboard → Authentication → URL Configuration
   - Add redirect URLs: `https://your-project.vercel.app/**`

## Common Issues

- **Build fails**: Check Vercel build logs for errors
- **App loads but shows errors**: Check browser console, verify environment variables
- **Can't connect to Supabase**: Verify CORS settings and environment variables

For detailed instructions, see `VERCEL_DEPLOYMENT.md`
