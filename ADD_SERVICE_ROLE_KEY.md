# Adding Supabase Service Role Key

The user creation feature requires the Supabase Service Role Key to be set as an environment variable.

## Step 1: Get Your Service Role Key

1. Go to your Supabase project: https://supabase.com/dashboard/project/yzxmxwppzpwfolkdiuuo
2. Click **Settings** (gear icon in left sidebar)
3. Click **API** (under Project Settings)
4. Scroll down to **Project API keys**
5. Find the **`service_role`** key (it's labeled as "secret" - this is the one you need)
6. Click the **eye icon** to reveal it, then **copy** the key

⚠️ **Important:** This key has full admin access to your database. Never expose it in client-side code or commit it to git.

## Step 2: Add to Vercel (Production)

1. Go to your Vercel project: https://vercel.com/dashboard
2. Click on your project: **slsc-needs-severity-toolset**
3. Go to **Settings** → **Environment Variables**
4. Click **Add New**
5. Enter:
   - **Name:** `SUPABASE_SERVICE_ROLE_KEY`
   - **Value:** (paste the service role key you copied)
   - **Environment:** Select all (Production, Preview, Development)
6. Click **Save**

## Step 3: Redeploy

After adding the environment variable:

1. Go to **Deployments** tab
2. Find the latest deployment
3. Click the three dots (⋯) menu
4. Click **Redeploy**
5. Wait for deployment to complete (2-3 minutes)

## Step 4: Test

1. Go to your app: `https://slsc-needs-severity-toolset.vercel.app`
2. Navigate to `/admin/users`
3. Click "Create User"
4. Try creating a user - the error should be gone!

## For Local Development

If you're testing locally, also add it to `.env.local`:

1. Open `.env.local` in your project root
2. Add:
   ```
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```
3. Restart your dev server (`npm run dev`)

## Security Notes

- ✅ The service role key is only used in server-side API routes
- ✅ It's never exposed to the client
- ✅ It's stored securely in Vercel environment variables
- ❌ Never commit it to git (it's already in `.gitignore`)
