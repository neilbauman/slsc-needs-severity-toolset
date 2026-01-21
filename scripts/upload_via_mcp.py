#!/usr/bin/env python3
"""
Upload boundaries using direct SQL via Supabase MCP.
This script processes GeoJSON files and generates SQL INSERT statements.
"""

import json
import geopandas as gpd
from pathlib import Path
from typing import Dict

# Country IDs from Supabase
COUNTRY_IDS = {
    "BGD": "0aa6850c-b932-444b-88b4-7e29ea8cc0bc",
    "MOZ": "f2c9e932-1ab3-41fd-b455-35a0fcb7c518",
    "LKA": "2b42a843-aaa0-4762-9f96-70fc423db7b6"
}

def generate_sql_inserts(geojson_path: Path, country_id: str, admin_level: str) -> str:
    """Generate SQL INSERT statements from GeoJSON."""
    gdf = gpd.read_file(geojson_path)
    
    # Ensure CRS is WGS84
    if gdf.crs is None:
        gdf.set_crs("EPSG:4326", inplace=True)
    elif gdf.crs.to_string() != "EPSG:4326":
        gdf = gdf.to_crs("EPSG:4326")
    
    sql_statements = []
    
    for idx, row in gdf.iterrows():
        admin_pcode = str(row.get("admin_pcode", "")).strip()
        if not admin_pcode or admin_pcode == "None":
            continue
        
        name = row.get("name")
        if name and str(name) != "None":
            name = str(name).replace("'", "''")
        else:
            name = None
        
        parent_pcode = row.get("parent_pcode")
        if parent_pcode and str(parent_pcode) != "None":
            parent_pcode = str(parent_pcode).strip()
        else:
            parent_pcode = None
        
        # Convert geometry to PostGIS format
        geometry_wkt = row.geometry.wkt
        
        # Build SQL
        name_sql = f"'{name}'" if name else "NULL"
        parent_sql = f"'{parent_pcode}'" if parent_pcode else "NULL"
        
        sql = f"""
INSERT INTO public.admin_boundaries (admin_pcode, admin_level, name, parent_pcode, country_id, geometry, metadata)
VALUES (
    '{admin_pcode}',
    '{admin_level}',
    {name_sql},
    {parent_sql},
    '{country_id}'::uuid,
    ST_GeomFromText('{geometry_wkt}', 4326)::geography,
    '{{"source": "HDX", "upload_method": "script"}}'::jsonb
)
ON CONFLICT (admin_pcode) DO UPDATE SET
    admin_level = EXCLUDED.admin_level,
    name = EXCLUDED.name,
    parent_pcode = EXCLUDED.parent_pcode,
    country_id = EXCLUDED.country_id,
    geometry = EXCLUDED.geometry,
    metadata = EXCLUDED.metadata;
"""
        sql_statements.append(sql)
    
    return "\n".join(sql_statements)

def main():
    """Generate SQL for all countries."""
    output_dir = Path(__file__).parent.parent / "data" / "hdx_boundaries"
    sql_output = Path(__file__).parent.parent / "supabase" / "migrations" / "42_upload_hdx_boundaries.sql"
    
    all_sql = []
    all_sql.append("-- Upload HDX Administrative Boundaries")
    all_sql.append("-- Generated from downloaded GeoJSON files")
    all_sql.append("")
    
    for country_iso in ["BGD", "MOZ", "LKA"]:
        if country_iso not in COUNTRY_IDS:
            continue
        
        country_id = COUNTRY_IDS[country_iso]
        country_dir = output_dir / country_iso
        geojson_files = sorted(country_dir.glob("*.geojson"))
        
        if not geojson_files:
            continue
        
        all_sql.append(f"-- {country_iso} boundaries")
        all_sql.append("")
        
        for geojson_file in geojson_files:
            level = geojson_file.stem.split("_")[1]
            print(f"Processing {country_iso} {level}...")
            
            sql = generate_sql_inserts(geojson_file, country_id, level)
            all_sql.append(f"-- {level} ({geojson_file.name})")
            all_sql.append(sql)
            all_sql.append("")
    
    # Write SQL file
    sql_output.parent.mkdir(parents=True, exist_ok=True)
    sql_content = "\n".join(all_sql)
    with open(sql_output, "w") as f:
        f.write(sql_content)
    
    print(f"\nSQL file generated: {sql_output}")
    print(f"Total size: {len(sql_content)} characters")
    print("\nNext: Run this SQL in Supabase SQL Editor")

if __name__ == "__main__":
    main()
