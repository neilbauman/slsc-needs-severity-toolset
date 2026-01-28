# "Nothing has changed" — how to see the new code

If you’ve been told changes were made but you still see the old UI, use this checklist.

---

## 1. Where the changes are

- **Framework Datasets (DB-driven)** → `components/BaselineConfigPanel.tsx`
- **Where it shows** → **Only** on the **baseline config** page:
  - URL like: `http://localhost:3000/baselines/your-baseline-slug` or `.../baselines/uuid`
  - You get there by: Country → baseline link, or **Responses** → click a baseline, or direct `/baselines/[id]`

So you **must** open a baseline (not home, not country dashboard tiles, not instances).

---

## 2. Run the updated app (local)

Do this **in the project folder** where the code was changed:

```bash
# 1. Go to the project
cd "/Users/neilbauman/Desktop/Philippines SSC Toolset/philippines-ssc-toolset"

# 2. Stop anything already running on port 3000
lsof -ti:3000 | xargs kill -9

# 3. Build and run (this picks up the latest code)
npm start
```

Wait until you see **`✓ Ready in ...`**. Leave that terminal open.

---

## 3. Open the right page and force fresh assets

1. In the browser, go to: **http://localhost:3000**
2. **Hard refresh** so the browser doesn’t use old JS: **Cmd+Shift+R** (Mac) or **Ctrl+Shift+R** (Windows).
3. Navigate to a **baseline**:
   - From home: pick a country → on the country page, open the baseline (e.g. “Configure baseline” or the baseline card).
   - Or: open **Responses** → click a baseline.
   - Or: if you know the slug/id, go to **http://localhost:3000/baselines/your-baseline-slug** (or `/baselines/uuid`).

---

## 4. How to know the new code is running

On the **Framework Datasets** block (on that baseline page), you should see:

- A small green **“from DB”** badge next to the “Framework Datasets” heading.
- In the hint text: **“X sections: pillars, themes, subthemes”** (instead of only “Order: P1 → P2 → P3…”).
- **Section headers** like **“P1 – The Shelter”**, **“P3.1 – …”**, **“P3.1.2 – …”** etc., one block per pillar/theme/subtheme from the DB (or 5 fallback sections if the DB returns nothing).

If you **don’t** see the “from DB” badge and “X sections”, you’re still on the old bundle (see below).

---

## 5. Chunk 404s / "Failed to fetch RSC payload" on home or baseline

If the console shows 404s for `/_next/static/chunks/...` or "Failed to fetch RSC payload" for `/datasets` or `/instances`:

1. **Stop the server** (Ctrl+C in the terminal).
2. **Clean build:**  
   `rm -rf .next`  
   then  
   `npm start`
3. Wait for "✓ Ready", open **http://localhost:3000**, then **hard refresh** (Cmd+Shift+R).

Home-page links to "All Datasets" and "Legacy Instances" now use `prefetch={false}` so those routes are not prefetched on load; chunks load only when you click. That avoids chunk 404s from stale build hashes when you're on the home page.

**Baseline config:** If you see `GET /baselines?rsc=... 404`, that's fixed by adding a `/baselines` page that redirects to `/responses`. Do a clean build (step 2) so the new route is in the bundle.

---

## 6. If you still see the old UI

| Check | What to do |
|-------|------------|
| **Wrong URL** | You must be on `/baselines/...`. Home, country summary, and instance pages don’t use BaselineConfigPanel. |
| **Old server still running** | Quit any terminal where you ran `npm run dev` or `npm start` before the changes. Run `lsof -ti:3000 \| xargs kill -9`, then `npm start` again. |
| **Cached build** | From the project folder: `rm -rf .next` then `npm start`. |
| **Different project folder** | Confirm you’re in `philippines-ssc-toolset` (or the repo where these edits were made). |
| **Deployed app (eercel, etc.)** | Local edits don’t affect the live site until you push and the project rebuilds. Push to the connected branch, wait for the new deployment, then open the **deployed** baseline URL and hard refresh. |

---

## 7. Quick confirmation

1. `cd` to the project folder  
2. `lsof -ti:3000 | xargs kill -9`  
3. `npm start`  
4. Wait for “✓ Ready”  
5. Open **http://localhost:3000/baselines/ANY_VALID_SLUG_OR_ID**  
6. **Cmd+Shift+R** (or Ctrl+Shift+R)  
7. Look for the green **“from DB”** badge next to “Framework Datasets”.

If you see that badge and “X sections: pillars, themes, subthemes”, the new code is running.
