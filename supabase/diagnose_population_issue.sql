-- ==============================
-- DIAGNOSTIC QUERY: Troubleshoot Population Data Issue
-- ==============================
-- Run this query to diagnose why population is showing 0
-- Replace 'YOUR_INSTANCE_ID' with your actual instance ID

-- Step 1: Check instance configuration
SELECT 
  id,
  name,
  population_dataset_id,
  admin_scope,
  array_length(admin_scope, 1) AS admin_scope_count
FROM instances
WHERE id = '5197ced7-a93e-4548-a482-07a5f1c123ed'::UUID;  -- Replace with your instance ID

-- Step 2: Check if population dataset exists and has data
SELECT 
  d.id AS dataset_id,
  d.name AS dataset_name,
  d.admin_level,
  COUNT(dvn.admin_pcode) AS value_count,
  MIN(dvn.value) AS min_value,
  MAX(dvn.value) AS max_value,
  SUM(dvn.value) AS total_population
FROM datasets d
LEFT JOIN dataset_values_numeric dvn ON dvn.dataset_id = d.id
WHERE d.name ILIKE '%population%' OR d.name ILIKE '%pop%'
GROUP BY d.id, d.name, d.admin_level
ORDER BY d.created_at DESC;

-- Step 3: Get affected ADM3 codes
WITH instance_scope AS (
  SELECT admin_scope
  FROM instances
  WHERE id = '5197ced7-a93e-4548-a482-07a5f1c123ed'::UUID
)
SELECT 
  ab.admin_pcode,
  ab.name,
  ab.parent_pcode,
  ab.admin_level
FROM admin_boundaries ab
CROSS JOIN instance_scope isc
WHERE ab.admin_level = 'ADM3'
  AND (
    ab.parent_pcode = ANY(isc.admin_scope)
    OR EXISTS (
      SELECT 1 FROM unnest(isc.admin_scope) AS adm2_code
      WHERE ab.admin_pcode LIKE adm2_code || '%'
    )
  )
ORDER BY ab.admin_pcode
LIMIT 20;  -- Show first 20

-- Step 4: Check if population data exists for affected codes
WITH instance_scope AS (
  SELECT admin_scope, population_dataset_id
  FROM instances
  WHERE id = '5197ced7-a93e-4548-a482-07a5f1c123ed'::UUID
),
affected_codes AS (
  SELECT DISTINCT ab.admin_pcode
  FROM admin_boundaries ab
  CROSS JOIN instance_scope isc
  WHERE ab.admin_level = 'ADM3'
    AND (
      ab.parent_pcode = ANY(isc.admin_scope)
      OR EXISTS (
        SELECT 1 FROM unnest(isc.admin_scope) AS adm2_code
        WHERE ab.admin_pcode LIKE adm2_code || '%'
      )
    )
)
SELECT 
  isc.population_dataset_id,
  d.name AS population_dataset_name,
  COUNT(DISTINCT ac.admin_pcode) AS affected_codes_count,
  COUNT(DISTINCT dvn.admin_pcode) AS codes_with_population_data,
  COALESCE(SUM(dvn.value), 0) AS total_population
FROM instance_scope isc
CROSS JOIN affected_codes ac
LEFT JOIN datasets d ON d.id = isc.population_dataset_id
LEFT JOIN dataset_values_numeric dvn 
  ON dvn.dataset_id = isc.population_dataset_id 
  AND dvn.admin_pcode = ac.admin_pcode
GROUP BY isc.population_dataset_id, d.name;

-- Step 5: Sample population data for affected codes (first 10)
WITH instance_scope AS (
  SELECT admin_scope, population_dataset_id
  FROM instances
  WHERE id = '5197ced7-a93e-4548-a482-07a5f1c123ed'::UUID
),
affected_codes AS (
  SELECT DISTINCT ab.admin_pcode
  FROM admin_boundaries ab
  CROSS JOIN instance_scope isc
  WHERE ab.admin_level = 'ADM3'
    AND (
      ab.parent_pcode = ANY(isc.admin_scope)
      OR EXISTS (
        SELECT 1 FROM unnest(isc.admin_scope) AS adm2_code
        WHERE ab.admin_pcode LIKE adm2_code || '%'
      )
    )
  LIMIT 10
)
SELECT 
  ac.admin_pcode,
  ab.name AS admin_name,
  dvn.value AS population_value,
  isc.population_dataset_id
FROM affected_codes ac
CROSS JOIN instance_scope isc
LEFT JOIN admin_boundaries ab ON ab.admin_pcode = ac.admin_pcode AND ab.admin_level = 'ADM3'
LEFT JOIN dataset_values_numeric dvn 
  ON dvn.dataset_id = isc.population_dataset_id 
  AND dvn.admin_pcode = ac.admin_pcode
ORDER BY ac.admin_pcode;

-- Step 6: Check what the get_instance_summary function would return
SELECT * FROM get_instance_summary('5197ced7-a93e-4548-a482-07a5f1c123ed'::UUID);

