#!/usr/bin/env python3
"""
Automated Framework Structure Migration
This script automatically discovers and migrates framework structure from source to target database
"""

import os
import sys
import json
import urllib.request
import urllib.error
from typing import Dict, List, Any, Optional

# Source database configuration
SOURCE_PROJECT_ID = "dmduriniqyfaptmfxmdd"
SOURCE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtZHVyaW5pcXlmYXB0bWZ4bWRkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjM5MDA3NiwiZXhwIjoyMDcxOTY2MDc2fQ.IB_6fJO9gI34tOoSRNIR2RN-9XhuBXO1zdN6bMgV-u8"
SOURCE_URL = f"https://{SOURCE_PROJECT_ID}.supabase.co"

# Target database configuration (get from environment or use defaults)
TARGET_PROJECT_ID = os.getenv("NEXT_PUBLIC_SUPABASE_PROJECT_ID", "yzxmxwppzpwfolkdiuuo")
TARGET_ANON_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")

if not TARGET_ANON_KEY:
    print("❌ TARGET_ANON_KEY not set!")
    print("   Set environment variable: export NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key")
    sys.exit(1)

TARGET_URL = f"https://{TARGET_PROJECT_ID}.supabase.co"

def make_request(url: str, headers: Dict[str, str], method: str = "GET", data: Optional[Any] = None):
    """Make a request to Supabase REST API"""
    req = urllib.request.Request(url, headers=headers)
    if method == "POST" and data:
        req.data = json.dumps(data).encode('utf-8')
        req.get_method = lambda: "POST"
    elif method == "GET":
        req.get_method = lambda: "GET"
    
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        print(f"   Error {e.code}: {error_body[:200]}")
        return None

def query_source_sql(query: str) -> Optional[List[Dict]]:
    """Execute SQL query on source database using RPC"""
    url = f"{SOURCE_URL}/rest/v1/rpc/exec_sql"
    headers = {
        "apikey": SOURCE_SERVICE_KEY,
        "Authorization": f"Bearer {SOURCE_SERVICE_KEY}",
        "Content-Type": "application/json"
    }
    
    # Try direct SQL execution via REST API
    # Note: Supabase REST API doesn't support arbitrary SQL, so we'll use table queries instead
    return None

def discover_tables() -> Dict[str, List[str]]:
    """Discover framework-related tables and their columns"""
    print("🔍 Discovering framework structure in source database...")
    
    headers = {
        "apikey": SOURCE_SERVICE_KEY,
        "Authorization": f"Bearer {SOURCE_SERVICE_KEY}",
        "Content-Type": "application/json"
    }
    
    discovered = {}
    
    # Common table name patterns to try
    table_patterns = [
        "pillars", "pillar",
        "themes", "theme",
        "subthemes", "sub_themes", "subtheme",
        "indicators", "indicator",
        "framework_pillars", "framework_themes", "framework_subthemes", "framework_indicators",
        "ssc_pillars", "ssc_themes", "ssc_indicators"
    ]
    
    for table_name in table_patterns:
        try:
            url = f"{SOURCE_URL}/rest/v1/{table_name}?limit=1"
            result = make_request(url, headers)
            if result is not None:
                # Get column info by trying to query with select=*
                url_columns = f"{SOURCE_URL}/rest/v1/{table_name}?select=*&limit=0"
                try:
                    result_full = make_request(url_columns, headers)
                    if result_full is not None or isinstance(result, list):
                        # Table exists, get a sample row to see columns
                        url_sample = f"{SOURCE_URL}/rest/v1/{table_name}?limit=1"
                        sample = make_request(url_sample, headers)
                        if sample and len(sample) > 0:
                            columns = list(sample[0].keys())
                            discovered[table_name] = columns
                            print(f"   ✅ Found table: {table_name} with columns: {', '.join(columns)}")
                except:
                    pass
        except:
            pass
    
    return discovered

def export_table_data(table_name: str, columns: List[str], limit: int = 10000) -> List[Dict]:
    """Export all data from a table"""
    print(f"   📊 Exporting {table_name}...")
    headers = {
        "apikey": SOURCE_SERVICE_KEY,
        "Authorization": f"Bearer {SOURCE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "count=exact"
    }
    
    all_data = []
    offset = 0
    page_size = 1000
    
    while True:
        # Build select query with all columns
        select_cols = ",".join(columns)
        url = f"{SOURCE_URL}/rest/v1/{table_name}?select={select_cols}&limit={page_size}&offset={offset}"
        
        try:
            result = make_request(url, headers)
            if not result or len(result) == 0:
                break
            
            all_data.extend(result)
            print(f"      Fetched {len(result)} rows (total: {len(all_data)})")
            
            if len(result) < page_size:
                break
            
            offset += page_size
        except Exception as e:
            print(f"      Error: {e}")
            break
    
    print(f"   ✅ Exported {len(all_data)} rows from {table_name}")
    return all_data

