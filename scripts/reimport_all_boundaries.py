#!/usr/bin/env python3
"""
Comprehensive reimport of all administrative boundaries from HDX.
This script:
1. Downloads fresh boundary data from HDX
2. Validates polygon geometries (filters out Points)
3. Ensures parent/child relationships are correct
4. Validates completeness (e.g., all 507 Bangladesh ADM3)
5. Uploads to Supabase with proper data health checks

Requirements:
    pip install requests shapely geopandas pyproj supabase python-dotenv hdx-python-api

Usage:
    python scripts/reimport_all_boundaries.py
"""

import os
import json
import sys
import re
import zipfile
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import geopandas as gpd
import pandas as pd
from supabase import create_client, Client
from dotenv import load_dotenv
import requests
from datetime import datetime

# Load environment variables from .env.local first, then .env
env_path = Path(__file__).parent.parent / ".env.local"
if env_path.exists():
    load_dotenv(env_path)
load_dotenv()  # Also load .env if it exists

# HDX dataset identifiers
HDX_DATASETS = {
    "BGD": {
        "name": "Bangladesh - Subnational Administrative Boundaries",
        "dataset_id": "cod-ab-bgd",
        "expected_counts": {"ADM0": 1, "ADM1": 8, "ADM2": 64, "ADM3": 507, "ADM4": None}
    },
    "MOZ": {
        "name": "Mozambique - Subnational Administrative Boundaries",
        "dataset_id": "cod-ab-moz",
        "expected_counts": {"ADM0": 1, "ADM1": 11, "ADM2": 159, "ADM3": 412, "ADM4": None}
    },
    "PSE": {
        "name": "Palestine - Subnational Administrative Boundaries",
        "dataset_id": "cod-ab-pse",
        "expected_counts": {"ADM0": 1, "ADM1": 16, "ADM2": 16, "ADM3": None, "ADM4": None}
    },
    "PHL": {
        "name": "Philippines - Subnational Administrative Boundaries",
        "dataset_id": "cod-ab-phl",
        "expected_counts": {"ADM0": 1, "ADM1": 17, "ADM2": 88, "ADM3": 1642, "ADM4": 42048}
    },
    "LKA": {
        "name": "Sri Lanka - Subnational Administrative Boundaries",
        "dataset_id": "cod-ab-lka",
        "expected_counts": {"ADM0": 1, "ADM1": 9, "ADM2": 25, "ADM3": 331, "ADM4": 14022}
    }
}

HDX_API_BASE = "https://data.humdata.org/api/3/action"

def get_country_id_mapping(supabase: Client) -> Dict[str, str]:
    """Get mapping of ISO codes to country IDs."""
    response = supabase.table("countries").select("id, iso_code").execute()
    return {row["iso_code"]: row["id"] for row in response.data}

def get_hdx_dataset_info(dataset_id: str) -> Optional[Dict]:
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

def find_geojson_resource(dataset_info: Dict) -> Optional[Dict]:
    """Find the best GeoJSON resource in the dataset."""
    resources = dataset_info.get("resources", [])
    
    # Prefer GeoJSON format
    for resource in resources:
        format_lower = resource.get("format", "").lower()
        if "geojson" in format_lower:
            return resource
    
    # Fallback to shapefile
    for resource in resources:
        format_lower = resource.get("format", "").lower()
        if "shp" in format_lower or "shapefile" in format_lower:
            return resource
    
    return None

def download_resource(resource_url: str, output_path: Path) -> bool:
    """Download a resource file."""
    try:
        print(f"Downloading from {resource_url}...")
        response = requests.get(resource_url, stream=True, timeout=600)
        response.raise_for_status()
        
        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        print(f"Downloaded to {output_path}")
        return True
    except Exception as e:
        print(f"Error downloading {resource_url}: {e}")
        return False

