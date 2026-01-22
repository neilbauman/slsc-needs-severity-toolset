#!/usr/bin/env python3
"""
Import missing Sri Lanka ADM4 boundaries.
This processes the large ADM4 file in batches to avoid memory issues.
"""

import os
import sys
from pathlib import Path
import geopandas as gpd
import pandas as pd
from supabase import create_client
from dotenv import load_dotenv
import json

load_dotenv(Path(__file__).parent.parent / ".env.local")
load_dotenv()

def main():
    print("=" * 80)
    print("IMPORT SRI LANKA ADM4 BOUNDARIES")
    print("=" * 80)
    
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        print("Error: Missing Supabase credentials")
        return
    
    supabase = create_client(supabase_url, supabase_key)
    
    # Get Sri Lanka country ID
    country_resp = supabase.table("countries").select("id, name, iso_code").ilike("name", "%Sri Lanka%").single().execute()
    if not country_resp.data:
        print("Error: Sri Lanka not found")
        return
    
    country_id = country_resp.data["id"]
    country_name = country_resp.data["name"]
    
    print(f"\nCountry: {country_name}")
    
    # Check ADM4 file
    adm4_file = Path(__file__).parent.parent / "data" / "temp_boundaries" / "LKA" / "lka_admin4.geojson"
    if not adm4_file.exists():
        print(f"\n❌ ADM4 file not found: {adm4_file}")
        print("Please run: python3 scripts/reimport_boundaries_single_country.py LKA")
        print("This will download the boundaries first.")
        return
    
    print(f"\nReading ADM4 boundaries from: {adm4_file}")
    print("This may take a few minutes for large files...")
    
    # Read in chunks to handle large file
    try:
        gdf = gpd.read_file(adm4_file)
        print(f"✓ Loaded {len(gdf)} features")
    except Exception as e:
        print(f"❌ Error reading file: {e}")
        return
    
    # Set CRS if needed
    if gdf.crs is None:
        gdf.set_crs("EPSG:4326", inplace=True)
    elif gdf.crs.to_string() != "EPSG:4326":
        gdf = gdf.to_crs("EPSG:4326")
    
    # Find pcode column (try lowercase first, then uppercase)
    pcode_col = None
    name_col = None
    parent_col = None
    
    # Try lowercase first (most common in HDX data)
    for col in gdf.columns:
        col_lower = col.lower()
        if "adm4" in col_lower and "pcode" in col_lower and not pcode_col:
            pcode_col = col
        if "adm4" in col_lower and "name" in col_lower and not name_col:
            name_col = col
        if "adm3" in col_lower and "pcode" in col_lower and not parent_col:
            parent_col = col
    
    # Fallback to uppercase
    if not pcode_col:
        for col in gdf.columns:
            if "ADM4" in col and "PCODE" in col:
                pcode_col = col
                break
    
    if not pcode_col:
        print(f"❌ No ADM4 pcode column found. Available columns: {list(gdf.columns)}")
        return
    
    print(f"\nUsing columns:")
    print(f"  PCode: {pcode_col}")
    print(f"  Name: {name_col or 'None'}")
    print(f"  Parent: {parent_col or 'None'}")
    
    # Filter polygons only
    gdf = gdf[gdf.geometry.apply(lambda g: g.geom_type in ['Polygon', 'MultiPolygon'])]
    gdf = gdf[gdf.geometry.is_valid]
    
    print(f"\nValid polygon features: {len(gdf)}")
    
    # Get existing ADM4 boundaries to avoid duplicates
    existing_resp = supabase.table("admin_boundaries").select("admin_pcode").eq("country_id", country_id).eq("admin_level", "ADM4").execute()
    existing_pcodes = {b["admin_pcode"] for b in existing_resp.data}
    print(f"Existing ADM4 boundaries: {len(existing_pcodes)}")
    
    # Filter out existing
    gdf = gdf[~gdf[pcode_col].isin(existing_pcodes)]
    print(f"New boundaries to import: {len(gdf)}")
    
    if len(gdf) == 0:
        print("\n✓ All ADM4 boundaries already imported!")
        return
    
    # Prepare features
    print("\nPreparing features...")
    features = []
    for idx, row in gdf.iterrows():
        try:
            pcode = str(row[pcode_col]).strip()
            if not pcode or pcode == "None" or pcode == "nan":
                continue
            
            geom_dict = gpd.GeoSeries([row.geometry]).__geo_interface__['features'][0]['geometry']
            
            feature = {
                "type": "Feature",
                "properties": {
                    "admin_pcode": pcode,
                    "name": str(row[name_col]).strip() if name_col and name_col in gdf.columns and pd.notna(row.get(name_col)) else None,
                    "parent_pcode": str(row[parent_col]).strip() if parent_col and parent_col in gdf.columns and pd.notna(row.get(parent_col)) else None
                },
                "geometry": geom_dict
            }
            features.append(feature)
        except Exception as e:
            if idx < 10:  # Only print first few errors
                print(f"  Error processing row {idx}: {e}")
    
    print(f"✓ Prepared {len(features)} features")
    
    # Import in batches
    batch_size = 50
    total_imported = 0
    
    print(f"\nImporting in batches of {batch_size}...")
    for i in range(0, len(features), batch_size):
        batch = features[i:i + batch_size]
        feature_collection = {"type": "FeatureCollection", "features": batch}
        
        try:
            resp = supabase.rpc("import_admin_boundaries", {
                "p_country_id": country_id,
                "p_admin_level": "ADM4",
                "p_boundaries": feature_collection,
                "p_clear_existing": False  # Don't clear, just add
            }).execute()
            
            if resp.data:
                result = resp.data[0]
                batch_imported = result.get("imported_count", 0)
                total_imported += batch_imported
                
                if (i // batch_size + 1) % 10 == 0 or i + batch_size >= len(features):
                    print(f"  Batch {i//batch_size + 1}/{(len(features) + batch_size - 1)//batch_size}: {total_imported} total imported")
        except Exception as e:
            print(f"  ❌ Batch {i//batch_size + 1} error: {e}")
            import traceback
            traceback.print_exc()
    
    print(f"\n✓ Total imported: {total_imported} ADM4 boundaries")
    
    # Verify final count
    final_resp = supabase.table("admin_boundaries").select("id", count="exact").eq("country_id", country_id).eq("admin_level", "ADM4").execute()
    print(f"✓ Final ADM4 count: {final_resp.count} boundaries")

if __name__ == "__main__":
    main()
