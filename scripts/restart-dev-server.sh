#!/bin/bash
# Quick script to restart dev server with clean cache

echo "Stopping Next.js dev server..."
pkill -f "next dev" 2>/dev/null
sleep 2

echo "Clearing build caches..."
rm -rf .next node_modules/.cache

echo "Starting dev server..."
npm run dev
