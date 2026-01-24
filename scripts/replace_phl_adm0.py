#!/usr/bin/env python3
"""
Replace Philippines ADM0 boundary with a better simplified version from HDX.

The current ADM0 is overly simplified. This script:
1. Reads the detailed HDX shapefile
2. Applies topology-preserving simplification
3. Uploads to Supabase

Usage:
    python scripts/replace_phl_adm0.py
    python scripts/replace_phl_adm0.py --tolerance 0.001  # Less simplification
    python scripts/replace_phl_adm0.py --tolerance 0.01   # More simplification
"""

import os
import sys
import argparse
from pathlib import Path
import geopandas as gpd
import pandas as pd
from supabase import create_client, Client
from dotenv import load_dotenv
from shapely.validation import make_valid
import json

# Load environment variables
load_dotenv(Path(__file__).parent.parent / ".env.local")
load_dotenv()

def simplify_geometry(gdf: gpd.GeoDataFrame, tolerance: float) -> gpd.GeoDataFrame:
    """Simplify geometries while preserving topology."""
    print(f"Simplifying with tolerance {tolerance}...")
    
    # Make geometries valid first
    gdf = gdf.copy()
    gdf.geometry = gdf.geometry.apply(lambda g: make_valid(g) if not g.is_valid else g)
    
    # Simplify while preserving topology
    gdf.geometry = gdf.geometry.simplify(tolerance, preserve_topology=True)
    
    # Make valid again after simplification
    gdf.geometry = gdf.geometry.apply(lambda g: make_valid(g) if not g.is_valid else g)
    
    return gdf

def get_geometry_stats(gdf: gpd.GeoDataFrame) -> dict:
    """Get statistics about the geometry."""
    total_points = 0
    for geom in gdf.geometry:
        if geom.geom_type == 'MultiPolygon':
            for poly in geom.geoms:
                total_points += len(poly.exterior.coords)
                for interior in poly.interiors:
                    total_points += len(interior.coords)
        elif geom.geom_type == 'Polygon':
            total_points += len(geom.exterior.coords)
            for interior in geom.interiors:
                total_points += len(interior.coords)
    
    return {
        "total_points": total_points,
        "num_features": len(gdf),
        "geom_types": gdf.geometry.geom_type.value_counts().to_dict()
    }

