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
from pathlib import Path
import geopandas as gpd
from typing import Dict, List, Optional

try:
    from hdx.api.configuration import Configuration
    from hdx.data.dataset import Dataset
    HDX_API_AVAILABLE = True
except ImportError:
    HDX_API_AVAILABLE = False
    print("Warning: hdx-python-api not installed. Install with: pip install hdx-python-api")
    import requests
    HDX_API_BASE = "https://data.humdata.org/api/3/action"

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
    if HDX_API_AVAILABLE:
        try:
            dataset = Dataset.read_from_hdx(dataset_id)
            return dataset.data
        except Exception as e:
            print(f"Error fetching dataset {dataset_id}: {e}")
            return None
    else:
        # Fallback to direct API call
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
        
        # Find admin level column (common names: ADM0, ADM1, ADM2, etc. or admin_level, level)
        admin_level_col = None
        for col in ["ADM_LEVEL", "ADMLEVEL", "admin_level", "level", "ADM0", "ADM1"]:
            if col in gdf.columns:
                admin_level_col = col
                break
        
        if not admin_level_col:
            print(f"Warning: Could not find admin level column. Available columns: {gdf.columns.tolist()}")
            # Try to infer from column names
            for col in gdf.columns:
                if "ADM" in col.upper() or "LEVEL" in col.upper():
                    admin_level_col = col
                    break
        
        # Find pcode column
        pcode_col = None
        for col in ["ADM0_PCODE", "ADM1_PCODE", "ADM2_PCODE", "ADM3_PCODE", "ADM4_PCODE", 
                    "PCODE", "pcode", "admin_pcode", "ADMIN_PCODE"]:
            if col in gdf.columns:
                pcode_col = col
                break
        
        # Find name column
        name_col = None
        for col in ["ADM0_EN", "ADM1_EN", "ADM2_EN", "ADM3_EN", "ADM4_EN",
                    "NAME", "name", "NAME_EN", "NAME_ENGLISH"]:
            if col in gdf.columns:
                name_col = col
                break
        
        # Find parent pcode column
        parent_pcode_col = None
        for col in ["PARENT_PCODE", "parent_pcode", "PARENT"]:
            if col in gdf.columns:
                parent_pcode_col = col
                break
        
        print(f"Using columns: admin_level={admin_level_col}, pcode={pcode_col}, name={name_col}, parent={parent_pcode_col}")
        
        # Process each admin level
        output_files = {}
        
        if admin_level_col:
            for level in gdf[admin_level_col].unique():
                level_gdf = gdf[gdf[admin_level_col] == level].copy()
                
                # Standardize column names
                level_gdf = level_gdf.rename(columns={
                    pcode_col: "admin_pcode",
                    name_col: "name",
                    parent_pcode_col: "parent_pcode" if parent_pcode_col else None
                })
                
                # Ensure required columns exist
                if "admin_pcode" not in level_gdf.columns:
                    print(f"Warning: No pcode column found for level {level}")
                    continue
                
                # Set admin_level
                level_gdf["admin_level"] = level
                
                # Select and reorder columns
                cols_to_keep = ["admin_pcode", "admin_level", "name", "parent_pcode", "geometry"]
                cols_to_keep = [c for c in cols_to_keep if c in level_gdf.columns]
                level_gdf = level_gdf[cols_to_keep]
                
                # Save as GeoJSON
                output_file = output_dir / f"{country_iso}_{level}.geojson"
                level_gdf.to_file(output_file, driver="GeoJSON")
                output_files[level] = output_file
                print(f"Saved {len(level_gdf)} features for {level} to {output_file}")
        else:
            # No admin level column - save entire dataset
            output_file = output_dir / f"{country_iso}_all.geojson"
            gdf.to_file(output_file, driver="GeoJSON")
            output_files["ALL"] = output_file
            print(f"Saved {len(gdf)} features to {output_file}")
        
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
    
    # Process all countries
    for country_iso in HDX_DATASETS.keys():
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