def extract_zip_file(zip_path: Path, extract_dir: Path) -> Optional[Path]:
    """Extract zip file and return path to GeoJSON or shapefile.
    If multiple admin-level GeoJSON files exist, returns the directory."""
    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_dir)
        
        # Check if there are multiple admin-level GeoJSON files (e.g., bgd_admin0.geojson, bgd_admin1.geojson)
        geojson_files = list(extract_dir.rglob("*admin*.geojson"))
        admin_level_files = [f for f in geojson_files if re.search(r'admin[0-4]', f.name.lower())]
        
        if admin_level_files:
            # Multiple admin level files - return directory so we can process each
            return extract_dir
        
        # Single GeoJSON file
        if geojson_files:
            return geojson_files[0]
        
        # Then look for shapefile
        shp_files = list(extract_dir.rglob("*.shp"))
        if shp_files:
            return shp_files[0]
        
        return None
    except Exception as e:
        print(f"Error extracting {zip_path}: {e}")
        return None

def process_boundaries_file(
    file_path: Path,
    country_iso: str,
    expected_counts: Dict[str, Optional[int]]
) -> Dict[str, gpd.GeoDataFrame]:
    """Process boundary file and extract all admin levels with polygon geometries."""
    results = {}
    
    try:
        # Handle zip files
        extracted_path = file_path
        if file_path.suffix == '.zip':
            extract_dir = file_path.parent / "extracted"
            extract_dir.mkdir(exist_ok=True)
            extracted_path = extract_zip_file(file_path, extract_dir)
            if not extracted_path:
                print(f"Could not extract file from {file_path}")
                return results
        
        # Check if we have a directory with multiple admin-level files
        if extracted_path.is_dir():
            # Process each admin-level GeoJSON file
            admin_files = sorted(extracted_path.glob("*admin*.geojson"))
            for admin_file in admin_files:
                # Extract level from filename (e.g., bgd_admin3.geojson -> ADM3)
                match = re.search(r'admin(\d+)', admin_file.name.lower())
                if match:
                    level_num = int(match.group(1))
                    level_key = f"ADM{level_num}"
                    
                    try:
                        gdf = gpd.read_file(admin_file)
                        # Ensure CRS
                        if gdf.crs is None:
                            gdf.set_crs("EPSG:4326", inplace=True)
                        elif gdf.crs.to_string() != "EPSG:4326":
                            gdf = gdf.to_crs("EPSG:4326")
                        
                        # Process this level
                        level_gdf = process_single_file_level(gdf, level_num, country_iso)
                        if level_gdf is not None and len(level_gdf) > 0:
                            results[level_key] = level_gdf
                            expected = expected_counts.get(level_key)
                            if expected and len(level_gdf) != expected:
                                print(f"⚠️  WARNING: {level_key} has {len(level_gdf)} features, expected {expected}")
                    except Exception as e:
                        print(f"Error processing {admin_file.name}: {e}")
            
            return results
        
        # Single file
        if not extracted_path.exists():
            print(f"File not found: {extracted_path}")
            return results
        
        # Read file
        if extracted_path.suffix == '.geojson':
            gdf = gpd.read_file(extracted_path)
        elif extracted_path.suffix == '.shp':
            gdf = gpd.read_file(extracted_path)
        else:
            print(f"Unsupported file format: {extracted_path.suffix}")
            return results
        
        # Ensure CRS is WGS84 (already done above for multi-file case)
        if not extracted_path.is_dir():
            if gdf.crs is None:
                gdf.set_crs("EPSG:4326", inplace=True)
            elif gdf.crs.to_string() != "EPSG:4326":
                gdf = gdf.to_crs("EPSG:4326")
        
        # Find admin level column
        admin_level_col = None
        for col in ["admin_leve", "adm_level", "ADM_LEVEL", "ADMLEVEL", "admin_level", "level"]:
            if col in gdf.columns:
                admin_level_col = col
                break
        
        if not admin_level_col:
            # Try to infer from pcode columns
            pcode_cols = [col for col in gdf.columns if "pcode" in col.lower() and "adm" in col.lower()]
            if not pcode_cols:
                print("Warning: Could not find admin level or pcode columns")
                return results
            
            # Process each pcode column as a separate level
            for pcode_col in pcode_cols:
                match = re.search(r'adm(\d+)_pcode', pcode_col.lower())
                if match:
                    level_num = int(match.group(1))
                    level_gdf = process_level_from_pcode_column(gdf, pcode_col, level_num, country_iso)
                    if level_gdf is not None and len(level_gdf) > 0:
                        results[f"ADM{level_num}"] = level_gdf
            return results
        
        # Process by admin level column
        for level_val in gdf[admin_level_col].unique():
            if pd.isna(level_val):
                continue
            
            try:
                level_num = int(float(level_val))
            except (ValueError, TypeError):
                match = re.search(r'(\d+)', str(level_val))
                if match:
                    level_num = int(match.group(1))
                else:
                    continue
            
            if level_num not in [0, 1, 2, 3, 4, 5]:
                continue
            
            level_gdf = process_level_from_admin_level_column(
                gdf, admin_level_col, level_val, level_num, country_iso
            )
            
            if level_gdf is not None and len(level_gdf) > 0:
                level_key = f"ADM{level_num}"
                results[level_key] = level_gdf
                
                # Validate count
                expected = expected_counts.get(level_key)
                if expected and len(level_gdf) != expected:
                    print(f"⚠️  WARNING: {level_key} has {len(level_gdf)} features, expected {expected}")
        
        return results
        
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        import traceback
        traceback.print_exc()
        return results

