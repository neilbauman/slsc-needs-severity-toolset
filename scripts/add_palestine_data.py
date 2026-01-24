#!/usr/bin/env python3
"""
Add Palestine data:
1. Admin level configurations (if not already set)
2. Admin boundaries from HDX
3. Population data from HDX
4. Poverty data from HDX
"""

import os
import sys
import requests
import zipfile
import json
from pathlib import Path
import pandas as pd
import geopandas as gpd
from supabase import create_client
from dotenv import load_dotenv
import time

load_dotenv(Path(__file__).parent.parent / ".env.local")
load_dotenv()

# HDX API base URL
HDX_API_BASE = "https://data.humdata.org/api/3/action"

# Palestine datasets on HDX
PSE_BOUNDARIES_DATASET = {
    "name": "State of Palestine - Subnational Administrative Boundaries",
    "dataset_id": "2caf8373-816f-458c-9913-71bddb9cab7c",
    "description": "Administrative boundaries for Palestine"
}

PSE_POPULATION_DATASET = {
    "name": "State of Palestine - Subnational Population Statistics",
    "dataset_id": "36271e9b-9ec2-4c1c-bfff-82848eba0b2f",
    "description": "Population by subnational administrative units"
}

PSE_POVERTY_DATASETS = [
    {
        "name": "State of Palestine Multidimensional Poverty Index",
        "dataset_id": "af127641-41b4-4c7f-a663-dd3abe736483",
        "description": "Multidimensional Poverty Index for Palestine"
    }
]

