#!/usr/bin/env python3
"""
Upload boundaries using JSON bulk load function.
More efficient than individual INSERTs.
"""

import json
import geopandas as gpd
from pathlib import Path
from supabase import create_client
import os

# Country IDs
COUNTRY_IDS = {
    "BGD": "0aa6850c-b932-444b-88b4-7e29ea8cc0bc",
    "MOZ": "f2c9e932-1ab3-41fd-b455-35a0fcb7c518",
    "LKA": "2b42a843-aaa0-4762-9f96-70fc423db7b6"
}

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "https://yzxmxwppzpwfolkdiuuo.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not SUPABASE_KEY:
    print("Error: SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY must be set")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def upload_geojson_file(geojson_path: Path, country_id: str, admin_level: str, batch_size=500):
    """Upload GeoJSON using bulk load function."""
    print(f"Processing {geojson_path.name}...")
    
    gdf = gpd.read_file(geojson_path)
    
    if gdf.crs is None:
        gdf.set_crs("EPSG:4326", inplace=True)
    elif gdf.crs.to_string() != "EPSG:4326":
        gdf = gdf.to_crs("EPSG:4326")
    
    # Prepare JSON array
    boundaries_json = []
    for idx, row in gdf.iterrows():
        admin_pcode = str(row.get("admin_pcode", "")).strip()
        if not admin_pcode or admin_pcode == "None":
            continue
        
        name = row.get("name")
        if name and str(name) != "None":
            name = str(name)
        else:
            name = None
        
        parent_pcode = row.get("parent_pcode")
        if parent_pcode and str(parent_pcode) != "None":
            parent_pcode = str(parent_pcode).strip()
        else:
            parent_pcode = None
        
        boundary_data = {
            "admin_pcode": admin_pcode,
            "admin_level": admin_level,
            "name": name,
            "parent_pcode": parent_pcode,
            "country_id": country_id,
            "geometry_wkt": row.geometry.wkt,
            "metadata": {"source": "HDX", "upload_method": "script"}
        }
        
        boundaries_json.append(boundary_data)
    
    # Upload in batches
    total_uploaded = 0
    for i in range(0, len(boundaries_json), batch_size):
        batch = boundaries_json[i:i + batch_size]
        try:
            response = supabase.rpc(
                "bulk_load_boundaries",
                {"boundaries_json": batch}
            ).execute()
            
            if response.data:
                result = response.data[0] if isinstance(response.data, list) else response.data
                inserted = result.get("inserted_count", 0)
                updated = result.get("updated_count", 0)
                total_uploaded += inserted + updated
                print(f"  Batch {i//batch_size + 1}: {inserted} inserted, {updated} updated")
        except Exception as e:
            print(f"  Error in batch {i//batch_size + 1}: {e}")
            # Fallback to individual inserts
            for boundary in batch:
                try:
                    supabase.table("admin_boundaries").upsert([{
                        "admin_pcode": boundary["admin_pcode"],
                        "admin_level": boundary["admin_level"],
                        "name": boundary["name"],
                        "parent_pcode": boundary["parent_pcode"],
                        "country_id": boundary["country_id"],
                        "geometry": f"SRID=4326;{boundary['geometry_wkt']}",
                        "metadata": boundary["metadata"]
                    }], on_conflict="admin_pcode").execute()
                    total_uploaded += 1
                except:
                    pass
    
    print(f"  ✓ Uploaded {total_uploaded} records from {geojson_path.name}")
    return total_uploaded

def main():
    """Upload all boundaries."""
    output_dir = Path(__file__).parent.parent / "data" / "hdx_boundaries"
    
    total = 0
    
    for country_iso in ["BGD", "MOZ", "LKA"]:
        if country_iso not in COUNTRY_IDS:
            continue
        
        country_id = COUNTRY_IDS[country_iso]
        country_dir = output_dir / country_iso
        geojson_files = sorted(country_dir.glob("*.geojson"))
        
        if not geojson_files:
            continue
        
        print(f"\n{'='*60}")
        print(f"Uploading {country_iso} boundaries")
        print(f"{'='*60}")
        
        for geojson_file in geojson_files:
            level = geojson_file.stem.split("_")[1]
            count = upload_geojson_file(geojson_file, country_id, level)
            total += count
    
    print(f"\n{'='*60}")
    print(f"Upload complete! Total records: {total}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
