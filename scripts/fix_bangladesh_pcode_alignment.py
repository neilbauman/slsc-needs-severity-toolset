#!/usr/bin/env python3
"""
Fix Bangladesh pcode alignment by mapping population pcodes to boundary pcodes.
Population uses format: BD100409 (BD + ADM2 code + ADM3 suffix)
Boundaries use format: BD20030004 (BD + division + district + upazila)

Strategy: Map population pcodes to boundaries via ADM2 parent relationship.
"""

import os
import sys
from pathlib import Path
from supabase import create_client
from dotenv import load_dotenv
from collections import defaultdict

load_dotenv(Path(__file__).parent.parent / ".env.local")
load_dotenv()

def main():
    print("=" * 80)
    print("FIX BANGLADESH PCODE ALIGNMENT")
    print("=" * 80)
    
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        print("Error: Missing Supabase credentials")
        return
    
    supabase = create_client(supabase_url, supabase_key)
    
    country_id = '0aa6850c-b932-444b-88b4-7e29ea8cc0bc'
    pop_dataset_id = 'b3ff17df-b342-4844-ad23-4b0966c6d35d'
    
    print("\nStep 1: Analyzing pcode structure...")
    
    # Get population values
    pop_resp = supabase.table("dataset_values_numeric").select("admin_pcode, value").eq("dataset_id", pop_dataset_id).execute()
    print(f"  Found {len(pop_resp.data)} population values")
    
    # Get ADM2 boundaries
    adm2_resp = supabase.table("admin_boundaries").select("admin_pcode, name").eq("country_id", country_id).eq("admin_level", "ADM2").execute()
    adm2_lookup = {b["admin_pcode"]: b["name"] for b in adm2_resp.data}
    print(f"  Found {len(adm2_lookup)} ADM2 boundaries")
    
    # Get ADM3 boundaries with parent relationships
    adm3_resp = supabase.table("admin_boundaries").select("admin_pcode, name, parent_pcode").eq("country_id", country_id).eq("admin_level", "ADM3").execute()
    print(f"  Found {len(adm3_resp.data)} ADM3 boundaries")
    
    # Group ADM3 by parent
    adm3_by_parent = defaultdict(list)
    for b in adm3_resp.data:
        if b.get("parent_pcode"):
            adm3_by_parent[b["parent_pcode"]].append(b)
    
    print(f"  ADM3 boundaries grouped under {len(adm3_by_parent)} ADM2 parents")
    
    # Try to map population pcodes to ADM3 boundaries
    # Population format: BD100409 -> BD1004 (ADM2) + 09 (ADM3 suffix)
    # We need to find the ADM3 boundary under BD1004 that corresponds to suffix 09
    
    print("\nStep 2: Creating pcode mapping...")
    
    mapping = {}
    unmapped = []
    
    for pop_row in pop_resp.data:
        pop_pcode = pop_row["admin_pcode"]  # e.g., BD100409
        
        # Extract ADM2 code (first 6 characters)
        if len(pop_pcode) >= 6:
            adm2_code = pop_pcode[:6]  # BD1004
            adm3_suffix = pop_pcode[6:]  # 09
            
            # Find ADM3 boundaries under this ADM2
            if adm2_code in adm3_by_parent:
                adm3_children = adm3_by_parent[adm2_code]
                
                # Try to match by suffix or position
                # If there are multiple children, we might need a different strategy
                if len(adm3_children) == 1:
                    # Only one child, direct match
                    mapping[pop_pcode] = adm3_children[0]["admin_pcode"]
                elif len(adm3_children) > 1:
                    # Multiple children - try to match by suffix or use first available
                    # For now, we'll need a more sophisticated mapping
                    # This is a complex problem that may require name matching or external mapping
                    unmapped.append(pop_pcode)
            else:
                unmapped.append(pop_pcode)
        else:
            unmapped.append(pop_pcode)
    
    print(f"  Mapped: {len(mapping)} pcodes")
    print(f"  Unmapped: {len(unmapped)} pcodes")
    
    if len(unmapped) > 0:
        print(f"\n⚠️  Warning: {len(unmapped)} population pcodes could not be automatically mapped")
        print("  This requires manual mapping or re-import with correct pcode format")
        print(f"  Sample unmapped: {unmapped[:10]}")
    
    if len(mapping) == 0:
        print("\n❌ No mappings could be created automatically")
        print("  Recommendation: Re-import Bangladesh boundaries with pcode format matching population data")
        print("  OR re-import population data with pcode format matching boundaries")
        return
    
    print(f"\nStep 3: Updating population dataset values...")
    
    # Update pcodes in dataset_values_numeric
    batch_size = 100
    updated = 0
    
    for i, (old_pcode, new_pcode) in enumerate(mapping.items()):
        try:
            # Update the pcode
            supabase.table("dataset_values_numeric").update({
                "admin_pcode": new_pcode
            }).eq("dataset_id", pop_dataset_id).eq("admin_pcode", old_pcode).execute()
            updated += 1
            
            if (i + 1) % 100 == 0:
                print(f"  Updated {i + 1}/{len(mapping)}...")
        except Exception as e:
            print(f"  ⚠️  Error updating {old_pcode} -> {new_pcode}: {e}")
    
    print(f"\n✓ Updated {updated} population values")
    
    # Verify coverage
    print("\nStep 4: Verifying coverage...")
    pop_resp_after = supabase.table("dataset_values_numeric").select("admin_pcode").eq("dataset_id", pop_dataset_id).execute()
    pop_pcodes_after = {r["admin_pcode"] for r in pop_resp_after.data}
    bound_pcodes = {b["admin_pcode"] for b in adm3_resp.data}
    
    matched = pop_pcodes_after & bound_pcodes
    coverage = (len(matched) / len(bound_pcodes)) * 100 if bound_pcodes else 0
    
    print(f"  Coverage: {coverage:.1f}% ({len(matched)}/{len(bound_pcodes)} boundaries)")
    
    if coverage < 50:
        print("\n⚠️  Coverage is still low. Manual mapping or re-import may be required.")

if __name__ == "__main__":
    main()
