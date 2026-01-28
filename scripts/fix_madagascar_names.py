#!/usr/bin/env python3
"""
Fix Madagascar admin boundary names.

This script re-downloads the HDX boundary data and updates the name column
in the admin_boundaries table, which was incorrectly set to pcodes during
the initial import.
"""

import os
import sys
import requests
import zipfile
import json
from pathlib import Path
import geopandas as gpd
from supabase import create_client
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env.local")
load_dotenv()

# HDX API base URL
HDX_API_BASE = "https://data.humdata.org/api/3/action"

# Madagascar boundaries dataset on HDX
MDG_BOUNDARIES_DATASET_ID = "26fa506b-0727-4d9d-a590-d2abee21ee22"


def get_hdx_dataset_info(dataset_id: str) -> dict:
    """Get dataset information from HDX API."""
    url = f"{HDX_API_BASE}/package_show"
    params = {"id": dataset_id}
    
    try:
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        if data.get("success"):
            return data.get("result")
        else:
            print(f"Error: {data.get('error', {}).get('message', 'Unknown error')}")
            return None
    except Exception as e:
        print(f"Error fetching dataset {dataset_id}: {e}")
        return None


def find_name_column(gdf, admin_level: str) -> str:
    """Find the best name column for a given admin level."""
    level_num = admin_level.replace("ADM", "")
    
    # Priority order for name column patterns
    name_patterns = [
        # Exact level match patterns (highest priority)
        f"adm{level_num}_en",      # ADM3_EN (English name)
        f"adm{level_num}_name",    # ADM3_NAME
        f"adm{level_num}name",     # ADM3NAME
        f"adm{level_num}_fr",      # ADM3_FR (French name - common for Madagascar)
        f"adm{level_num}_ref",     # ADM3_REF (Reference name)
        f"adm{level_num}nm",       # ADM3NM
        # Generic patterns (lower priority)
        "name_en", "name_fr", "name",
        "shapename", "shape_name",
    ]
    
    for pattern in name_patterns:
        for col in gdf.columns:
            col_lower = col.lower()
            if col_lower == pattern or col_lower.endswith(f"_{pattern}"):
                return col
    
    # Fallback: any column with 'name' that's not a pcode column
    for col in gdf.columns:
        col_lower = col.lower()
        if "name" in col_lower and "pcode" not in col_lower:
            if admin_level.lower() in col_lower:
                return col
    
    # Last resort: any name column
    for col in gdf.columns:
        col_lower = col.lower()
        if "name" in col_lower and "pcode" not in col_lower:
            return col
    
    return None


def find_pcode_column(gdf, admin_level: str) -> str:
    """Find the pcode column for a given admin level."""
    for col in gdf.columns:
        col_lower = col.lower()
        if "pcode" in col_lower and admin_level.lower() in col_lower:
            return col
        if admin_level.lower() in col_lower and "code" in col_lower:
            return col
    
    # Fallback
    for col in gdf.columns:
        if "pcode" in col.lower():
            return col
    
    return None


