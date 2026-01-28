# Crash Prevention Guide

This guide helps prevent and fix common Next.js crashes in the application.

## Common Crash Causes

1. **Corrupted Build Cache** - Most common cause
   - Symptoms: "Cannot find module './vendor-chunks/@supabase.js'" or similar webpack errors
   - Fix: Clear `.next` directory and restart

2. **Module Resolution Issues**
   - Symptoms: Webpack module not found errors
   - Fix: Clear caches and rebuild

3. **Memory Issues**
   - Symptoms: Server crashes or becomes unresponsive
   - Fix: Restart server, check for memory leaks

## Quick Fix Scripts

### Option 1: Use the automated script
```bash
./scripts/fix-crashes.sh
```

### Option 2: Manual fix
```bash
# Stop the server (Ctrl+C)
pkill -f "next dev"

# Clear caches
rm -rf .next
rm -rf node_modules/.cache

# Restart
npm run dev
```

## Prevention Measures

The application now includes:

1. **Error Boundaries** - Catch React errors before they crash the app
2. **Crash Recovery** - Automatic retry logic for transient errors
3. **Dynamic Imports** - Reduces initial bundle size and SSR issues
4. **Better Error Messages** - Clear instructions when crashes occur

## If Crashes Persist

1. Check browser console (F12) for specific errors
2. Check terminal where `npm run dev` is running
3. Try the fix-crashes script
4. If still failing, check:
   - Node.js version (should be 18+)
   - Dependencies are up to date: `npm install`
   - No port conflicts (another process on :3000)

## Monitoring

The ErrorBoundary component will:
- Catch errors and display user-friendly messages
- Provide retry options
- Show detailed error info for debugging
- Detect webpack errors and suggest fixes