def process_single_file_level(
    gdf: gpd.GeoDataFrame,
    level_num: int,
    country_iso: str
) -> Optional[gpd.GeoDataFrame]:
    """Process a GeoJSON file that contains a single admin level."""
    # Find pcode and name columns - prioritize level-specific columns
    pcode_col = None
    name_col = None
    parent_pcode_col = None
    
    # First, try level-specific columns (e.g., adm3_pcode for ADM3)
    level_specific_pcode = f"adm{level_num}_pcode"
    level_specific_name = f"adm{level_num}_name"
    
    for col in gdf.columns:
        col_lower = col.lower()
        if col_lower == level_specific_pcode or col_lower.endswith(f"_adm{level_num}_pcode"):
            pcode_col = col
        if (col_lower == level_specific_name or col_lower.endswith(f"_adm{level_num}_name")) and not name_col:
            name_col = col
    
    # Fallback to any pcode column
    if not pcode_col:
        for col in gdf.columns:
            col_lower = col.lower()
            if 'pcode' in col_lower or 'pcod' in col_lower:
                pcode_col = col
                break
    
    # Fallback to any name column
    if not name_col:
        for col in gdf.columns:
            col_lower = col.lower()
            if 'name' in col_lower and not name_col:
                name_col = col
                break
    
    if not pcode_col:
        print(f"  Warning: No pcode column found in file (columns: {list(gdf.columns)})")
        return None
    
    # Create standardized dataframe
    result_data = {
        "admin_pcode": gdf[pcode_col].astype(str),
        "admin_level": f"ADM{level_num}",
        "name": gdf[name_col].astype(str) if name_col else None,
        "geometry": gdf.geometry
    }
    
    # Try to find parent pcode
    if level_num > 0:
        parent_level = level_num - 1
        for col in gdf.columns:
            col_lower = col.lower()
            if f"adm{parent_level}_pcode" in col_lower or f"adm{parent_level}_pcod" in col_lower:
                parent_pcode_col = col
                break
    
    if parent_pcode_col:
        result_data["parent_pcode"] = gdf[parent_pcode_col].astype(str)
    else:
        result_data["parent_pcode"] = None
    
    result_gdf = gpd.GeoDataFrame(result_data, crs=gdf.crs)
    
    # Filter out invalid geometries and Points
    result_gdf = result_gdf[result_gdf["admin_pcode"].notna()]
    result_gdf = result_gdf[result_gdf["admin_pcode"] != "None"]
    result_gdf = result_gdf[result_gdf["admin_pcode"] != ""]
    
    # Filter out Point geometries
    result_gdf = result_gdf[result_gdf.geometry.apply(
        lambda g: g is not None and g.geom_type in ['Polygon', 'MultiPolygon']
    )]
    
    result_gdf = result_gdf[result_gdf.geometry.is_valid]
    result_gdf = result_gdf.drop_duplicates(subset=["admin_pcode"])
    
    if len(result_gdf) == 0:
        return None
    
    return result_gdf

