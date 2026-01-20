-- ==============================
-- DISCOVER SOURCE DATABASE SCHEMA
-- ==============================
-- Run this in the SOURCE database SQL Editor to discover actual table and column names
-- This will help identify the correct structure before exporting

-- Step 1: Find all tables that might contain framework structure
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (table_name ILIKE '%pillar%' 
       OR table_name ILIKE '%theme%' 
       OR table_name ILIKE '%indicator%'
       OR table_name ILIKE '%framework%'
       OR table_name ILIKE '%ssc%'
       OR table_name ILIKE '%structure%')
ORDER BY table_name;

-- Step 2: For each potential table, show its columns
-- Replace 'pillars' with actual table names found in Step 1

-- Check pillars table (if it exists)
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name ILIKE '%pillar%'
ORDER BY table_name, ordinal_position;

-- Check themes table
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name ILIKE '%theme%'
ORDER BY table_name, ordinal_position;

-- Check indicators table
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name ILIKE '%indicator%'
ORDER BY table_name, ordinal_position;

-- Step 3: Get sample data from each table to understand structure
-- (Run these after identifying the table names)

-- Sample from pillars table (adjust table name)
-- SELECT * FROM pillars LIMIT 5;

-- Sample from themes table (adjust table name)
-- SELECT * FROM themes LIMIT 5;

-- Sample from indicators table (adjust table name)
-- SELECT * FROM indicators LIMIT 5;

-- Step 4: Check if framework structure is stored in JSONB columns
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND data_type = 'jsonb'
  AND (column_name ILIKE '%framework%' 
       OR column_name ILIKE '%pillar%'
       OR column_name ILIKE '%theme%'
       OR column_name ILIKE '%indicator%'
       OR column_name ILIKE '%structure%')
ORDER BY table_name, column_name;

-- Step 5: Check datasets table for framework references
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'datasets'
  AND (column_name ILIKE '%pillar%'
       OR column_name ILIKE '%theme%'
       OR column_name ILIKE '%indicator%'
       OR column_name ILIKE '%framework%')
ORDER BY column_name;

-- Step 6: Check metadata JSONB in datasets for framework structure
SELECT 
  id,
  name,
  metadata
FROM datasets
WHERE metadata IS NOT NULL
  AND (metadata::text ILIKE '%pillar%'
       OR metadata::text ILIKE '%theme%'
       OR metadata::text ILIKE '%indicator%'
       OR metadata::text ILIKE '%P1%'
       OR metadata::text ILIKE '%P2%'
       OR metadata::text ILIKE '%P3%')
LIMIT 10;
