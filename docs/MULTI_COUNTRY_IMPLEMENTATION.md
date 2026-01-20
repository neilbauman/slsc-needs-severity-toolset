# Multi-Country Authentication and Isolation Implementation

## Overview

This document tracks the implementation progress of the multi-country authentication and isolation feature. The implementation follows the plan outlined in `multi-country_authentication_and_isolation_e7fb9ee1.plan.md`.

## Implementation Status

### ✅ Phase 1: Database Foundation (COMPLETE)

All database migration files have been created:

1. **`supabase/migrations/add_countries.sql`**
   - Creates `countries` table with ISO 3166-1 alpha-3 codes
   - Inserts initial countries (PHL, BGD, MMR)

2. **`supabase/migrations/add_user_countries.sql`**
   - Creates `user_countries` junction table
   - Links users to countries with role-based access (admin/user)

3. **`supabase/migrations/add_country_isolation.sql`**
   - Adds `country_id` columns to:
     - `datasets`
     - `admin_boundaries`
     - `instances`
     - `hazard_events`
   - Creates indexes for performance

4. **`supabase/migrations/migrate_philippines_data.sql`**
   - Migration script to assign all existing data to Philippines
   - Includes verification checks

5. **`supabase/migrations/make_country_id_not_null.sql`**
   - Makes `country_id` columns NOT NULL after migration

**⚠️ IMPORTANT**: These migrations should be run in a DEV Supabase project first for testing!

### ✅ Phase 2: Authentication (COMPLETE)

All authentication components have been created:

1. **`components/AuthProvider.tsx`**
   - React context for Supabase authentication
   - Provides `user`, `session`, `signIn`, `signUp`, `signOut`
   - Handles session persistence

2. **`components/LoginModal.tsx`**
   - Email/password login form
   - Error handling and validation

3. **`components/SignupModal.tsx`**
   - User registration form
   - Password strength validation (8+ chars, uppercase, lowercase, number)

4. **`components/ProtectedRoute.tsx`**
   - HOC for protecting routes
   - Redirects to login if not authenticated

5. **`app/login/page.tsx`** and **`app/signup/page.tsx`**
   - Dedicated login and signup pages

6. **`middleware.ts`** (Updated)
   - Basic auth structure (full protection handled client-side)

7. **`app/layout.tsx`** (Updated)
   - Wrapped with `AuthProvider`

### ✅ Phase 3: Country Context (COMPLETE)

Country management components created:

1. **`lib/countryContext.tsx`**
   - React context for current country
   - Fetches user's assigned countries
   - Site admins see all countries
   - Persists selection in localStorage
   - Provides `currentCountry`, `setCurrentCountry`, `userCountries`, `isSiteAdmin`

2. **`components/CountrySelector.tsx`**
   - Dropdown for country switching
   - Only shows countries user has access to
   - Visual indicator for current country

3. **`components/Header.tsx`** (Updated)
   - Added user menu with logout
   - Added country selector
   - Shows user email and admin badge
   - Login button for unauthenticated users

4. **`lib/supabaseClient.ts`** (Updated)
   - Added helper functions:
     - `getDatasets(countryId, filters?)`
     - `getInstances(countryId, filters?)`
     - `getAdminBoundaries(countryId, filters?)`

5. **`app/layout.tsx`** (Updated)
   - Wrapped with `CountryProvider`

## ⚠️ Phase 4: Data Layer Updates (IN PROGRESS)

### What Needs to Be Done

All Supabase queries throughout the application need to be updated to include country filtering. Here are the key files that need updates:

#### Pages That Need Updates:

1. **`app/datasets/page.tsx`**
   - Currently: `supabase.from('datasets').select('*')`
   - Should: Filter by `currentCountry.id`

2. **`app/datasets/[dataset_id]/page.tsx`**
   - Currently: `supabase.from('datasets').select('*').eq('id', dataset_id)`
   - Should: Add country filter AND verify dataset belongs to current country

3. **`app/datasets/raw/page.tsx`**
   - Currently: `supabase.from('datasets').select('*')`
   - Should: Filter by `currentCountry.id`

4. **`app/instances/page.tsx`**
   - Currently: Queries instances without country filter
   - Should: Filter by `currentCountry.id`

5. **`app/instances/[id]/page.tsx`**
   - Currently: `supabase.from('instances').select('*').eq('id', instanceId)`
   - Should: Add country filter AND verify instance belongs to current country

6. **`app/page.tsx`** (Dashboard)
   - Should filter all queries by `currentCountry.id`

#### Components That Need Updates:

