# HDX Boundaries Upload Status

## Summary

Administrative boundary datasets have been downloaded from OCHA HDX for 3 countries (excluding Philippines which was already complete). The data has been processed into GeoJSON format and SQL migration files have been generated.

## Downloaded Data

### Successfully Processed:
1. **Bangladesh (BGD)**: 5,777 features
   - ADM0: 1 feature
   - ADM1: 8 features  
   - ADM2: 64 features
   - ADM3: 544 features
   - ADM4: 5,160 features

2. **Mozambique (MOZ)**: 582 features
   - ADM0: 1 feature
   - ADM1: 11 features
   - ADM2: 159 features
   - ADM3: 411 features

3. **Sri Lanka (LKA)**: 35 features
   - ADM0: 1 feature (large geometry - 427KB SQL)
   - ADM1: 9 features (very large geometries - 7.4MB SQL)
   - ADM2: 25 features (very large geometries - 19MB SQL)

### Not Processed:
- **Palestine (PSE)**: Uses non-standard structure (level values 84, 85, 88, 99) and different pcode columns. Needs special handling.

## Upload Status

### Already Uploaded:
- BGD ADM0 (1 record)
- BGD ADM1 (8 records)
- BGD ADM2 (64 records) - **Complete**
- MOZ ADM0 (1 record)
- MOZ ADM1 (11 records)

### SQL Files Generated:
All SQL files are in `supabase/migrations/42_upload_*.sql`:

- `42_upload_BGD_ADM2.sql` (34KB) - ✅ Uploaded
- `42_upload_MOZ_ADM2.sql` (85KB) - Ready to upload
- `42_upload_BGD_ADM3.sql` (293KB) - Ready to upload
- `42_upload_MOZ_ADM3.sql` (222KB) - Ready to upload
- `42_upload_LKA_ADM0.sql` (428KB) - Ready to upload
- `42_upload_LKA_ADM1.sql` (7.4MB) - **Too large for API, use SQL Editor**
- `42_upload_LKA_ADM2.sql` (19MB) - **Too large for API, use SQL Editor**
- `42_upload_BGD_ADM4.sql` (2.8MB) - **Too large for API, use SQL Editor**

## Next Steps

### Option 1: Upload via Supabase SQL Editor (Recommended for large files)

1. Go to Supabase Dashboard → SQL Editor
2. Upload and run each SQL file:
   - Start with smaller files (MOZ ADM2, BGD ADM3, MOZ ADM3, LKA ADM0)
   - Then handle large files (LKA ADM1, LKA ADM2, BGD ADM4) - these may need to be split or run directly

### Option 2: Continue via MCP (for smaller files)

The smaller SQL files (< 500KB) can be uploaded via MCP. The large ones (LKA ADM1, LKA ADM2, BGD ADM4) should be run in the SQL Editor.

## Palestine (PSE) Handling

Palestine requires special processing due to:
- Non-standard admin level values (84, 85, 88, 99 instead of 0-5)
- Different column structure (`right_pcod`, `left_pcod` instead of standard pcode columns)

This will need custom script logic to map to standard ADM levels.

## Files Location

- **GeoJSON files**: `data/hdx_boundaries/{COUNTRY_ISO}/`
- **SQL migration files**: `supabase/migrations/42_upload_*.sql`
- **Download script**: `scripts/download_hdx_boundaries.py`
- **Upload scripts**: `scripts/upload_*.py`
