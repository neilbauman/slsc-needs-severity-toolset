#!/usr/bin/env python3
"""
Upload processed administrative boundaries to Supabase.

This script reads GeoJSON files created by download_hdx_boundaries.py
and uploads them to the Supabase admin_boundaries table.

Requirements:
    pip install supabase geopandas python-dotenv

Usage:
    python scripts/upload_boundaries_to_supabase.py
"""

import os
import json
from pathlib import Path
from typing import Dict, List
import geopandas as gpd
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_country_id_mapping(supabase: Client) -> Dict[str, str]:
    """Get mapping of ISO codes to country IDs."""
    response = supabase.table("countries").select("id, iso_code").execute()
    return {row["iso_code"]: row["id"] for row in response.data}

def upload_boundaries_file(
    supabase: Client,
    geojson_path: Path,
    country_id: str,
    admin_level: str
) -> Dict[str, int]:
    """Upload boundaries from a GeoJSON file."""
    stats = {"uploaded": 0, "skipped": 0, "errors": 0}
    
    try:
        # Read GeoJSON
        gdf = gpd.read_file(geojson_path)
        
        # Ensure CRS is WGS84
        if gdf.crs is None:
            gdf.set_crs("EPSG:4326", inplace=True)
        elif gdf.crs.to_string() != "EPSG:4326":
            gdf = gdf.to_crs("EPSG:4326")
        
        # Prepare records for upload
        records = []
        for idx, row in gdf.iterrows():
            try:
                # Get required fields
                admin_pcode = str(row.get("admin_pcode", ""))
                if not admin_pcode:
                    stats["skipped"] += 1
                    continue
                
                name = row.get("name", "")
                parent_pcode = row.get("parent_pcode")
                
                # Convert geometry to PostGIS format
                # Supabase expects WKT with SRID
                geometry_wkt = row.geometry.wkt
                
                # Create record
                record = {
                    "admin_pcode": admin_pcode,
                    "admin_level": admin_level,
                    "name": name if name else None,
                    "parent_pcode": str(parent_pcode) if parent_pcode else None,
                    "country_id": country_id,
                    "geometry": f"SRID=4326;{geometry_wkt}",  # PostGIS format
                    "metadata": {
                        "source": "HDX",
                        "upload_method": "script"
                    }
                }
                
                records.append(record)
                
            except Exception as e:
                print(f"Error processing row {idx}: {e}")
                stats["errors"] += 1
        
        # Upload in batches
        batch_size = 100
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            try:
                # Use upsert to handle duplicates
                response = supabase.table("admin_boundaries").upsert(
                    batch,
                    on_conflict="admin_pcode"
                ).execute()
                stats["uploaded"] += len(batch)
                print(f"Uploaded batch {i//batch_size + 1} ({len(batch)} records)")
            except Exception as e:
                print(f"Error uploading batch {i//batch_size + 1}: {e}")
                stats["errors"] += len(batch)
        
        return stats
        
    except Exception as e:
        print(f"Error processing {geojson_path}: {e}")
        import traceback
        traceback.print_exc()
        return stats

def main():
    """Main function."""
    # Initialize Supabase client
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    
    if not supabase_url or not supabase_key:
        print("Error: SUPABASE_URL and SUPABASE_KEY must be set in environment")
        print("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        return
    
    supabase: Client = create_client(supabase_url, supabase_key)
    
    # Get country ID mapping
    country_map = get_country_id_mapping(supabase)
    print(f"Found {len(country_map)} countries: {list(country_map.keys())}")
    
    # Find GeoJSON files
    data_dir = Path(__file__).parent.parent / "data" / "hdx_boundaries"
    
    if not data_dir.exists():
        print(f"Error: Data directory not found: {data_dir}")
        print("Please run download_hdx_boundaries.py first")
        return
    
    # Process each country
    total_stats = {"uploaded": 0, "skipped": 0, "errors": 0}
    
    for country_dir in data_dir.iterdir():
        if not country_dir.is_dir():
            continue
        
        country_iso = country_dir.name
        if country_iso not in country_map:
            print(f"Skipping unknown country: {country_iso}")
            continue
        
        country_id = country_map[country_iso]
        print(f"\n{'='*60}")
        print(f"Processing {country_iso} (ID: {country_id})")
        print(f"{'='*60}")
        
        # Find GeoJSON files
        geojson_files = list(country_dir.glob("*.geojson"))
        
        for geojson_file in geojson_files:
            # Extract admin level from filename (e.g., BGD_ADM1.geojson)
            filename_parts = geojson_file.stem.split("_")
            if len(filename_parts) >= 2:
                admin_level = filename_parts[1]
            else:
                admin_level = "UNKNOWN"
            
            print(f"\nUploading {geojson_file.name} (level: {admin_level})...")
            stats = upload_boundaries_file(supabase, geojson_file, country_id, admin_level)
            
            total_stats["uploaded"] += stats["uploaded"]
            total_stats["skipped"] += stats["skipped"]
            total_stats["errors"] += stats["errors"]
            
            print(f"  Uploaded: {stats['uploaded']}, Skipped: {stats['skipped']}, Errors: {stats['errors']}")
    
    print("\n" + "=" * 60)
    print("Upload complete!")
    print(f"Total - Uploaded: {total_stats['uploaded']}, Skipped: {total_stats['skipped']}, Errors: {total_stats['errors']}")

if __name__ == "__main__":
    main()
