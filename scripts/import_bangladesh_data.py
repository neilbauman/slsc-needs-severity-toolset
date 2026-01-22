#!/usr/bin/env python3
"""
Import Bangladesh population and poverty data from HDX.
Downloads data at the lowest available admin level.
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

# Bangladesh datasets on HDX
BGD_POPULATION_DATASET = {
    "name": "Bangladesh - Subnational Population Statistics",
    "dataset_id": "fdf0606c-8a3b-421a-b3e8-903301e5b2ff",
    "description": "Population by subnational administrative units"
}

BGD_POVERTY_DATASETS = [
    {
        "name": "Bangladesh Multidimensional Poverty Index",
        "dataset_id": "3dff0e65-7aea-4eb0-9be8-af68af882911",
        "description": "Multidimensional Poverty Index for Bangladesh"
    },
    {
        "name": "Bangladesh - Poverty",
        "dataset_id": "4a66b25e-7bfc-4d3f-a2fc-2e7821f1cb72",
        "description": "Poverty indicators for Bangladesh"
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

def find_population_resource(dataset_info: dict, preferred_level: str = "ADM4") -> dict:
    """Find the best population resource, preferring lowest admin level."""
    if not dataset_info:
        return None
    
    resources = dataset_info.get("resources", [])
    level_priority = {"adm4": 1, "adm3": 2, "adm2": 3, "adm1": 4, "adm0": 5}
    
    scored_resources = []
    for resource in resources:
        format_lower = resource.get("format", "").lower()
        name_lower = resource.get("name", "").lower()
        url_lower = resource.get("url", "").lower()
        
        if "metadata" in name_lower or "metadata" in url_lower:
            continue
        
        if not any(fmt in format_lower for fmt in ["csv", "xlsx", "xls"]):
            continue
        
        score = 999
        for level, priority in level_priority.items():
            if level in name_lower or level in url_lower:
                score = priority
                break
        
        has_pop_keyword = any(kw in name_lower for kw in ["pop", "population", "census", "demographic", "adm"])
        if has_pop_keyword:
            score -= 0.5
        
        scored_resources.append((score, resource))
    
    if not scored_resources:
        return None
    
    scored_resources.sort(key=lambda x: x[0])
    return scored_resources[0][1]

def find_poverty_resource(dataset_info: dict) -> dict:
    """Find the best poverty resource."""
    if not dataset_info:
        return None
    
    resources = dataset_info.get("resources", [])
    
    for resource in resources:
        format_lower = resource.get("format", "").lower()
        name_lower = resource.get("name", "").lower()
        
        if "csv" in format_lower and any(kw in name_lower for kw in ["poverty", "poor", "mpi"]):
            return resource
    
    # Fallback: any CSV
    for resource in resources:
        if "csv" in resource.get("format", "").lower():
            return resource
    
    return None

def download_and_process_file(resource_url: str, output_dir: Path, file_type: str = "csv") -> pd.DataFrame:
    """Download and process data file."""
    print(f"Downloading from {resource_url}...")
    
    response = requests.get(resource_url, stream=True, timeout=300)
    response.raise_for_status()
    
    file_ext = Path(resource_url).suffix.lower()
    if not file_ext:
        file_ext = ".csv" if file_type == "csv" else ".xlsx"
    
    file_path = output_dir / f"bgd_{file_type}{file_ext}"
    
    with open(file_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    
    print(f"Downloaded to {file_path}")
    
    if file_ext in [".xlsx", ".xls"]:
        excel_file = pd.ExcelFile(file_path)
        print(f"Excel file has {len(excel_file.sheet_names)} sheets: {excel_file.sheet_names}")
        
        for sheet_name in excel_file.sheet_names:
            try:
                df = pd.read_excel(file_path, sheet_name=sheet_name)
                if len(df) > 10 and len(df.select_dtypes(include=['number']).columns) > 0:
                    print(f"Using sheet: {sheet_name}")
                    break
            except:
                continue
        else:
            df = pd.read_excel(file_path, sheet_name=excel_file.sheet_names[0])
    else:
        df = pd.read_csv(file_path)
    
    print(f"Loaded {len(df)} rows")
    print(f"Columns: {list(df.columns)}")
    
    return df

def find_pcode_column(df: pd.DataFrame, preferred_level: str = "ADM4") -> str:
    """Find the admin pcode column, preferring lowest admin level."""
    patterns = [
        "adm4_pcode", "ADM4_PCODE",
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

def find_population_column(df: pd.DataFrame) -> str:
    """Find the population value column."""
    patterns = [
        ("t_tl", 1),
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
    
    if "adm4" in col_lower:
        return "ADM4"
    elif "adm3" in col_lower:
        return "ADM3"
    elif "adm2" in col_lower:
        return "ADM2"
    elif "adm1" in col_lower:
        return "ADM1"
    elif "adm0" in col_lower:
        return "ADM0"
    
    sample_pcodes = df[pcode_col].dropna().head(10)
    if len(sample_pcodes) > 0:
        avg_length = sample_pcodes.astype(str).str.len().mean()
        if avg_length > 8:
            return "ADM4"
        elif avg_length > 6:
            return "ADM3"
        elif avg_length > 4:
            return "ADM2"
        else:
            return "ADM1"
    
    return "ADM3"  # Default

def import_population(supabase, country_id: str, output_dir: Path):
    """Import population data."""
    print("\n" + "=" * 80)
    print("IMPORTING BANGLADESH POPULATION DATA")
    print("=" * 80)
    
    dataset_info = get_hdx_dataset_info(BGD_POPULATION_DATASET["dataset_id"])
    if not dataset_info:
        print("Error: Could not fetch population dataset")
        return None
    
    resource = find_population_resource(dataset_info)
    if not resource:
        print("Error: Could not find population resource")
        return None
    
    print(f"✓ Found resource: {resource.get('name', 'Unnamed')}")
    
    try:
        df = download_and_process_file(resource["url"], output_dir, "population")
    except Exception as e:
        print(f"Error downloading/processing: {e}")
        return None
    
    pcode_col = find_pcode_column(df)
    pop_col = find_population_column(df)
    
    if not pcode_col:
        print(f"⚠️  Could not find admin pcode column")
        print(f"Available columns: {list(df.columns)}")
        return None
    
    if not pop_col:
        print(f"⚠️  Could not find population column")
        print(f"Available columns: {list(df.columns)}")
        if "T_TL" in df.columns:
            pop_col = "T_TL"
            print(f"Using T_TL as population column")
        else:
            return None
    
    print(f"\n✓ Found pcode column: {pcode_col}")
    print(f"✓ Found population column: {pop_col}")
    
    admin_level = determine_admin_level(pcode_col, df)
    print(f"✓ Detected admin level: {admin_level}\n")
    
    # Clean and prepare data
    df_clean = df[[pcode_col, pop_col]].copy()
    df_clean.columns = ["admin_pcode", "value"]
    df_clean = df_clean.dropna(subset=["admin_pcode", "value"])
    df_clean["admin_pcode"] = df_clean["admin_pcode"].astype(str).str.strip()
    df_clean["value"] = pd.to_numeric(df_clean["value"], errors="coerce")
    df_clean = df_clean.dropna(subset=["value"])
    df_clean = df_clean[df_clean["value"] > 0]
    
    print(f"Cleaned data: {len(df_clean)} rows")
    print(f"Sample data:\n{df_clean.head()}\n")
    
    # Create dataset metadata
    dataset_name = f"Bangladesh Population - {admin_level}"
    dataset_description = f"Total population by {admin_level} administrative units for Bangladesh. Source: HDX ({dataset_info.get('title', 'Unknown dataset')})"
    
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
        return None
    
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
    return dataset_id

def import_poverty(supabase, country_id: str, output_dir: Path):
    """Import poverty data or create placeholder."""
    print("\n" + "=" * 80)
    print("IMPORTING BANGLADESH POVERTY DATA")
    print("=" * 80)
    
    # Try to find subnational poverty data
    dataset_info = None
    resource = None
    
    for dataset_config in BGD_POVERTY_DATASETS:
        print(f"Trying dataset: {dataset_config['dataset_id']}...")
        dataset_info = get_hdx_dataset_info(dataset_config["dataset_id"])
        if dataset_info:
            resource = find_poverty_resource(dataset_info)
            if resource:
                print(f"✓ Found resource: {resource.get('name', 'Unnamed')}")
                break
    
    if not dataset_info or not resource:
        print("⚠️  No subnational poverty data found on HDX")
        print("Creating placeholder dataset instead...")
        return create_poverty_placeholder(supabase, country_id)
    
    # Try to download and check if it has subnational data
    try:
        df = download_and_process_file(resource["url"], output_dir, "poverty")
    except Exception as e:
        print(f"Error downloading/processing: {e}")
        print("Creating placeholder dataset instead...")
        return create_poverty_placeholder(supabase, country_id)
    
    pcode_col = find_pcode_column(df)
    poverty_col = find_poverty_column(df)
    
    if not pcode_col or not poverty_col:
        print("⚠️  Dataset appears to be country-level only (no subnational breakdown)")
        print("Creating placeholder dataset instead...")
        return create_poverty_placeholder(supabase, country_id)
    
    # If we have subnational data, import it
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
    
    # Check if values are percentages (0-100) or decimals (0-1)
    if df_clean["value"].max() > 1:
        df_clean["value"] = df_clean["value"] / 100
    
    print(f"Cleaned data: {len(df_clean)} rows")
    print(f"Sample data:\n{df_clean.head()}\n")
    
    # Create dataset metadata
    dataset_name = f"Bangladesh Poverty Rate (Headcount Ratio) - {admin_level}"
    dataset_description = f"Poverty headcount ratio by {admin_level} administrative units for Bangladesh. Source: HDX ({dataset_info.get('title', 'Unknown dataset')})"
    
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
            "pillar": "Underlying Vulnerability",
            "category": "Underlying Vulnerability",
        }
    }
    
    # Insert dataset
    print("Creating dataset...")
    dataset_resp = supabase.table("datasets").insert(dataset_metadata).execute()
    
    if not dataset_resp.data or len(dataset_resp.data) == 0:
        print(f"Error creating dataset: {dataset_resp}")
        return None
    
    dataset_id = dataset_resp.data[0]["id"]
    print(f"✓ Created dataset: {dataset_name} (ID: {dataset_id})\n")
    
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
    return dataset_id

def create_poverty_placeholder(supabase, country_id: str):
    """Create placeholder poverty dataset using boundaries."""
    print("\nCreating placeholder poverty dataset...")
    
    # Get boundaries at lowest available level
    for level in ["ADM4", "ADM3", "ADM2", "ADM1"]:
        boundaries_resp = supabase.table("admin_boundaries").select("admin_pcode, name, parent_pcode").eq("country_id", country_id).eq("admin_level", level).order("admin_pcode").limit(1).execute()
        
        if boundaries_resp.data and len(boundaries_resp.data) > 0:
            admin_level = level
            break
    else:
        print("Error: No boundaries found")
        return None
    
    # Get all boundaries at this level
    boundaries_resp = supabase.table("admin_boundaries").select("admin_pcode, name, parent_pcode").eq("country_id", country_id).eq("admin_level", admin_level).order("admin_pcode").execute()
    
    if not boundaries_resp.data:
        print("Error: Could not find boundaries")
        return None
    
    boundaries = boundaries_resp.data
    print(f"✓ Found {len(boundaries)} {admin_level} boundaries")
    
    # Use national average poverty rate for Bangladesh (~20% based on World Bank)
    default_poverty_rate = 0.20
    
    # Create placeholder values
    import random
    poverty_values = []
    for boundary in boundaries:
        # Add variation (±5%)
        variation = random.uniform(-0.05, 0.05)
        poverty_rate = max(0.10, min(0.50, default_poverty_rate + variation))
        
        poverty_values.append({
            "admin_pcode": boundary["admin_pcode"],
            "value": round(poverty_rate, 4)
        })
    
    print(f"Generated {len(poverty_values)} placeholder poverty rates")
    print(f"Range: {min(v['value'] for v in poverty_values):.2%} - {max(v['value'] for v in poverty_values):.2%}\n")
    
    # Create dataset metadata
    dataset_name = f"Bangladesh Poverty Rate (Placeholder) - {admin_level}"
    dataset_description = f"Placeholder poverty rate dataset for Bangladesh at {admin_level} level. " \
                         "Values are estimated and should be replaced with actual data when available."
    
    dataset_metadata = {
        "name": dataset_name,
        "description": dataset_description,
        "type": "numeric",
        "admin_level": admin_level,
        "country_id": country_id,
        "is_baseline": True,
        "source": "Placeholder - Estimated",
        "metadata": {
            "is_placeholder": True,
            "placeholder_note": "This dataset contains estimated poverty rates. Actual subnational poverty data should replace this when available.",
            "estimated_from": "National average poverty rate (~20%) with regional variation",
            "pillar": "Underlying Vulnerability",
            "category": "Underlying Vulnerability",
            "created_at": pd.Timestamp.now().isoformat(),
        }
    }
    
    # Insert dataset
    dataset_resp = supabase.table("datasets").insert(dataset_metadata).execute()
    
    if not dataset_resp.data or len(dataset_resp.data) == 0:
        print(f"Error creating dataset: {dataset_resp}")
        return None
    
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
    return dataset_id

def main():
    print("=" * 80)
    print("Bangladesh Population and Poverty Data Import from HDX")
    print("=" * 80)
    
    # Initialize Supabase
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        print("Error: Missing Supabase credentials")
        return
    
    supabase = create_client(supabase_url, supabase_key)
    
    # Get Bangladesh country ID
    country_resp = supabase.table("countries").select("id, iso_code, name").eq("iso_code", "BGD").single().execute()
    if not country_resp.data:
        print("Error: Bangladesh not found")
        return
    
    country_id = country_resp.data["id"]
    print(f"Country: {country_resp.data['name']} ({country_resp.data['iso_code']})\n")
    
    output_dir = Path(__file__).parent.parent / "data" / "bangladesh_data"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Import population
    pop_dataset_id = import_population(supabase, country_id, output_dir)
    
    # Import poverty (or create placeholder)
    pov_dataset_id = import_poverty(supabase, country_id, output_dir)
    
    print("\n" + "=" * 80)
    print("IMPORT COMPLETE")
    print("=" * 80)
    if pop_dataset_id:
        print(f"✓ Population dataset ID: {pop_dataset_id}")
    if pov_dataset_id:
        print(f"✓ Poverty dataset ID: {pov_dataset_id}")

if __name__ == "__main__":
    main()
