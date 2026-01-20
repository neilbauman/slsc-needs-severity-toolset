#!/usr/bin/env python3
"""
Download and process administrative boundary datasets from OCHA HDX for each country.
This script downloads COD (Common Operational Dataset) administrative boundaries from HDX
and prepares them for upload to Supabase.

Requirements:
    pip install hdx-python-api shapely geopandas pyproj

Usage:
    python scripts/download_hdx_boundaries.py
"""

import json
import os
import zipfile
import re
from pathlib import Path
import geopandas as gpd
import pandas as pd
from typing import Dict, List, Optional

# HDX CKAN API base URL (always available)
HDX_API_BASE = "https://data.humdata.org/api/3/action"

try:
    from hdx.api.configuration import Configuration
    from hdx.data.dataset import Dataset
    HDX_API_AVAILABLE = True
except ImportError:
    HDX_API_AVAILABLE = False
    print("Warning: hdx-python-api not installed. Install with: pip install hdx-python-api")
    import requests

# Country-specific HDX dataset identifiers
# These are the COD-AB (Common Operational Dataset - Administrative Boundaries) datasets
HDX_DATASETS = {
    "BGD": {
        "name": "Bangladesh - Subnational Administrative Boundaries",
        "dataset_id": "cod-ab-bgd",
        "expected_levels": ["ADM0", "ADM1", "ADM2", "ADM3", "ADM4"]
    },
    "MOZ": {
        "name": "Mozambique - Subnational Administrative Boundaries",
        "dataset_id": "cod-ab-moz",
        "expected_levels": ["ADM0", "ADM1", "ADM2", "ADM3"]
    },
    "PSE": {
        "name": "Palestine - Subnational Administrative Boundaries",
        "dataset_id": "cod-ab-pse",
        "expected_levels": ["ADM0", "ADM1", "ADM2", "ADM3"]
    },
    "PHL": {
        "name": "Philippines - Subnational Administrative Boundaries",
        "dataset_id": "cod-ab-phl",
        "expected_levels": ["ADM0", "ADM1", "ADM2", "ADM3", "ADM4"]
    },
    "LKA": {
        "name": "Sri Lanka - Subnational Administrative Boundaries",
        "dataset_id": "cod-ab-lka",
        "expected_levels": ["ADM0", "ADM1", "ADM2", "ADM3", "ADM4"]
    }
}

def get_hdx_dataset_info(dataset_id: str) -> Optional[Dict]:
    """Get dataset information from HDX API."""
    # Try direct CKAN API first (more reliable)
    url = f"{HDX_API_BASE}/package_show"
    params = {"id": dataset_id}
    
    try:
        import requests
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        if data.get("success"):
            result = data.get("result")
            print(f"Found dataset: {result.get('title', dataset_id)}")
            print(f"Resources: {len(result.get('resources', []))}")
            return result
        else:
            print(f"Error: {data.get('error', {}).get('message', 'Unknown error')}")
            return None
    except Exception as e:
        print(f"Error fetching dataset {dataset_id} via CKAN API: {e}")
    
    # Fallback to HDX Python API
    if HDX_API_AVAILABLE:
        try:
            dataset = Dataset.read_from_hdx(dataset_id)
            return dataset.data
        except Exception as e:
            print(f"Error fetching dataset {dataset_id} via HDX API: {e}")
            return None
    
    return None

def find_shapefile_resource(dataset_info: Dict) -> Optional[Dict]:
    """Find the best shapefile resource in the dataset."""
    resources = dataset_info.get("resources", [])
    
    # Prefer shapefile format
    for resource in resources:
        format_lower = resource.get("format", "").lower()
        if "shp" in format_lower or "shapefile" in format_lower:
            return resource
    
    # Fallback to any geospatial format
    for resource in resources:
        format_lower = resource.get("format", "").lower()
        if any(fmt in format_lower for fmt in ["geojson", "kml", "geopackage", "gdb"]):
            return resource
    
    return None

def download_resource(resource_url: str, output_path: Path, resource_obj=None) -> bool:
    """Download a resource file."""
    try:
        print(f"Downloading from {resource_url}...")
        
        if HDX_API_AVAILABLE and resource_obj:
            # Use HDX API download method
            url, path = resource_obj.download(folder=str(output_path.parent))
            if path and Path(path).exists():
                # Rename to desired output path if needed
                if path != str(output_path):
                    Path(path).rename(output_path)
                print(f"Downloaded to {output_path}")
                return True
        else:
            # Fallback to direct download
            import requests
            response = requests.get(resource_url, stream=True, timeout=300)
            response.raise_for_status()
            
            with open(output_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            print(f"Downloaded to {output_path}")
            return True
    except Exception as e:
        print(f"Error downloading {resource_url}: {e}")
        return False

def extract_shapefile(zip_path: Path, extract_dir: Path) -> Optional[Path]:
    """Extract shapefile from zip and return path to .shp file."""
    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_dir)
        
        # Find .shp file
        shp_files = list(extract_dir.rglob("*.shp"))
        if shp_files:
            return shp_files[0]
        return None
    except Exception as e:
        print(f"Error extracting {zip_path}: {e}")
        return None

