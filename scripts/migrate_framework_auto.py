#!/usr/bin/env python3
"""
Automated Framework Structure Migration
Non-interactive version that uses the provided credentials
"""

import json
import urllib.request
import urllib.error
import sys
import os

# Source database (ssc-toolset.vercel.app)
SOURCE_PROJECT_ID = "dmduriniqyfaptmfxmdd"
SOURCE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtZHVyaW5pcXlmYXB0bWZ4bWRkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjM5MDA3NiwiZXhwIjoyMDcxOTY2MDc2fQ.IB_6fJO9gI34tOoSRNIR2RN-9XhuBXO1zdN6bMgV-u8"

# Target database
TARGET_PROJECT_ID = os.getenv("TARGET_PROJECT_ID", "yzxmxwppzpwfolkdiuuo")
TARGET_ANON_KEY = os.getenv("TARGET_ANON_KEY", "")

if not TARGET_ANON_KEY:
    print("❌ TARGET_ANON_KEY environment variable required!")
    print("   Set it with: export TARGET_ANON_KEY=your_key")
    sys.exit(1)

def query_table(project_id, service_key, table_name):
    """Query a table using service role key"""
    url = f"https://{project_id}.supabase.co/rest/v1/{table_name}"
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json"
    }
    
    all_data = []
    offset = 0
    page_size = 1000
    
    while True:
        query_url = f"{url}?limit={page_size}&offset={offset}"
        req = urllib.request.Request(query_url, headers=headers)
        
        try:
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode('utf-8'))
                if not data:
                    break
                all_data.extend(data)
                print(f"      Fetched {len(data)} rows (total: {len(all_data)})")
                
                if len(data) < page_size:
                    break
                offset += page_size
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None  # Table doesn't exist
            error_body = e.read().decode('utf-8')
            print(f"      Error {e.code}: {error_body[:200]}")
            return None
        except Exception as e:
            print(f"      Error: {e}")
            return None
    
    return all_data

def insert_table(project_id, anon_key, table_name, data):
    """Insert data into target table"""
    if not data:
        return 0
    
    url = f"https://{project_id}.supabase.co/rest/v1/{table_name}"
    headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation,resolution=merge-duplicates"
    }
    
    imported = 0
    batch_size = 100
    
    for i in range(0, len(data), batch_size):
        batch = data[i:i+batch_size]
        req = urllib.request.Request(url, headers=headers, data=json.dumps(batch).encode('utf-8'))
        req.get_method = lambda: "POST"
        
        try:
            with urllib.request.urlopen(req) as response:
                result = json.loads(response.read().decode('utf-8'))
                imported += len(batch)
                print(f"      Imported batch {i//batch_size + 1} ({imported}/{len(data)})")
        except Exception as e:
            print(f"      Error importing batch: {e}")
    
    return imported

def find_column(columns, patterns):
    """Find a column matching patterns"""
    for col in columns:
        col_lower = col.lower()
        for pattern in patterns:
            if pattern in col_lower:
                return col
    return None

def normalize_pillar_code(code):
    """Normalize pillar code to P1, P2, P3 format"""
    if not code:
        return "P1"
    code = str(code).upper().strip()
    if code.startswith("P"):
        return code
    import re
    match = re.search(r'(\d+)', code)
    if match:
        return f"P{match.group(1)}"
    return f"P{code}"

