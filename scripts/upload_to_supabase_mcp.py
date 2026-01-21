#!/usr/bin/env python3
"""
Upload boundaries to Supabase via MCP by generating SQL batches.
This script processes GeoJSON files and outputs SQL that can be executed via MCP.
"""

import json
import geopandas as gpd
from pathlib import Path

COUNTRY_IDS = {
    "BGD": "0aa6850c-b932-444b-88b4-7e29ea8cc0bc",
    "MOZ": "f2c9e932-1ab3-41fd-b455-35a0fcb7c518",
    "LKA": "2b42a843-aaa0-4762-9f96-70fc423db7b6"
}

def generate_sql_batch(geojson_file, country_id, admin_level, batch_size=50):
    """Generate SQL batches from GeoJSON."""
    gdf = gpd.read_file(geojson_file)
    
    if gdf.crs is None:
        gdf.set_crs("EPSG:4326", inplace=True)
    elif gdf.crs.to_string() != "EPSG:4326":
        gdf = gdf.to_crs("EPSG:4326")
    
    batches = []
    current_batch = []
    
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
        current_batch.append(sql)
        
        if len(current_batch) >= batch_size:
            batches.append('\n'.join(current_batch))
            current_batch = []
    
    if current_batch:
        batches.append('\n'.join(current_batch))
    
    return batches

def main():
    """Generate SQL batches for all countries."""
    output_dir = Path(__file__).parent.parent / "data" / "hdx_boundaries"
    
    all_batches = []
    
    for country_iso in ["BGD", "MOZ", "LKA"]:
        if country_iso not in COUNTRY_IDS:
            continue
        
        country_id = COUNTRY_IDS[country_iso]
        country_dir = output_dir / country_iso
        geojson_files = sorted(country_dir.glob("*.geojson"))
        
        for geojson_file in geojson_files:
            level = geojson_file.stem.split("_")[1]
            print(f"Processing {country_iso} {level}...")
            
            batches = generate_sql_batch(geojson_file, country_id, level, batch_size=50)
            all_batches.extend(batches)
            print(f"  Generated {len(batches)} batches")
    
    print(f"\nTotal batches: {len(all_batches)}")
    print(f"First batch preview ({len(all_batches[0])} chars):")
    print(all_batches[0][:500] + "...")
    
    # Save batches to file for reference
    batches_file = Path(__file__).parent.parent / "data" / "upload_batches.txt"
    with open(batches_file, "w") as f:
        for i, batch in enumerate(all_batches):
            f.write(f"\n{'='*60}\n")
            f.write(f"BATCH {i+1} of {len(all_batches)}\n")
            f.write(f"{'='*60}\n")
            f.write(batch)
            f.write("\n")
    
    print(f"\nBatches saved to: {batches_file}")
    print("\nNote: These batches can be executed via Supabase MCP execute_sql")

if __name__ == "__main__":
    main()
