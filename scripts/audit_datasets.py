#!/usr/bin/env python3
"""
Comprehensive dataset audit script.
Checks for:
1. Completeness - missing values, gaps in coverage
2. Coverage - percentage of boundaries with data
3. Alignment with PCodes - pcode matching between datasets and boundaries
4. Uniqueness - duplicate datasets, duplicate values
"""

import os
import sys
from pathlib import Path
from supabase import create_client
from dotenv import load_dotenv
from collections import defaultdict
import json

load_dotenv(Path(__file__).parent.parent / ".env.local")
load_dotenv()

def get_countries(supabase):
    """Get all active countries."""
    resp = supabase.table("countries").select("id, iso_code, name").eq("active", True).order("name").execute()
    return resp.data

def get_all_datasets(supabase, country_id=None):
    """Get all datasets, optionally filtered by country."""
    query = supabase.table("datasets").select("id, name, type, admin_level, country_id, metadata")
    if country_id:
        query = query.eq("country_id", country_id)
    resp = query.order("country_id, name").execute()
    return resp.data

def get_boundaries(supabase, country_id, admin_level):
    """Get all boundaries for a country and admin level."""
    resp = supabase.table("admin_boundaries").select("admin_pcode, name").eq("country_id", country_id).eq("admin_level", admin_level).execute()
    return resp.data

def get_dataset_values(supabase, dataset_id, dataset_type):
    """Get all values for a dataset."""
    if dataset_type == "numeric":
        resp = supabase.table("dataset_values_numeric").select("admin_pcode, value").eq("dataset_id", dataset_id).execute()
    else:
        resp = supabase.table("dataset_values_categorical").select("admin_pcode, category, value").eq("dataset_id", dataset_id).execute()
    return resp.data

def audit_dataset(supabase, dataset, country):
    """Audit a single dataset."""
    country_id = dataset["country_id"]
    dataset_id = dataset["id"]
    dataset_name = dataset["name"]
    admin_level = dataset["admin_level"]
    dataset_type = dataset["type"]
    
    issues = []
    warnings = []
    stats = {
        "boundary_count": 0,
        "value_count": 0,
        "matched_pcodes": 0,
        "orphaned_pcodes": 0,
        "missing_pcodes": 0,
        "duplicate_pcodes": 0,
        "null_values": 0,
        "zero_values": 0
    }
    
    # Get boundaries at this admin level
    boundaries = get_boundaries(supabase, country_id, admin_level)
    stats["boundary_count"] = len(boundaries)
    boundary_pcodes = {b["admin_pcode"] for b in boundaries}
    
    if stats["boundary_count"] == 0:
        issues.append(f"⚠️  No boundaries found at {admin_level} level")
        return {
            "dataset_id": dataset_id,
            "dataset_name": dataset_name,
            "admin_level": admin_level,
            "type": dataset_type,
            "issues": issues,
            "warnings": warnings,
            "stats": stats,
            "status": "ERROR"
        }
    
    # Get dataset values
    values = get_dataset_values(supabase, dataset_id, dataset_type)
    stats["value_count"] = len(values)
    
    if stats["value_count"] == 0:
        issues.append("⚠️  Dataset has no values")
        return {
            "dataset_id": dataset_id,
            "dataset_name": dataset_name,
            "admin_level": admin_level,
            "type": dataset_type,
            "issues": issues,
            "warnings": warnings,
            "stats": stats,
            "status": "ERROR"
        }
    
    # Check pcode alignment
    if dataset_type == "numeric":
        value_pcodes = {v["admin_pcode"] for v in values}
        
        # Check for null or zero values
        for v in values:
            if v.get("value") is None:
                stats["null_values"] += 1
            elif v.get("value") == 0:
                stats["zero_values"] += 1
        
        # Check for duplicate pcodes
        pcode_counts = defaultdict(int)
        for v in values:
            pcode_counts[v["admin_pcode"]] += 1
        
        duplicates = {pcode: count for pcode, count in pcode_counts.items() if count > 1}
        if duplicates:
            stats["duplicate_pcodes"] = len(duplicates)
            issues.append(f"⚠️  Found {len(duplicates)} duplicate pcodes: {list(duplicates.keys())[:5]}")
        
        # Check alignment
        matched = value_pcodes & boundary_pcodes
        orphaned = value_pcodes - boundary_pcodes
        missing = boundary_pcodes - value_pcodes
        
        stats["matched_pcodes"] = len(matched)
        stats["orphaned_pcodes"] = len(orphaned)
        stats["missing_pcodes"] = len(missing)
        
        if orphaned:
            warnings.append(f"⚠️  {len(orphaned)} orphaned pcodes (data without boundaries): {list(orphaned)[:5]}")
        
        if missing:
            coverage_pct = (len(matched) / stats["boundary_count"]) * 100
            if coverage_pct < 50:
                issues.append(f"⚠️  Low coverage: {coverage_pct:.1f}% ({len(matched)}/{stats['boundary_count']} boundaries)")
            elif coverage_pct < 100:
                warnings.append(f"⚠️  Incomplete coverage: {coverage_pct:.1f}% ({len(matched)}/{stats['boundary_count']} boundaries)")
                warnings.append(f"   Missing pcodes: {list(missing)[:10]}")
        
        if stats["null_values"] > 0:
            warnings.append(f"⚠️  {stats['null_values']} null values found")
        
        if stats["zero_values"] > 0:
            warnings.append(f"⚠️  {stats['zero_values']} zero values found")
    
    else:  # categorical
        value_pcodes = {v["admin_pcode"] for v in values}
        
        # Check for duplicate pcodes with same category
        pcode_category_counts = defaultdict(lambda: defaultdict(int))
        for v in values:
            pcode_category_counts[v["admin_pcode"]][v["category"]] += 1
        
        duplicates = []
        for pcode, categories in pcode_category_counts.items():
            for category, count in categories.items():
                if count > 1:
                    duplicates.append(f"{pcode}:{category}")
        
        if duplicates:
            stats["duplicate_pcodes"] = len(duplicates)
            issues.append(f"⚠️  Found {len(duplicates)} duplicate pcode+category combinations")
        
        # Check alignment
        matched = value_pcodes & boundary_pcodes
        orphaned = value_pcodes - boundary_pcodes
        missing = boundary_pcodes - value_pcodes
        
        stats["matched_pcodes"] = len(matched)
        stats["orphaned_pcodes"] = len(orphaned)
        stats["missing_pcodes"] = len(missing)
        
        if orphaned:
            warnings.append(f"⚠️  {len(orphaned)} orphaned pcodes: {list(orphaned)[:5]}")
        
        if missing:
            coverage_pct = (len(matched) / stats["boundary_count"]) * 100
            if coverage_pct < 50:
                issues.append(f"⚠️  Low coverage: {coverage_pct:.1f}%")
            elif coverage_pct < 100:
                warnings.append(f"⚠️  Incomplete coverage: {coverage_pct:.1f}% ({len(matched)}/{stats['boundary_count']} boundaries)")
    
    # Determine status
    if issues:
        status = "ERROR"
    elif warnings:
        status = "WARNING"
    else:
        status = "OK"
    
    return {
        "dataset_id": dataset_id,
        "dataset_name": dataset_name,
        "admin_level": admin_level,
        "type": dataset_type,
        "issues": issues,
        "warnings": warnings,
        "stats": stats,
        "status": status,
        "coverage_pct": (stats["matched_pcodes"] / stats["boundary_count"] * 100) if stats["boundary_count"] > 0 else 0
    }

