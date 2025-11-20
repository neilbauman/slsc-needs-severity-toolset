# Instance Detail Page - Debugging & Improvements

## Overview
This document describes the debugging and improvements made to `app/instances/[id]/page.tsx` - the instance detail page that displays maps and scoring information.

## Issues Found & Fixed

### ✅ 1. Non-Functional Buttons
**Problem:** The "Adjust Scoring" and "Refresh Data" buttons had no onClick handlers.

**Fix:**
- Added `InstanceScoringModal` integration for "Adjust Scoring" button
- Added `handleRefresh` function for "Refresh Data" button
- Added loading state (`refreshing`) to show feedback during refresh

### ✅ 2. Map Auto-Zoom Timing Issue
**Problem:** The map ref was being used before the map was fully initialized, causing auto-zoom to fail.

**Fix:**
- Created `MapBoundsController` component using React Leaflet's `useMap` hook
- This component properly waits for the map to be ready before fitting bounds
- Moved bounds logic into a separate component that mounts after the map

### ✅ 3. Poor Error Handling
**Problem:** Errors were only logged to console, users saw no feedback.

**Fix:**
- Added `error` state to track and display errors
- Created error UI with retry button
- Added fallback queries if database views don't exist
- Added try-catch blocks around GeoJSON parsing

### ✅ 4. Dataset Display Issues
**Problem:** Showed "Dataset {id}" instead of actual dataset names.

**Fix:**
- Added `getDatasetName` helper function
- Handles multiple data structures (view vs direct table queries)
- Shows actual dataset names or falls back gracefully

### ✅ 5. Missing Loading States
**Problem:** Only had basic "Loading..." text.

**Fix:**
- Improved loading UI with better messaging
- Added refreshing state for button feedback
- Added empty state for when no map data exists

### ✅ 6. Database View Dependencies
**Problem:** Code assumed database views existed, would break if they didn't.

**Fix:**
- Added fallback queries to direct tables if views don't exist
- Graceful degradation - shows what data is available
- Better error messages explaining what's missing

## New Features Added

### 1. Instance Header
- Shows instance name and description
- Back button to instances list
- Better visual hierarchy

### 2. Improved Map Display
- Better popup formatting with admin names
- Handles empty data gracefully
- Proper attribution for OpenStreetMap tiles

### 3. Better Sidebar Organization
- Action buttons in separate section
- Score layers in scrollable section
- Error messages at bottom

### 4. Modal Integration
- "Adjust Scoring" opens `InstanceScoringModal`
- Modal properly refreshes data after saving
- Uses dynamic import to avoid SSR issues

## Testing Checklist

### Basic Functionality
- [ ] Page loads without errors
- [ ] Map displays (if data exists)
- [ ] Instance name and description show correctly
- [ ] Back button works

### Button Functionality
- [ ] "Adjust Scoring" button opens modal
- [ ] Modal can be closed
- [ ] Changes in modal refresh the page data
- [ ] "Refresh Data" button reloads data
- [ ] Refresh button shows "Refreshing..." state

### Map Features
- [ ] Map auto-zooms to data bounds (if data exists)
- [ ] Clicking regions shows popup with score
- [ ] Map colors match score values (green=1, red=5)
- [ ] Empty state shows when no data

### Error Handling
- [ ] Error messages display if database views missing
- [ ] Fallback queries work if views don't exist
- [ ] Retry button works on error page
- [ ] Console shows helpful error messages

### Dataset Display
- [ ] Dataset names show instead of IDs
- [ ] Categories are organized correctly
- [ ] "No datasets" shows when appropriate
- [ ] Handles missing score_config gracefully

## Database Views Expected

The page tries to use these views (with fallbacks if they don't exist):

1. **v_instance_affected_summary** - Instance summary data
   - Fallback: Direct query to `instances` table

2. **v_instance_datasets_view** - Dataset information for instance
   - Fallback: Query `instance_datasets` with join to `datasets`

3. **v_instance_admin_scores_geojson** - GeoJSON for map display
   - Fallback: Shows empty state if not available

## Code Structure

```
InstancePage
├── MapBoundsController (handles auto-zoom)
├── MapContainer
│   ├── TileLayer
│   ├── MapBoundsController
│   └── GeoJSON (for each feature)
├── Sidebar
│   ├── Action Buttons
│   │   ├── Adjust Scoring (opens modal)
│   │   └── Refresh Data
│   └── Score Layers (by category)
└── InstanceScoringModal (conditional)
```

## Common Issues & Solutions

### Issue: Map doesn't zoom to data
**Solution:** Check that `v_instance_admin_scores_geojson` view exists and returns valid GeoJSON.

### Issue: "Adjust Scoring" button does nothing
**Solution:** Check browser console for errors. Ensure `InstanceScoringModal` component exists and imports correctly.

### Issue: Datasets show as "Dataset {id}"
**Solution:** Check that dataset names are in the query results. The fallback query should include `datasets.name`.

### Issue: Page shows error on load
**Solution:** 
1. Check browser console for specific error
2. Verify database views exist in Supabase
3. Check that instance ID is valid
4. Try the fallback queries manually in Supabase SQL editor

## Next Steps for Further Improvement

1. **Add layer selection** - Allow users to toggle which dataset layers show on map
2. **Add score legend** - Show color scale for scores
3. **Add export functionality** - Export map or data
4. **Add filters** - Filter by score range or category
5. **Add statistics panel** - Show summary statistics for the instance
6. **Improve mobile responsiveness** - Better layout for small screens

## Related Files

- `components/InstanceScoringModal.tsx` - Scoring adjustment modal
- `components/InstanceRecomputePanel.tsx` - Recompute functionality (could be integrated)
- `components/ScoreLayerSelector.tsx` - Layer selection (could be integrated)

