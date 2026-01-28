# When the app won't load — do this

Follow these steps **in order** (copy-paste into Terminal):

## 1. Open the project folder

```bash
cd "/Users/neilbauman/Desktop/Philippines SSC Toolset/philippines-ssc-toolset"
```

## 2. Stop anything on port 3000 (if it’s stuck)

```bash
lsof -ti:3000 | xargs kill -9
```

## 3. Start the app the reliable way

```bash
npm start
```

Wait until you see **`✓ Ready in ...`** in the terminal. Do not close that terminal.

## 4. Open the app in the browser

- Go to: **http://localhost:3000**
- Do a **hard refresh** so the browser doesn’t use old cached files:
  - **Mac:** Cmd+Shift+R  
  - **Windows:** Ctrl+Shift+R  

## 5. If it’s still blank or “Loading…” forever

- Check that **.env.local** exists and has:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- If the page shows “Loading is taking longer than expected”, the app is running but Supabase is slow or not configured — check the yellow box on the page and fix env/DB.

## Summary

| You see this | Do this |
|--------------|---------|
| Blank page, “Can’t reach”, chunk/500 errors | Run `npm start`, wait for “✓ Ready”, then open http://localhost:3000 and hard-refresh |
| “Loading…” forever after 10+ seconds | Check .env.local and Supabase; use “Retry” or “Reload” on the page |
| Port already in use | Run `lsof -ti:3000 \| xargs kill -9` then `npm start` again |

**Do not use `npm run dev` for normal use** — use `npm start`.
