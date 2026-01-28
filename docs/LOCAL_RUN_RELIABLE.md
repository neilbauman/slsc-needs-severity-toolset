# Reliable local run (default)

**By default, use `npm start`.** It builds then serves in production so the app does not crash from dev-server chunk issues.

## Default: stable run

```bash
npm start
```

Wait for **"✓ Ready"**, then open **http://localhost:3000** and **hard refresh** (Cmd+Shift+R or Ctrl+Shift+R) the first time.

- **Crashes / 500s / "Something went wrong":** run `npm start` again, then hard-refresh. Avoid `npm run dev` for daily use.
- **Port stuck:** `lsof -ti:3000 | xargs kill -9` then `npm start`.
- **Hot reload (less stable):** `npm run dev` — only if you need it.

## Scripts

| Command | Purpose |
|--------|--------|
| **`npm start`** | Default reliable run (build + serve). Use this. |
| `npm run start:serve` | Serve only (run after a build). |
| `npm run build` | Build only. |
| `npm run dev` | Dev server with hot reload (can 500/crash). |
| `./scripts/run-reliable.sh` | Fallback: kill port, clean, build, serve. |

## If it still fails

1. Clear and rebuild:
   ```bash
   rm -rf .next node_modules/.cache
   npm start
   ```
2. Clear browser cache or use an Incognito/Private window so old HTML (wrong asset paths) is not used.