def check_duplicate_datasets(supabase):
    """Check for duplicate datasets (same name, country, admin_level)."""
    all_datasets = get_all_datasets(supabase)
    
    # Group by name, country_id, admin_level
    dataset_groups = defaultdict(list)
    for ds in all_datasets:
        key = (ds["name"], ds["country_id"], ds["admin_level"])
        dataset_groups[key].append(ds)
    
    duplicates = []
    for key, datasets in dataset_groups.items():
        if len(datasets) > 1:
            duplicates.append({
                "name": key[0],
                "country_id": key[1],
                "admin_level": key[2],
                "count": len(datasets),
                "dataset_ids": [ds["id"] for ds in datasets]
            })
    
    return duplicates

def main():
    print("=" * 80)
    print("DATASET AUDIT")
    print("=" * 80)
    print()
    
    # Initialize Supabase
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        print("Error: Missing Supabase credentials")
        return
    
    supabase = create_client(supabase_url, supabase_key)
    
    # Get all countries
    countries = get_countries(supabase)
    print(f"Found {len(countries)} active countries\n")
    
    # Check for duplicate datasets
    print("Checking for duplicate datasets...")
    duplicates = check_duplicate_datasets(supabase)
    if duplicates:
        print(f"⚠️  Found {len(duplicates)} duplicate dataset groups:\n")
        for dup in duplicates:
            country = supabase.table("countries").select("name, iso_code").eq("id", dup["country_id"]).single().execute()
            if country.data:
                print(f"  {country.data['name']}: '{dup['name']}' ({dup['admin_level']}) - {dup['count']} duplicates")
                print(f"    IDs: {', '.join(dup['dataset_ids'][:3])}...")
    else:
        print("✓ No duplicate datasets found\n")
    
    print("\n" + "=" * 80)
    print("AUDITING DATASETS BY COUNTRY")
    print("=" * 80)
    
    all_results = []
    summary_stats = {
        "total_datasets": 0,
        "ok": 0,
        "warnings": 0,
        "errors": 0,
        "total_issues": 0,
        "total_warnings": 0
    }
    
    # Audit each country
    for country in countries:
        country_id = country["id"]
        country_name = country["name"]
        iso_code = country["iso_code"]
        
        print(f"\n{'=' * 80}")
        print(f"{country_name} ({iso_code})")
        print(f"{'=' * 80}")
        
        # Get datasets for this country
        datasets = get_all_datasets(supabase, country_id)
        
        if not datasets:
            print("  ⚠️  No datasets found")
            continue
        
        print(f"  Found {len(datasets)} dataset(s)\n")
        
        # Audit each dataset
        country_results = []
        for dataset in datasets:
            result = audit_dataset(supabase, dataset, country)
            country_results.append(result)
            all_results.append(result)
            
            summary_stats["total_datasets"] += 1
            
            if result["status"] == "OK":
                summary_stats["ok"] += 1
                print(f"  ✓ {result['dataset_name']} ({result['admin_level']})")
                print(f"    Coverage: {result['coverage_pct']:.1f}% ({result['stats']['matched_pcodes']}/{result['stats']['boundary_count']} boundaries)")
                print(f"    Values: {result['stats']['value_count']}")
            elif result["status"] == "WARNING":
                summary_stats["warnings"] += 1
                summary_stats["total_warnings"] += len(result["warnings"])
                print(f"  ⚠️  {result['dataset_name']} ({result['admin_level']}) - WARNINGS")
                print(f"    Coverage: {result['coverage_pct']:.1f}% ({result['stats']['matched_pcodes']}/{result['stats']['boundary_count']} boundaries)")
                print(f"    Values: {result['stats']['value_count']}")
                for warning in result["warnings"][:3]:
                    print(f"    {warning}")
            else:
                summary_stats["errors"] += 1
                summary_stats["total_issues"] += len(result["issues"])
                print(f"  ❌ {result['dataset_name']} ({result['admin_level']}) - ERRORS")
                for issue in result["issues"]:
                    print(f"    {issue}")
        
        # Country summary
        country_ok = sum(1 for r in country_results if r["status"] == "OK")
        country_warn = sum(1 for r in country_results if r["status"] == "WARNING")
        country_err = sum(1 for r in country_results if r["status"] == "ERROR")
        
        print(f"\n  Summary: {country_ok} OK, {country_warn} warnings, {country_err} errors")
    
    # Overall summary
    print("\n" + "=" * 80)
    print("AUDIT SUMMARY")
    print("=" * 80)
    print(f"Total datasets audited: {summary_stats['total_datasets']}")
    print(f"  ✓ OK: {summary_stats['ok']}")
    print(f"  ⚠️  Warnings: {summary_stats['warnings']} ({summary_stats['total_warnings']} total warnings)")
    print(f"  ❌ Errors: {summary_stats['errors']} ({summary_stats['total_issues']} total issues)")
    
    # Detailed issues report
    if summary_stats['total_issues'] > 0 or summary_stats['total_warnings'] > 0:
        print("\n" + "=" * 80)
        print("DETAILED ISSUES REPORT")
        print("=" * 80)
        
        # Group by issue type
        coverage_issues = []
        alignment_issues = []
        duplicate_issues = []
        data_quality_issues = []
        
        for result in all_results:
            country = None
            for c in countries:
                if c["id"] == result.get("country_id"):
                    country = c
                    break
            
            country_name = country["name"] if country else "Unknown"
            
            for issue in result.get("issues", []):
                if "coverage" in issue.lower() or "missing" in issue.lower():
                    coverage_issues.append(f"{country_name}: {result['dataset_name']} - {issue}")
                elif "orphaned" in issue.lower() or "pcode" in issue.lower():
                    alignment_issues.append(f"{country_name}: {result['dataset_name']} - {issue}")
                elif "duplicate" in issue.lower():
                    duplicate_issues.append(f"{country_name}: {result['dataset_name']} - {issue}")
                else:
                    data_quality_issues.append(f"{country_name}: {result['dataset_name']} - {issue}")
        
        if coverage_issues:
            print("\n📊 Coverage Issues:")
            for issue in coverage_issues[:10]:
                print(f"  {issue}")
            if len(coverage_issues) > 10:
                print(f"  ... and {len(coverage_issues) - 10} more")
        
        if alignment_issues:
            print("\n🔗 PCode Alignment Issues:")
            for issue in alignment_issues[:10]:
                print(f"  {issue}")
            if len(alignment_issues) > 10:
                print(f"  ... and {len(alignment_issues) - 10} more")
        
        if duplicate_issues:
            print("\n🔄 Duplicate Issues:")
            for issue in duplicate_issues[:10]:
                print(f"  {issue}")
            if len(duplicate_issues) > 10:
                print(f"  ... and {len(duplicate_issues) - 10} more")
        
        if data_quality_issues:
            print("\n📈 Data Quality Issues:")
            for issue in data_quality_issues[:10]:
                print(f"  {issue}")
            if len(data_quality_issues) > 10:
                print(f"  ... and {len(data_quality_issues) - 10} more")
    
    # Save detailed report to file
    report_file = Path(__file__).parent.parent / "data" / "dataset_audit_report.json"
    report_file.parent.mkdir(parents=True, exist_ok=True)
    
    report_data = {
        "summary": summary_stats,
        "duplicate_datasets": duplicates,
        "dataset_results": all_results
    }
    
    with open(report_file, "w") as f:
        json.dump(report_data, f, indent=2, default=str)
    
    print(f"\n✓ Detailed report saved to: {report_file}")

if __name__ == "__main__":
    main()