def process_level_from_admin_level_column(
    gdf: gpd.GeoDataFrame,
    admin_level_col: str,
    level_val: any,
    level_num: int,
    country_iso: str
) -> Optional[gpd.GeoDataFrame]:
    """Process a specific admin level from admin_level column."""
    level_gdf = gdf[gdf[admin_level_col] == level_val].copy()
    
    if len(level_gdf) == 0:
        return None
    
    # Find pcode and name columns
    pcode_col = None
    name_col = None
    parent_pcode_col = None
    
    # Try level-specific columns (e.g., ADM1_PCODE, adm1_pcode)
    for col in gdf.columns:
        col_lower = col.lower()
        # Try both ADM1_PCODE and adm1_pcode formats
        if f"adm{level_num}_pcode" in col_lower or f"adm{level_num}_pcode" == col_lower:
            pcode_col = col
        if (f"adm{level_num}_name" in col_lower or f"adm{level_num}_name" == col_lower) and not name_col:
            name_col = col
    
    # Try uppercase format (ADM1_PCODE)
    if not pcode_col:
        for col in gdf.columns:
            col_upper = col.upper()
            if f"ADM{level_num}_PCODE" in col_upper or f"ADM{level_num}_PCODE" == col_upper:
                pcode_col = col
                break
    
    # Fallback to generic columns
    if not pcode_col:
        for col in ["PCODE", "pcode", "admin_pcode", "ADMIN_PCODE", "ADM_PCODE", "adm_pcode"]:
            if col in gdf.columns:
                pcode_col = col
                break
    
    if not name_col:
        for col in ["NAME", "name", "NAME_EN", "name_en", "NAME_ALT", "name_alt", "ADM_NAME", "adm_name"]:
            if col in gdf.columns:
                name_col = col
                break
    
    # Find parent pcode
    if level_num > 0:
        parent_level = level_num - 1
        for col in gdf.columns:
            col_lower = col.lower()
            if f"adm{parent_level}_pcode" in col_lower:
                parent_pcode_col = col
                break
    
    if not pcode_col:
        print(f"Warning: No pcode column found for level {level_num}")
        return None
    
    # Create standardized dataframe
    result_data = {
        "admin_pcode": level_gdf[pcode_col].astype(str),
        "admin_level": f"ADM{level_num}",
        "name": level_gdf[name_col].astype(str) if name_col else None,
        "geometry": level_gdf.geometry
    }
    
    if parent_pcode_col:
        result_data["parent_pcode"] = level_gdf[parent_pcode_col].astype(str)
    else:
        result_data["parent_pcode"] = None
    
    result_gdf = gpd.GeoDataFrame(result_data, crs=gdf.crs)
    
    # Filter out invalid geometries and Points
    initial_count = len(result_gdf)
    
    # Remove null pcodes
    result_gdf = result_gdf[result_gdf["admin_pcode"].notna()]
    result_gdf = result_gdf[result_gdf["admin_pcode"] != "None"]
    result_gdf = result_gdf[result_gdf["admin_pcode"] != ""]
    
    # Filter out Point geometries - we need Polygons
    def is_polygon(geom):
        if geom is None:
            return False
        geom_type = geom.geom_type if hasattr(geom, 'geom_type') else None
        return geom_type in ['Polygon', 'MultiPolygon']
    
    result_gdf = result_gdf[result_gdf.geometry.apply(is_polygon)]
    
    # Remove duplicates
    result_gdf = result_gdf.drop_duplicates(subset=["admin_pcode"])
    
    # Validate geometries
    valid_gdf = result_gdf[result_gdf.geometry.is_valid]
    
    if len(valid_gdf) < len(result_gdf):
        invalid_count = len(result_gdf) - len(valid_gdf)
        print(f"  ⚠️  {invalid_count} invalid geometries filtered out")
    
    if len(valid_gdf) == 0:
        print(f"  ❌ No valid polygon geometries found for ADM{level_num}")
        return None
    
    if len(valid_gdf) < initial_count:
        print(f"  ℹ️  Filtered from {initial_count} to {len(valid_gdf)} valid polygon features")
    
    return valid_gdf