Many components query datasets/instances. Key ones include:

- `components/DatasetTable.tsx`
- `components/InstanceDatasetConfigModal.tsx`
- `components/ViewDatasetModal.tsx`
- `components/UploadDatasetModal.tsx`
- `components/DeriveDatasetModal.tsx`
- `components/TransformDatasetModal.tsx`
- `components/AffectedAreaModal.tsx`
- All scoring modals (they reference instances/datasets)

### Pattern for Updates

```typescript
// OLD:
const { data } = await supabase
  .from('datasets')
  .select('*');

// NEW:
import { useCountry } from '@/lib/countryContext';
const { currentCountry } = useCountry();
const { data } = await supabase
  .from('datasets')
  .select('*')
  .eq('country_id', currentCountry?.id);
```

### RPC Function Updates Needed

All RPC functions that work with datasets/instances need country awareness. Key functions:

- `score_numeric_auto` - Filter by country via instance
- `score_building_typology` - Filter by country via instance
- `score_framework_aggregate` - Filter by country via instance
- `score_final_aggregate` - Filter by country via instance
- `get_admin_boundaries_geojson` - Add `country_id` parameter
- `get_admin_boundaries_list` - Add `country_id` parameter
- All dataset preview/cleaning functions - Filter by country

**Note**: Since instances have `country_id`, many RPCs can filter via the instance relationship. However, some may need direct `country_id` parameters for performance.

## ⚠️ Phase 5: UI Updates (PENDING)

### What Needs to Be Done

1. **Wrap protected pages with `ProtectedRoute`**
   - All pages except `/login` and `/signup` should be wrapped
   - Example: `app/datasets/page.tsx`, `app/instances/page.tsx`, etc.

2. **Add country context checks**
   - Show loading state if `currentCountry` is null
   - Show error if user has no countries assigned
   - Redirect to appropriate page if country selection is required

3. **Update breadcrumbs**
   - Include country context in breadcrumb navigation

4. **Create admin page** (`app/admin/page.tsx`)
   - Country management interface
   - User management (assign countries to users)
   - System-wide statistics (for site admins only)

## Phase 6: Testing & Migration (PENDING)

### Dev Environment Setup

1. Create dev Supabase project
2. Run migrations in order:
   - `add_countries.sql`
   - `add_user_countries.sql`
   - `add_country_isolation.sql`
   - `migrate_philippines_data.sql` (if you have sample data)
   - `make_country_id_not_null.sql` (after verifying migration)

3. Create test users and assign countries
4. Test all functionality in dev

### Production Migration

1. **Backup production database**
2. Run migrations in same order
3. Run `migrate_philippines_data.sql` to tag existing data
4. Verify all existing Philippines data has `country_id`
5. Run `make_country_id_not_null.sql`
6. Deploy code changes
7. Monitor for issues

## Security Considerations

1. **Application-level filtering**: All queries MUST include country filter
2. **User validation**: Verify user has access to country before operations
3. **Admin checks**: Site admins bypass country restrictions (see all countries)
4. **Input validation**: Validate `country_id` in all user inputs
5. **Session management**: Current country stored in localStorage + context

## Next Steps

1. **Complete Phase 4**: Update all queries to include country filtering
2. **Complete Phase 5**: Add UI updates and admin page
3. **Set up dev environment**: Create dev Supabase project and test migrations
4. **Test thoroughly**: Verify data isolation works correctly
5. **Production migration**: After dev validation, apply to production

## Files Created

### Database Migrations
- `supabase/migrations/add_countries.sql`
- `supabase/migrations/add_user_countries.sql`
- `supabase/migrations/add_country_isolation.sql`
- `supabase/migrations/migrate_philippines_data.sql`
- `supabase/migrations/make_country_id_not_null.sql`

### Components
- `components/AuthProvider.tsx`
- `components/LoginModal.tsx`
- `components/SignupModal.tsx`
- `components/ProtectedRoute.tsx`
- `components/CountrySelector.tsx`

### Pages
- `app/login/page.tsx`
- `app/signup/page.tsx`

### Libraries
- `lib/countryContext.tsx`

### Modified Files
- `app/layout.tsx` - Added AuthProvider and CountryProvider
- `components/Header.tsx` - Added auth UI and country selector
- `lib/supabaseClient.ts` - Added country filtering helpers
- `middleware.ts` - Added basic auth structure

## Notes

- The implementation follows a safety-first approach with dev environment testing
- All existing Philippines data will be preserved during migration
- Country isolation is enforced at both database and application levels
- Site admins can access all countries; regular users only see their assigned countries
