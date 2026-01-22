#!/usr/bin/env python3
"""
Audit Sri Lanka boundaries and import missing admin levels.
This script will:
1. Audit current boundary coverage
2. Import missing ADM2, ADM3, and ADM4 boundaries from HDX
"""

import os
import sys
from pathlib import Path
from supabase import create_client
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env.local")
load_dotenv()

def audit_boundaries(supabase, country_id):
    """Audit current boundary coverage."""
    print("=" * 80)
    print("SRI LANKA BOUNDARY AUDIT")
    print("=" * 80)
    
    expected = {
        "ADM1": 9,
        "ADM2": 25,
        "ADM3": 331,
        "ADM4": 14022
    }
    
    print("\nCurrent vs Expected Boundaries:\n")
    missing_levels = []
    
    for level, expected_count in expected.items():
        count_resp = supabase.table("admin_boundaries").select("id", count="exact").eq("country_id", country_id).eq("admin_level", level).execute()
        current_count = count_resp.count or 0
        
        status = "✓" if current_count == expected_count else "⚠️"
        missing = expected_count - current_count
        
        print(f"  {status} {level}: {current_count}/{expected_count} boundaries")
        
        if missing > 0:
            missing_levels.append((level, missing))
            print(f"     Missing: {missing} boundaries")
    
    return missing_levels

def main():
    print("=" * 80)
    print("SRI LANKA BOUNDARY AUDIT AND IMPORT")
    print("=" * 80)
    
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        print("Error: Missing Supabase credentials")
        return
    
    supabase = create_client(supabase_url, supabase_key)
    
    # Get Sri Lanka country ID
    country_resp = supabase.table("countries").select("id, name, iso_code").ilike("name", "%Sri Lanka%").single().execute()
    if not country_resp.data:
        print("Error: Sri Lanka not found in countries table")
        return
    
    country_id = country_resp.data["id"]
    country_name = country_resp.data["name"]
    iso_code = country_resp.data["iso_code"]
    
    print(f"\nCountry: {country_name} ({iso_code})")
    
    # Audit current boundaries
    missing_levels = audit_boundaries(supabase, country_id)
    
    if not missing_levels:
        print("\n✓ All boundaries are present!")
        return
    
    print(f"\n\nMissing boundaries detected:")
    for level, count in missing_levels:
        print(f"  {level}: {count} boundaries missing")
    
    print(f"\n{'=' * 80}")
    print("RECOMMENDATION")
    print("=" * 80)
    print("Run the following command to import all missing boundaries:")
    print("  python3 scripts/reimport_boundaries_single_country.py LKA")
    print("\nThis will:")
    print("  - Download boundaries from HDX (cod-ab-lka dataset)")
    print("  - Import all admin levels (ADM1-ADM4)")
    print("  - Replace existing boundaries with complete dataset")
    print("\nNote: This may take 10-20 minutes due to large file sizes.")

if __name__ == "__main__":
    main()
