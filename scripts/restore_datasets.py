#!/usr/bin/env python3
"""
Restore Building Typology Datasets from Source to Target
Uses Supabase REST API to export and import data
"""

import json
import urllib.request
import urllib.parse
from typing import List, Dict, Optional

# Configuration
SOURCE_PROJECT = "vxoyzgsxiqwpufrtnerf"
SOURCE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4b3l6Z3N4aXF3cHVmcnRuZXJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjU3ODAyMiwiZXhwIjoyMDc4MTU0MDIyfQ.fdRNdgzaHLeXYabs0kFG2BcMPG6kEY9W1Vy6-5YBsBc"

TARGET_PROJECT = "yzxmxwppzpwfolkdiuuo"
TARGET_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6eG14d3BwenB3Zm9sa2RpdXVvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQyMjk3NSwiZXhwIjoyMDgzOTk4OTc1fQ.vW5z5udhwZOW367t3m3y9MOhnCpRN6SiQe1wwJw9xCE"

DATASETS = [
    {
        "name": "Building Typologies (adm3)",
        "source_id": "a017b4a4-b958-4ede-ab9d-8f4124188d4c",
        "target_name": "Building Typologies (adm3)"
    },
    {
        "name": "Building Typology",
        "source_id": "59abe182-73c6-47f5-8e7b-752a1168bf06",
        "target_name": "Building Typology"
    }
]

def query_data(project_id: str, api_key: str, table: str, filters: Dict) -> List[Dict]:
    """Query data from Supabase using PostgREST API"""
    # Build query params
    params = {"select": "*"}
    for key, value in filters.items():
        params[key] = f"eq.{value}"
    
    query_string = urllib.parse.urlencode(params)
    url = f"https://{project_id}.supabase.co/rest/v1/{table}?{query_string}"
    
    req = urllib.request.Request(url)
    req.add_header("apikey", api_key)
    req.add_header("Authorization", f"Bearer {api_key}")
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", "return=representation")
    
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode())

def insert_data(project_id: str, api_key: str, table: str, data: List[Dict]) -> Dict:
    """Insert data into Supabase using PostgREST API"""
    url = f"https://{project_id}.supabase.co/rest/v1/{table}"
    
    json_data = json.dumps(data).encode('utf-8')
    
    req = urllib.request.Request(url, data=json_data, method='POST')
    req.add_header("apikey", api_key)
    req.add_header("Authorization", f"Bearer {api_key}")
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", "return=representation,resolution=merge-duplicates")
    
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        raise Exception(f"HTTP {e.code}: {error_body}")

