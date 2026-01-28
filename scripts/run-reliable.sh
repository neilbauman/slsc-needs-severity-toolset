#!/bin/bash
# Fallback: stop everything, clean build, run in production.
# Default run is "npm start" (same idea, no kill). Use this if port is stuck or npm start fails.

set -e
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

echo "Stopping anything on port 3000..."
pkill -f "next" 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 2

echo "Cleaning and building..."
rm -rf .next node_modules/.cache
mkdir -p .next/cache/webpack/client-production .next/cache/webpack/server-production
npm run build

echo "Starting production server..."
echo ""
echo "  When you see \"✓ Ready\", open http://localhost:3000"
echo "  Do a hard refresh (Cmd+Shift+R or Ctrl+Shift+R) so the browser uses fresh assets."
echo ""
(cd "$ROOT" && exec npm run start)
