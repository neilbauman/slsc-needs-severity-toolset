#!/usr/bin/env python3
"""
Create population density datasets for each country.
Calculates density = population / area (in km²) using PostGIS ST_Area function.
Uses mcp_supabase_execute_sql to execute SQL queries.
"""

import os
import sys
import json
from pathlib import Path
from supabase import create_client
from dotenv import load_dotenv
import pandas as pd

load_dotenv(Path(__file__).parent.parent / ".env.local")
load_dotenv()

def get_countries(supabase):
    """Get all active countries."""
    resp = supabase.table("countries").select("id, iso_code, name").eq("active", True).order("name").execute()
    return resp.data

def get_population_datasets(supabase, country_id: str):
    """Get population datasets for a country (excluding existing density datasets)."""
    resp = supabase.table("datasets").select("id, name, admin_level, country_id").eq("country_id", country_id).eq("type", "numeric").ilike("name", "%population%").not_.ilike("name", "%density%").order("admin_level").execute()
    return resp.data

def get_project_id():
    """Extract project ID from Supabase URL."""
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    if not supabase_url:
        return None
    # Extract project ref from URL: https://xxx.supabase.co
    try:
        # URL format: https://[project-ref].supabase.co
        parts = supabase_url.replace("https://", "").replace("http://", "").split(".")
        if len(parts) > 0:
            return parts[0]
    except:
        pass
    return None

def calculate_density_and_create_dataset(supabase, project_id: str, country_id: str, country_name: str, admin_level: str, population_dataset_id: str):
    """Calculate population density using SQL and create dataset."""
    
    # SQL query to calculate density and create dataset
    sql_query = f"""
    DO $$
    DECLARE
        v_dataset_id UUID;
        v_dataset_name TEXT;
        v_count INTEGER;
        v_density_data RECORD;
    BEGIN
        -- Check if dataset already exists
        v_dataset_name := '{country_name} Population Density - {admin_level}';
        
        SELECT id INTO v_dataset_id
        FROM datasets
        WHERE country_id = '{country_id}'
          AND name = v_dataset_name;
        
        -- Create dataset if it doesn't exist
        IF v_dataset_id IS NULL THEN
            INSERT INTO datasets (
                name,
                description,
                type,
                admin_level,
                country_id,
                is_baseline,
                source,
                metadata
            ) VALUES (
                v_dataset_name,
                'Population density (persons per km²) by {admin_level} administrative units for {country_name}. Calculated from population and boundary area data.',
                'numeric',
                '{admin_level}',
                '{country_id}',
                true,
                'Calculated from population and boundary data',
                jsonb_build_object(
                    'calculated_from_population_dataset', '{population_dataset_id}',
                    'calculation_method', 'population / area_km2',
                    'unit', 'persons per km²'
                )
            ) RETURNING id INTO v_dataset_id;
            
            RAISE NOTICE 'Created dataset: % (ID: %)', v_dataset_name, v_dataset_id;
        ELSE
            -- Delete existing values
            DELETE FROM dataset_values_numeric WHERE dataset_id = v_dataset_id;
            RAISE NOTICE 'Using existing dataset: % (ID: %)', v_dataset_name, v_dataset_id;
        END IF;
        
        -- Calculate and insert density values
        INSERT INTO dataset_values_numeric (dataset_id, admin_pcode, value)
        WITH population_data AS (
            SELECT 
                admin_pcode,
                value AS population
            FROM dataset_values_numeric
            WHERE dataset_id = '{population_dataset_id}'
        ),
        boundary_areas AS (
            SELECT 
                admin_pcode,
                ST_Area(geometry::geography) / 1000000.0 AS area_km2
            FROM admin_boundaries
            WHERE country_id = '{country_id}'
              AND admin_level = '{admin_level}'
              AND geometry IS NOT NULL
              AND ST_IsValid(geometry::geometry)
        ),
        density_calc AS (
            SELECT 
                p.admin_pcode,
                p.population,
                COALESCE(b.area_km2, 0) AS area_km2,
                CASE 
                    WHEN COALESCE(b.area_km2, 0) > 0 
                    THEN p.population / b.area_km2 
                    ELSE NULL 
                END AS density_per_km2
            FROM population_data p
            INNER JOIN boundary_areas b ON p.admin_pcode = b.admin_pcode
            WHERE b.area_km2 > 0
        )
        SELECT 
            v_dataset_id,
            admin_pcode,
            density_per_km2
        FROM density_calc
        WHERE density_per_km2 IS NOT NULL
          AND density_per_km2 > 0;
        
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'Inserted % density values', v_count;
    END $$;
    """
    
    # Execute SQL using mcp_supabase_execute_sql
    # Since we're in a Python script, we'll need to use the MCP tool
    # For now, let's save the SQL and provide instructions
    
    print(f"    Executing SQL to calculate density...")
    
    # Try to execute via Supabase if we have direct access
    # Otherwise, save SQL file for manual execution
    try:
        # Use mcp_supabase_execute_sql if available in this context
        # Since we're in a script, we'll need to use a different approach
        
        # Save SQL to file for now
        sql_file = Path(__file__).parent.parent / "supabase" / "migrations" / f"create_density_{country_id[:8]}_{admin_level.lower()}.sql"
        sql_file.parent.mkdir(parents=True, exist_ok=True)
        with open(sql_file, "w") as f:
            f.write(sql_query)
        
        print(f"    ✓ Generated SQL file: {sql_file.name}")
        print(f"    Run this SQL in Supabase SQL Editor to create density dataset")
        
        return sql_file
        
    except Exception as e:
        print(f"    ⚠️  Error: {e}")
        return None

