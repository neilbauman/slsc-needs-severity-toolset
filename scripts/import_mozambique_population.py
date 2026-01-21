#!/usr/bin/env python3
"""
Import Mozambique population data from HDX.
Downloads population data at the lowest available admin level (ADM3 - Administrative Posts).
"""

import os
import sys
import requests
import zipfile
import json
from pathlib import Path
import pandas as pd
from supabase import create_client
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env.local")
load_dotenv()

# HDX API base URL
HDX_API_BASE = "https://data.humdata.org/api/3/action"

# Mozambique population datasets on HDX
# Primary dataset: Mozambique - Subnational Population Statistics
MOZ_POPULATION_DATASETS = [
    {
        "name": "Mozambique - Subnational Population Statistics",
        "dataset_id": "46b79d47-0667-4baa-8d69-468b208855ed",  # Verified HDX dataset
        "description": "Population by subnational administrative units (ADM0-ADM3)"
    },
    {
        "name": "Mozambique - Population Statistics",
        "dataset_id": "cod-ps-moz",  # Fallback
        "description": "Population statistics for Mozambique"
    }
]

def get_hdx_dataset_info(dataset_id: str) -> dict:
    """Get dataset information from HDX API."""
    url = f"{HDX_API_BASE}/package_show"
    params = {"id": dataset_id}
    
    try:
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        if data.get("success"):
            return data.get("result")
        else:
            print(f"Error: {data.get('error', {}).get('message', 'Unknown error')}")
            return None
    except Exception as e:
        print(f"Error fetching dataset {dataset_id}: {e}")
        return None

def find_population_resource(dataset_info: dict, preferred_level: str = "ADM3") -> dict:
    """Find the best population resource in the dataset, preferring lowest admin level."""
    if not dataset_info:
        return None
    
    resources = dataset_info.get("resources", [])
    
    # Prefer ADM3, then ADM2, then ADM1
    level_priority = {"adm3": 1, "adm2": 2, "adm1": 3, "adm0": 4}
    
    # Score resources
    scored_resources = []
    for resource in resources:
        format_lower = resource.get("format", "").lower()
        name_lower = resource.get("name", "").lower()
        url_lower = resource.get("url", "").lower()
        
        # Skip metadata files
        if "metadata" in name_lower or "metadata" in url_lower:
            continue
        
        # Only consider CSV/Excel files
        if not any(fmt in format_lower for fmt in ["csv", "xlsx", "xls"]):
            continue
        
        # Score by admin level (lower is better)
        score = 999
        for level, priority in level_priority.items():
            if level in name_lower or level in url_lower:
                score = priority
                break
        
        # Prefer files with population keywords
        has_pop_keyword = any(kw in name_lower for kw in ["pop", "population", "census", "demographic"])
        if has_pop_keyword:
            score -= 0.5  # Boost score
        
        scored_resources.append((score, resource))
    
    if not scored_resources:
        return None
    
    # Return resource with best (lowest) score
    scored_resources.sort(key=lambda x: x[0])
    return scored_resources[0][1]