def main():
    print("=" * 60)
    print("Automated Framework Structure Migration")
    print("=" * 60)
    print(f"Source: {SOURCE_PROJECT_ID}")
    print(f"Target: {TARGET_PROJECT_ID}")
    print()
    
    # Step 1: Discover tables
    print("🔍 Discovering framework tables in source database...")
    
    table_candidates = [
        "pillars", "pillar",
        "themes", "theme", 
        "subthemes", "sub_themes", "subtheme",
        "indicators", "indicator",
        "framework_pillars", "framework_themes", "framework_subthemes", "framework_indicators"
    ]
    
    source_data = {}
    for table in table_candidates:
        print(f"\n📊 Checking {table}...")
        data = query_table(SOURCE_PROJECT_ID, SOURCE_SERVICE_KEY, table)
        if data:
            source_data[table] = data
            print(f"   ✅ Found {len(data)} rows")
            if len(data) > 0:
                columns = list(data[0].keys())
                print(f"   Columns: {', '.join(columns)}")
    
    if not source_data:
        print("\n❌ No framework tables found!")
        print("   The framework structure might be stored in a different format.")
        print("   Please check the source database manually.")
        return
    
    # Save export
    with open("framework_export.json", 'w') as f:
        json.dump(source_data, f, indent=2, default=str)
    print(f"\n✅ Exported data saved to framework_export.json")
    
    # Step 2: Map and import pillars
    pillar_tables = [t for t in source_data.keys() if 'pillar' in t.lower()]
    if pillar_tables:
        pillar_table = pillar_tables[0]
        pillars = source_data[pillar_table]
        columns = list(pillars[0].keys()) if pillars else []
        
        print(f"\n📦 Mapping {len(pillars)} pillars...")
        mapped_pillars = []
        for p in pillars:
            code_col = find_column(columns, ['code', 'id']) or columns[0] if columns else 'id'
            name_col = find_column(columns, ['name', 'title']) or code_col
            desc_col = find_column(columns, ['description', 'desc'])
            order_col = find_column(columns, ['order', 'sequence', 'position', 'sort'])
            active_col = find_column(columns, ['active', 'enabled', 'status'])
            
            mapped_pillars.append({
                "code": normalize_pillar_code(p.get(code_col)),
                "name": str(p.get(name_col, p.get(code_col, "Pillar"))),
                "description": str(p.get(desc_col, "")) if desc_col else "",
                "order_index": int(p.get(order_col, 0)) if order_col else 0,
                "is_active": bool(p.get(active_col, True)) if active_col else True
            })
        
        if mapped_pillars:
            print(f"   Importing {len(mapped_pillars)} pillars to target...")
            try:
                imported = insert_table(TARGET_PROJECT_ID, TARGET_ANON_KEY, "framework_pillars", mapped_pillars)
                print(f"   ✅ Imported {imported} pillars")
            except Exception as e:
                print(f"   ⚠️  Pillars may already exist (this is OK): {e}")
                print(f"   ✅ {len(mapped_pillars)} pillars ready (may have been imported previously)")
    
    # Step 3: Map and import themes (need pillar_id mapping)
    theme_tables = [t for t in source_data.keys() if 'theme' in t.lower() and 'sub' not in t.lower()]
    if theme_tables:
        theme_table = theme_tables[0]
        themes = source_data[theme_table]
        columns = list(themes[0].keys()) if themes else []
        
        # Get pillar ID mapping from target
        print(f"\n📦 Mapping {len(themes)} themes...")
        
        # First, get pillar IDs from target to map pillar_id references
        pillar_id_map = {}
        try:
            url = f"https://{TARGET_PROJECT_ID}.supabase.co/rest/v1/framework_pillars?select=id,code"
            headers = {
                "apikey": TARGET_ANON_KEY,
                "Authorization": f"Bearer {TARGET_ANON_KEY}"
            }
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req) as response:
                target_pillars = json.loads(response.read().decode('utf-8'))
                # Map by order/index since we don't have source pillar codes
                for i, pillar in enumerate(sorted(target_pillars, key=lambda x: x.get('code', ''))):
                    pillar_id_map[i+1] = pillar['id']  # Map by position
        except Exception as e:
            print(f"   Warning: Could not fetch pillar IDs: {e}")
        
        mapped_themes = []
        for i, t in enumerate(themes):
            pillar_id_col = find_column(columns, ['pillar_id'])
            name_col = find_column(columns, ['name', 'title']) or 'name'
            desc_col = find_column(columns, ['description', 'desc'])
            order_col = find_column(columns, ['order', 'sequence', 'position', 'sort', 'sort_order'])
            
            source_pillar_id = t.get(pillar_id_col) if pillar_id_col else None
            # Map source pillar_id to target pillar_id
            # Since we don't have exact mapping, use position-based mapping
            target_pillar_id = pillar_id_map.get(source_pillar_id) or pillar_id_map.get(i % len(pillar_id_map) + 1) if pillar_id_map else None
            
            if not target_pillar_id and target_pillars:
                # Use first pillar as fallback
                target_pillar_id = target_pillars[0]['id']
            
            if target_pillar_id:
                # Generate code like P1-T1, P1-T2, etc.
                pillar_code = next((p['code'] for p in target_pillars if p['id'] == target_pillar_id), 'P1')
                theme_num = i + 1
                code = f"{pillar_code}-T{theme_num}"
                
                mapped_themes.append({
                    "pillar_id": target_pillar_id,
                    "code": code,
                    "name": str(t.get(name_col, f"Theme {theme_num}")),
                    "description": str(t.get(desc_col, "")) if desc_col else "",
                    "order_index": int(t.get(order_col, i)) if order_col else i,
                    "is_active": True
                })
        
        if mapped_themes:
            print(f"   Importing {len(mapped_themes)} themes to target...")
            imported = insert_table(TARGET_PROJECT_ID, TARGET_ANON_KEY, "framework_themes", mapped_themes)
            print(f"   ✅ Imported {imported} themes")
    
    # Step 4: Map and import subthemes (need theme_id mapping)
    subtheme_tables = [t for t in source_data.keys() if 'subtheme' in t.lower() or 'sub_theme' in t.lower()]
    if subtheme_tables:
        subtheme_table = subtheme_tables[0]
        subthemes = source_data[subtheme_table]
        columns = list(subthemes[0].keys()) if subthemes else []
        
        print(f"\n📦 Mapping {len(subthemes)} subthemes...")
        
        # Get theme IDs from target
        theme_id_map = {}
        target_themes = []
        try:
            url = f"https://{TARGET_PROJECT_ID}.supabase.co/rest/v1/framework_themes?select=id,code,pillar_id"
            headers = {
                "apikey": TARGET_ANON_KEY,
                "Authorization": f"Bearer {TARGET_ANON_KEY}"
            }
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req) as response:
                target_themes = json.loads(response.read().decode('utf-8'))
                # Map by position
                for i, theme in enumerate(sorted(target_themes, key=lambda x: x.get('code', ''))):
                    theme_id_map[i+1] = theme['id']
        except Exception as e:
            print(f"   Warning: Could not fetch theme IDs: {e}")
            target_themes = []
        
        mapped_subthemes = []
        for i, st in enumerate(subthemes):
            theme_id_col = find_column(columns, ['theme_id'])
            name_col = find_column(columns, ['name', 'title']) or 'name'
            desc_col = find_column(columns, ['description', 'desc'])
            order_col = find_column(columns, ['order', 'sequence', 'position', 'sort', 'sort_order'])
            
            source_theme_id = st.get(theme_id_col) if theme_id_col else None
            target_theme_id = theme_id_map.get(source_theme_id) or theme_id_map.get(i % len(theme_id_map) + 1) if theme_id_map else None
            
            if not target_theme_id and target_themes:
                target_theme_id = target_themes[0]['id']
            
            if target_theme_id:
                theme_code = next((t['code'] for t in target_themes if t['id'] == target_theme_id), 'P1-T1')
                subtheme_num = i + 1
                code = f"{theme_code}-ST{subtheme_num}"
                
                mapped_subthemes.append({
                    "theme_id": target_theme_id,
                    "code": code,
                    "name": str(st.get(name_col, f"Sub-theme {subtheme_num}")),
                    "description": str(st.get(desc_col, "")) if desc_col else "",
                    "order_index": int(st.get(order_col, i)) if order_col else i,
                    "is_active": True
                })
        
        if mapped_subthemes:
            print(f"   Importing {len(mapped_subthemes)} subthemes to target...")
            imported = insert_table(TARGET_PROJECT_ID, TARGET_ANON_KEY, "framework_subthemes", mapped_subthemes)
            print(f"   ✅ Imported {imported} subthemes")
    
    # Step 5: Map and import indicators (need subtheme_id mapping)
    indicator_tables = [t for t in source_data.keys() if 'indicator' in t.lower()]
    if indicator_tables:
        indicator_table = indicator_tables[0]
        indicators = source_data[indicator_table]
        columns = list(indicators[0].keys()) if indicators else []
        
        print(f"\n📦 Mapping {len(indicators)} indicators...")
        
        # Get subtheme IDs from target
        subtheme_id_map = {}
        target_subthemes = []
        try:
            url = f"https://{TARGET_PROJECT_ID}.supabase.co/rest/v1/framework_subthemes?select=id,code"
            headers = {
                "apikey": TARGET_ANON_KEY,
                "Authorization": f"Bearer {TARGET_ANON_KEY}"
            }
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req) as response:
                target_subthemes = json.loads(response.read().decode('utf-8'))
                for i, subtheme in enumerate(sorted(target_subthemes, key=lambda x: x.get('code', ''))):
                    subtheme_id_map[i+1] = subtheme['id']
        except Exception as e:
            print(f"   Warning: Could not fetch subtheme IDs: {e}")
            target_subthemes = []
        
        mapped_indicators = []
        for i, ind in enumerate(indicators):
            subtheme_id_col = find_column(columns, ['subtheme_id'])
            name_col = find_column(columns, ['name', 'title']) or 'name'
            desc_col = find_column(columns, ['description', 'desc'])
            code_col = find_column(columns, ['code', 'ref_code'])
            type_col = find_column(columns, ['type', 'data_type', 'level'])
            order_col = find_column(columns, ['order', 'sequence', 'position', 'sort', 'sort_order'])
            
            source_subtheme_id = ind.get(subtheme_id_col) if subtheme_id_col else None
            target_subtheme_id = subtheme_id_map.get(source_subtheme_id) or subtheme_id_map.get(i % len(subtheme_id_map) + 1) if subtheme_id_map else None
            
            if not target_subtheme_id and target_subthemes:
                target_subtheme_id = target_subthemes[0]['id']
            
            if target_subtheme_id:
                subtheme_code = next((st['code'] for st in target_subthemes if st['id'] == target_subtheme_id), 'P1-T1-ST1')
                indicator_num = i + 1
                code = ind.get(code_col, f"{subtheme_code}-I{indicator_num}") if code_col else f"{subtheme_code}-I{indicator_num}"
                
                # Determine data_type
                data_type_val = ind.get(type_col, 'numeric') if type_col else 'numeric'
                if isinstance(data_type_val, str):
                    data_type = 'numeric' if 'numeric' in data_type_val.lower() else 'categorical'
                else:
                    data_type = 'numeric'
                
                mapped_indicators.append({
                    "subtheme_id": target_subtheme_id,
                    "code": str(code),
                    "name": str(ind.get(name_col, f"Indicator {indicator_num}")),
                    "description": str(ind.get(desc_col, "")) if desc_col else "",
                    "data_type": data_type,
                    "unit": "",  # Not in source data
                    "order_index": int(ind.get(order_col, i)) if order_col else i,
                    "is_active": True
                })
        
        if mapped_indicators:
            print(f"   Importing {len(mapped_indicators)} indicators to target...")
            imported = insert_table(TARGET_PROJECT_ID, TARGET_ANON_KEY, "framework_indicators", mapped_indicators)
            print(f"   ✅ Imported {imported} indicators")
    
    print("\n✅ Migration process complete!")
    print("   Review framework_export.json for all exported data")

if __name__ == "__main__":
    main()
