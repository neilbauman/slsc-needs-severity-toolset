#!/usr/bin/env python3
"""
Upload all boundaries to Supabase via MCP execute_sql.
Processes GeoJSON files and uploads in batches.
"""

import geopandas as gpd
from pathlib import Path
import json

COUNTRY_IDS = {
    "BGD": "0aa6850c-b932-444b-88b4-7e29ea8cc0bc",
    "MOZ": "f2c9e932-1ab3-41fd-b455-35a0fcb7c518",
    "LKA": "2b42a843-aaa0-4762-9f96-70fc423db7b6"
}

def generate_sql_for_level(geojson_file, country_id, admin_level):
    """Generate SQL for all records in a level."""
    gdf = gpd.read_file(geojson_file)
    
    if gdf.crs is None:
        gdf.set_crs("EPSG:4326", inplace=True)
    elif gdf.crs.to_string() != "EPSG:4326":
        gdf = gdf.to_crs("EPSG:4326")
    
    sql_statements = []
    for idx, row in gdf.iterrows():
        pcode = str(row['admin_pcode']).replace("'", "''")
        name = str(row.get('name', '')).replace("'", "''") if row.get('name') and str(row.get('name')) != 'None' else None
        parent = str(row.get('parent_pcode', '')).replace("'", "''") if row.get('parent_pcode') and str(row.get('parent_pcode')) != 'None' else None
        wkt = row.geometry.wkt.replace("'", "''")
        
        name_sql = f"'{name}'" if name else 'NULL'
        parent_sql = f"'{parent}'" if parent else 'NULL'
        
        sql = f"""INSERT INTO public.admin_boundaries (admin_pcode, admin_level, name, parent_pcode, country_id, geometry, metadata)
VALUES ('{pcode}', '{admin_level}', {name_sql}, {parent_sql}, '{country_id}'::uuid, ST_GeomFromText('{wkt}', 4326)::geography, '{{"source": "HDX"}}'::jsonb)
ON CONFLICT (admin_pcode) DO UPDATE SET
    admin_level = EXCLUDED.admin_level,
    name = EXCLUDED.name,
    parent_pcode = EXCLUDED.parent_pcode,
    country_id = EXCLUDED.country_id,
    geometry = EXCLUDED.geometry,
    metadata = EXCLUDED.metadata;
"""
        sql_statements.append(sql)
    
    return '\n'.join(sql_statements)

def main():
    """Generate SQL for all countries and levels."""
    output_dir = Path(__file__).parent.parent / "data" / "hdx_boundaries"
    
    # Process in order: smallest levels first
    upload_order = [
        ("BGD", ["ADM0", "ADM1"]),
        ("MOZ", ["ADM0", "ADM1"]),
        ("LKA", ["ADM0", "ADM1", "ADM2"]),
        ("BGD", ["ADM2"]),
        ("MOZ", ["ADM2"]),
        ("BGD", ["ADM3"]),
        ("MOZ", ["ADM3"]),
        ("BGD", ["ADM4"]),
    ]
    
    all_sql = []
    
    for country_iso, levels in upload_order:
        if country_iso not in COUNTRY_IDS:
            continue
        
        country_id = COUNTRY_IDS[country_iso]
        country_dir = output_dir / country_iso
        
        for level in levels:
            geojson_file = country_dir / f"{country_iso}_{level}.geojson"
            if not geojson_file.exists():
                continue
            
            print(f"Processing {country_iso} {level}...")
            sql = generate_sql_for_level(geojson_file, country_id, level)
            all_sql.append(f"-- {country_iso} {level}\n{sql}")
            print(f"  Generated SQL ({len(sql)} chars, {len(sql.split('INSERT'))-1} records)")
    
    # Write complete SQL file
    complete_sql = '\n\n'.join(all_sql)
    sql_file = Path(__file__).parent.parent / "supabase" / "migrations" / "42_upload_hdx_boundaries_complete.sql"
    sql_file.parent.mkdir(parents=True, exist_ok=True)
    
    with open(sql_file, "w") as f:
        f.write("-- Upload HDX Administrative Boundaries\n")
        f.write("-- Complete upload for BGD, MOZ, LKA\n\n")
        f.write(complete_sql)
    
    print(f"\nComplete SQL file written: {sql_file}")
    print(f"Total size: {len(complete_sql)} characters")
    print(f"Total records: {sum(len(s.split('INSERT'))-1 for s in all_sql)}")
    print("\nThis file can be run in Supabase SQL Editor or applied via migration")

if __name__ == "__main__":
    main()
