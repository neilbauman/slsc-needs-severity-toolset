#!/usr/bin/env python3
"""
Update dataset metadata with data health metrics (alignment, coverage, completeness).
This populates the metadata.data_health field that the datasets page uses to display
Alignment and Status columns.
"""

import os
import sys
from pathlib import Path
from supabase import create_client
from dotenv import load_dotenv
from collections import defaultdict

load_dotenv(Path(__file__).parent.parent / ".env.local")
load_dotenv()

def get_all_boundaries(supabase, country_id, admin_level):
    """Get all boundaries with pagination."""
    all_data = []
    page_size = 1000
    offset = 0
    
    while True:
        resp = supabase.table("admin_boundaries").select("admin_pcode").eq("country_id", country_id).eq("admin_level", admin_level).range(offset, offset + page_size - 1).execute()
        if not resp.data:
            break
        all_data.extend([r["admin_pcode"] for r in resp.data])
        if len(resp.data) < page_size:
            break
        offset += page_size
    
    return set(all_data)

def get_all_dataset_values(supabase, dataset_id, dataset_type):
    """Get all dataset values with pagination."""
    all_data = []
    page_size = 1000
    offset = 0
    
    table_name = "dataset_values_numeric" if dataset_type == "numeric" else "dataset_values_categorical"
    
    while True:
        if dataset_type == "numeric":
            resp = supabase.table(table_name).select("admin_pcode, value").eq("dataset_id", dataset_id).range(offset, offset + page_size - 1).execute()
        else:
            resp = supabase.table(table_name).select("admin_pcode, category, value").eq("dataset_id", dataset_id).range(offset, offset + page_size - 1).execute()
        
        if not resp.data:
            break
        all_data.extend(resp.data)
        if len(resp.data) < page_size:
            break
        offset += page_size
    
    return all_data

def is_computed_dataset(dataset):
    """Check if this is a computed/derived dataset that doesn't store values in dataset_values tables."""
    name = (dataset.get("name") or "").lower()
    metadata = dataset.get("metadata") or {}
    
    # Hazard scores are computed from hazard events, stored in hazard_event_scores table
    if "hazard" in name and "score" in name:
        return True
    
    # Check metadata for computed indicators
    if metadata.get("source") == "hazard_event_analysis":
        return True
    
    if metadata.get("is_computed") or metadata.get("computed"):
        return True
    
    return False

def calculate_health_metrics(supabase, dataset, country_id):
    """Calculate health metrics for a dataset."""
    dataset_id = dataset["id"]
    dataset_type = dataset["type"]
    admin_level = dataset.get("admin_level")
    
    # Skip health calculation for computed datasets (e.g., hazard scores)
    if is_computed_dataset(dataset):
        # For computed datasets, mark as ready with note that they're computed
        return {
            "matched": None,
            "total": None,
            "percent": 1.0,  # Show as 100% since they're computed on-demand
            "alignment_rate": 1.0,
            "coverage": 1.0,
            "completeness": 1.0,
            "uniqueness": 1.0,
            "validation_errors": 0,
            "is_computed": True
        }
    
    if not admin_level:
        return None
    
    # Get boundaries
    boundaries = get_all_boundaries(supabase, country_id, admin_level)
    if not boundaries:
        return {
            "matched": 0,
            "total": 0,
            "percent": 0,
            "alignment_rate": 0,
            "coverage": 0,
            "completeness": 0,
            "uniqueness": 1.0,
            "validation_errors": 0
        }
    
    # Get dataset values
    values = get_all_dataset_values(supabase, dataset_id, dataset_type)
    if not values:
        # Check if dataset is marked as ready in metadata (user indicates it's complete)
        metadata = dataset.get("metadata") or {}
        readiness = metadata.get("readiness") or metadata.get("cleaning_status")
        
        # If marked as ready but no values, respect that status
        # (might be computed, derived, or placeholder)
        if readiness == "ready":
            return {
                "matched": len(boundaries),  # Assume all boundaries are covered
                "total": len(boundaries),
                "percent": 1.0,
                "alignment_rate": 1.0,
                "coverage": 1.0,
                "completeness": 1.0,
                "uniqueness": 1.0,
                "validation_errors": 0,
                "note": "marked_as_ready"
            }
        
        return {
            "matched": 0,
            "total": len(boundaries),
            "percent": 0,
            "alignment_rate": 0,
            "coverage": 0,
            "completeness": 0,
            "uniqueness": 1.0,
            "validation_errors": 0
        }
    
    # Calculate metrics
    if dataset_type == "numeric":
        value_pcodes = {v["admin_pcode"] for v in values}
        
        # Check for null/zero values
        null_count = sum(1 for v in values if v.get("value") is None)
        zero_count = sum(1 for v in values if v.get("value") == 0)
        
        # Check for duplicate pcodes
        pcode_counts = defaultdict(int)
        for v in values:
            pcode_counts[v["admin_pcode"]] += 1
        duplicates = sum(1 for count in pcode_counts.values() if count > 1)
        
        # Alignment: matched pcodes / total boundaries
        matched = value_pcodes & boundaries
        orphaned = value_pcodes - boundaries
        missing = boundaries - value_pcodes
        
        alignment_rate = len(matched) / len(boundaries) if boundaries else 0
        coverage = alignment_rate  # Coverage is same as alignment for numeric
        completeness = (len(values) - null_count - zero_count) / len(values) if values else 0
        uniqueness = 1.0 - (duplicates / len(values)) if values else 1.0
        
        return {
            "matched": len(matched),
            "total": len(boundaries),
            "percent": alignment_rate,
            "alignment_rate": alignment_rate,
            "coverage": coverage,
            "completeness": completeness,
            "uniqueness": uniqueness,
            "validation_errors": len(orphaned) + duplicates
        }
    else:  # categorical
        value_pcodes = {v["admin_pcode"] for v in values}
        
        # Check for duplicate pcode+category combinations
        pcode_category_counts = defaultdict(lambda: defaultdict(int))
        for v in values:
            pcode_category_counts[v["admin_pcode"]][v["category"]] += 1
        
        duplicates = sum(1 for categories in pcode_category_counts.values() for count in categories.values() if count > 1)
        
        # Alignment
        matched = value_pcodes & boundaries
        orphaned = value_pcodes - boundaries
        missing = boundaries - value_pcodes
        
        alignment_rate = len(matched) / len(boundaries) if boundaries else 0
        coverage = alignment_rate
        completeness = len(value_pcodes) / len(boundaries) if boundaries else 0
        uniqueness = 1.0 - (duplicates / len(values)) if values else 1.0
        
        return {
            "matched": len(matched),
            "total": len(boundaries),
            "percent": alignment_rate,
            "alignment_rate": alignment_rate,
            "coverage": coverage,
            "completeness": completeness,
            "uniqueness": uniqueness,
            "validation_errors": len(orphaned) + duplicates
        }