def process_level_from_pcode_column(
    gdf: gpd.GeoDataFrame,
    pcode_col: str,
    level_num: int,
    country_iso: str
) -> Optional[gpd.GeoDataFrame]:
    """Process a level inferred from pcode column name."""
    
    level_gdf = gdf[gdf[pcode_col].notna()].copy()
    if len(level_gdf) == 0:
        return None
    
    # Find name column
    name_col = None
    for col in gdf.columns:
        if f"adm{level_num}_name" in col.lower():
            name_col = col
            break
    
    if not name_col:
        for col in ["NAME", "name", "NAME_EN", "name_en"]:
            if col in gdf.columns:
                name_col = col
                break
    
    # Find parent
    parent_pcode_col = None
    if level_num > 0:
        parent_level = level_num - 1
        for col in gdf.columns:
            if f"adm{parent_level}_pcode" in col.lower():
                parent_pcode_col = col
                break
    
    result_data = {
        "admin_pcode": level_gdf[pcode_col].astype(str),
        "admin_level": f"ADM{level_num}",
        "name": level_gdf[name_col].astype(str) if name_col else None,
        "geometry": level_gdf.geometry
    }
    
    if parent_pcode_col:
        result_data["parent_pcode"] = level_gdf[parent_pcode_col].astype(str)
    else:
        result_data["parent_pcode"] = None
    
    result_gdf = gpd.GeoDataFrame(result_data, crs=gdf.crs)
    
    # Filter Points
    result_gdf = result_gdf[result_gdf.geometry.apply(
        lambda g: g is not None and g.geom_type in ['Polygon', 'MultiPolygon']
    )]
    
    result_gdf = result_gdf[result_gdf.geometry.is_valid]
    result_gdf = result_gdf.drop_duplicates(subset=["admin_pcode"])
    
    if len(result_gdf) == 0:
        return None
    
    return result_gdf

def validate_parent_child_relationships(
    boundaries_by_level: Dict[str, gpd.GeoDataFrame],
    country_iso: str
) -> Tuple[Dict[str, int], List[str]]:
    """Validate parent/child relationships and return statistics."""
    stats = {}
    issues = []
    
    for level in sorted(boundaries_by_level.keys()):
        gdf = boundaries_by_level[level]
        level_num = int(level.replace("ADM", ""))
        
        if level_num == 0:
            # ADM0 has no parent
            stats[level] = {
                "total": len(gdf),
                "with_parent": 0,
                "orphans": 0,
                "valid_parents": 0
            }
            continue
        
        parent_level = f"ADM{level_num - 1}"
        parent_gdf = boundaries_by_level.get(parent_level)
        
        if parent_gdf is None:
            issues.append(f"{level}: No parent level {parent_level} found")
            stats[level] = {
                "total": len(gdf),
                "with_parent": 0,
                "orphans": len(gdf),
                "valid_parents": 0
            }
            continue
        
        parent_pcodes = set(parent_gdf["admin_pcode"].astype(str))
        
        with_parent = gdf[gdf["parent_pcode"].notna()]
        orphans = gdf[gdf["parent_pcode"].isna()]
        
        # Check if parent_pcode exists in parent level
        valid_parents = 0
        invalid_parents = []
        
        for idx, row in with_parent.iterrows():
            parent_pcode = str(row["parent_pcode"])
            if parent_pcode in parent_pcodes:
                valid_parents += 1
            else:
                invalid_parents.append(f"{row['admin_pcode']} -> {parent_pcode}")
        
        if invalid_parents:
            issues.append(f"{level}: {len(invalid_parents)} invalid parent references")
            if len(invalid_parents) <= 10:
                issues.extend([f"  - {ref}" for ref in invalid_parents])
        
        stats[level] = {
            "total": len(gdf),
            "with_parent": len(with_parent),
            "orphans": len(orphans),
            "valid_parents": valid_parents
        }
    
    return stats, issues

