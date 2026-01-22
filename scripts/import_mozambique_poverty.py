#!/usr/bin/env python3
"""
Import Mozambique poverty rate data from HDX.
Downloads poverty data at the lowest available admin level and imports as Underlying Vulnerability dataset.
"""

import os
import sys
import requests
import json
from pathlib import Path
import pandas as pd
from supabase import create_client
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env.local")
load_dotenv()

# HDX API base URL
HDX_API_BASE = "https://data.humdata.org/api/3/action"

# Mozambique poverty datasets on HDX
MOZ_POVERTY_DATASETS = [
    {
        "name": "Mozambique - Poverty",
        "dataset_id": "e37ce88f-cd85-4554-9f2c-40477f26d7c9",
        "description": "Poverty indicators for Mozambique"
    },
    {
        "name": "Mozambique Multidimensional Poverty Index",
        "dataset_id": "26645af7-d51e-410a-aa64-0353f7421d10",
        "description": "Multidimensional Poverty Index for Mozambique"
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

def find_poverty_resource(dataset_info: dict, preferred_level: str = "ADM3") -> dict:
    """Find the best poverty resource in the dataset, preferring lowest admin level."""
    if not dataset_info:
        return None
    
    resources = dataset_info.get("resources", [])
    
    # Prefer CSV files with poverty data
    level_priority = {"adm3": 1, "adm2": 2, "adm1": 3, "adm0": 4}
    
    scored_resources = []
    for resource in resources:
        format_lower = resource.get("format", "").lower()
        name_lower = resource.get("name", "").lower()
        url_lower = resource.get("url", "").lower()
        
        # Only consider CSV files
        if "csv" not in format_lower:
            continue
        
        # Score by admin level (lower is better)
        score = 999
        for level, priority in level_priority.items():
            if level in name_lower or level in url_lower:
                score = priority
                break
        
        # Prefer files with poverty keywords
        has_poverty_keyword = any(kw in name_lower for kw in ["poverty", "poor", "mpi"])
        if has_poverty_keyword:
            score -= 0.5
        
        scored_resources.append((score, resource))
    
    if not scored_resources:
        return None
    
    scored_resources.sort(key=lambda x: x[0])
    return scored_resources[0][1]

def download_and_process_poverty(resource_url: str, output_dir: Path) -> pd.DataFrame:
    """Download and process poverty data."""
    print(f"Downloading from {resource_url}...")
    
    response = requests.get(resource_url, stream=True, timeout=300)
    response.raise_for_status()
    
    file_path = output_dir / "moz_poverty.csv"
    
    with open(file_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    
    print(f"Downloaded to {file_path}")
    
    df = pd.read_csv(file_path)
    print(f"Loaded {len(df)} rows")
    print(f"Columns: {list(df.columns)}")
    
    return df

def find_pcode_column(df: pd.DataFrame, preferred_level: str = "ADM3") -> str:
    """Find the admin pcode column, preferring lowest admin level."""
    patterns = [
        "adm3_pcode", "ADM3_PCODE",
        "adm2_pcode", "ADM2_PCODE",
        "adm1_pcode", "ADM1_PCODE",
        "adm0_pcode", "ADM0_PCODE",
        "pcode", "admin_pcode", "adm_pcode", "admin_code", "code"
    ]
    
    for pattern in patterns:
        for col in df.columns:
            if pattern.lower() == col.lower() or pattern.lower() in col.lower():
                return col
    
    return None

def find_poverty_column(df: pd.DataFrame) -> str:
    """Find the poverty rate/value column."""
    patterns = [
        ("poverty_rate", 1),
        ("poverty_rate_percent", 2),
        ("poverty", 3),
        ("poor", 4),
        ("mpi", 5),
        ("headcount", 6),
        ("incidence", 7)
    ]
    
    best_col = None
    best_score = 999
    
    for pattern, priority in patterns:
        for col in df.columns:
            col_lower = col.lower()
            if pattern in col_lower and "name" not in col_lower:
                if priority < best_score:
                    best_score = priority
                    best_col = col
    
    return best_col

def determine_admin_level(pcode_col: str, df: pd.DataFrame) -> str:
    """Determine admin level from pcode column name or data."""
    col_lower = pcode_col.lower()
    
    if "adm3" in col_lower:
        return "ADM3"
    elif "adm2" in col_lower:
        return "ADM2"
    elif "adm1" in col_lower:
        return "ADM1"
    elif "adm0" in col_lower:
        return "ADM0"
    
    # Try to infer from pcode length/format
    sample_pcodes = df[pcode_col].dropna().head(10)
    if len(sample_pcodes) > 0:
        avg_length = sample_pcodes.astype(str).str.len().mean()
        if avg_length > 6:
            return "ADM3"
        elif avg_length > 4:
            return "ADM2"
        else:
            return "ADM1"
    
    return "ADM2"  # Default

def main():
    print("=" * 80)
    print("Mozambique Poverty Rate Data Import from HDX")
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
    
    # Find poverty dataset
    dataset_info = None
    resource = None
    
    for dataset_config in MOZ_POVERTY_DATASETS:
        print(f"Trying dataset: {dataset_config['dataset_id']}...")
        dataset_info = get_hdx_dataset_info(dataset_config["dataset_id"])
        if dataset_info:
            resource = find_poverty_resource(dataset_info)
            if resource:
                print(f"✓ Found resource: {resource.get('name', 'Unnamed')}")
                break
    
    if not dataset_info or not resource:
        print("\n⚠️  Could not find poverty dataset on HDX automatically.")
        return
    
    # Download and process
    output_dir = Path(__file__).parent.parent / "data" / "mozambique_population"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        df = download_and_process_poverty(resource["url"], output_dir)
    except Exception as e:
        print(f"Error downloading/processing: {e}")
        return
    
    # Find columns
    pcode_col = find_pcode_column(df)
    poverty_col = find_poverty_column(df)
    
    if not pcode_col:
        print(f"\n⚠️  Could not find admin pcode column")
        print(f"Available columns: {list(df.columns)}")
        return
    
    if not poverty_col:
        print(f"\n⚠️  Could not find poverty column")
        print(f"Available columns: {list(df.columns)}")
        print("\nAvailable numeric columns:")
        for col in df.select_dtypes(include=['number']).columns:
            print(f"  - {col}")
        return
    
    print(f"\n✓ Found pcode column: {pcode_col}")
    print(f"✓ Found poverty column: {poverty_col}")
    
    admin_level = determine_admin_level(pcode_col, df)
    print(f"✓ Detected admin level: {admin_level}\n")
    
    # Clean and prepare data
    df_clean = df[[pcode_col, poverty_col]].copy()
    df_clean.columns = ["admin_pcode", "value"]
    df_clean = df_clean.dropna(subset=["admin_pcode", "value"])
    df_clean["admin_pcode"] = df_clean["admin_pcode"].astype(str).str.strip()
    df_clean["value"] = pd.to_numeric(df_clean["value"], errors="coerce")
    df_clean = df_clean.dropna(subset=["value"])
    
    # Remove zero/negative values (poverty rates should be positive)
    df_clean = df_clean[df_clean["value"] > 0]
    
    # If values are > 1, they might be percentages (e.g., 65.5 means 65.5%)
    # Convert to decimal if > 100 (assuming percentages)
    if df_clean["value"].max() > 100:
        df_clean["value"] = df_clean["value"] / 100
        print("⚠️  Converted percentage values to decimal (e.g., 65.5% -> 0.655)")
    
    print(f"Cleaned data: {len(df_clean)} rows")
    print(f"Sample data:\n{df_clean.head()}\n")
    
    # Create dataset metadata - Underlying Vulnerability category
    dataset_name = f"Mozambique Poverty Rate - {admin_level}"
    dataset_description = f"Poverty rate by {admin_level} administrative units for Mozambique. Source: HDX ({dataset_info.get('title', 'Unknown dataset')})"
    
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
            "category": "Underlying Vulnerability",
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
    
    # Update category in metadata (since category is stored in metadata JSONB, not a direct column)
    # Actually, we need to check the schema - category might be a column
    supabase.table("datasets").update({
        "metadata": {
            **dataset_metadata["metadata"],
            "category": "Underlying Vulnerability"
        }
    }).eq("id", dataset_id).execute()
    
    # Insert values in batches
    print("Inserting poverty values...")
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
    
    print(f"\n✓ Total: {total_inserted} poverty rate values imported")
    print(f"✓ Dataset ID: {dataset_id}")
    print(f"✓ Admin Level: {admin_level}")
    print(f"✓ Category: Underlying Vulnerability")
    print("\nNote: You may need to manually set the category to 'Underlying Vulnerability' in the UI")

if __name__ == "__main__":
    main()
