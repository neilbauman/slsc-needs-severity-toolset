# Country Configuration & Data Management Audit

This document audits the current application state against the requirements for multi-country support with country-specific configurations.

## Requirements Checklist

### ✅ 1. Countries can define custom names for admin levels
**Status:** ❌ **NOT IMPLEMENTED**

**Current State:**
- Admin levels are hardcoded as `ADM1`, `ADM2`, `ADM3`, `ADM4`
- No country-specific naming (e.g., "Province", "District", "Municipality", "Barangay")
- Admin level names appear throughout the UI as "ADM1", "ADM2", etc.

**What Needs to be Done:**
1. Create `country_admin_levels` table to store custom names per country
2. Update UI to display custom names instead of ADM1-ADM4
3. Update all queries/functions to use the custom level names
4. Add admin interface for countries to configure their admin level names

**Database Schema Needed:**
```sql
CREATE TABLE country_admin_levels (
  id UUID PRIMARY KEY,
  country_id UUID REFERENCES countries(id),
  level_number INTEGER CHECK (level_number BETWEEN 1 AND 4),
  name TEXT NOT NULL, -- e.g., "Province", "District"
  plural_name TEXT, -- e.g., "Provinces", "Districts"
  code_prefix TEXT, -- e.g., "PROV", "DIST"
  order_index INTEGER,
  UNIQUE(country_id, level_number)
);
```

**Files to Update:**
- `app/countries/[country]/page.tsx` - Display custom names
- `components/DefineAffectedAreaModal.tsx` - Use custom names
- `components/AffectedAreaModal.tsx` - Use custom names
- `components/UploadDatasetModal.tsx` - Show custom names in dropdown
- All RPC functions that reference admin levels
- Database queries that filter by admin_level

---

### ✅ 2. Countries can upload GIS data as source of truth
**Status:** ⚠️ **PARTIALLY IMPLEMENTED**

**Current State:**
- `admin_boundaries` table exists with geometry column
- PostGIS extension is enabled
- Geometry can be stored as `GEOGRAPHY(GEOMETRY, 4326)`
- No UI for uploading admin boundaries as GeoJSON/Shapefile
- Admin boundaries appear to be manually inserted or imported via SQL

**What Needs to be Done:**
1. Create admin interface for uploading admin boundaries
2. Support GeoJSON upload (primary format)
3. Support Shapefile upload (via conversion to GeoJSON)
4. Validate geometry on upload
5. Update/replace existing boundaries when re-uploading
6. Store place names, admin codes, and hierarchy from GIS data
7. Make GIS data the authoritative source (prevent manual edits that conflict)

**Database Schema:**
- `admin_boundaries` table already exists with:
  - `admin_pcode` (code)
  - `admin_level` (level)
  - `name` (place name)
  - `parent_pcode` (hierarchy)
  - `geometry` (PostGIS geometry)
  - `country_id` (isolation)

**Files to Create:**
- `components/UploadAdminBoundariesModal.tsx` - Upload interface
- `app/api/admin/upload-boundaries/route.ts` - API endpoint for processing

**Files to Update:**
- `app/admin/page.tsx` - Add link to boundary upload
- `components/DashboardMap.tsx` - Ensure it uses uploaded boundaries

---

### ✅ 3. Countries can upload population data per admin level
**Status:** ⚠️ **PARTIALLY IMPLEMENTED**

**Current State:**
- Population is stored as a regular numeric dataset
- `instances` table has `population_dataset_id` field
- System can aggregate population from ADM4 to ADM3
- No dedicated population upload interface
- Population must be uploaded as a regular dataset, then linked to instance

**What Needs to be Done:**
1. Create dedicated population upload interface
2. Validate that population data matches admin boundaries
3. Allow population data at different admin levels (ADM1-ADM4)
4. Auto-link population dataset to instances
5. Display population in country dashboard
6. Support multiple population datasets (e.g., census years)

**Database Schema:**
- Current: Population stored in `dataset_values_numeric` with `dataset.type = 'numeric'`
- Could add: `is_population BOOLEAN` flag to datasets table
- Or: Keep as-is but improve UI/UX for population-specific uploads

**Files to Create:**
- `components/UploadPopulationModal.tsx` - Dedicated population upload
- Or enhance `components/UploadDatasetModal.tsx` with population-specific flow

**Files to Update:**
- `app/countries/[country]/page.tsx` - Show population statistics
- `components/InstanceConfigModal.tsx` - Better population dataset selection

---

### ✅ 4. Other datasets uploaded as numeric or categorical
**Status:** ✅ **FULLY IMPLEMENTED**

**Current State:**
- `UploadDatasetModal.tsx` supports both numeric and categorical datasets
- Database schema supports both types
- Upload flow handles CSV parsing and validation
- Data stored in `dataset_values_numeric` or `dataset_values_categorical`
- Dataset metadata stored in `datasets` table with `type` field

**What's Working:**
- ✅ Numeric dataset upload (single value per admin area)
- ✅ Categorical dataset upload (multiple categories per admin area)
- ✅ CSV parsing with column mapping
- ✅ Raw data staging before cleaning
- ✅ Data cleaning workflow
- ✅ Country isolation (datasets filtered by country_id)