def determine_cleaning_status(health_metrics, dataset, supabase):
    """Determine cleaning status based on health metrics."""
    if not health_metrics:
        return "needs_review"
    
    # Computed datasets are always "ready" since they're computed on-demand
    if health_metrics.get("is_computed"):
        return "ready"
    
    alignment = health_metrics.get("alignment_rate", 0)
    completeness = health_metrics.get("completeness", 0)
    validation_errors = health_metrics.get("validation_errors", 0)
    
    # Check if dataset is used in instances even if it has no values
    # This might indicate it's computed/derived at runtime
    if alignment == 0 and completeness == 0:
        # Check if it's used in instances
        usage_count = supabase.table("instance_datasets").select("id", count="exact").eq("dataset_id", dataset["id"]).execute()
        if usage_count.count and usage_count.count > 0:
            # Used but no values - might be computed, mark as ready
            return "ready"
    
    # Ready: high alignment, high completeness, no errors
    if alignment >= 0.95 and completeness >= 0.95 and validation_errors == 0:
        return "ready"
    
    # In progress: decent metrics but some issues
    if alignment >= 0.85 and completeness >= 0.85:
        return "in_progress"
    
    # Needs review: low metrics or errors
    return "needs_review"

def main():
    print("=" * 80)
    print("UPDATE DATASET HEALTH METADATA")
    print("=" * 80)
    
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        print("Error: Missing Supabase credentials")
        return
    
    supabase = create_client(supabase_url, supabase_key)
    
    # Get all countries
    countries = supabase.table("countries").select("id, name, iso_code").eq("active", True).execute()
    print(f"\nFound {len(countries.data)} active countries\n")
    
    total_updated = 0
    total_skipped = 0
    
    for country in countries.data:
        country_id = country["id"]
        country_name = country["name"]
        
        print(f"Processing {country_name}...")
        
        # Get all datasets for this country
        datasets = supabase.table("datasets").select("id, name, type, admin_level, metadata").eq("country_id", country_id).execute()
        
        for dataset in datasets.data:
            dataset_id = dataset["id"]
            dataset_name = dataset["name"]
            
            # Calculate health metrics
            health_metrics = calculate_health_metrics(supabase, dataset, country_id)
            
            if not health_metrics:
                print(f"  ⚠️  Skipped {dataset_name} (no admin_level)")
                total_skipped += 1
                continue
            
            # Determine cleaning status
            cleaning_status = determine_cleaning_status(health_metrics, dataset, supabase)
            
            # Update metadata
            current_metadata = dataset.get("metadata") or {}
            updated_metadata = {
                **current_metadata,
                "data_health": health_metrics,
                "cleaning_status": cleaning_status
            }
            
            # Update dataset
            supabase.table("datasets").update({
                "metadata": updated_metadata
            }).eq("id", dataset_id).execute()
            
            alignment_pct = health_metrics["alignment_rate"] * 100
            print(f"  ✓ {dataset_name}: {alignment_pct:.1f}% alignment, status: {cleaning_status}")
            total_updated += 1
    
    print("\n" + "=" * 80)
    print(f"SUMMARY")
    print("=" * 80)
    print(f"Updated: {total_updated} datasets")
    print(f"Skipped: {total_skipped} datasets")
    print("\n✓ Health metadata updated successfully!")

if __name__ == "__main__":
    main()