def restore_dataset(dataset: Dict):
    """Restore a single dataset"""
    print(f"\n📦 Processing: {dataset['name']}")
    print(f"   Source ID: {dataset['source_id']}")
    
    # Step 1: Find target dataset ID
    print("   🔍 Finding target dataset...")
    try:
        target_datasets = query_data(
            TARGET_PROJECT, TARGET_KEY, "datasets",
            {"name": dataset['target_name']}
        )
        
        if not target_datasets:
            print(f"   ⚠️  Target dataset '{dataset['target_name']}' not found. Skipping.")
            return
        
        target_dataset_id = target_datasets[0]['id']
        print(f"   ✓ Found target dataset ID: {target_dataset_id}")
    except Exception as e:
        print(f"   ❌ Error finding target dataset: {e}")
        return
    
    # Step 2: Export from source (with pagination)
    print("   📤 Exporting from source...")
    source_data = []
    
    def fetch_all_rows(project_id, api_key, table, filters):
        """Fetch all rows with pagination"""
        all_data = []
        limit = 1000
        offset = 0
        
        while True:
            params = {"select": "*", "limit": str(limit), "offset": str(offset)}
            for key, value in filters.items():
                params[key] = f"eq.{value}"
            
            query_string = urllib.parse.urlencode(params)
            url = f"https://{project_id}.supabase.co/rest/v1/{table}?{query_string}"
            
            req = urllib.request.Request(url)
            req.add_header("apikey", api_key)
            req.add_header("Authorization", f"Bearer {api_key}")
            req.add_header("Content-Type", "application/json")
            req.add_header("Prefer", "return=representation")
            
            with urllib.request.urlopen(req) as response:
                batch = json.loads(response.read().decode())
                if not batch:
                    break
                all_data.extend(batch)
                if len(batch) < limit:
                    break
                offset += limit
                print(f"      Fetched {len(all_data)} rows so far...")
        
        return all_data
    
    # Try raw table first
    try:
        source_data = fetch_all_rows(
            SOURCE_PROJECT, SOURCE_KEY, "dataset_values_categorical_raw",
            {"dataset_id": dataset['source_id']}
        )
        print(f"   ✓ Found {len(source_data)} rows in raw table")
    except Exception as e:
        print(f"   ⚠️  Raw table query failed: {e}")
    
    # If raw is empty, try cleaned table
    if not source_data:
        try:
            source_data = fetch_all_rows(
                SOURCE_PROJECT, SOURCE_KEY, "dataset_values_categorical",
                {"dataset_id": dataset['source_id']}
            )
            print(f"   ✓ Found {len(source_data)} rows in cleaned table")
        except Exception as e:
            print(f"   ❌ Error exporting data: {e}")
            return
    
    if not source_data:
        print("   ⚠️  No data found in source. Skipping.")
        return
    
    # Step 3: Prepare import data
    print("   🔄 Preparing data for import...")
    import_data = []
    skipped = 0
    
    for row in source_data:
        # Handle different possible column names
        admin_pcode = row.get("admin_pcode") or row.get("admin_pcode_raw")
        
        # Check if this is "long" format (has category column)
        if row.get("category"):
            # Long format - direct mapping
            import_data.append({
                "dataset_id": target_dataset_id,
                "admin_pcode": admin_pcode,
                "category": row["category"],
                "value": row.get("value")
            })
        # Check if this is "wide" format (has raw_row with categories)
        elif row.get("raw_row") and isinstance(row["raw_row"], dict):
            # Wide format - need to extract categories from raw_row
            raw_row = row["raw_row"]
            wide_categories = raw_row.get("__ssc_wide_categories", [])
            
            if not admin_pcode:
                skipped += 1
                continue
            
            # Extract each category value
            for cat_name in wide_categories:
                # Get the normalized category name if available
                normalized = raw_row.get("__ssc_wide_categories_normalized", {})
                category_key = normalized.get(cat_name, cat_name.lower().replace(" ", "_"))
                
                # Get the value for this category
                value = raw_row.get(cat_name)
                if value is None or value == '':
                    continue
                
                try:
                    value_num = float(value) if value else None
                except (ValueError, TypeError):
                    value_num = None
                
                import_data.append({
                    "dataset_id": target_dataset_id,
                    "admin_pcode": admin_pcode,
                    "category": category_key,
                    "value": value_num
                })
        # Try other column name variations
        elif row.get("category"):
            category = row.get("category") or row.get("category_raw")
            value = row.get("value") or row.get("value_raw")
            
            if not admin_pcode or not category:
                skipped += 1
                continue
            
            import_data.append({
                "dataset_id": target_dataset_id,
                "admin_pcode": admin_pcode,
                "category": category,
                "value": value
            })
        else:
            skipped += 1
    
    if skipped > 0:
        print(f"   ⚠️  Skipped {skipped} rows that couldn't be converted")
    
    # Step 4: Import to target (batch insert)
    print(f"   📥 Importing {len(import_data)} rows to target...")
    batch_size = 1000
    imported = 0
    
    for i in range(0, len(import_data), batch_size):
        batch = import_data[i:i + batch_size]
        try:
            result = insert_data(
                TARGET_PROJECT, TARGET_KEY,
                "dataset_values_categorical_raw", batch
            )
            imported += len(batch)
            print(f"   ✓ Imported batch: {imported}/{len(import_data)} rows")
        except Exception as e:
            print(f"   ⚠️  Batch import error: {e}")
            # Try individual inserts
            for row in batch:
                try:
                    insert_data(
                        TARGET_PROJECT, TARGET_KEY,
                        "dataset_values_categorical_raw", [row]
                    )
                    imported += 1
                except Exception as err:
                    print(f"   ⚠️  Failed to import row: {err}")
    
    print(f"   ✓ Successfully imported {imported} rows")
    print(f"   ✅ Dataset restoration complete: {dataset['name']}")
    print(f"   💡 Next: Run cleaning function via SQL:")
    print(f"      SELECT * FROM restore_dataset_from_raw('{target_dataset_id}');")

def main():
    print("🚀 Starting dataset restoration...\n")
    
    for dataset in DATASETS:
        try:
            restore_dataset(dataset)
        except Exception as e:
            print(f"❌ Error processing {dataset['name']}: {e}")
    
    print("\n🎉 Restoration process completed!")
    print("\nNext steps:")
    print("1. Verify data was imported correctly")
    print("2. Run cleaning functions via SQL Editor:")
    print("   SELECT * FROM restore_dataset_from_raw('target-dataset-id');")

if __name__ == "__main__":
    main()
