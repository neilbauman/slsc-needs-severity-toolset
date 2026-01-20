#!/usr/bin/env python3
"""
Discover Framework Structure from Source Database
This script queries the source database to find pillars, themes, sub-themes, and indicators
"""

import os
import sys
import json
from urllib.parse import urlparse
import urllib.request
import urllib.error

# Source database configuration
SOURCE_PROJECT_ID = "yzxmxwppzpwfolkdiuuo"
SOURCE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6eG14d3BwenB3Zm9sa2RpdXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjI5NzUsImV4cCI6MjA4Mzk5ODk3NX0.adI6gRqCfSjtlR12511G_5wIy96nxd_uGFrJFBriF_g"
SOURCE_URL = f"https://{SOURCE_PROJECT_ID}.supabase.co"

def make_request(endpoint, method="GET", data=None):
    """Make a request to Supabase REST API"""
    url = f"{SOURCE_URL}/rest/v1/{endpoint}"
    headers = {
        "apikey": SOURCE_ANON_KEY,
        "Authorization": f"Bearer {SOURCE_ANON_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
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
        print(f"Error {e.code}: {error_body}")
        return None

def discover_tables():
    """Discover what framework-related tables exist"""
    print("🔍 Discovering framework-related tables...")
    
    # Common table name patterns
    patterns = [
        "pillar", "pillars",
        "theme", "themes",
        "subtheme", "sub_themes", "subthemes",
        "indicator", "indicators",
        "framework",
        "ssc"
    ]
    
    # Try to query information_schema via RPC or direct query
    # Note: This might not work with REST API, but we'll try common table names
    
    discovered = {}
    
    for pattern in patterns:
        table_name = f"{pattern}s" if not pattern.endswith('s') else pattern
        # Try singular and plural
        for name in [pattern, table_name, f"framework_{pattern}", f"ssc_{pattern}"]:
            try:
                result = make_request(f"{name}?limit=1")
                if result is not None:
                    discovered[name] = result
                    print(f"✅ Found table: {name}")
            except:
                pass
    
    return discovered

def query_table(table_name, limit=1000):
    """Query a table and return all rows"""
    print(f"📊 Querying {table_name}...")
    try:
        result = make_request(f"{table_name}?limit={limit}")
        if result:
            print(f"   Found {len(result)} rows")
            return result
    except Exception as e:
        print(f"   Error: {e}")
    return []

def discover_framework_structure():
    """Main discovery function"""
    print("=" * 60)
    print("Framework Structure Discovery")
    print("=" * 60)
    
    # Step 1: Try to discover tables
    tables = discover_tables()
    
    # Step 2: Query common table names directly
    common_tables = [
        "pillars",
        "themes", 
        "subthemes",
        "sub_themes",
        "indicators",
        "framework_pillars",
        "framework_themes",
        "framework_subthemes",
        "framework_indicators",
        "ssc_pillars",
        "ssc_themes",
        "ssc_indicators"
    ]
    
    all_data = {}
    for table in common_tables:
        data = query_table(table)
        if data:
            all_data[table] = data
    
    # Step 3: Check for JSONB columns that might contain framework structure
    print("\n🔍 Checking for framework data in other tables...")
    
    # Check datasets table for indicator_id references
    datasets = query_table("datasets", limit=100)
    if datasets:
        indicator_ids = [d.get("indicator_id") for d in datasets if d.get("indicator_id")]
        if indicator_ids:
            print(f"   Found {len(set(indicator_ids))} unique indicator_id references in datasets")
            all_data["dataset_indicator_refs"] = list(set(indicator_ids))
    
    # Check metadata columns for framework structure
    if datasets:
        framework_metadata = []
        for d in datasets:
            meta = d.get("metadata", {})
            if meta and any(k in str(meta).lower() for k in ["pillar", "theme", "indicator"]):
                framework_metadata.append({
                    "dataset_id": d.get("id"),
                    "name": d.get("name"),
                    "metadata": meta
                })
        if framework_metadata:
            print(f"   Found {len(framework_metadata)} datasets with framework metadata")
            all_data["framework_metadata"] = framework_metadata
    
    # Step 4: Save results
    output_file = "framework_structure_discovery.json"
    with open(output_file, 'w') as f:
        json.dump(all_data, f, indent=2, default=str)
    
    print(f"\n✅ Discovery complete! Results saved to {output_file}")
    print("\nNext steps:")
    print("1. Review the discovery results")
    print("2. Run the import script: python scripts/import_framework_structure.py")
    
    return all_data

if __name__ == "__main__":
    discover_framework_structure()
