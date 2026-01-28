#!/usr/bin/env python3
"""
Migrate categorical data from source Supabase project to target project.
This copies the Building Typologies dataset values.
"""

import os
from supabase import create_client

# Source project (where data exists)
SOURCE_URL = "https://vxoyzgsxiqwpufrtnerf.supabase.co"
SOURCE_KEY = os.environ.get("SOURCE_SUPABASE_KEY", "")

# Target project (where we want to copy data)
TARGET_URL = "https://yzxmxwppzpwfolkdiuuo.supabase.co"
TARGET_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# Dataset ID for Building Typologies
DATASET_ID = "a017b4a4-b958-4ede-ab9d-8f4124188d4c"

BATCH_SIZE = 500

def main():
    if not SOURCE_KEY:
        print("Error: Set SOURCE_SUPABASE_KEY environment variable")
        print("Get this from Supabase dashboard > Settings > API > service_role key")
        return
    
    if not TARGET_KEY:
        print("Error: Set SUPABASE_SERVICE_ROLE_KEY environment variable")
        print("This should already be in your .env.local")
        return
    
    source = create_client(SOURCE_URL, SOURCE_KEY)
    target = create_client(TARGET_URL, TARGET_KEY)
    
    # Get count first
    count_response = source.table("dataset_values_categorical").select("id", count="exact").eq("dataset_id", DATASET_ID).execute()
    total = count_response.count
    print(f"Found {total} rows to migrate")
    
    # Migrate in batches
    offset = 0
    migrated = 0
    
    while offset < total:
        print(f"Fetching batch {offset//BATCH_SIZE + 1} ({offset} to {offset + BATCH_SIZE})...")
        
        response = source.table("dataset_values_categorical").select("*").eq("dataset_id", DATASET_ID).range(offset, offset + BATCH_SIZE - 1).execute()
        
        if response.data:
            # Insert into target
            print(f"  Inserting {len(response.data)} rows...")
            target.table("dataset_values_categorical").upsert(response.data, on_conflict="id").execute()
            migrated += len(response.data)
        
        offset += BATCH_SIZE
    
    print(f"\nDone! Migrated {migrated} rows.")

if __name__ == "__main__":
    main()
