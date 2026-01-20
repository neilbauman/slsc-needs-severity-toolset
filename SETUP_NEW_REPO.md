# Setting Up New Repository for SLSC Needs Severity Toolset

Since this is a separate project with its own Supabase and Vercel projects, let's create a dedicated GitHub repository.

## Step 1: Create New GitHub Repository

1. **Go to GitHub**: https://github.com/new
2. **Repository name**: `slsc-needs-severity-toolset` (or your preferred name)
3. **Description**: "Multi-country SLSC Needs Severity Toolset - data and decision support system"
4. **Visibility**: 
   - **Private** (recommended for now)
   - Or **Public** if you want it open
5. **DO NOT** initialize with README, .gitignore, or license (we already have these)
6. **Click "Create repository"**

## Step 2: Update Git Remote

After creating the repo, GitHub will show you commands. Use these:

```bash
cd "/Users/neilbauman/Desktop/Philippines SSC Toolset/philippines-ssc-toolset"

# Remove old remote (if you want to keep it separate)
# git remote remove origin

# Add new remote (replace YOUR_USERNAME with your GitHub username)
git remote set-url origin https://github.com/YOUR_USERNAME/slsc-needs-severity-toolset.git

# Or if you prefer SSH:
# git remote set-url origin git@github.com:YOUR_USERNAME/slsc-needs-severity-toolset.git

# Push to new repository
git push -u origin feature/multi-country-auth

# If you want main/master as the default branch:
git checkout -b main
git push -u origin main
```

## Step 3: Verify

```bash
git remote -v
# Should show your new repository URL
```

## Step 4: Deploy to Vercel from New Repo

1. Go to https://vercel.com/new
2. Import the **new repository** (`slsc-needs-severity-toolset`)
3. Configure and deploy as usual

## Alternative: Keep Both Remotes

If you want to keep the old remote for reference:

```bash
# Add new remote with a different name
git remote add slsc https://github.com/YOUR_USERNAME/slsc-needs-severity-toolset.git

# Push to new repo
git push -u slsc feature/multi-country-auth
```

Then you can push to either:
- `git push origin` → old repo
- `git push slsc` → new SLSC repo
