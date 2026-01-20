#!/usr/bin/env python3
"""
Import Framework Structure to Target Database
This script imports pillars, themes, sub-themes, and indicators from discovery results
"""

import os
import sys
import json
import urllib.request
import urllib.error

# Target database configuration (current database)
TARGET_PROJECT_ID = os.getenv("NEXT_PUBLIC_SUPABASE_PROJECT_ID", "yzxmxwppzpwfolkdiuuo")
TARGET_ANON_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
TARGET_URL = f"https://{TARGET_PROJECT_ID}.supabase.co"

def make_request(endpoint, method="GET", data=None):
    """Make a request to Supabase REST API"""
    url = f"{TARGET_URL}/rest/v1/{endpoint}"
    headers = {
        "apikey": TARGET_ANON_KEY,
        "Authorization": f"Bearer {TARGET_ANON_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    req = urllib.request.Request(url, headers=headers)
    if method == "POST" and data:
        req.data = json.dumps(data).encode('utf-8')
        req.get_method = lambda: "POST"
    elif method == "PUT" and data:
        req.data = json.dumps(data).encode('utf-8')
        req.get_method = lambda: "PUT"
    elif method == "GET":
        req.get_method = lambda: "GET"
    
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        print(f"Error {e.code}: {error_body}")
        return None

def normalize_pillar_code(code):
    """Normalize pillar code to P1, P2, P3 format"""
    code = str(code).upper().strip()
    if code.startswith("P"):
        return code
    # Try to extract number
    import re
    match = re.search(r'(\d+)', code)
    if match:
        return f"P{match.group(1)}"
    return code

def import_pillars(data):
    """Import pillars"""
    print("\n📦 Importing Pillars...")
    
    # Look for pillars in various possible locations
    pillars_data = []
    
    # Check direct pillars table
    if "pillars" in data:
        pillars_data = data["pillars"]
    elif "framework_pillars" in data:
        pillars_data = data["framework_pillars"]
    elif "ssc_pillars" in data:
        pillars_data = data["ssc_pillars"]
    
    if not pillars_data:
        print("   No pillars data found. Creating default pillars...")
        pillars_data = [
            {"code": "P1", "name": "The Shelter", "description": "Structural safety & direct exposure of homes", "order_index": 1},
            {"code": "P2", "name": "The Living Conditions", "description": "Physical & socioeconomic fragility factors", "order_index": 2},
            {"code": "P3", "name": "The Settlement", "description": "Readiness of services, governance & access", "order_index": 3},
        ]
    
    pillar_map = {}
    for pillar in pillars_data:
        code = normalize_pillar_code(pillar.get("code", pillar.get("pillar_code", "")))
        name = pillar.get("name", pillar.get("pillar_name", f"Pillar {code}"))
        description = pillar.get("description", pillar.get("pillar_description", ""))
        order_index = pillar.get("order_index", pillar.get("order", 0))
        
        payload = {
            "code": code,
            "name": name,
            "description": description,
            "order_index": order_index,
            "is_active": True
        }
        
        result = make_request("framework_pillars", method="POST", data=payload)
        if result:
            pillar_id = result[0]["id"] if isinstance(result, list) else result["id"]
            pillar_map[code] = pillar_id
            print(f"   ✅ Imported pillar: {code} - {name} (ID: {pillar_id})")
        else:
            print(f"   ❌ Failed to import pillar: {code}")
    
    return pillar_map

def import_themes(data, pillar_map):
    """Import themes"""
    print("\n📦 Importing Themes...")
    
    themes_data = []
    if "themes" in data:
        themes_data = data["themes"]
    elif "framework_themes" in data:
        themes_data = data["framework_themes"]
    elif "ssc_themes" in data:
        themes_data = data["ssc_themes"]
    
    if not themes_data:
        print("   No themes data found.")
        return {}
    
    theme_map = {}
    for theme in themes_data:
        pillar_code = normalize_pillar_code(theme.get("pillar_code", theme.get("pillar_id", "")))
        pillar_id = pillar_map.get(pillar_code)
        
        if not pillar_id:
            print(f"   ⚠️  Skipping theme {theme.get('code')} - pillar {pillar_code} not found")
            continue
        
        code = theme.get("code", theme.get("theme_code", ""))
        name = theme.get("name", theme.get("theme_name", ""))
        description = theme.get("description", theme.get("theme_description", ""))
        order_index = theme.get("order_index", theme.get("order", 0))
        
        payload = {
            "pillar_id": pillar_id,
            "code": code,
            "name": name,
            "description": description,
            "order_index": order_index,
            "is_active": True
        }
        
        result = make_request("framework_themes", method="POST", data=payload)
        if result:
            theme_id = result[0]["id"] if isinstance(result, list) else result["id"]
            theme_map[code] = theme_id
            print(f"   ✅ Imported theme: {code} - {name} (ID: {theme_id})")
        else:
            print(f"   ❌ Failed to import theme: {code}")
    
    return theme_map

def import_subthemes(data, theme_map):
    """Import sub-themes"""
    print("\n📦 Importing Sub-themes...")
    
    subthemes_data = []
    if "subthemes" in data:
        subthemes_data = data["subthemes"]
    elif "sub_themes" in data:
        subthemes_data = data["sub_themes"]
    elif "framework_subthemes" in data:
        subthemes_data = data["framework_subthemes"]
    
    if not subthemes_data:
        print("   No sub-themes data found.")
        return {}
    
    subtheme_map = {}
    for subtheme in subthemes_data:
        theme_code = subtheme.get("theme_code", subtheme.get("theme_id", ""))
        theme_id = theme_map.get(theme_code)
        
        if not theme_id:
            print(f"   ⚠️  Skipping sub-theme {subtheme.get('code')} - theme {theme_code} not found")
            continue
        
        code = subtheme.get("code", subtheme.get("subtheme_code", ""))
        name = subtheme.get("name", subtheme.get("subtheme_name", ""))
        description = subtheme.get("description", subtheme.get("subtheme_description", ""))
        order_index = subtheme.get("order_index", subtheme.get("order", 0))
        
        payload = {
            "theme_id": theme_id,
            "code": code,
            "name": name,
            "description": description,
            "order_index": order_index,
            "is_active": True
        }
        
        result = make_request("framework_subthemes", method="POST", data=payload)
        if result:
            subtheme_id = result[0]["id"] if isinstance(result, list) else result["id"]
            subtheme_map[code] = subtheme_id
            print(f"   ✅ Imported sub-theme: {code} - {name} (ID: {subtheme_id})")
        else:
            print(f"   ❌ Failed to import sub-theme: {code}")
    
    return subtheme_map

def import_indicators(data, subtheme_map):
    """Import indicators"""
    print("\n📦 Importing Indicators...")
    
    indicators_data = []
    if "indicators" in data:
        indicators_data = data["indicators"]
    elif "framework_indicators" in data:
        indicators_data = data["framework_indicators"]
    elif "ssc_indicators" in data:
        indicators_data = data["ssc_indicators"]
    
    if not indicators_data:
        print("   No indicators data found.")
        return {}
    
    indicator_map = {}
    for indicator in indicators_data:
        subtheme_code = indicator.get("subtheme_code", indicator.get("subtheme_id", ""))
        subtheme_id = subtheme_map.get(subtheme_code)
        
        if not subtheme_id:
            print(f"   ⚠️  Skipping indicator {indicator.get('code')} - sub-theme {subtheme_code} not found")
            continue
        
        code = indicator.get("code", indicator.get("indicator_code", ""))
        name = indicator.get("name", indicator.get("indicator_name", ""))
        description = indicator.get("description", indicator.get("indicator_description", ""))
        data_type = indicator.get("data_type", indicator.get("type", "numeric"))
        unit = indicator.get("unit", "")
        order_index = indicator.get("order_index", indicator.get("order", 0))
        
        payload = {
            "subtheme_id": subtheme_id,
            "code": code,
            "name": name,
            "description": description,
            "data_type": data_type,
            "unit": unit,
            "order_index": order_index,
            "is_active": True
        }
        
        result = make_request("framework_indicators", method="POST", data=payload)
        if result:
            indicator_id = result[0]["id"] if isinstance(result, list) else result["id"]
            indicator_map[code] = indicator_id
            print(f"   ✅ Imported indicator: {code} - {name} (ID: {indicator_id})")
        else:
            print(f"   ❌ Failed to import indicator: {code}")
    
    return indicator_map

def main():
    """Main import function"""
    print("=" * 60)
    print("Framework Structure Import")
    print("=" * 60)
    
    # Load discovery results
    discovery_file = "framework_structure_discovery.json"
    if not os.path.exists(discovery_file):
        print(f"❌ Discovery file not found: {discovery_file}")
        print("   Please run discovery script first: python scripts/discover_framework_structure.py")
        return
    
    with open(discovery_file, 'r') as f:
        data = json.load(f)
    
    # Check for target database credentials
    if not TARGET_ANON_KEY:
        print("❌ TARGET_ANON_KEY not set!")
        print("   Set environment variable: export NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key")
        return
    
    # Import in order: pillars → themes → sub-themes → indicators
    pillar_map = import_pillars(data)
    theme_map = import_themes(data, pillar_map)
    subtheme_map = import_subthemes(data, theme_map)
    indicator_map = import_indicators(data, subtheme_map)
    
    print("\n" + "=" * 60)
    print("✅ Import Complete!")
    print("=" * 60)
    print(f"   Pillars: {len(pillar_map)}")
    print(f"   Themes: {len(theme_map)}")
    print(f"   Sub-themes: {len(subtheme_map)}")
    print(f"   Indicators: {len(indicator_map)}")

if __name__ == "__main__":
    main()