def main():
    parser = argparse.ArgumentParser(description="Replace Philippines ADM0 boundary")
    parser.add_argument("--tolerance", type=float, default=0.005,
                       help="Simplification tolerance in degrees (default: 0.005 ≈ 500m)")
    parser.add_argument("--dry-run", action="store_true",
                       help="Preview without uploading to Supabase")
    parser.add_argument("--output-geojson", type=str, default=None,
                       help="Save simplified geometry to GeoJSON file")
    args = parser.parse_args()
    
    # Initialize Supabase
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not args.dry_run and (not supabase_url or not supabase_key):
        print("Error: Missing Supabase credentials")
        print("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local")
        return 1
    
    supabase = None
    if not args.dry_run:
        supabase = create_client(supabase_url, supabase_key)
    
    # Find the shapefile
    data_dir = Path(__file__).parent.parent / "data" / "hdx_boundaries_reimport" / "PHL" / "extracted"
    shp_files = list(data_dir.glob("*adm0*.shp"))
    
    if not shp_files:
        print(f"Error: No ADM0 shapefile found in {data_dir}")
        return 1
    
    shp_path = shp_files[0]
    print(f"Reading shapefile: {shp_path.name}")
    
    # Read shapefile
    gdf = gpd.read_file(shp_path)
    
    # Ensure CRS is WGS84
    if gdf.crs is None:
        gdf.set_crs("EPSG:4326", inplace=True)
    elif gdf.crs.to_string() != "EPSG:4326":
        gdf = gdf.to_crs("EPSG:4326")
    
    print(f"Loaded {len(gdf)} features")
    print(f"Columns: {list(gdf.columns)}")
    
    # Get original stats
    original_stats = get_geometry_stats(gdf)
    print(f"\nOriginal geometry: {original_stats['total_points']:,} vertices")
    
    # Dissolve multi-part polygons into single country boundary if needed
    # The HDX data might have multiple rows (singlepart), we want one MultiPolygon
    if len(gdf) > 1:
        print(f"Dissolving {len(gdf)} parts into single boundary...")
        # Get the first row's attributes
        attrs = gdf.iloc[0].drop('geometry').to_dict()
        # Dissolve all geometries
        dissolved = gdf.dissolve()
        gdf = gpd.GeoDataFrame([attrs], geometry=[dissolved.geometry.values[0]], crs=gdf.crs)
        print(f"Dissolved to {len(gdf)} feature(s)")
    
    # Simplify
    gdf_simplified = simplify_geometry(gdf, args.tolerance)
    
    # Get simplified stats
    simplified_stats = get_geometry_stats(gdf_simplified)
    reduction = (1 - simplified_stats['total_points'] / original_stats['total_points']) * 100
    print(f"Simplified geometry: {simplified_stats['total_points']:,} vertices ({reduction:.1f}% reduction)")
    
    # Find pcode column
    pcode_col = None
    name_col = None
    for col in gdf_simplified.columns:
        col_lower = col.lower()
        if 'adm0' in col_lower and 'pcode' in col_lower:
            pcode_col = col
        elif 'adm0' in col_lower and 'name' in col_lower and 'en' in col_lower:
            name_col = col
        elif 'adm0' in col_lower and 'name' in col_lower and not name_col:
            name_col = col
    
    if not pcode_col:
        # Try to find any pcode
        for col in gdf_simplified.columns:
            if 'pcode' in col.lower():
                pcode_col = col
                break
    
    if not pcode_col:
        print("Warning: No pcode column found, using 'PH' as default")
        admin_pcode = "PH"
    else:
        admin_pcode = str(gdf_simplified.iloc[0][pcode_col]).strip()
        print(f"Found pcode column: {pcode_col} = {admin_pcode}")
    
    admin_name = None
    if name_col:
        admin_name = str(gdf_simplified.iloc[0][name_col]).strip()
        print(f"Found name column: {name_col} = {admin_name}")
    else:
        admin_name = "Philippines"
    
    # Save to GeoJSON if requested
    if args.output_geojson:
        output_path = Path(args.output_geojson)
        gdf_simplified.to_file(output_path, driver="GeoJSON")
        print(f"\nSaved simplified GeoJSON to: {output_path}")
    
    if args.dry_run:
        print("\n[DRY RUN] Would upload to Supabase with:")
        print(f"  admin_pcode: {admin_pcode}")
        print(f"  admin_level: ADM0")
        print(f"  name: {admin_name}")
        print(f"  vertices: {simplified_stats['total_points']:,}")
        return 0
    
    # Get country ID
    country_resp = supabase.table("countries").select("id").eq("iso_code", "PHL").single().execute()
    if not country_resp.data:
        print("Error: Philippines (PHL) not found in countries table")
        return 1
    country_id = country_resp.data["id"]
    print(f"\nCountry ID: {country_id}")
    
    # Prepare the feature for import
    geom = gdf_simplified.iloc[0].geometry
    geom_dict = gpd.GeoSeries([geom]).__geo_interface__['features'][0]['geometry']
    
    feature_collection = {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "properties": {
                "admin_pcode": admin_pcode,
                "name": admin_name,
                "parent_pcode": None
            },
            "geometry": geom_dict
        }]
    }
    
    print(f"\nUploading to Supabase...")
    
    # Use the import_admin_boundaries RPC
    try:
        resp = supabase.rpc("import_admin_boundaries", {
            "p_country_id": country_id,
            "p_admin_level": "ADM0",
            "p_boundaries": feature_collection,
            "p_clear_existing": True  # Replace existing ADM0
        }).execute()
        
        if resp.data:
            result = resp.data[0] if isinstance(resp.data, list) else resp.data
            imported = result.get("imported_count", 0)
            print(f"\n✓ Successfully imported {imported} ADM0 boundary for Philippines")
            print(f"  Vertices: {simplified_stats['total_points']:,}")
            print(f"  Reduction from original: {reduction:.1f}%")
        else:
            print(f"Warning: No data returned from import")
    except Exception as e:
        print(f"Error uploading to Supabase: {e}")
        
        # Try direct upsert as fallback
        print("\nTrying direct upsert...")
        try:
            geometry_wkt = gdf_simplified.iloc[0].geometry.wkt
            record = {
                "admin_pcode": admin_pcode,
                "admin_level": "ADM0",
                "name": admin_name,
                "parent_pcode": None,
                "country_id": country_id,
                "geometry": f"SRID=4326;{geometry_wkt}",
                "metadata": {
                    "source": "HDX",
                    "simplified": True,
                    "tolerance": args.tolerance,
                    "original_vertices": original_stats['total_points'],
                    "simplified_vertices": simplified_stats['total_points']
                }
            }
            
            resp = supabase.table("admin_boundaries").upsert(
                [record],
                on_conflict="admin_pcode"
            ).execute()
            
            print(f"✓ Successfully upserted ADM0 boundary")
        except Exception as e2:
            print(f"Error with direct upsert: {e2}")
            return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
