# Downloading GIS Datasets from OCHA HDX

This guide explains how to download and upload administrative boundary datasets from the Humanitarian Data Exchange (HDX) for each country.

## Overview

The scripts in this directory will:
1. Download Common Operational Dataset (COD) administrative boundaries from HDX
2. Process them into standardized GeoJSON format
3. Upload them to Supabase

## Prerequisites

Install required Python packages:

```bash
pip install requests shapely geopandas pyproj supabase python-dotenv
```

## Step 1: Download Boundaries

Run the download script to fetch datasets from HDX:

```bash
python scripts/download_hdx_boundaries.py
```

This will:
- Download administrative boundary shapefiles for each country (BGD, MOZ, PSE, PHL, LKA)
- Extract and process them into GeoJSON files
- Save them to `data/hdx_boundaries/{COUNTRY_ISO}/`

## Step 2: Review Downloaded Data

Check the downloaded GeoJSON files:

```bash
ls -la data/hdx_boundaries/*/
```

Each country will have files like:
- `{COUNTRY}_ADM0.geojson` - Country level
- `{COUNTRY}_ADM1.geojson` - First admin level (e.g., Regions, Provinces)
- `{COUNTRY}_ADM2.geojson` - Second admin level (e.g., Districts)
- `{COUNTRY}_ADM3.geojson` - Third admin level (e.g., Municipalities)
- `{COUNTRY}_ADM4.geojson` - Fourth admin level (if available)

## Step 3: Upload to Supabase

Before uploading, ensure your `.env` file has:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Then run:

```bash
python scripts/upload_boundaries_to_supabase.py
```

This will:
- Read all GeoJSON files
- Upload boundaries to the `admin_boundaries` table
- Link them to the correct country via `country_id`
- Handle duplicates using upsert

## HDX Dataset Sources

The scripts use these HDX datasets:

- **Bangladesh (BGD)**: `cod-ab-bgd` - Subnational Administrative Boundaries
- **Mozambique (MOZ)**: `cod-ab-moz` - Subnational Administrative Boundaries  
- **Palestine (PSE)**: `cod-ab-pse` - Subnational Administrative Boundaries
- **Philippines (PHL)**: `cod-ab-phl` - Subnational Administrative Boundaries
- **Sri Lanka (LKA)**: `cod-ab-lka` - Subnational Administrative Boundaries

## Troubleshooting

### Download Fails

If a download fails:
1. Check your internet connection
2. Verify the HDX dataset ID is correct
3. Check HDX website directly: https://data.humdata.org/dataset/cod-ab-{iso}

### Upload Fails

If upload fails:
1. Verify Supabase credentials in `.env`
2. Check that the `admin_boundaries` table exists
3. Ensure PostGIS extension is enabled in Supabase
4. Check that country records exist in the `countries` table

### Geometry Issues

If geometries don't display correctly:
1. Verify CRS is EPSG:4326 (WGS84)
2. Check that geometries are valid (no self-intersections)
3. Use QGIS or similar tool to validate GeoJSON files

## Manual Alternative

If the scripts don't work, you can manually download from HDX:

1. Visit https://data.humdata.org/dataset/cod-ab-{iso}
2. Download the shapefile or GeoJSON
3. Process and upload using your preferred GIS tool or database client

## Notes

- HDX datasets are updated periodically - check for newer versions
- Some countries may have different admin level structures
- The scripts attempt to auto-detect column names, but manual adjustment may be needed
- Large datasets may take time to download and upload