def download_and_process_population(resource_url: str, output_dir: Path) -> pd.DataFrame:
    """Download and process population data."""
    print(f"Downloading from {resource_url}...")
    
    response = requests.get(resource_url, stream=True, timeout=300)
    response.raise_for_status()
    
    # Determine file extension
    file_ext = Path(resource_url).suffix.lower()
    if not file_ext:
        file_ext = ".csv"
    
    file_path = output_dir / f"moz_population{file_ext}"
    
    with open(file_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    
    print(f"Downloaded to {file_path}")
    
    # Read the file
    if file_ext in [".xlsx", ".xls"]:
        # Try to read all sheets and find the one with data
        excel_file = pd.ExcelFile(file_path)
        print(f"Excel file has {len(excel_file.sheet_names)} sheets: {excel_file.sheet_names}")
        
        # Try each sheet
        for sheet_name in excel_file.sheet_names:
            try:
                df = pd.read_excel(file_path, sheet_name=sheet_name)
                # Skip if it looks like metadata (very few rows or no numeric columns)
                if len(df) > 10 and len(df.select_dtypes(include=['number']).columns) > 0:
                    print(f"Using sheet: {sheet_name}")
                    break
            except:
                continue
        else:
            # If no good sheet found, use first one
            df = pd.read_excel(file_path, sheet_name=excel_file.sheet_names[0])
    else:
        df = pd.read_csv(file_path)
    
    print(f"Loaded {len(df)} rows")
    print(f"Columns: {list(df.columns)}")
    
    return df

def find_pcode_column(df: pd.DataFrame, preferred_level: str = "ADM3") -> str:
    """Find the admin pcode column, preferring lowest admin level."""
    # Try patterns in order of preference (lowest level first)
    patterns = [
        "adm3_pcode", "ADM3_PCODE",  # ADM3 first (lowest)
        "adm2_pcode", "ADM2_PCODE",  # Then ADM2
        "adm1_pcode", "ADM1_PCODE",  # Then ADM1
        "adm0_pcode", "ADM0_PCODE",  # Then ADM0
        "pcode", "admin_pcode", "adm_pcode", "admin_code", "code"
    ]
    
    for pattern in patterns:
        for col in df.columns:
            if pattern.lower() == col.lower() or pattern.lower() in col.lower():
                return col
    
    return None

def find_population_column(df: pd.DataFrame) -> str:
    """Find the population value column."""
    # Try common patterns - prioritize total population columns
    patterns = [
        ("t_tl", 1),  # Total Total (highest priority)
        ("total", 2),
        ("population", 3),
        ("pop", 4),
        ("total_pop", 5),
        ("total_population", 6),
        ("pop_total", 7),
        ("persons", 8),
        ("total_persons", 9)
    ]
    
    best_col = None
    best_score = 999
    
    for pattern, priority in patterns:
        for col in df.columns:
            col_lower = col.lower()
            if pattern in col_lower and "percent" not in col_lower:
                if priority < best_score:
                    best_score = priority
                    best_col = col
    
    return best_col

def determine_admin_level(pcode_col: str, df: pd.DataFrame) -> str:
    """Determine admin level from pcode column name or data."""
    col_lower = pcode_col.lower()
    
    if "adm3" in col_lower or "admin3" in col_lower:
        return "ADM3"
    elif "adm2" in col_lower or "admin2" in col_lower:
        return "ADM2"
    elif "adm1" in col_lower or "admin1" in col_lower:
        return "ADM1"
    
    # Try to infer from pcode length/format
    # Mozambique: ADM3 codes are typically longer
    sample_pcodes = df[pcode_col].dropna().head(10)
    if len(sample_pcodes) > 0:
        avg_length = sample_pcodes.astype(str).str.len().mean()
        if avg_length > 6:
            return "ADM3"
        elif avg_length > 4:
            return "ADM2"
        else:
            return "ADM1"
    
    return "ADM3"  # Default to ADM3 (lowest level)

def main():
    print("=" * 80)
    print("Mozambique Population Data Import from HDX")
    print("=" * 80)
    
    # Initialize Supabase
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        print("Error: Missing Supabase credentials")
        print("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        return
    
    supabase = create_client(supabase_url, supabase_key)
    
    # Get Mozambique country ID
    country_resp = supabase.table("countries").select("id, iso_code, name").eq("iso_code", "MOZ").single().execute()
    if not country_resp.data:
        print("Error: Mozambique not found in countries table")
        return
    
    country_id = country_resp.data["id"]
    print(f"Country: {country_resp.data['name']} ({country_resp.data['iso_code']})")
    print(f"Country ID: {country_id}\n")
    
    # Try to find population dataset on HDX
    dataset_info = None
    resource = None
    
    for dataset_config in MOZ_POPULATION_DATASETS:
        print(f"Trying dataset: {dataset_config['dataset_id']}...")
        dataset_info = get_hdx_dataset_info(dataset_config["dataset_id"])
        if dataset_info:
            resource = find_population_resource(dataset_info)
            if resource:
                print(f"✓ Found resource: {resource.get('name', 'Unnamed')}")
                break
    
    if not dataset_info or not resource:
        print("\n⚠️  Could not find population dataset on HDX automatically.")
        print("Please provide the HDX dataset ID manually:")
        print("Usage: python scripts/import_mozambique_population.py <dataset_id>")
        print("\nOr search HDX manually: https://data.humdata.org/search?q=mozambique+population")
        return
    
    # Download and process
    output_dir = Path(__file__).parent.parent / "data" / "mozambique_population"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        df = download_and_process_population(resource["url"], output_dir)
    except Exception as e:
        print(f"Error downloading/processing: {e}")
        return
    
    # Find columns (prefer lowest admin level)
    pcode_col = find_pcode_column(df, preferred_level="ADM3")
    pop_col = find_population_column(df)
    
    if not pcode_col:
        print("\n⚠️  Could not find admin pcode column")
        print(f"Available columns: {list(df.columns)}")
        print("\nPlease specify manually:")
        print("Usage: python scripts/import_mozambique_population.py <dataset_id> <pcode_col> <pop_col>")
        return
    
    if not pop_col:
        print("\n⚠️  Could not find population column")
        print(f"Available columns: {list(df.columns)}")
        # Try to suggest T_TL if it exists
        if "T_TL" in df.columns:
            print("\n💡 Found 'T_TL' column - this appears to be total population")
            use_t_tl = input("Use T_TL as population column? (y/n): ").strip().lower()
            if use_t_tl == 'y':
                pop_col = "T_TL"
            else:
                print("\nPlease specify manually:")
                print("Usage: python scripts/import_mozambique_population.py <dataset_id> <pcode_col> <pop_col>")
                return
        else:
            print("\nPlease specify manually:")
            print("Usage: python scripts/import_mozambique_population.py <dataset_id> <pcode_col> <pop_col>")
            return
    
    print(f"\n✓ Found pcode column: {pcode_col}")
    print(f"✓ Found population column: {pop_col}")
    
    # Determine admin level
    admin_level = determine_admin_level(pcode_col, df)
    print(f"✓ Detected admin level: {admin_level}\n")
    
    # Clean and prepare data
    df_clean = df[[pcode_col, pop_col]].copy()
    df_clean.columns = ["admin_pcode", "value"]
    df_clean = df_clean.dropna(subset=["admin_pcode", "value"])
    df_clean["admin_pcode"] = df_clean["admin_pcode"].astype(str).str.strip()
    df_clean["value"] = pd.to_numeric(df_clean["value"], errors="coerce")
    df_clean = df_clean.dropna(subset=["value"])
    df_clean = df_clean[df_clean["value"] > 0]  # Remove zero/negative values
    
    print(f"Cleaned data: {len(df_clean)} rows")
    print(f"Sample data:\n{df_clean.head()}\n")
    
    # Create dataset metadata
    dataset_name = f"Mozambique Population - {admin_level}"
    dataset_description = f"Total population by {admin_level} administrative units for Mozambique. Source: HDX ({dataset_info.get('name', 'Unknown dataset')})"
    
    dataset_metadata = {
        "name": dataset_name,
        "description": dataset_description,
        "type": "numeric",
        "admin_level": admin_level,
        "country_id": country_id,
        "is_baseline": True,
        "source": "HDX (Humanitarian Data Exchange)",
        "metadata": {
            "source_link": f"https://data.humdata.org/dataset/{dataset_info.get('id', '')}",
            "hdx_dataset_id": dataset_info.get("id"),
            "imported_at": pd.Timestamp.now().isoformat(),
            "admin_level_detected": admin_level,
        }
    }
    
    # Insert dataset
    print("Creating dataset...")
    dataset_resp = supabase.table("datasets").insert(dataset_metadata).execute()
    
    if not dataset_resp.data or len(dataset_resp.data) == 0:
        print(f"Error creating dataset: {dataset_resp}")
        return
    
    dataset_id = dataset_resp.data[0]["id"]
    print(f"✓ Created dataset: {dataset_name} (ID: {dataset_id})\n")
    
    # Insert values in batches
    print("Inserting population values...")
    batch_size = 500
    total_inserted = 0
    
    for i in range(0, len(df_clean), batch_size):
        batch = df_clean.iloc[i:i + batch_size]
        values = [
            {
                "dataset_id": dataset_id,
                "admin_pcode": str(row["admin_pcode"]),
                "value": float(row["value"])
            }
            for _, row in batch.iterrows()
        ]
        
        try:
            resp = supabase.table("dataset_values_numeric").insert(values).execute()
            batch_inserted = len(values)
            total_inserted += batch_inserted
            print(f"  Batch {i//batch_size + 1}: {batch_inserted} values inserted")
        except Exception as e:
            print(f"  ⚠️  Error inserting batch {i//batch_size + 1}: {e}")
    
    print(f"\n✓ Total: {total_inserted} population values imported")
    print(f"✓ Dataset ID: {dataset_id}")
    print(f"✓ Admin Level: {admin_level}")
    print("\nYou can now use this dataset in instances for Mozambique!")

if __name__ == "__main__":
    main()
