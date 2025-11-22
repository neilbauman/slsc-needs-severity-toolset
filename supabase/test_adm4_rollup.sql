-- Test query to verify ADM4 to ADM3 rollup works
-- This should show if the parent_pcode relationship exists

-- Check a sample ADM3 code and its ADM4 children
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
WHERE ab3.admin_level = 'ADM3'
  AND ab3.admin_pcode IN ('PH0702201', 'PH0702202', 'PH0702203')
ORDER BY ab3.admin_pcode, ab4.admin_pcode
LIMIT 20;

-- Test the actual rollup query
SELECT 
  ab3.admin_pcode AS adm3_code,
  SUM(dvn.value) AS total_population
FROM dataset_values_numeric dvn
INNER JOIN admin_boundaries ab4 ON ab4.admin_pcode = dvn.admin_pcode
INNER JOIN admin_boundaries ab3 ON ab3.admin_pcode = ab4.parent_pcode
WHERE dvn.dataset_id = 'b35ef28d-2cd4-41aa-b2bd-bfda4b58a051'::UUID
  AND UPPER(TRIM(ab4.admin_level)) = 'ADM4'
  AND UPPER(TRIM(ab3.admin_level)) = 'ADM3'
  AND ab3.admin_pcode IN ('PH0702201', 'PH0702202', 'PH0702203')
GROUP BY ab3.admin_pcode;

