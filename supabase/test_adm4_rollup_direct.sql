-- Direct test query - copy and paste this into Supabase SQL Editor
-- This tests if ADM4 population can be rolled up to ADM3

-- Test 1: Check a sample ADM3 code and its ADM4 children
SELECT 
  ab3.admin_pcode AS adm3_code,
  ab3.name AS adm3_name,
  ab4.admin_pcode AS adm4_code,
  ab4.name AS adm4_name,
  ab4.parent_pcode,
  dvn.value AS population_value
FROM admin_boundaries ab3
LEFT JOIN admin_boundaries ab4 ON ab4.parent_pcode = ab3.admin_pcode AND UPPER(TRIM(ab4.admin_level)) = 'ADM4'
LEFT JOIN dataset_values_numeric dvn ON dvn.admin_pcode = ab4.admin_pcode 
  AND dvn.dataset_id = 'b35ef28d-2cd4-41aa-b2bd-bfda4b58a051'::UUID
WHERE UPPER(TRIM(ab3.admin_level)) = 'ADM3'
  AND ab3.admin_pcode IN ('PH0702201', 'PH0702202', 'PH0702203')
ORDER BY ab3.admin_pcode, ab4.admin_pcode
LIMIT 20;

-- Test 2: Test the actual rollup query (sum ADM4 to ADM3)
SELECT 
  ab3.admin_pcode AS adm3_code,
  ab3.name AS adm3_name,
  SUM(dvn.value) AS total_population,
  COUNT(ab4.admin_pcode) AS adm4_count
FROM dataset_values_numeric dvn
INNER JOIN admin_boundaries ab4 ON ab4.admin_pcode = dvn.admin_pcode
INNER JOIN admin_boundaries ab3 ON ab3.admin_pcode = ab4.parent_pcode
WHERE dvn.dataset_id = 'b35ef28d-2cd4-41aa-b2bd-bfda4b58a051'::UUID
  AND UPPER(TRIM(ab4.admin_level)) = 'ADM4'
  AND UPPER(TRIM(ab3.admin_level)) = 'ADM3'
  AND ab3.admin_pcode IN ('PH0702201', 'PH0702202', 'PH0702203')
GROUP BY ab3.admin_pcode, ab3.name;

-- Test 3: Test with all affected ADM3 codes from the instance
WITH affected_codes AS (
  SELECT DISTINCT ab.admin_pcode
  FROM admin_boundaries ab
  CROSS JOIN (
    SELECT admin_scope FROM instances WHERE id = '5197ced7-a93e-4548-a482-07a5f1c123ed'::UUID
  ) i
  WHERE UPPER(TRIM(ab.admin_level)) = 'ADM3'
    AND (
      ab.parent_pcode = ANY(i.admin_scope)
      OR EXISTS (
        SELECT 1 FROM unnest(i.admin_scope) AS adm2_code
        WHERE ab.admin_pcode LIKE adm2_code || '%'
      )
    )
)
SELECT 
  ab3.admin_pcode AS adm3_code,
  SUM(dvn.value) AS total_population
FROM dataset_values_numeric dvn
INNER JOIN admin_boundaries ab4 ON ab4.admin_pcode = dvn.admin_pcode
INNER JOIN admin_boundaries ab3 ON ab3.admin_pcode = ab4.parent_pcode
INNER JOIN affected_codes ac ON ac.admin_pcode = ab3.admin_pcode
WHERE dvn.dataset_id = 'b35ef28d-2cd4-41aa-b2bd-bfda4b58a051'::UUID
  AND UPPER(TRIM(ab4.admin_level)) = 'ADM4'
  AND UPPER(TRIM(ab3.admin_level)) = 'ADM3'
GROUP BY ab3.admin_pcode
ORDER BY ab3.admin_pcode
LIMIT 10;

