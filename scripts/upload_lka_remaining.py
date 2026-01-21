#!/usr/bin/env python3
"""
Upload remaining LKA (Sri Lanka) administrative boundaries.
Uses Supabase REST API with service role key to handle large geometries.
"""

import os
import sys
from pathlib import Path
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL', 'https://yzxmxwppzpwfolkdiuuo.supabase.co')
SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SERVICE_ROLE_KEY:
    print("Error: SUPABASE_SERVICE_ROLE_KEY not set in environment")
    sys.exit(1)

# Remaining ADM1 INSERTs: 4, 5, 7, 8, 9
# All ADM2 INSERTs: 1-25
remaining_adm1 = [4, 5, 7, 8, 9]
remaining_adm2 = list(range(1, 26))

def execute_sql(sql: str) -> bool:
    """Execute SQL via Supabase REST API"""
    url = f"{SUPABASE_URL}/rest/v1/rpc/exec_sql"
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json"
    }
    
    # Try using the REST API's SQL execution endpoint
    # If that doesn't work, we'll use direct POST to /rest/v1/rpc
    try:
        response = requests.post(
            url,
            headers=headers,
            json={"query": sql},
            timeout=60
        )
        if response.status_code == 200:
            return True
        else:
            print(f"  Error: {response.status_code} - {response.text[:200]}")
            return False
    except Exception as e:
        print(f"  Exception: {e}")
        return False

def upload_inserts(level: str, insert_numbers: list):
    """Upload INSERT statements for a given admin level"""
    print(f"\nUploading LKA {level} INSERTs: {insert_numbers}")
    
    for i in insert_numbers:
        file_path = Path(f'/tmp/lka_{level.lower()}_simplified_insert_{i}.sql')
        if not file_path.exists():
            print(f"  INSERT {i}: File not found, skipping")
            continue
        
        sql = file_path.read_text()
        print(f"  INSERT {i}: {len(sql)} bytes", end=" ... ")
        
        if execute_sql(sql):
            print("✓")
        else:
            print("✗")
            # Continue with next INSERT even if one fails

if __name__ == "__main__":
    print("Uploading remaining LKA administrative boundaries...")
    print(f"Supabase URL: {SUPABASE_URL}")
    
    # Upload remaining ADM1
    upload_inserts("ADM1", remaining_adm1)
    
    # Upload all ADM2
    upload_inserts("ADM2", remaining_adm2)
    
    print("\nDone!")