def process_boundaries(shapefile_path: Path, country_iso: str, output_dir: Path) -> Dict[str, Path]:
    """Process shapefile and split by admin level."""
    try:
        # Read shapefile
        gdf = gpd.read_file(shapefile_path)
        
        # Ensure CRS is WGS84 (EPSG:4326)
        if gdf.crs is None:
            gdf.set_crs("EPSG:4326", inplace=True)
        elif gdf.crs.to_string() != "EPSG:4326":
            gdf = gdf.to_crs("EPSG:4326")
        
        # Find admin level column (COD-AB format uses admin_leve or adm_level)
        admin_level_col = None
        for col in ["admin_leve", "adm_level", "ADM_LEVEL", "ADMLEVEL", "admin_level", "level"]:
            if col in gdf.columns:
                admin_level_col = col
                break
        
        # COD-AB format: Each row has columns like adm1_pcode, adm2_pcode, etc.
        # We need to extract rows by level and use the appropriate pcode/name columns
        output_files = {}
        
        if admin_level_col:
            # Process each unique admin level value
            for level_val in gdf[admin_level_col].unique():
                if pd.isna(level_val):
                    continue
                
                # Convert level value to integer
                try:
                    level_num = int(float(level_val))
                except (ValueError, TypeError):
                    # If not numeric, try to extract from string
                    match = re.search(r'(\d+)', str(level_val))
                    if match:
                        level_num = int(match.group(1))
                    else:
                        print(f"Warning: Could not parse level value: {level_val}")
                        continue
                
                # Skip non-standard level values (Palestine uses 84, 85, 88, 99)
                if level_num not in [0, 1, 2, 3, 4, 5]:
                    continue
                
                # Filter rows for this level
                level_gdf = gdf[gdf[admin_level_col] == level_val].copy()
                
                # Find pcode and name columns for this level
                # Try both formats: adm1_pcode and ADM1_PCODE
                pcode_col = None
                name_col = None
                parent_pcode_col = None
                
                # Try level-specific columns first (COD-AB format)
                for col in gdf.columns:
                    col_lower = col.lower()
                    if f"adm{level_num}_pcode" in col_lower or f"adm{level_num}_pcode" == col_lower:
                        pcode_col = col
                    if f"adm{level_num}_name" in col_lower and not name_col:
                        name_col = col
                
                # Fallback to generic columns
                if not pcode_col:
                    for col in ["PCODE", "pcode", "admin_pcode", "ADMIN_PCODE"]:
                        if col in gdf.columns:
                            pcode_col = col
                            break
                
                if not name_col:
                    for col in ["NAME", "name", "NAME_EN", "name_en"]:
                        if col in gdf.columns:
                            name_col = col
                            break
                
                # Find parent pcode (one level up)
                if level_num > 0:
                    parent_level = level_num - 1
                    for col in gdf.columns:
                        col_lower = col.lower()
                        if f"adm{parent_level}_pcode" in col_lower:
                            parent_pcode_col = col
                            break
                
                if not pcode_col:
                    print(f"Warning: No pcode column found for level {level_num}")
                    continue
                
                # Create standardized dataframe
                result_gdf = gpd.GeoDataFrame({
                    "admin_pcode": level_gdf[pcode_col].astype(str),
                    "admin_level": f"ADM{level_num}",
                    "name": level_gdf[name_col].astype(str) if name_col else None,
                    "parent_pcode": level_gdf[parent_pcode_col].astype(str) if parent_pcode_col else None,
                    "geometry": level_gdf.geometry
                }, crs=gdf.crs)
                
                # Remove duplicates and null pcodes
                result_gdf = result_gdf[result_gdf["admin_pcode"].notna()]
                result_gdf = result_gdf[result_gdf["admin_pcode"] != "None"]
                result_gdf = result_gdf[result_gdf["admin_pcode"] != ""]
                result_gdf = result_gdf.drop_duplicates(subset=["admin_pcode"])
                
                if len(result_gdf) == 0:
                    print(f"Warning: No valid features for level {level_num}")
                    continue
                
                # Save as GeoJSON
                output_file = output_dir / f"{country_iso}_ADM{level_num}.geojson"
                result_gdf.to_file(output_file, driver="GeoJSON")
                output_files[f"ADM{level_num}"] = output_file
                print(f"Saved {len(result_gdf)} features for ADM{level_num} to {output_file}")
        else:
            # No admin level column - try to infer from pcode columns
            print("No admin level column found. Attempting to infer from pcode columns...")
            
            # Find all pcode columns
            pcode_cols = [col for col in gdf.columns if "pcode" in col.lower() and "adm" in col.lower()]
            
            for pcode_col in pcode_cols:
                # Extract level number from column name (e.g., adm1_pcode -> 1)
                import re
                match = re.search(r'adm(\d+)_pcode', pcode_col.lower())
                if match:
                    level_num = int(match.group(1))
                    
                    # Find corresponding name column
                    name_col = None
                    for col in gdf.columns:
                        if f"adm{level_num}_name" in col.lower():
                            name_col = col
                            break
                    
                    # Create dataframe for this level
                    level_gdf = gdf[gdf[pcode_col].notna()].copy()
                    if len(level_gdf) == 0:
                        continue
                    
                    result_gdf = gpd.GeoDataFrame({
                        "admin_pcode": level_gdf[pcode_col].astype(str),
                        "admin_level": f"ADM{level_num}",
                        "name": level_gdf[name_col].astype(str) if name_col else None,
                        "geometry": level_gdf.geometry
                    }, crs=gdf.crs)
                    
                    result_gdf = result_gdf.drop_duplicates(subset=["admin_pcode"])
                    
                    output_file = output_dir / f"{country_iso}_ADM{level_num}.geojson"
                    result_gdf.to_file(output_file, driver="GeoJSON")
                    output_files[f"ADM{level_num}"] = output_file
                    print(f"Saved {len(result_gdf)} features for ADM{level_num} to {output_file}")
        
        return output_files
        
    except Exception as e:
        print(f"Error processing boundaries: {e}")
        import traceback
        traceback.print_exc()
        return {}

