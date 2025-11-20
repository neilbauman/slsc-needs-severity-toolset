# 🚀 Beginner's Guide: Getting Your Application Running

This is a simple, step-by-step guide to get your Philippines SSC Toolset application working as a prototype. Don't worry if you're new to coding - we'll go through everything step by step!

## 📋 What You'll Need

Before we start, make sure you have:
1. **Node.js** installed (version 18 or higher)
   - Check if you have it: Open Terminal and type `node --version`
   - If you don't have it, download from: https://nodejs.org/
2. **A Supabase account** (free tier is fine)
   - Sign up at: https://supabase.com/
3. **A code editor** (you're using Cursor, which is perfect!)

---

## Step 1: Install Dependencies (One-Time Setup)

**What this does:** Downloads all the code libraries your application needs to run.

1. Open **Terminal** (on Mac) or **Command Prompt** (on Windows)
2. Navigate to your project folder:
   ```bash
   cd "/Users/neilbauman/Desktop/Philippines SSC Toolset/philippines-ssc-toolset"
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
   - This might take 2-5 minutes. You'll see lots of text scrolling - that's normal!
   - Wait until you see something like "added 500 packages" or it returns to the command prompt

**✅ Success looks like:** No error messages, and you're back at the command prompt.

**❌ If you get errors:**
- Make sure you're in the right folder
- Try `npm install` again
- If it still fails, copy the error message and ask Cursor for help

---

## Step 2: Set Up Supabase Database

**What this does:** Creates your database tables where your data will be stored.

### 2a. Create a Supabase Project

1. Go to https://supabase.com/ and sign in (or create an account)
2. Click **"New Project"**
3. Fill in:
   - **Name:** "Philippines SSC Toolset" (or any name you like)
   - **Database Password:** Create a strong password (save it somewhere safe!)
   - **Region:** Choose closest to you
4. Click **"Create new project"**
5. Wait 2-3 minutes for it to set up

### 2b. Get Your Supabase Keys

1. In your Supabase project, click **"Settings"** (gear icon) in the left sidebar
2. Click **"API"** in the settings menu
3. You'll see two important values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public key** (a long string of letters and numbers)
4. **Copy both of these** - you'll need them in the next step!

### 2c. Create Database Tables

1. In Supabase, click **"SQL Editor"** in the left sidebar
2. Click **"New query"**
3. Open the file `supabase/schema.sql` from your project in Cursor
4. **Copy all the SQL code** from that file
5. **Paste it** into the Supabase SQL Editor
6. Click **"Run"** (or press Ctrl/Cmd + Enter)
7. You should see "Success. No rows returned" - that's good!

**✅ Success looks like:** No errors, and you see "Success" message.

---

## Step 3: Create Environment Variables File

**What this does:** Stores your Supabase connection information securely.

1. In Cursor, in your project root folder, create a new file called `.env.local`
   - Right-click in the file explorer → New File
   - Name it exactly: `.env.local` (including the dot at the start!)

2. Open `.env.local` and paste this (replace with YOUR values from Step 2b):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

3. Replace:
   - `https://your-project-id.supabase.co` with your actual Project URL
   - `your-anon-key-here` with your actual anon public key

4. **Save the file** (Ctrl/Cmd + S)

**⚠️ Important:** Never share this file or commit it to GitHub! It's already in `.gitignore` to protect it.

---

## Step 4: Start the Development Server

**What this does:** Starts your application so you can see it in your browser.

1. In Terminal, make sure you're in your project folder:
   ```bash
   cd "/Users/neilbauman/Desktop/Philippines SSC Toolset/philippines-ssc-toolset"
   ```

2. Start the server:
   ```bash
   npm run dev
   ```

3. You should see:
   ```
   ▲ Next.js 14.2.1
   - Local:        http://localhost:3000
   ```

**✅ Success looks like:** The server is running and shows a localhost URL.

**❌ Common errors:**
- **"Port 3000 is already in use"**: Another app is using that port. Close it or we can change the port.
- **"Cannot find module"**: Go back to Step 1 and run `npm install` again
- **"Environment variable not found"**: Check Step 3 - make sure `.env.local` exists and has the right values

---

## Step 5: Open Your Application

1. Open your web browser (Chrome, Firefox, Safari, etc.)
2. Go to: **http://localhost:3000**
3. You should see your application!

**✅ Success looks like:** Your application loads in the browser (even if it shows errors, the page loads).

**❌ If the page doesn't load:**
- Make sure Step 4 is still running (the Terminal window should still be active)
- Check that you're going to `http://localhost:3000` (not https)
- Try refreshing the page

---

## Step 6: Test Basic Functionality

Let's see if the basic features work:

1. **Check the homepage** - Does it load without errors?
2. **Try navigating** - Click on links/buttons to see different pages
3. **Check the browser console** for errors:
   - Press `F12` (or right-click → Inspect)
   - Click the "Console" tab
   - Look for red error messages

**Common things to check:**
- ✅ Page loads
- ✅ Navigation works
- ✅ No red errors in console (yellow warnings are usually okay)

---

## 🐛 Debugging Common Issues

### Issue: "Supabase connection failed"
**Fix:**
1. Check your `.env.local` file has the correct values
2. Make sure there are no extra spaces or quotes
3. Restart the server (stop with Ctrl+C, then run `npm run dev` again)

### Issue: "Table doesn't exist" or "Relation does not exist"
**Fix:**
1. Go back to Step 2c
2. Make sure you ran the SQL schema in Supabase
3. Check in Supabase → "Table Editor" that you see `datasets`, `dataset_values_numeric`, etc.

### Issue: "Module not found" errors
**Fix:**
1. Stop the server (Ctrl+C in Terminal)
2. Delete the `node_modules` folder
3. Run `npm install` again
4. Start the server with `npm run dev`

### Issue: Page is blank or shows errors
**Fix:**
1. Open browser console (F12)
2. Look at the error messages
3. Copy the error and ask Cursor: "Help me fix this error: [paste error]"

---

## 📝 Next Steps After It's Running

Once your application is running:

1. **Explore the interface** - Click around and see what's there
2. **Try uploading a test dataset** (if that feature exists)
3. **Check what features work** and what needs fixing
4. **Take notes** on what you want to improve

---

## 🆘 Getting Help

If you get stuck:

1. **Check the error message** - Copy the exact error
2. **Ask Cursor** - Paste the error and ask: "Help me fix this error"
3. **Check the console** - Browser console (F12) often has helpful error messages
4. **Check Supabase logs** - In Supabase dashboard → Logs

---

## 🎯 Quick Reference Commands

Here are the commands you'll use most often:

```bash
# Install dependencies (do this once, or after adding new packages)
npm install

# Start the development server
npm run dev

# Build for production (when you're ready to deploy)
npm run build

# Stop the server (when it's running)
# Press Ctrl+C in the Terminal
```

---

## ✅ Checklist: Is Everything Working?

Before moving forward, check:

- [ ] Dependencies installed (`npm install` completed)
- [ ] Supabase project created
- [ ] Database tables created (schema.sql run successfully)
- [ ] `.env.local` file created with correct values
- [ ] Development server starts (`npm run dev` works)
- [ ] Application opens in browser (http://localhost:3000)
- [ ] No major errors in browser console

If all boxes are checked, you're ready to start debugging and improving your application! 🎉

---

## 💡 Tips for Beginners

1. **Keep Terminal open** - The server needs to keep running
2. **Save files often** - Cursor auto-saves, but good to check
3. **Read error messages** - They usually tell you what's wrong
4. **One step at a time** - Don't try to fix everything at once
5. **Ask questions** - Use Cursor to explain things you don't understand

---

**Remember:** Every developer starts as a beginner. It's okay to make mistakes and ask questions. You've got this! 💪