def process_country(supabase, country, use_mcp=False):
    """Process a single country to create density datasets."""
    country_id = country["id"]
    country_name = country["name"]
    iso_code = country["iso_code"]
    
    print(f"\n{'=' * 80}")
    print(f"Processing {country_name} ({iso_code})")
    print(f"{'=' * 80}")
    
    # Get population datasets
    pop_datasets = get_population_datasets(supabase, country_id)
    
    if not pop_datasets:
        print(f"  ⚠️  No population datasets found")
        return
    
    print(f"  Found {len(pop_datasets)} population dataset(s)")
    
    # For each population dataset, create a density dataset
    sql_files = []
    for pop_dataset in pop_datasets:
        admin_level = pop_dataset["admin_level"]
        pop_dataset_id = pop_dataset["id"]
        pop_dataset_name = pop_dataset["name"]
        
        print(f"\n  Processing {pop_dataset_name} ({admin_level})...")
        
        # Check if boundaries exist at this level
        boundaries_resp = supabase.table("admin_boundaries").select("admin_pcode", count="exact").eq("country_id", country_id).eq("admin_level", admin_level).limit(1).execute()
        
        if boundaries_resp.count == 0:
            print(f"    ⚠️  No boundaries found at {admin_level} level")
            continue
        
        # Calculate density and create dataset
        project_id = get_project_id()
        sql_file = calculate_density_and_create_dataset(supabase, project_id, country_id, country_name, admin_level, pop_dataset_id)
        if sql_file:
            sql_files.append(sql_file)
    
    return sql_files

def main():
    print("=" * 80)
    print("CREATE POPULATION DENSITY DATASETS")
    print("=" * 80)
    print("\nThis script generates SQL files for calculating population density.")
    print("The SQL files can be run in Supabase SQL Editor.\n")
    
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
    
    # Process each country
    all_sql_files = []
    for country in countries:
        sql_files = process_country(supabase, country)
        if sql_files:
            all_sql_files.extend(sql_files)
    
    print("\n" + "=" * 80)
    print("SQL FILES GENERATED")
    print("=" * 80)
    print(f"\nGenerated {len(all_sql_files)} SQL file(s):")
    for sql_file in all_sql_files:
        print(f"  - {sql_file.name}")
    
    print("\nNext steps:")
    print("1. Review the generated SQL files in supabase/migrations/")
    print("2. Run each SQL file in Supabase SQL Editor")
    print("3. The SQL will calculate density and create datasets automatically")
    print("\nAlternatively, you can use the mcp_supabase_execute_sql tool to run these queries programmatically.")

if __name__ == "__main__":
    main()
