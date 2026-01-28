# Why your changes aren’t appearing (and how to fix it)

## Quick answers

| Goal | What to do |
|------|------------|
| See edits **on the live site** | Push to Git; if Vercel is connected, it deploys. **Yes, use Vercel.** |
| See edits **locally** | Depends how you run the app (see below). |

---

## 1. Getting changes onto the live site (Vercel)

**Yes — pushing to Vercel (via Git) is the right way to get updates live.**

1. **Connect the repo to Vercel** (if you haven’t):  
   [VERCEL_CONNECT_REPO.md](./VERCEL_CONNECT_REPO.md) — connect the GitHub repo and set env vars.

2. **Deploy every time you want the site updated:**
   - Commit and push to the branch Vercel uses (often `main`):
     ```bash
     git add -A
     git commit -m "Your change description"
     git push origin main
     ```
   - Vercel will build and deploy. In a few minutes your changes are live.

3. **Confirm in the Vercel dashboard:**  
   [vercel.com/dashboard](https://vercel.com/dashboard) → your project → **Deployments**. Latest commit should show “Building” then “Ready”.

---

## 2. Getting changes to appear **locally**

Local behavior depends on how you start the app.

### If you use `npm start` (production build)

- The app serves a **built** bundle. It does **not** pick up code changes automatically.
- **To see new changes:**  
  1. Stop the server (Ctrl+C in the terminal).  
  2. Run `npm start` again and wait for “✓ Ready”.  
  3. Open or refresh http://localhost:3000 and do a **hard refresh** (Cmd+Shift+R or Ctrl+Shift+R).

So: **after editing code, restart `npm start` and hard-refresh.** Otherwise you’ll keep seeing the old build.

### If you use `npm run dev` (development with hot reload)

- Edits *should* show without restarting, but this setup has been flaky (blank/chunk errors).
- If the page is blank or broken: stop dev, then run `npm start` and hard-refresh as above.

### Checklist when “nothing changes” locally

1. **Save the file** in your editor (Cmd+S / Ctrl+S).
2. **Restart the app** if you’re on `npm start` (stop → `npm start` again).
3. **Hard-refresh the browser** (Cmd+Shift+R / Ctrl+Shift+R).
4. **Confirm the URL** is http://localhost:3000 (and that you’re not looking at a Vercel URL).

---

## 3. Suggested workflow

1. **Do your edits** in Cursor/VS Code.
2. **Test locally (optional):**  
   - Run `npm start`, wait for “✓ Ready”, then open http://localhost:3000 and hard-refresh.  
   - Or use `npm run dev` and refresh when it misbehaves.
3. **Put changes live:**  
   - Commit and push to the branch connected to Vercel.  
   - Wait for the deployment to finish; your changes will appear on the Vercel URL.

Using **Vercel as the place you “ship” to** keeps the live site in sync with your repo and makes it clear where the latest version is.

---

## 4. If the live site still doesn’t update after push

- In **Vercel → Project → Settings → Git**: check which branch is used for “Production”.
- Push to that branch (e.g. `main`): `git push origin main`.
- In **Vercel → Deployments**: confirm a new deployment started for your latest commit.
- If build fails, open the deployment and read the build logs; fix the reported error and push again.