def download_boundaries(output_dir: Path) -> Path:
    """Download Madagascar boundaries from HDX."""
    print("\n" + "=" * 60)
    print("DOWNLOADING MADAGASCAR BOUNDARIES")
    print("=" * 60)
    
    dataset_info = get_hdx_dataset_info(MDG_BOUNDARIES_DATASET_ID)
    if not dataset_info:
        print("Error: Could not fetch boundaries dataset")
        return None
    
    # Find the resource
    resources = dataset_info.get("resources", [])
    resource = None
    
    for res in resources:
        format_lower = res.get("format", "").lower()
        if "shp" in format_lower or "shapefile" in format_lower or "zip" in format_lower:
            resource = res
            break
        if "geojson" in format_lower:
            resource = res
            break
    
    if not resource:
        print("Error: Could not find boundary resource")
        return None
    
    print(f"✓ Found resource: {resource.get('name', 'Unnamed')}")
    
    # Download
    resource_url = resource["url"]
    print(f"Downloading from {resource_url}...")
    
    file_ext = Path(resource_url).suffix.lower()
    if not file_ext:
        file_ext = ".zip"
    
    file_path = output_dir / f"mdg_boundaries{file_ext}"
    
    response = requests.get(resource_url, stream=True, timeout=600)
    response.raise_for_status()
    
    with open(file_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    
    print(f"✓ Downloaded to {file_path}")
    
    # Extract if zip
    extract_dir = output_dir / "mdg_boundaries"
    extract_dir.mkdir(exist_ok=True)
    
    if file_ext == ".zip":
        with zipfile.ZipFile(file_path, 'r') as z:
            z.extractall(extract_dir)
        print(f"✓ Extracted to {extract_dir}")
    
    return extract_dir


def update_names(supabase, extract_dir: Path):
    """Update names in admin_boundaries table from source files."""
    print("\n" + "=" * 60)
    print("UPDATING BOUNDARY NAMES")
    print("=" * 60)
    
    # Get Madagascar country_id
    country_resp = supabase.table("countries").select("id").eq("iso_code", "MDG").execute()
    if not country_resp.data:
        print("Error: Madagascar not found in countries table")
        return False
    
    country_id = country_resp.data[0]["id"]
    print(f"✓ Found Madagascar country_id: {country_id}")
    
    # Find shapefiles
    shp_files = sorted(extract_dir.glob("*.shp"))
    if not shp_files:
        geojson_files = list(extract_dir.glob("*.geojson"))
        if not geojson_files:
            print("Error: No shapefiles or GeoJSON files found")
            return False
        shp_files = geojson_files
    
    total_updated = 0
    
    for shp_file in sorted(shp_files):
        print(f"\nProcessing {shp_file.name}...")
        
        try:
            gdf = gpd.read_file(shp_file)
            print(f"  Loaded {len(gdf)} features")
            print(f"  Columns: {list(gdf.columns)}")
            
            # Determine admin level from filename
            admin_level = None
            filename_lower = shp_file.name.lower()
            
            for lvl in ["adm0", "adm1", "adm2", "adm3", "adm4"]:
                if lvl in filename_lower:
                    admin_level = lvl.upper()
                    break
            
            if not admin_level:
                print(f"  ⚠️  Could not determine admin level, skipping")
                continue
            
            print(f"  Admin level: {admin_level}")
            
            # Find columns
            pcode_col = find_pcode_column(gdf, admin_level)
            name_col = find_name_column(gdf, admin_level)
            
            if not pcode_col:
                print(f"  ⚠️  Could not find pcode column, skipping")
                continue
            
            if not name_col:
                print(f"  ⚠️  Could not find name column, skipping")
                continue
            
            print(f"  Using pcode column: {pcode_col}")
            print(f"  Using name column: {name_col}")
            
            # Show sample data
            sample = gdf[[pcode_col, name_col]].head(3)
            print(f"  Sample data:")
            for _, row in sample.iterrows():
                print(f"    {row[pcode_col]} -> {row[name_col]}")
            
            # Update names in database
            updated_count = 0
            skipped_count = 0
            
            for _, row in gdf.iterrows():
                pcode = str(row[pcode_col]).strip()
                name = str(row[name_col]).strip()
                
                if not pcode or pcode == "nan":
                    skipped_count += 1
                    continue
                
                if not name or name == "nan" or name == pcode:
                    # Name is still the pcode, skip
                    skipped_count += 1
                    continue
                
                try:
                    result = supabase.table("admin_boundaries") \
                        .update({"name": name}) \
                        .eq("country_id", country_id) \
                        .eq("admin_pcode", pcode) \
                        .execute()
                    
                    if result.data:
                        updated_count += 1
                except Exception as e:
                    print(f"  ⚠️  Error updating {pcode}: {e}")
            
            print(f"  ✓ Updated {updated_count} names (skipped {skipped_count})")
            total_updated += updated_count
            
        except Exception as e:
            print(f"  ⚠️  Error processing {shp_file.name}: {e}")
            import traceback
            traceback.print_exc()
    
    print(f"\n✓ Total: {total_updated} boundary names updated")
    return True


def verify_names(supabase):
    """Verify that names were updated correctly."""
    print("\n" + "=" * 60)
    print("VERIFYING UPDATES")
    print("=" * 60)
    
    # Get Madagascar country_id
    country_resp = supabase.table("countries").select("id").eq("iso_code", "MDG").execute()
    if not country_resp.data:
        return
    
    country_id = country_resp.data[0]["id"]
    
    for admin_level in ["ADM1", "ADM2", "ADM3", "ADM4"]:
        # Count boundaries where name equals pcode (problematic)
        resp = supabase.table("admin_boundaries") \
            .select("admin_pcode, name") \
            .eq("country_id", country_id) \
            .eq("admin_level", admin_level) \
            .limit(5) \
            .execute()
        
        if not resp.data:
            continue
        
        print(f"\n{admin_level} samples:")
        for row in resp.data:
            pcode = row["admin_pcode"]
            name = row["name"]
            status = "✓" if name != pcode else "⚠️ (still pcode)"
            print(f"  {status} {pcode} -> {name}")


def main():
    print("=" * 60)
    print("FIX MADAGASCAR BOUNDARY NAMES")
    print("=" * 60)
    
    # Initialize Supabase
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        print("Error: Missing Supabase credentials")
        print("Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        return
    
    supabase = create_client(supabase_url, supabase_key)
    
    # Create output directory
    output_dir = Path(__file__).parent.parent / "data" / "madagascar_fix"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Download boundaries
    extract_dir = download_boundaries(output_dir)
    if not extract_dir:
        print("Error: Failed to download boundaries")
        return
    
    # Update names
    success = update_names(supabase, extract_dir)
    
    if success:
        # Verify
        verify_names(supabase)
    
    print("\n" + "=" * 60)
    print("DONE")
    print("=" * 60)
    print("\nRefresh the map in your browser to see the updated names.")


if __name__ == "__main__":
    main()