# Palestine admin level names (Governorate, District)
PSE_ADMIN_LEVELS = [
    {"level_number": 1, "name": "Governorate", "plural_name": "Governorates", "code_prefix": "GOV", "order_index": 1},
    {"level_number": 2, "name": "District", "plural_name": "Districts", "code_prefix": "DIST", "order_index": 2},
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

def get_country_id(supabase):
    """Get Palestine country ID."""
    country_resp = supabase.table("countries").select("id, name").eq("iso_code", "PSE").single().execute()
    if not country_resp.data:
        print("Error: Palestine not found in database")
        return None
    return country_resp.data["id"]

def configure_admin_levels(supabase, country_id: str):
    """Configure admin level names for Palestine."""
    print("\n" + "=" * 80)
    print("CONFIGURING ADMIN LEVELS")
    print("=" * 80)
    
    # Check if already configured
    existing = supabase.table("country_admin_levels").select("id").eq("country_id", country_id).execute()
    if existing.data:
        print(f"✓ Admin levels already configured ({len(existing.data)} levels)")
        return
    
    # Insert admin levels
    for level in PSE_ADMIN_LEVELS:
        level_data = {
            "country_id": country_id,
            **level
        }
        supabase.table("country_admin_levels").insert(level_data).execute()
        print(f"✓ Added {level['name']} (Level {level['level_number']})")
    
    print(f"\n✓ Configured {len(PSE_ADMIN_LEVELS)} admin levels")

def find_geojson_resource(dataset_info: dict) -> dict:
    """Find GeoJSON resource in dataset, preferring GeoJSON over other formats."""
    if not dataset_info:
        return None
    
    resources = dataset_info.get("resources", [])
    
    # Prefer GeoJSON first
    for resource in resources:
        format_lower = resource.get("format", "").lower()
        if "geojson" in format_lower:
            return resource
    
    # Then shapefile
    for resource in resources:
        format_lower = resource.get("format", "").lower()
        name_lower = resource.get("name", "").lower()
        if "shp" in format_lower or "shapefile" in name_lower:
            return resource
    
    # Finally geodatabase
    for resource in resources:
        format_lower = resource.get("format", "").lower()
        name_lower = resource.get("name", "").lower()
        if "geodatabase" in format_lower or "gdb" in name_lower:
            return resource
    
    return None

def import_boundaries(supabase, country_id: str, output_dir: Path):
    """Import admin boundaries from HDX."""
    print("\n" + "=" * 80)
    print("IMPORTING ADMIN BOUNDARIES")
    print("=" * 80)
    
    dataset_info = get_hdx_dataset_info(PSE_BOUNDARIES_DATASET["dataset_id"])
    if not dataset_info:
        print("Error: Could not fetch boundaries dataset")
        return False
    
    resource = find_geojson_resource(dataset_info)
    if not resource:
        print("Error: Could not find GeoJSON/Shapefile resource")
        return False
    
    print(f"✓ Found resource: {resource.get('name', 'Unnamed')}")
    
    # Download
    resource_url = resource["url"]
    print(f"Downloading from {resource_url}...")
    
    file_ext = Path(resource_url).suffix.lower()
    if not file_ext:
        file_ext = ".zip"
    
    file_path = output_dir / f"pse_boundaries{file_ext}"
    
    response = requests.get(resource_url, stream=True, timeout=600)
    response.raise_for_status()
    
    with open(file_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    
    print(f"✓ Downloaded to {file_path}")
    
    # Extract if zip
    extract_dir = output_dir / "pse_boundaries"
    extract_dir.mkdir(exist_ok=True)
    
    if file_ext == ".zip":
        with zipfile.ZipFile(file_path, 'r') as z:
            z.extractall(extract_dir)
        print(f"✓ Extracted to {extract_dir}")
    
    # Find shapefiles or GeoJSON files
    shp_files = sorted(extract_dir.glob("*.shp"))
    geojson_files = sorted(extract_dir.glob("*.geojson"))
    
    if not shp_files and not geojson_files:
        print("Error: No shapefiles or GeoJSON files found")
        print(f"Files in directory: {list(extract_dir.iterdir())}")
        return False
    
    if not shp_files:
        shp_files = geojson_files
    
    # Process each admin level file
    admin_levels_imported = {}
    
    for shp_file in sorted(shp_files):
        print(f"\nProcessing {shp_file.name}...")
        
        try:
            gdf = gpd.read_file(shp_file)
            print(f"  Loaded {len(gdf)} features")
            print(f"  Columns: {list(gdf.columns)}")
            
            # Determine admin level from filename or data
            admin_level = None
            filename_lower = shp_file.name.lower()
            
            if "adm0" in filename_lower or "admbnda_adm0" in filename_lower:
                admin_level = "ADM0"
            elif "adm1" in filename_lower or "admbnda_adm1" in filename_lower:
                admin_level = "ADM1"
            elif "adm2" in filename_lower or "admbnda_adm2" in filename_lower:
                admin_level = "ADM2"
            elif "adm3" in filename_lower or "admbnda_adm3" in filename_lower:
                admin_level = "ADM3"
            elif "adm4" in filename_lower or "admbnda_adm4" in filename_lower:
                admin_level = "ADM4"
            else:
                # Try to detect from pcode column
                pcode_col = None
                for col in gdf.columns:
                    if "pcode" in col.lower() or "code" in col.lower():
                        if "adm1" in col.lower():
                            admin_level = "ADM1"
                            pcode_col = col
                            break
                        elif "adm2" in col.lower():
                            admin_level = "ADM2"
                            pcode_col = col
                            break
                        elif "adm3" in col.lower():
                            admin_level = "ADM3"
                            pcode_col = col
                            break
                        elif "adm4" in col.lower():
                            admin_level = "ADM4"
                            pcode_col = col
                            break
                
                if not admin_level:
                    print(f"  ⚠️  Could not determine admin level, skipping")
                    continue
            
            print(f"  Detected admin level: {admin_level}")
            
            # Find pcode and name columns
            pcode_col = None
            name_col = None
            
            for col in gdf.columns:
                col_lower = col.lower()
                if "pcode" in col_lower or (admin_level.lower() in col_lower and "code" in col_lower):
                    pcode_col = col
                if "name" in col_lower and "pcode" not in col_lower:
                    if admin_level.lower() in col_lower or name_col is None:
                        name_col = col
            
            if not pcode_col:
                print(f"  ⚠️  Could not find pcode column, skipping")
                continue
            
            print(f"  Using pcode column: {pcode_col}")
            if name_col:
                print(f"  Using name column: {name_col}")
            
            # Prepare data for import
            gdf["admin_pcode"] = gdf[pcode_col].astype(str).str.strip()
            if name_col:
                gdf["name"] = gdf[name_col].astype(str).str.strip()
            else:
                gdf["name"] = gdf["admin_pcode"]
            
            # Import in batches using RPC
            batch_size = 100
            total_imported = 0
            
            for i in range(0, len(gdf), batch_size):
                batch = gdf.iloc[i:i + batch_size]
                
                features = []
                for _, row in batch.iterrows():
                    if pd.isna(row["admin_pcode"]) or row["admin_pcode"] == "":
                        continue
                    
                    geom = row["geometry"]
                    if geom is None or geom.is_empty:
                        continue
                    
                    # Convert to GeoJSON feature
                    geom_json = json.loads(gpd.GeoSeries([geom]).to_json())["features"][0]["geometry"]
                    
                    feature = {
                        "type": "Feature",
                        "properties": {
                            "admin_pcode": str(row["admin_pcode"]),
                            "name": str(row["name"]),
                            "parent_pcode": str(row.get("parent_pcode", "")) if "parent_pcode" in row else ""
                        },
                        "geometry": geom_json
                    }
                    features.append(feature)
                
                if not features:
                    continue
                
                # Format as GeoJSON FeatureCollection for RPC
                geojson_data = {
                    "type": "FeatureCollection",
                    "features": features
                }
                
                # Call import_admin_boundaries RPC
                try:
                    result = supabase.rpc("import_admin_boundaries", {
                        "p_country_id": country_id,
                        "p_admin_level": admin_level,
                        "p_boundaries": geojson_data,
                        "p_clear_existing": (i == 0)  # Only clear on first batch
                    }).execute()
                    
                    if result.data and len(result.data) > 0:
                        batch_imported = result.data[0].get("imported_count", len(features))
                        total_imported += batch_imported
                        print(f"  Batch {i//batch_size + 1}: {batch_imported} features imported")
                    else:
                        batch_imported = len(features)
                        total_imported += batch_imported
                        print(f"  Batch {i//batch_size + 1}: {batch_imported} features imported (no result data)")
                except Exception as e:
                    print(f"  ⚠️  Error importing batch {i//batch_size + 1}: {e}")
                    import traceback
                    traceback.print_exc()
            
            admin_levels_imported[admin_level] = total_imported
            print(f"  ✓ Total: {total_imported} {admin_level} boundaries imported")
            
        except Exception as e:
            print(f"  ⚠️  Error processing {shp_file.name}: {e}")
            import traceback
            traceback.print_exc()
    
    print(f"\n✓ Imported boundaries for {len(admin_levels_imported)} admin levels")
    return True

def find_population_resource(dataset_info: dict) -> dict:
    """Find the best population resource, preferring lowest admin level."""
    if not dataset_info:
        return None
    
    resources = dataset_info.get("resources", [])
    level_priority = {"adm4": 1, "adm3": 2, "adm2": 3, "adm1": 4, "adm0": 5}
    
    scored_resources = []
    for resource in resources:
        format_lower = resource.get("format", "").lower()
        name_lower = resource.get("name", "").lower()
        
        if "metadata" in name_lower:
            continue
        
        if not any(fmt in format_lower for fmt in ["csv", "xlsx", "xls"]):
            continue
        
        score = 999
        for level, priority in level_priority.items():
            if level in name_lower:
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

def find_pcode_column(df: pd.DataFrame) -> str:
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
    
    return "ADM2"  # Default for Palestine

def import_population(supabase, country_id: str, output_dir: Path):
    """Import population data."""
    print("\n" + "=" * 80)
    print("IMPORTING POPULATION DATA")
    print("=" * 80)
    
    dataset_info = get_hdx_dataset_info(PSE_POPULATION_DATASET["dataset_id"])
    if not dataset_info:
        print("Error: Could not fetch population dataset")
        return None
    
    resource = find_population_resource(dataset_info)
    if not resource:
        print("Error: Could not find population resource")
        return None
    
    print(f"✓ Found resource: {resource.get('name', 'Unnamed')}")
    
    # Download
    resource_url = resource["url"]
    file_ext = Path(resource_url).suffix.lower()
    if not file_ext:
        file_ext = ".csv"
    
    file_path = output_dir / f"pse_population{file_ext}"
    
    print(f"Downloading from {resource_url}...")
    response = requests.get(resource_url, stream=True, timeout=300)
    response.raise_for_status()
    
    with open(file_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    
    print(f"✓ Downloaded to {file_path}")
    
    # Process
    if file_ext in [".xlsx", ".xls"]:
        excel_file = pd.ExcelFile(file_path)
        print(f"Excel file has {len(excel_file.sheet_names)} sheets: {excel_file.sheet_names}")
        
        # Try to find the best sheet
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
    
    pcode_col = find_pcode_column(df)
    pop_col = find_population_column(df)
    
    if not pcode_col:
        print(f"⚠️  Could not find admin pcode column")
        print(f"Available columns: {list(df.columns)}")
        return None
    
    if not pop_col:
        print(f"⚠️  Could not find population column")
        # Try to find T_TL (most recent year)
        if "T_TL" in df.columns:
            pop_col = "T_TL"
            print(f"Using T_TL as population column")
        elif any("T_TL" in col for col in df.columns):
            # Use the most recent year
            t_tl_cols = [col for col in df.columns if "T_TL" in col]
            pop_col = sorted(t_tl_cols)[-1]  # Most recent
            print(f"Using {pop_col} as population column")
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
    dataset_name = f"Palestine Population - {admin_level}"
    dataset_description = f"Total population by {admin_level} administrative units for Palestine. Source: HDX ({dataset_info.get('title', 'Unknown dataset')})"
    
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

def import_poverty(supabase, country_id: str, output_dir: Path):
    """Import poverty data or create placeholder."""
    print("\n" + "=" * 80)
    print("IMPORTING POVERTY DATA")
    print("=" * 80)
    
    # Try to find subnational poverty data
    dataset_info = None
    resource = None
    
    for dataset_config in PSE_POVERTY_DATASETS:
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
        resource_url = resource["url"]
        file_path = output_dir / "pse_poverty.csv"
        
        print(f"Downloading from {resource_url}...")
        response = requests.get(resource_url, stream=True, timeout=300)
        response.raise_for_status()
        
        with open(file_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        df = pd.read_csv(file_path)
    except Exception as e:
        print(f"Error downloading/processing: {e}")
        print("Creating placeholder dataset instead...")
        return create_poverty_placeholder(supabase, country_id)
    
    pcode_col = find_pcode_column(df)
    poverty_col = find_poverty_column(df)
    
    # Prefer Headcount Ratio over Vulnerable to Poverty
    if "Headcount Ratio" in df.columns:
        poverty_col = "Headcount Ratio"
        print(f"Using 'Headcount Ratio' as poverty column")
    elif not poverty_col:
        print(f"⚠️  Could not find poverty column")
        print(f"Available columns: {list(df.columns)}")
        if "Vulnerable to Poverty" in df.columns:
            poverty_col = "Vulnerable to Poverty"
            print(f"Using 'Vulnerable to Poverty' as fallback")
        else:
            print("⚠️  Dataset appears to be country-level only (no subnational breakdown)")
            print("Creating placeholder dataset instead...")
            return create_poverty_placeholder(supabase, country_id)
    
    if not pcode_col:
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
    dataset_name = f"Palestine Poverty Rate (Headcount Ratio) - {admin_level}"
    dataset_description = f"Poverty headcount ratio by {admin_level} administrative units for Palestine. Source: HDX ({dataset_info.get('title', 'Unknown dataset')})"
    
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
    
    # Use national average poverty rate for Palestine (~25% based on World Bank)
    default_poverty_rate = 0.25
    
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
    dataset_name = f"Palestine Poverty Rate (Placeholder) - {admin_level}"
    dataset_description = f"Placeholder poverty rate dataset for Palestine at {admin_level} level. " \
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
            "estimated_from": "National average poverty rate (~25%) with regional variation",
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
    print("PALESTINE DATA SETUP")
    print("=" * 80)
    
    # Initialize Supabase
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        print("Error: Missing Supabase credentials")
        return
    
    supabase = create_client(supabase_url, supabase_key)
    
    # Get country ID
    country_id = get_country_id(supabase)
    if not country_id:
        return
    
    print(f"Country: Palestine (ID: {country_id})\n")
    
    output_dir = Path(__file__).parent.parent / "data" / "palestine_data"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Step 1: Configure admin levels
    configure_admin_levels(supabase, country_id)
    
    # Step 2: Import boundaries
    boundaries_success = import_boundaries(supabase, country_id, output_dir)
    if not boundaries_success:
        print("⚠️  Warning: Boundary import had issues, but continuing...")
    
    # Step 3: Import population
    pop_dataset_id = import_population(supabase, country_id, output_dir)
    
    # Step 4: Import poverty (or create placeholder)
    pov_dataset_id = import_poverty(supabase, country_id, output_dir)
    
    print("\n" + "=" * 80)
    print("SETUP COMPLETE")
    print("=" * 80)
    print(f"✓ Country ID: {country_id}")
    if pop_dataset_id:
        print(f"✓ Population dataset ID: {pop_dataset_id}")
    if pov_dataset_id:
        print(f"✓ Poverty dataset ID: {pov_dataset_id}")

if __name__ == "__main__":
    main()
