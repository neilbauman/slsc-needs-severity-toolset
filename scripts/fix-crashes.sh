#!/bin/bash
# Fix Next.js chunk/build crashes (404 on _next/static, "Loading chunk failed", etc.)
# Run from project root: ./scripts/fix-crashes.sh

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

echo "🔧 Fixing Next.js crashes (project root: $ROOT)"

# 1. Stop dev server and free port 3000
echo "1. Stopping dev server and freeing port 3000..."
pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
for _ in 1 2 3 4 5; do
  if lsof -ti:3000 >/dev/null 2>&1; then
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    sleep 2
  else
    break
  fi
done
sleep 2

# 2. Remove all build/cache directories
echo "2. Clearing build and cache..."
rm -rf "$ROOT/.next"
rm -rf "$ROOT/node_modules/.cache"
rm -rf "$ROOT/.turbo" 2>/dev/null || true
rm -rf "$ROOT/node_modules/.next" 2>/dev/null || true

# 3. Pre-create webpack cache dirs so dev server doesn't hit ENOENT and fail to serve chunks
echo "3. Creating cache directories..."
mkdir -p "$ROOT/.next/cache/webpack/client-development"
mkdir -p "$ROOT/.next/cache/webpack/server-development"

# 4. Remove any stray webpack cache files
echo "4. Clearing webpack cache files..."
find "$ROOT" -maxdepth 4 -name "*.webpack*" -type f -delete 2>/dev/null || true

# 5. Optional: ensure deps are present (no full reinstall to save time)
echo "5. Checking dependencies..."
(cd "$ROOT" && npm install --prefer-offline --no-audit 2>/dev/null) || true

# 6. Start dev server from project root
echo "6. Starting dev server..."
echo ""
echo "   ⏳ Wait until you see \"✓ Ready\" and \"✓ Compiled /\" before opening http://localhost:3000"
echo "   ⏳ If you see 404s for chunks, hard-refresh (Cmd+Shift+R) after the first compile."
echo ""
(cd "$ROOT" && npm run dev)
