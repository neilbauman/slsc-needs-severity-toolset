# Data Directory Audit Report
**Generated:** January 26, 2026

## Executive Summary

The project contains **4.9GB** of data files in the `data/` directory that are causing Cursor to be sluggish. These files are **NOT needed** for the application to run - they are only used by import/processing scripts. Once data is uploaded to Supabase, these files can be safely removed or archived.

## Key Findings

### 1. Application Code Analysis
✅ **The application code (app/, components/) does NOT read from the data/ directory**
- All data comes from Supabase database via API calls
- No file system reads of data/ directory in production code
- Data is uploaded via UI modals directly to Supabase

### 2. Data Directory Breakdown (4.9GB total)

| Directory | Size | Status | Used By | Can Delete? |
|-----------|------|--------|---------|------------|
| `hdx_boundaries_reimport/` | 3.1GB | ⚠️ Backup/Reimport | `reimport_all_boundaries.py`, `replace_phl_adm0.py` | ✅ Yes (if data already in Supabase) |
| `temp_boundaries/` | 868MB | ⚠️ Temporary | `reimport_boundaries_single_country.py`, `import_sri_lanka_adm4_boundaries.py` | ✅ Yes (temporary files) |
| `hdx_boundaries/` | 540MB | ⚠️ Original download | `upload_boundaries_to_supabase.py` | ✅ Yes (if data already in Supabase) |
| `madagascar_data/` | 227MB | ⚠️ Import source | `add_madagascar_country.py` | ✅ Yes (if data already in Supabase) |
| `madagascar_fix/` | 210MB | ⚠️ Batch SQL files | `fix_madagascar_names.py` | ✅ Yes (321 SQL files - already processed) |
| `upload_batches/` | 304KB | ⚠️ Batch uploads | `upload_bgd_adm3_batches.py` | ✅ Yes (if uploads complete) |
| `bangladesh_data/` | Small | ⚠️ Import source | `import_bangladesh_data.py` | ✅ Yes (if data already in Supabase) |
| `sri_lanka_data/` | Small | ⚠️ Import source | `import_sri_lanka_data.py` | ✅ Yes (if data already in Supabase) |
| `palestine_data/` | 7.4MB | ⚠️ Import source | `add_palestine_data.py` | ✅ Yes (if data already in Supabase) |
| `mozambique_population/` | 244KB | ⚠️ Import source | `import_mozambique_population.py` | ✅ Yes (if data already in Supabase) |
| `phl_adm0_simplified.geojson` | 1.2MB | ⚠️ Single file | Unknown | ⚠️ Check usage |
| `dataset_audit_report.json` | 20KB | ℹ️ Report | Audit script | ✅ Yes (can regenerate) |
| `upload_batches.txt` | 29MB | ⚠️ Batch list | `upload_to_supabase_mcp.py` | ✅ Yes (if uploads complete) |

### 3. Large Migration Files

| File | Size | Status |
|------|------|--------|
| `supabase/migrations/42_upload_hdx_boundaries.sql` | 30MB | ⚠️ Large SQL migration |
| `supabase/migrations/42_upload_hdx_boundaries_complete.sql` | 29MB | ⚠️ Large SQL migration |
| `supabase/migrations/42_upload_LKA_ADM2.sql` | 18MB | ⚠️ Large SQL migration |

**Note:** These migration files are already applied to the database. They're kept for version control but could slow down indexing.

### 4. Build Artifacts

| Directory | Size | Status |
|-----------|------|--------|
| `.next/` | 85MB | ℹ️ Can be regenerated |
| `node_modules/` | 324MB | ℹ️ Required for development |

## Recommendations

### Immediate Actions (High Impact)

1. **Create `.cursorignore` file** to exclude data/ from Cursor indexing:
   ```
   data/
   .next/
   node_modules/
   *.tsbuildinfo
   ```

2. **Archive or delete data/ directory** (after verifying data is in Supabase):
   - Move to external storage if you might need to re-import
   - Or delete if confident data is safely in Supabase

3. **Clean `.next/` build cache**:
   ```bash
   rm -rf .next
   ```

### Optional Actions (Medium Impact)

4. **Consider splitting large migration files**:
   - The 18-30MB SQL files could be split or compressed
   - Or add to `.cursorignore` if not actively editing

5. **Archive processed batch files**:
   - `data/madagascar_fix/` (321 SQL files) - already processed
   - `data/upload_batches/` - if uploads are complete

### Verification Steps

Before deleting data files, verify:
1. ✅ All boundaries are in Supabase `admin_boundaries` table
2. ✅ All datasets are in Supabase `datasets` table
3. ✅ All values are in Supabase `dataset_values_*` tables
4. ✅ You can re-download from HDX if needed (scripts support this)

## Script Usage Summary

### Scripts that READ from data/:
- `upload_boundaries_to_supabase.py` → reads `data/hdx_boundaries/`
- `reimport_all_boundaries.py` → writes to `data/hdx_boundaries_reimport/`
- `reimport_boundaries_single_country.py` → writes to `data/temp_boundaries/`
- `import_bangladesh_data.py` → reads `data/bangladesh_data/`
- `import_sri_lanka_data.py` → reads `data/sri_lanka_data/`
- `import_sri_lanka_adm4_boundaries.py` → reads `data/temp_boundaries/`
- `add_palestine_data.py` → reads `data/palestine_data/`
- `add_madagascar_country.py` → reads `data/madagascar_data/`
- `fix_madagascar_names.py` → writes to `data/madagascar_fix/`
- `replace_phl_adm0.py` → reads `data/hdx_boundaries_reimport/`
- `upload_bgd_adm3_batches.py` → writes to `data/upload_batches/`

### Scripts that DOWNLOAD fresh data:
- `download_hdx_boundaries.py` → downloads from HDX API (doesn't need existing files)
- `reimport_all_boundaries.py` → downloads fresh from HDX
- Most import scripts can download from HDX if files don't exist

## Conclusion

**The data/ directory (4.9GB) is the primary cause of Cursor sluggishness.** These files are:
- ✅ Safe to delete if data is already in Supabase
- ✅ Can be re-downloaded using the provided scripts
- ✅ Not needed for the application to run
- ✅ Only used during initial data import/processing

**Recommended action:** Create `.cursorignore` and delete/archive the `data/` directory to immediately improve Cursor performance.