def upload_boundaries_level(
    supabase: Client,
    gdf: gpd.GeoDataFrame,
    country_id: str,
    admin_level: str
) -> Dict[str, int]:
    """Upload boundaries for a specific admin level."""
    stats = {"uploaded": 0, "skipped": 0, "errors": 0}
    
    try:
        records = []
        for idx, row in gdf.iterrows():
            try:
                admin_pcode = str(row["admin_pcode"]).strip()
                if not admin_pcode:
                    stats["skipped"] += 1
                    continue
                
                # Convert geometry to GeoJSON for RPC function
                # Use mapping() method which returns a GeoJSON-like dict
                geom_geojson = gpd.GeoSeries([row.geometry]).__geo_interface__['features'][0]['geometry']
                
                record = {
                    "type": "Feature",
                    "properties": {
                        "admin_pcode": admin_pcode,
                        "name": str(row["name"]).strip() if pd.notna(row.get("name")) else None,
                        "parent_pcode": str(row["parent_pcode"]).strip() if pd.notna(row.get("parent_pcode")) else None,
                    },
                    "geometry": geom_geojson
                }
                
                records.append(record)
                
            except Exception as e:
                print(f"  Error processing row {idx}: {e}")
                stats["errors"] += 1
        
        # Use RPC function to import boundaries in batches to avoid timeouts
        print(f"  Importing {len(records)} boundaries via RPC function (in batches)...")
        
        batch_size = 50  # Smaller batches to avoid timeouts
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            batch_num = i // batch_size + 1
            total_batches = (len(records) + batch_size - 1) // batch_size
            
            # Create FeatureCollection for this batch
            feature_collection = {
                "type": "FeatureCollection",
                "features": batch
            }
            
            try:
                response = supabase.rpc("import_admin_boundaries", {
                    "p_country_id": country_id,
                    "p_admin_level": admin_level,
                    "p_boundaries": feature_collection
                }).execute()
                
                if response.data and len(response.data) > 0:
                    result = response.data[0]
                    batch_imported = result.get("imported_count", 0)
                    batch_skipped = result.get("skipped_count", 0)
                    batch_errors = result.get("error_count", 0)
                    
                    stats["uploaded"] += batch_imported
                    stats["skipped"] += batch_skipped
                    stats["errors"] += batch_errors
                    
                    print(f"    Batch {batch_num}/{total_batches}: {batch_imported} imported, {batch_skipped} skipped, {batch_errors} errors")
                    
                    errors = result.get("errors", [])
                    if errors and len(errors) <= 3:
                        for err in errors:
                            print(f"      - {err}")
            except Exception as e:
                print(f"  ❌ Error in batch {batch_num}: {e}")
                stats["errors"] += len(batch)
        
        return stats
        
    except Exception as e:
        print(f"Error uploading {admin_level}: {e}")
        import traceback
        traceback.print_exc()
        return stats