**Potential Improvements:**
- Better validation of admin_pcode matching
- Support for additional file formats (Excel, Shapefile attributes)
- Bulk upload of multiple datasets
- Dataset templates/pre-configured uploads

---

## Implementation Priority

### Phase 1: Critical (Country-Specific Admin Level Names)
**Priority: HIGH**
- Countries need to see their own terminology
- Affects all UI components
- Required for user acceptance

**Estimated Effort:** 2-3 days
- Database migration
- UI updates (10-15 files)
- RPC function updates

### Phase 2: High (GIS Data Upload)
**Priority: HIGH**
- Source of truth for boundaries
- Required for accurate mapping
- Prevents manual data entry errors

**Estimated Effort:** 3-4 days
- Upload interface
- GeoJSON processing
- Validation and error handling
- Update/replace logic

### Phase 3: Medium (Population Data Upload)
**Priority: MEDIUM**
- Currently works but UX could be better
- Dedicated interface would improve workflow

**Estimated Effort:** 1-2 days
- Enhanced upload modal
- Better validation
- Auto-linking to instances

### Phase 4: Low (Dataset Upload Improvements)
**Priority: LOW**
- Already functional
- Nice-to-have enhancements

**Estimated Effort:** 1-2 days
- Additional file formats
- Bulk upload
- Templates

---

## Database Schema Changes Required

### 1. Country Admin Levels Table
```sql
CREATE TABLE country_admin_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id UUID NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  level_number INTEGER NOT NULL CHECK (level_number BETWEEN 1 AND 4),
  name TEXT NOT NULL, -- Singular: "Province"
  plural_name TEXT, -- Plural: "Provinces"
  code_prefix TEXT, -- Optional: "PROV"
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(country_id, level_number)
);

CREATE INDEX idx_country_admin_levels_country_id ON country_admin_levels(country_id);
```

### 2. Add is_population flag to datasets (optional)
```sql
ALTER TABLE datasets 
  ADD COLUMN IF NOT EXISTS is_population BOOLEAN DEFAULT false;

CREATE INDEX idx_datasets_is_population ON datasets(is_population) WHERE is_population = true;
```

---

## UI Components to Create/Update

### New Components Needed:
1. **`CountryAdminLevelsConfig.tsx`** - Configure admin level names per country
2. **`UploadAdminBoundariesModal.tsx`** - Upload GIS boundaries
3. **`UploadPopulationModal.tsx`** - Dedicated population upload (or enhance existing)

### Components to Update:
1. **`DefineAffectedAreaModal.tsx`** - Use custom admin level names
2. **`AffectedAreaModal.tsx`** - Use custom admin level names
3. **`UploadDatasetModal.tsx`** - Show custom admin level names
4. **`app/countries/[country]/page.tsx`** - Display custom names
5. **`app/datasets/page.tsx`** - Show custom names
6. **All components displaying admin levels** - Replace ADM1-ADM4 with custom names

---

## RPC Functions to Update

All functions that reference admin levels need to:
1. Accept country_id parameter
2. Look up custom admin level names
3. Use level_number instead of hardcoded "ADM1", "ADM2", etc.

**Functions to Review:**
- `get_admin_boundaries_list`
- `get_admin_boundaries_geojson`
- `get_affected_adm3`
- `score_numeric_auto`
- `score_building_typology`
- `score_hazard_event`
- `get_instance_summary`
- All aggregation functions

---

## Testing Checklist

### Admin Level Names:
- [ ] Can configure custom names for each country
- [ ] Custom names display throughout UI
- [ ] Queries work with custom names
- [ ] Default fallback to ADM1-ADM4 if not configured

### GIS Upload:
- [ ] Can upload GeoJSON boundaries
- [ ] Geometry validates correctly
- [ ] Place names extracted from properties
- [ ] Admin codes extracted correctly
- [ ] Hierarchy (parent_pcode) established
- [ ] Re-upload replaces existing data
- [ ] Map displays uploaded boundaries

### Population Data:
- [ ] Can upload population dataset
- [ ] Validates against admin boundaries
- [ ] Supports all admin levels
- [ ] Auto-links to instances
- [ ] Aggregation works (ADM4 → ADM3)

### Dataset Upload:
- [ ] Numeric datasets work
- [ ] Categorical datasets work
- [ ] Country isolation maintained
- [ ] Admin level validation works

---

## Next Steps

1. **Review this audit** with stakeholders
2. **Prioritize features** based on user needs
3. **Create detailed implementation plan** for Phase 1
4. **Begin implementation** starting with admin level names
5. **Test incrementally** as features are added

---

## Questions to Resolve

1. **Admin Level Names:**
   - Should we support more than 4 levels?
   - Do we need code prefixes (e.g., "PROV001")?
   - Should names be translatable (multiple languages)?

2. **GIS Upload:**
   - What GeoJSON property names should we expect?
   - Should we support multiple geometry types (Point, Line, Polygon)?
   - How do we handle boundary updates (merge or replace)?

3. **Population Data:**
   - Should we support multiple population datasets per country?
   - How do we handle population updates over time?
   - Should population be required for instances?

4. **Dataset Upload:**
   - Should we support additional formats (Excel, Shapefile attributes)?
   - Do we need bulk upload capabilities?
   - Should we have dataset templates?