def process_country(country_iso: str, output_base_dir: Path):
    """Download and process boundaries for a country."""
    if country_iso not in HDX_DATASETS:
        print(f"Unknown country ISO: {country_iso}")
        return
    
    country_info = HDX_DATASETS[country_iso]
    print(f"\n{'='*60}")
    print(f"Processing {country_info['name']}")
    print(f"{'='*60}")
    
    # Get dataset info
    dataset_info = get_hdx_dataset_info(country_info["dataset_id"])
    if not dataset_info:
        print(f"Could not fetch dataset info for {country_iso}")
        return
    
    # Find shapefile resource
    resource = find_shapefile_resource(dataset_info)
    if not resource:
        print(f"No suitable geospatial resource found for {country_iso}")
        print(f"Available resources: {[r.get('format') for r in dataset_info.get('resources', [])]}")
        return
    
    # Create output directory
    country_dir = output_base_dir / country_iso
    country_dir.mkdir(parents=True, exist_ok=True)
    
    # Download resource
    resource_url = resource.get("url")
    if not resource_url:
        print(f"No download URL found for resource")
        return
    
    # Get resource object if using HDX API
    resource_obj = None
    if HDX_API_AVAILABLE:
        try:
            dataset = Dataset.read_from_hdx(country_info["dataset_id"])
            resources = dataset.get_resources()
            for r in resources:
                if r.get("id") == resource.get("id"):
                    resource_obj = r
                    break
        except:
            pass
    
    # Determine file extension
    file_ext = Path(resource_url).suffix or ".zip"
    download_path = country_dir / f"boundaries{file_ext}"
    
    if not download_resource(resource_url, download_path, resource_obj):
        return
    
    # Extract if zip
    if file_ext == ".zip":
        extract_dir = country_dir / "extracted"
        extract_dir.mkdir(exist_ok=True)
        shapefile_path = extract_shapefile(download_path, extract_dir)
        if not shapefile_path:
            print(f"Could not extract shapefile from {download_path}")
            return
    else:
        shapefile_path = download_path
    
    # Process boundaries
    output_files = process_boundaries(shapefile_path, country_iso, country_dir)
    
    if output_files:
        print(f"\n✓ Successfully processed {country_iso}")
        print(f"Output files: {list(output_files.keys())}")
    else:
        print(f"\n✗ Failed to process {country_iso}")

def main():
    """Main function."""
    # Initialize HDX API if available
    if HDX_API_AVAILABLE:
        try:
            Configuration.create(
                hdx_site="prod",
                user_agent="SLSC-Needs-Severity-Toolset",
                hdx_read_only=True
            )
        except Exception as e:
            print(f"Warning: Could not initialize HDX API: {e}")
    
    # Create output directory
    output_dir = Path(__file__).parent.parent / "data" / "hdx_boundaries"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print("HDX Administrative Boundaries Downloader")
    print("=" * 60)
    
    # Process all countries (skip Philippines - already completed)
    countries_to_process = [iso for iso in HDX_DATASETS.keys() if iso != "PHL"]
    
    for country_iso in countries_to_process:
        try:
            process_country(country_iso, output_dir)
        except Exception as e:
            print(f"Error processing {country_iso}: {e}")
            import traceback
            traceback.print_exc()
    
    print("\n" + "=" * 60)
    print("Download complete!")
    print(f"Output directory: {output_dir}")
    print("\nNext steps:")
    print("1. Review the downloaded GeoJSON files")
    print("2. Run the upload script to import to Supabase")

if __name__ == "__main__":
    main()
