#!/usr/bin/env python3
"""
Upload boundaries level by level, generating SQL that can be executed via MCP.
"""

import geopandas as gpd
from pathlib import Path

COUNTRY_IDS = {
    "BGD": "0aa6850c-b932-444b-88b4-7e29ea8cc0bc",
    "MOZ": "f2c9e932-1ab3-41fd-b455-35a0fcb7c518",
    "LKA": "2b42a843-aaa0-4762-9f96-70fc423db7b6"
}

def generate_sql_for_level(geojson_file, country_id, admin_level):
    """Generate complete SQL for a level."""
    gdf = gpd.read_file(geojson_file)
    if gdf.crs is None or gdf.crs.to_string() != 'EPSG:4326':
        gdf = gdf.to_crs('EPSG:4326')
    
    sql_parts = []
    for idx, row in gdf.iterrows():
        pcode = str(row['admin_pcode']).replace("'", "''")
        name = str(row.get('name', '')).replace("'", "''") if row.get('name') and str(row.get('name')) != 'None' else None
        parent = str(row.get('parent_pcode', '')).replace("'", "''") if row.get('parent_pcode') and str(row.get('parent_pcode')) != 'None' else None
        wkt = row.geometry.wkt.replace("'", "''")
        name_sql = f"'{name}'" if name else 'NULL'
        parent_sql = f"'{parent}'" if parent else 'NULL'
        sql = f"INSERT INTO public.admin_boundaries (admin_pcode, admin_level, name, parent_pcode, country_id, geometry, metadata) VALUES ('{pcode}', '{admin_level}', {name_sql}, {parent_sql}, '{country_id}'::uuid, ST_GeomFromText('{wkt}', 4326)::geography, '{{\"source\": \"HDX\"}}'::jsonb) ON CONFLICT (admin_pcode) DO UPDATE SET admin_level=EXCLUDED.admin_level, name=EXCLUDED.name, parent_pcode=EXCLUDED.parent_pcode, country_id=EXCLUDED.country_id, geometry=EXCLUDED.geometry, metadata=EXCLUDED.metadata;\n"
        sql_parts.append(sql)
    return ''.join(sql_parts)

# Upload queue (excluding already uploaded ADM0/ADM1 for BGD/MOZ)
upload_queue = [
    ("BGD", "ADM2", COUNTRY_IDS["BGD"]),
    ("MOZ", "ADM2", COUNTRY_IDS["MOZ"]),
    ("BGD", "ADM3", COUNTRY_IDS["BGD"]),
    ("MOZ", "ADM3", COUNTRY_IDS["MOZ"]),
    ("LKA", "ADM0", COUNTRY_IDS["LKA"]),
    ("LKA", "ADM1", COUNTRY_IDS["LKA"]),
    ("LKA", "ADM2", COUNTRY_IDS["LKA"]),
    ("BGD", "ADM4", COUNTRY_IDS["BGD"]),
]

output_dir = Path(__file__).parent.parent / "data" / "hdx_boundaries"

print("Generating SQL files for each level...")
print("=" * 60)

for country_iso, level, country_id in upload_queue:
    geojson_file = output_dir / country_iso / f"{country_iso}_{level}.geojson"
    if not geojson_file.exists():
        continue
    
    print(f"\n{country_iso} {level}...")
    sql = generate_sql_for_level(geojson_file, country_id, level)
    
    # Save to file
    sql_file = Path(__file__).parent.parent / "supabase" / "migrations" / f"42_upload_{country_iso}_{level}.sql"
    sql_file.parent.mkdir(parents=True, exist_ok=True)
    
    with open(sql_file, "w") as f:
        f.write(f"-- Upload {country_iso} {level} boundaries\n")
        f.write(f"-- {len(sql.split('INSERT'))-1} records\n\n")
        f.write(sql)
    
    print(f"  Saved: {sql_file} ({len(sql)} chars, {len(sql.split('INSERT'))-1} records)")

print("\n" + "=" * 60)
print("SQL files generated. These can be applied via Supabase MCP or SQL Editor.")
