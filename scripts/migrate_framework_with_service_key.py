#!/usr/bin/env python3
"""
Framework Structure Migration with Service Role Key
Uses the service role key to access source database and migrate framework structure
"""

import json
import urllib.request
import urllib.error
import sys

# Source database (ssc-toolset.vercel.app)
SOURCE_PROJECT_ID = "dmduriniqyfaptmfxmdd"
SOURCE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtZHVyaW5pcXlmYXB0bWZ4bWRkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjM5MDA3NiwiZXhwIjoyMDcxOTY2MDc2fQ.IB_6fJO9gI34tOoSRNIR2RN-9XhuBXO1zdN6bMgV-u8"
SOURCE_URL = f"https://{SOURCE_PROJECT_ID}.supabase.co"

# Target database (get from environment)
TARGET_PROJECT_ID = input("Enter target project ID (or press Enter for yzxmxwppzpwfolkdiuuo): ").strip() or "yzxmxwppzpwfolkdiuuo"
TARGET_ANON_KEY = input("Enter target anon key: ").strip()

if not TARGET_ANON_KEY:
    print("❌ Target anon key required!")
    sys.exit(1)

TARGET_URL = f"https://{TARGET_PROJECT_ID}.supabase.co"

def query_table(project_id, service_key, table_name, limit=10000):
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
                print(f"   Fetched {len(data)} rows from {table_name} (total: {len(all_data)})")
                
                if len(data) < page_size:
                    break
                offset += page_size
        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8')
            if e.code == 404:
                print(f"   Table {table_name} not found")
            else:
                print(f"   Error {e.code}: {error_body[:200]}")
            break
        except Exception as e:
            print(f"   Error: {e}")
            break
    
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
                print(f"   Imported batch {i//batch_size + 1} ({imported}/{len(data)})")
        except Exception as e:
            print(f"   Error importing batch: {e}")
    
    return imported

def normalize_pillar_code(code):
    """Normalize pillar code"""
    if not code:
        return "P1"
    code = str(code).upper().strip()
    if code.startswith("P"):
        return code
    # Extract number
    import re
    match = re.search(r'(\d+)', code)
    if match:
        return f"P{match.group(1)}"
    return f"P{code}"

def main():
    print("=" * 60)
    print("Framework Structure Migration")
    print("=" * 60)
    
    # Step 1: Discover and export from source
    print("\n🔍 Discovering tables in source database...")
    
    # Try common table names
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
        data = query_table(SOURCE_PROJECT_ID, SOURCE_SERVICE_KEY, table, limit=100)
        if data:
            source_data[table] = data
            print(f"   ✅ Found {len(data)} rows")
            if len(data) > 0:
                print(f"   Columns: {', '.join(data[0].keys())}")
    
    if not source_data:
        print("\n❌ No framework tables found!")
        print("   Please check the source database manually.")
        return
    
    # Step 2: Save export
    with open("framework_export.json", 'w') as f:
        json.dump(source_data, f, indent=2, default=str)
    print(f"\n✅ Exported data saved to framework_export.json")
    
    # Step 3: Map and import
    print("\n📥 Importing to target database...")
    
    # Map pillars
    if any('pillar' in t for t in source_data.keys()):
        pillar_table = next(t for t in source_data.keys() if 'pillar' in t)
        pillars = source_data[pillar_table]
        
        mapped_pillars = []
        for p in pillars:
            # Try to find code column
            code_col = next((c for c in p.keys() if 'code' in c.lower()), None) or 'id'
            name_col = next((c for c in p.keys() if 'name' in c.lower() or 'title' in c.lower()), None) or code_col
            desc_col = next((c for c in p.keys() if 'description' in c.lower() or 'desc' in c.lower()), None)
            order_col = next((c for c in p.keys() if 'order' in c.lower() or 'sequence' in c.lower()), None)
            active_col = next((c for c in p.keys() if 'active' in c.lower() or 'enabled' in c.lower()), None)
            
            mapped_pillars.append({
                "code": normalize_pillar_code(p.get(code_col, "P1")),
                "name": p.get(name_col, p.get(code_col, "Pillar")),
                "description": p.get(desc_col, "") if desc_col else "",
                "order_index": p.get(order_col, 0) if order_col else 0,
                "is_active": p.get(active_col, True) if active_col else True
            })
        
        if mapped_pillars:
            print(f"\n📦 Importing {len(mapped_pillars)} pillars...")
            imported = insert_table(TARGET_PROJECT_ID, TARGET_ANON_KEY, "framework_pillars", mapped_pillars)
            print(f"   ✅ Imported {imported} pillars")
    
    print("\n✅ Migration process complete!")
    print("   Review framework_export.json for the exported data")
    print("   You may need to manually adjust the mapping for themes, subthemes, and indicators")

if __name__ == "__main__":
    main()