def process_country(
    country_iso: str,
    supabase: Client,
    country_map: Dict[str, str],
    output_dir: Path
) -> bool:
    """Download, process, and upload boundaries for a country."""
    if country_iso not in HDX_DATASETS:
        print(f"Unknown country: {country_iso}")
        return False
    
    if country_iso not in country_map:
        print(f"Country {country_iso} not found in database")
        return False
    
    country_info = HDX_DATASETS[country_iso]
    country_id = country_map[country_iso]
    
    print(f"\n{'='*80}")
    print(f"Processing {country_info['name']} ({country_iso})")
    print(f"{'='*80}")
    
    # Get dataset info
    dataset_info = get_hdx_dataset_info(country_info["dataset_id"])
    if not dataset_info:
        print(f"❌ Could not fetch dataset info")
        return False
    
    # Find resource
    resource = find_geojson_resource(dataset_info)
    if not resource:
        print(f"❌ No suitable resource found")
        return False
    
    # Download
    country_dir = output_dir / country_iso
    country_dir.mkdir(parents=True, exist_ok=True)
    
    resource_url = resource.get("url")
    if not resource_url:
        print(f"❌ No download URL")
        return False
    
    # Determine file extension from URL or resource format
    file_ext = Path(resource_url).suffix
    if not file_ext:
        # Check resource format
        resource_format = resource.get("format", "").lower()
        if "geojson" in resource_format:
            file_ext = ".geojson"
        elif "shp" in resource_format or "shapefile" in resource_format:
            file_ext = ".zip"  # Shapefiles usually come in zip
        else:
            file_ext = ".zip"  # Default to zip
    
    download_path = country_dir / f"boundaries{file_ext}"
    
    if not download_resource(resource_url, download_path):
        return False
    
    # Process boundaries
    print(f"\nProcessing boundaries...")
    boundaries_by_level = process_boundaries_file(
        download_path,
        country_iso,
        country_info["expected_counts"]
    )
    
    if not boundaries_by_level:
        print(f"❌ No boundaries extracted")
        return False
    
    print(f"\nExtracted levels: {list(boundaries_by_level.keys())}")
    for level, gdf in boundaries_by_level.items():
        print(f"  {level}: {len(gdf)} features")
    
    # Validate parent/child relationships
    print(f"\nValidating parent/child relationships...")
    stats, issues = validate_parent_child_relationships(boundaries_by_level, country_iso)
    
    for level, level_stats in stats.items():
        print(f"  {level}: {level_stats['total']} total, "
              f"{level_stats['valid_parents']} valid parents, "
              f"{level_stats['orphans']} orphans")
    
    if issues:
        print(f"\n⚠️  Issues found:")
        for issue in issues[:20]:  # Limit output
            print(f"  {issue}")
        if len(issues) > 20:
            print(f"  ... and {len(issues) - 20} more issues")
    
    # Upload each level
    print(f"\nUploading to Supabase...")
    total_uploaded = 0
    
    for level in sorted(boundaries_by_level.keys()):
        gdf = boundaries_by_level[level]
        print(f"\nUploading {level} ({len(gdf)} features)...")
        
        upload_stats = upload_boundaries_level(supabase, gdf, country_id, level)
        total_uploaded += upload_stats["uploaded"]
        
        print(f"  ✓ Uploaded: {upload_stats['uploaded']}, "
              f"Skipped: {upload_stats['skipped']}, "
              f"Errors: {upload_stats['errors']}")
    
    # Verify final counts
    print(f"\nVerifying upload...")
    for level in sorted(boundaries_by_level.keys()):
        response = supabase.table("admin_boundaries").select(
            "id", count="exact"
        ).eq("country_id", country_id).eq("admin_level", level).execute()
        
        db_count = response.count
        expected_count = len(boundaries_by_level[level])
        
        if db_count == expected_count:
            print(f"  ✓ {level}: {db_count} boundaries in database")
        else:
            print(f"  ⚠️  {level}: {db_count} in DB, expected {expected_count}")
    
    print(f"\n✓ Completed {country_iso}: {total_uploaded} boundaries uploaded")
    return True

def main():
    """Main function."""
    # Initialize Supabase
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        print("❌ Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        return
    
    supabase: Client = create_client(supabase_url, supabase_key)
    
    # Get country mapping
    country_map = get_country_id_mapping(supabase)
    print(f"Found {len(country_map)} countries: {list(country_map.keys())}")
    
    # Create output directory
    output_dir = Path(__file__).parent.parent / "data" / "hdx_boundaries_reimport"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print("\n" + "="*80)
    print("COMPREHENSIVE BOUNDARY REIMPORT")
    print("="*80)
    print("\nThis will:")
    print("1. Download fresh data from HDX")
    print("2. Filter out Point geometries (only Polygons)")
    print("3. Validate parent/child relationships")
    print("4. Check completeness (e.g., all 507 Bangladesh ADM3)")
    print("5. Reimport to Supabase")
    print("\n" + "="*80)
    
    # Process all countries
    success_count = 0
    for country_iso in HDX_DATASETS.keys():
        try:
            if process_country(country_iso, supabase, country_map, output_dir):
                success_count += 1
        except Exception as e:
            print(f"\n❌ Error processing {country_iso}: {e}")
            import traceback
            traceback.print_exc()
    
    print("\n" + "="*80)
    print(f"REIMPORT COMPLETE: {success_count}/{len(HDX_DATASETS)} countries successful")
    print("="*80)

if __name__ == "__main__":
    main()
