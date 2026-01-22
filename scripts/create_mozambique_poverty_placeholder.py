#!/usr/bin/env python3
"""
Create a placeholder poverty rate dataset for Mozambique at ADM2 level.
Uses the existing population dataset as a base and creates placeholder poverty rates
that can be updated with real data later.
"""

import os
import sys
from pathlib import Path
from supabase import create_client
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env.local")
load_dotenv()

def main():
    print("=" * 80)
    print("Create Mozambique Poverty Rate Placeholder Dataset")
    print("=" * 80)
    
    # Initialize Supabase
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        print("Error: Missing Supabase credentials")
        return
    
    supabase = create_client(supabase_url, supabase_key)
    
    # Get Mozambique country ID
    country_resp = supabase.table("countries").select("id, iso_code, name").eq("iso_code", "MOZ").single().execute()
    if not country_resp.data:
        print("Error: Mozambique not found")
        return
    
    country_id = country_resp.data["id"]
    print(f"Country: {country_resp.data['name']} ({country_resp.data['iso_code']})\n")
    
    # Find the population dataset we just created
    print("Finding Mozambique population dataset...")
    pop_resp = supabase.table("datasets").select("id, name, admin_level").eq("country_id", country_id).ilike("name", "%population%").eq("admin_level", "ADM2").order("created_at", desc=True).limit(1).execute()
    
    if not pop_resp.data or len(pop_resp.data) == 0:
        print("Error: Could not find Mozambique ADM2 population dataset")
        print("Please import population data first using: python3 scripts/import_mozambique_population.py")
        return
    
    pop_dataset = pop_resp.data[0]
    pop_dataset_id = pop_dataset["id"]
    print(f"✓ Found population dataset: {pop_dataset['name']} (ID: {pop_dataset_id})\n")
    
    # Get all ADM2 boundaries for Mozambique to create placeholder values
    print("Getting ADM2 boundaries...")
    boundaries_resp = supabase.table("admin_boundaries").select("admin_pcode, name, parent_pcode").eq("country_id", country_id).eq("admin_level", "ADM2").order("admin_pcode").execute()
    
    if not boundaries_resp.data:
        print("Error: Could not find ADM2 boundaries")
        return
    
    boundaries = boundaries_resp.data
    print(f"✓ Found {len(boundaries)} ADM2 boundaries\n")
    
    # Get province (ADM1) codes to use for regional poverty estimates
    # Based on research: Northern/Central provinces have higher poverty (~60-70%),
    # Southern provinces (Maputo) have lower poverty (~20-30%)
    provinces_resp = supabase.table("admin_boundaries").select("admin_pcode, name").eq("country_id", country_id).eq("admin_level", "ADM1").order("admin_pcode").execute()
    
    province_poverty_rates = {}
    if provinces_resp.data:
        # Assign placeholder poverty rates by province
        # Northern/Central provinces: higher poverty
        high_poverty_provinces = ["Niassa", "Cabo Delgado", "Nampula", "Zambézia", "Tete", "Manica", "Sofala"]
        # Southern provinces: lower poverty
        low_poverty_provinces = ["Maputo", "Gaza", "Inhambane"]
        
        for prov in provinces_resp.data:
            prov_name = prov["name"]
            if any(high in prov_name for high in high_poverty_provinces):
                province_poverty_rates[prov["admin_pcode"]] = 0.65  # 65% poverty rate
            elif any(low in prov_name for low in low_poverty_provinces):
                province_poverty_rates[prov["admin_pcode"]] = 0.25  # 25% poverty rate
            else:
                province_poverty_rates[prov["admin_pcode"]] = 0.50  # 50% default
    
    # Create placeholder poverty rates for each district
    # Use province-level rates if available, otherwise use national average
    default_poverty_rate = 0.52  # National average from World Bank (2016)
    poverty_values = []
    
    for boundary in boundaries:
        pcode = boundary["admin_pcode"]
        parent_pcode = boundary.get("parent_pcode")
        
        # Try to get province-level rate, otherwise use default
        poverty_rate = default_poverty_rate
        if parent_pcode and parent_pcode in province_poverty_rates:
            poverty_rate = province_poverty_rates[parent_pcode]
        elif not parent_pcode:
            # Try to match by pcode prefix (e.g., MZ01 -> province MZ01)
            for prov_code, rate in province_poverty_rates.items():
                if pcode.startswith(prov_code):
                    poverty_rate = rate
                    break
        
        # Add some variation (±5%) to make it more realistic
        import random
        variation = random.uniform(-0.05, 0.05)
        poverty_rate = max(0.10, min(0.90, poverty_rate + variation))  # Clamp between 10% and 90%
        
        poverty_values.append({
            "admin_pcode": pcode,
            "value": round(poverty_rate, 4)
        })
    
    print(f"Generated {len(poverty_values)} placeholder poverty rates")
    print(f"Range: {min(v['value'] for v in poverty_values):.2%} - {max(v['value'] for v in poverty_values):.2%}")
    print(f"Average: {sum(v['value'] for v in poverty_values) / len(poverty_values):.2%}\n")
    
    # Create dataset metadata
    dataset_name = "Mozambique Poverty Rate (Placeholder) - ADM2"
    dataset_description = "Placeholder poverty rate dataset for Mozambique at ADM2 (district) level. " \
                         "Values are estimated based on province-level poverty patterns and should be " \
                         "replaced with actual data when available. Source: Estimated based on World Bank " \
                         "province-level poverty data (2016) and regional patterns."
    
    dataset_metadata = {
        "name": dataset_name,
        "description": dataset_description,
        "type": "numeric",
        "admin_level": "ADM2",
        "country_id": country_id,
        "is_baseline": True,
        "source": "Placeholder - Estimated from province-level patterns",
        "metadata": {
            "source_link": "https://data.worldbank.org/country/mozambique",
            "is_placeholder": True,
            "placeholder_note": "This dataset contains estimated poverty rates based on province-level patterns. " \
                               "Actual subnational poverty data should replace this when available.",
            "estimated_from": "World Bank province-level poverty data (2016) and regional patterns",
            "pillar": "Underlying Vulnerability",
            "category": "Underlying Vulnerability",
            "created_at": pd.Timestamp.now().isoformat(),
        }
    }
    
    # Insert dataset
    print("Creating placeholder dataset...")
    dataset_resp = supabase.table("datasets").insert(dataset_metadata).execute()
    
    if not dataset_resp.data or len(dataset_resp.data) == 0:
        print(f"Error creating dataset: {dataset_resp}")
        return
    
    dataset_id = dataset_resp.data[0]["id"]
    print(f"✓ Created dataset: {dataset_name} (ID: {dataset_id})\n")
    
    # Insert values in batches
    print("Inserting placeholder poverty values...")
    batch_size = 500
    total_inserted = 0
    
    for i in range(0, len(poverty_values), batch_size):
        batch = poverty_values[i:i + batch_size]
        values = [
            {
                "dataset_id": dataset_id,
                "admin_pcode": item["admin_pcode"],
                "value": item["value"]
            }
            for item in batch
        ]
        
        try:
            resp = supabase.table("dataset_values_numeric").insert(values).execute()
            batch_inserted = len(values)
            total_inserted += batch_inserted
            print(f"  Batch {i//batch_size + 1}: {batch_inserted} values inserted")
        except Exception as e:
            print(f"  ⚠️  Error inserting batch {i//batch_size + 1}: {e}")
    
    print(f"\n✓ Total: {total_inserted} placeholder poverty rate values created")
    print(f"✓ Dataset ID: {dataset_id}")
    print(f"✓ Admin Level: ADM2")
    print(f"✓ Category: Underlying Vulnerability (set in metadata)")
    print("\n⚠️  NOTE: This is a PLACEHOLDER dataset with estimated values.")
    print("   Please replace with actual poverty data when available.")
    print("\n   To update the category in the UI:")
    print("   1. Go to the dataset in the datasets list")
    print("   2. Edit the dataset")
    print("   3. Set category to 'Underlying Vulnerability'")

if __name__ == "__main__":
    import pandas as pd
    main()
