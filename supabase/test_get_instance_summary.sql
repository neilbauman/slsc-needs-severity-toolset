-- Test the get_instance_summary function
-- This should return one row with three columns

SELECT * FROM get_instance_summary('5197ced7-a93e-4548-a482-07a5f1c123ed'::UUID);

-- If that returns no rows, let's check what's happening step by step:

-- Step 1: Does the instance exist?
SELECT id, name, population_dataset_id, admin_scope 
FROM instances 
WHERE id = '5197ced7-a93e-4548-a482-07a5f1c123ed'::UUID;

-- Step 2: Are affected codes being found?
WITH instance_scope AS (
  SELECT admin_scope
  FROM instances
  WHERE id = '5197ced7-a93e-4548-a482-07a5f1c123ed'::UUID
)
SELECT COUNT(*) AS affected_adm3_count
FROM admin_boundaries ab
CROSS JOIN instance_scope isc
WHERE UPPER(TRIM(ab.admin_level)) = 'ADM3'
  AND (
    ab.parent_pcode = ANY(isc.admin_scope)
    OR EXISTS (
      SELECT 1 FROM unnest(isc.admin_scope) AS adm2_code
      WHERE ab.admin_pcode LIKE adm2_code || '%'
    )
  );

-- Step 3: Test the actual population calculation (what the function should do)
WITH instance_scope AS (
  SELECT admin_scope, population_dataset_id
  FROM instances
  WHERE id = '5197ced7-a93e-4548-a482-07a5f1c123ed'::UUID
),
affected_codes AS (
  SELECT DISTINCT ab.admin_pcode
  FROM admin_boundaries ab
  CROSS JOIN instance_scope isc
  WHERE UPPER(TRIM(ab.admin_level)) = 'ADM3'
    AND (
      ab.parent_pcode = ANY(isc.admin_scope)
      OR EXISTS (
        SELECT 1 FROM unnest(isc.admin_scope) AS adm2_code
        WHERE ab.admin_pcode LIKE adm2_code || '%'
      )
    )
)
SELECT 
  'Total Population' AS metric,
  COALESCE(SUM(dvn.value), 0) AS value
FROM dataset_values_numeric dvn
INNER JOIN admin_boundaries ab4 ON ab4.admin_pcode = dvn.admin_pcode
INNER JOIN admin_boundaries ab3 ON ab3.admin_pcode = ab4.parent_pcode
INNER JOIN affected_codes ac ON ac.admin_pcode = ab3.admin_pcode
CROSS JOIN instance_scope isc
WHERE dvn.dataset_id = COALESCE(isc.population_dataset_id, 'b35ef28d-2cd4-41aa-b2bd-bfda4b58a051'::UUID)
  AND UPPER(TRIM(ab4.admin_level)) = 'ADM4'
  AND UPPER(TRIM(ab3.admin_level)) = 'ADM3';

