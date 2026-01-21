#!/usr/bin/env python3
"""
Reimport boundaries for a single country - optimized version.
Usage: python scripts/reimport_boundaries_single_country.py BGD
"""

import os
import sys
import re
import zipfile
from pathlib import Path
import geopandas as gpd
import pandas as pd
from supabase import create_client, Client
from dotenv import load_dotenv
import requests
from datetime import datetime

load_dotenv(Path(__file__).parent.parent / ".env.local")
load_dotenv()

HDX_DATASETS = {
    "BGD": {"dataset_id": "cod-ab-bgd", "expected": {"ADM0": 1, "ADM1": 8, "ADM2": 64, "ADM3": 507}},
    "MOZ": {"dataset_id": "cod-ab-moz", "expected": {"ADM0": 1, "ADM1": 11, "ADM2": 159, "ADM3": 412}},
    "PSE": {"dataset_id": "cod-ab-pse", "expected": {"ADM0": 1, "ADM1": 16, "ADM2": 16}},
    "PHL": {"dataset_id": "cod-ab-phl", "expected": {"ADM0": 1, "ADM1": 17, "ADM2": 88, "ADM3": 1642, "ADM4": 42048}},
    "LKA": {"dataset_id": "cod-ab-lka", "expected": {"ADM0": 1, "ADM1": 9, "ADM2": 25, "ADM3": 331, "ADM4": 14022}}
}

def main():
    country_iso = sys.argv[1] if len(sys.argv) > 1 else None
    if not country_iso or country_iso not in HDX_DATASETS:
        print(f"Usage: {sys.argv[0]} <COUNTRY_ISO>")
        print(f"Available: {list(HDX_DATASETS.keys())}")
        return
    
    # Initialize Supabase
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        print("Error: Missing Supabase credentials")
        return
    
    supabase = create_client(supabase_url, supabase_key)
    
    # Get country ID
    country_resp = supabase.table("countries").select("id").eq("iso_code", country_iso).single().execute()
    if not country_resp.data:
        print(f"Country {country_iso} not found")
        return
    country_id = country_resp.data["id"]
    
    # Get HDX dataset
    dataset_id = HDX_DATASETS[country_iso]["dataset_id"]
    url = f"https://data.humdata.org/api/3/action/package_show"
    resp = requests.get(url, params={"id": dataset_id}, timeout=30)
    dataset_info = resp.json().get("result")
    
    # Find GeoJSON resource
    resource = None
    for r in dataset_info.get("resources", []):
        if "geojson" in r.get("format", "").lower():
            resource = r
            break
    
    if not resource:
        print("No GeoJSON resource found")
        return
    
    # Download
    output_dir = Path(__file__).parent.parent / "data" / "temp_boundaries"
    output_dir.mkdir(parents=True, exist_ok=True)
    zip_path = output_dir / f"{country_iso}_boundaries.zip"
    
    print(f"Downloading {country_iso} boundaries...")
    resp = requests.get(resource["url"], stream=True, timeout=600)
    with open(zip_path, 'wb') as f:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)
    
    # Extract
    extract_dir = output_dir / country_iso
    extract_dir.mkdir(exist_ok=True)
    with zipfile.ZipFile(zip_path, 'r') as z:
        z.extractall(extract_dir)
    
    # Process each admin level file
    admin_files = sorted(extract_dir.glob("*admin*.geojson"))
    if not admin_files:
        admin_files = sorted(extract_dir.glob("*.geojson"))
    
    total_imported = 0
    
    for admin_file in admin_files:
        match = re.search(r'admin(\d+)', admin_file.name.lower())
        if not match:
            continue
        
        level_num = int(match.group(1))
        level_key = f"ADM{level_num}"
        
        print(f"\nProcessing {level_key} from {admin_file.name}...")
        
        gdf = gpd.read_file(admin_file)
        if gdf.crs is None:
            gdf.set_crs("EPSG:4326", inplace=True)
        elif gdf.crs.to_string() != "EPSG:4326":
            gdf = gdf.to_crs("EPSG:4326")
        
        # Find level-specific pcode column
        pcode_col = f"adm{level_num}_pcode"
        name_col = f"adm{level_num}_name"
        parent_col = f"adm{level_num - 1}_pcode" if level_num > 0 else None
        
        if pcode_col not in gdf.columns:
            # Try uppercase
            pcode_col = pcode_col.upper()
            name_col = name_col.upper()
            if parent_col:
                parent_col = parent_col.upper()
        
        if pcode_col not in gdf.columns:
            print(f"  ⚠️  {pcode_col} not found, trying alternatives...")
            for col in gdf.columns:
                if f"adm{level_num}" in col.lower() and "pcode" in col.lower():
                    pcode_col = col
                    break
        
        if pcode_col not in gdf.columns:
            print(f"  ❌ No pcode column found for {level_key}")
            continue
        
        # Filter polygons only
        gdf = gdf[gdf.geometry.apply(lambda g: g.geom_type in ['Polygon', 'MultiPolygon'])]
        gdf = gdf[gdf.geometry.is_valid]
        
        print(f"  Found {len(gdf)} polygon features")
        
        # Prepare features for RPC
        features = []
        for idx, row in gdf.iterrows():
            try:
                pcode = str(row[pcode_col]).strip()
                if not pcode or pcode == "None":
                    continue
                
                geom_dict = gpd.GeoSeries([row.geometry]).__geo_interface__['features'][0]['geometry']
                
                feature = {
                    "type": "Feature",
                    "properties": {
                        "admin_pcode": pcode,
                        "name": str(row[name_col]).strip() if name_col in gdf.columns and pd.notna(row.get(name_col)) else None,
                        "parent_pcode": str(row[parent_col]).strip() if parent_col and parent_col in gdf.columns and pd.notna(row.get(parent_col)) else None
                    },
                    "geometry": geom_dict
                }
                features.append(feature)
            except Exception as e:
                print(f"    Error processing row {idx}: {e}")
        
        if not features:
            print(f"  ⚠️  No valid features to import")
            continue
        
        # Import in batches of 50
        batch_size = 50
        imported = 0
        
        for i in range(0, len(features), batch_size):
            batch = features[i:i + batch_size]
            feature_collection = {"type": "FeatureCollection", "features": batch}
            
            try:
                resp = supabase.rpc("import_admin_boundaries", {
                    "p_country_id": country_id,
                    "p_admin_level": level_key,
                    "p_boundaries": feature_collection
                }).execute()
                
                if resp.data:
                    result = resp.data[0]
                    batch_imported = result.get("imported_count", 0)
                    imported += batch_imported
                    print(f"    Batch {i//batch_size + 1}: {batch_imported} imported")
            except Exception as e:
                print(f"    ❌ Batch {i//batch_size + 1} error: {e}")
        
        total_imported += imported
        expected = HDX_DATASETS[country_iso]["expected"].get(level_key)
        if expected:
            if imported == expected:
                print(f"  ✓ {level_key}: {imported}/{expected} (complete)")
            else:
                print(f"  ⚠️  {level_key}: {imported}/{expected} (missing {expected - imported})")
        else:
            print(f"  ✓ {level_key}: {imported} imported")
    
    print(f"\n✓ Total: {total_imported} boundaries imported for {country_iso}")

if __name__ == "__main__":
    main()
