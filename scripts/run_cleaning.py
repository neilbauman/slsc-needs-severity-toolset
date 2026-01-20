#!/usr/bin/env python3
"""
Run cleaning functions on restored datasets
"""

import json
import urllib.request
import urllib.parse

TARGET_PROJECT = "yzxmxwppzpwfolkdiuuo"
TARGET_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6eG14d3BwenB3Zm9sa2RpdXVvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQyMjk3NSwiZXhwIjoyMDgzOTk4OTc1fQ.vW5z5udhwZOW367t3m3y9MOhnCpRN6SiQe1wwJw9xCE"

DATASETS = [
    {
        "name": "Building Typologies (adm3)",
        "id": "a017b4a4-b958-4ede-ab9d-8f4124188d4c"
    },
    {
        "name": "Building Typology",
        "id": "59abe182-73c6-47f5-8e7b-752a1168bf06"
    }
]

def call_rpc(project_id, api_key, function_name, params):
    """Call a Supabase RPC function"""
    url = f"https://{project_id}.supabase.co/rest/v1/rpc/{function_name}"
    
    json_data = json.dumps(params).encode('utf-8')
    
    req = urllib.request.Request(url, data=json_data, method='POST')
    req.add_header("apikey", api_key)
    req.add_header("Authorization", f"Bearer {api_key}")
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", "return=representation")
    
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        raise Exception(f"HTTP {e.code}: {error_body}")

def main():
    print("🔧 Running cleaning functions on restored datasets...\n")
    
    for dataset in DATASETS:
        print(f"📦 Processing: {dataset['name']}")
        print(f"   Dataset ID: {dataset['id']}")
        
        try:
            result = call_rpc(
                TARGET_PROJECT,
                TARGET_KEY,
                "restore_dataset_from_raw",
                {"p_dataset_id": dataset['id']}
            )
            
            print(f"   ✅ Cleaning completed!")
            print(f"   Results:")
            for row in result:
                print(f"      {row.get('step', 'N/A')}: {row.get('message', 'N/A')} ({row.get('count_value', 0)} rows)")
            print()
            
        except Exception as e:
            print(f"   ❌ Error: {e}")
            print(f"   💡 You may need to run this manually via SQL Editor:")
            print(f"      SELECT * FROM restore_dataset_from_raw('{dataset['id']}');")
            print()

if __name__ == "__main__":
    main()