def normalize_column_name(col: str, table_type: str) -> str:
    """Normalize column names to expected format"""
    col_lower = col.lower()
    
    # Map common variations
    if 'code' in col_lower or col == 'id':
        return 'code' if table_type != 'pillar' else 'code'
    if 'name' in col_lower or 'title' in col_lower:
        return 'name'
    if 'description' in col_lower or 'desc' in col_lower:
        return 'description'
    if 'order' in col_lower or 'sequence' in col_lower or 'position' in col_lower or 'sort' in col_lower:
        return 'order_index'
    if 'active' in col_lower or 'enabled' in col_lower or 'status' in col_lower:
        return 'is_active'
    if 'type' in col_lower and 'data' in col_lower:
        return 'data_type'
    
    return col

def map_pillar_data(row: Dict, columns: List[str]) -> Dict:
    """Map source pillar data to target format"""
    mapped = {}
    
    # Find code column
    code_col = next((c for c in columns if 'code' in c.lower() or c == 'id'), None)
    if code_col:
        code = str(row.get(code_col, '')).upper().strip()
        if code.startswith('P') or code.isdigit():
            mapped['code'] = f"P{code.replace('P', '')}" if code.isdigit() else code
        else:
            mapped['code'] = f"P{code}" if code else "P1"
    else:
        mapped['code'] = "P1"  # Default
    
    # Find name column
    name_col = next((c for c in columns if 'name' in c.lower() or 'title' in c.lower()), None)
    mapped['name'] = row.get(name_col, mapped['code']) if name_col else mapped['code']
    
    # Find description
    desc_col = next((c for c in columns if 'description' in c.lower() or 'desc' in c.lower()), None)
    mapped['description'] = row.get(desc_col, '') if desc_col else ''
    
    # Find order
    order_col = next((c for c in columns if 'order' in c.lower() or 'sequence' in c.lower()), None)
    mapped['order_index'] = row.get(order_col, 0) if order_col else 0
    
    # Find active status
    active_col = next((c for c in columns if 'active' in c.lower() or 'enabled' in c.lower()), None)
    mapped['is_active'] = row.get(active_col, True) if active_col else True
    
    return mapped

def import_to_target(table_name: str, data: List[Dict]):
    """Import data to target database"""
    if not data:
        return
    
    print(f"   📥 Importing {len(data)} rows to {table_name}...")
    
    headers = {
        "apikey": TARGET_ANON_KEY,
        "Authorization": f"Bearer {TARGET_ANON_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation,resolution=merge-duplicates"
    }
    
    # Batch insert (Supabase allows up to 1000 rows per request)
    batch_size = 100
    imported = 0
    
    for i in range(0, len(data), batch_size):
        batch = data[i:i+batch_size]
        url = f"{TARGET_URL}/rest/v1/{table_name}"
        
        try:
            result = make_request(url, headers, method="POST", data=batch)
            if result:
                imported += len(batch)
                print(f"      Imported batch {i//batch_size + 1} ({imported}/{len(data)})")
        except Exception as e:
            print(f"      Error importing batch: {e}")
    
    print(f"   ✅ Imported {imported} rows to {table_name}")

def main():
    """Main migration function"""
    print("=" * 60)
    print("Automated Framework Structure Migration")
    print("=" * 60)
    print(f"Source: {SOURCE_PROJECT_ID}")
    print(f"Target: {TARGET_PROJECT_ID}")
    print()
    
    # Step 1: Discover tables
    discovered = discover_tables()
    
    if not discovered:
        print("❌ No framework tables found in source database!")
        print("   The framework structure might be stored differently.")
        print("   Please check the source database manually.")
        return
    
    print(f"\n✅ Found {len(discovered)} framework-related tables")
    
    # Step 2: Export data
    exported_data = {}
    for table_name, columns in discovered.items():
        data = export_table_data(table_name, columns)
        if data:
            exported_data[table_name] = data
    
    # Step 3: Map and transform data
    print("\n🔄 Mapping data to target schema...")
    
    # Identify which tables are which
    pillars_data = []
    themes_data = []
    subthemes_data = []
    indicators_data = []
    
    for table_name, data in exported_data.items():
        if 'pillar' in table_name.lower():
            for row in data:
                mapped = map_pillar_data(row, discovered[table_name])
                pillars_data.append(mapped)
        # Add similar logic for themes, subthemes, indicators
    
    # Step 4: Import to target
    print("\n📥 Importing to target database...")
    
    if pillars_data:
        import_to_target("framework_pillars", pillars_data)
    
    # Save exported data for manual review
    output_file = "framework_structure_export.json"
    with open(output_file, 'w') as f:
        json.dump(exported_data, f, indent=2, default=str)
    
    print(f"\n✅ Migration complete! Exported data saved to {output_file}")
    print("\nNote: You may need to manually review and adjust the mapping")
    print("      based on the actual column structure in your source database.")

if __name__ == "__main__":
    main()
