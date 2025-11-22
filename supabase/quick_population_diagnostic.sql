-- ==============================
-- QUICK ALL-IN-ONE DIAGNOSTIC
-- ==============================
-- This single query shows everything at once

WITH instance_info AS (
  SELECT 
    id,
    name,
    population_dataset_id,
    admin_scope,
    array_length(admin_scope, 1) AS admin_scope_count
  FROM instances
  WHERE id = '5197ced7-a93e-4548-a482-07a5f1c123ed'::UUID
),
affected_codes AS (
  SELECT DISTINCT ab.admin_pcode
  FROM admin_boundaries ab
  CROSS JOIN instance_info ii
  WHERE ab.admin_level = 'ADM3'
    AND (
      ab.parent_pcode = ANY(ii.admin_scope)
      OR EXISTS (
        SELECT 1 FROM unnest(ii.admin_scope) AS adm2_code
        WHERE ab.admin_pcode LIKE adm2_code || '%'
      )
    )
),
auto_detected_pop AS (
  SELECT id
  FROM datasets
  WHERE (name ILIKE '%population%' OR name ILIKE '%pop%')
    AND type = 'numeric'
    AND admin_level IN ('ADM3', 'ADM4')
  ORDER BY 
    CASE WHEN name ILIKE '%population%' THEN 1 ELSE 2 END,
    created_at DESC
  LIMIT 1
),
population_dataset AS (
  SELECT COALESCE(ii.population_dataset_id, adp.id) AS dataset_id
  FROM instance_info ii
  LEFT JOIN auto_detected_pop adp ON ii.population_dataset_id IS NULL
),
main_diagnostic AS (
  SELECT 
    'Instance Info' AS check_type,
    ii.name AS instance_name,
    ii.population_dataset_id AS configured_pop_id,
    pd.dataset_id AS used_pop_id,
    d.name AS population_dataset_name,
    d.admin_level AS pop_admin_level,
    ii.admin_scope_count,
    (SELECT COUNT(*) FROM affected_codes) AS affected_adm3_count,
    (SELECT COUNT(DISTINCT dvn.admin_pcode) 
     FROM dataset_values_numeric dvn 
     WHERE dvn.dataset_id = pd.dataset_id 
       AND dvn.admin_pcode IN (SELECT admin_pcode FROM affected_codes)) AS codes_with_data,
    (SELECT COALESCE(SUM(dvn.value), 0)
     FROM dataset_values_numeric dvn 
     WHERE dvn.dataset_id = pd.dataset_id 
       AND dvn.admin_pcode IN (SELECT admin_pcode FROM affected_codes)) AS total_population
  FROM instance_info ii
  CROSS JOIN population_dataset pd
  LEFT JOIN datasets d ON d.id = pd.dataset_id
)
SELECT * FROM main_diagnostic
UNION ALL
SELECT 
  'Sample Data' AS check_type,
  ac.admin_pcode AS instance_name,
  NULL AS configured_pop_id,
  NULL AS used_pop_id,
  ab.name AS population_dataset_name,
  NULL AS pop_admin_level,
  NULL AS admin_scope_count,
  NULL AS affected_adm3_count,
  NULL AS codes_with_data,
  dvn.value AS total_population
FROM affected_codes ac
LEFT JOIN admin_boundaries ab ON ab.admin_pcode = ac.admin_pcode AND ab.admin_level = 'ADM3'
LEFT JOIN population_dataset pd ON 1=1
LEFT JOIN dataset_values_numeric dvn ON dvn.dataset_id = pd.dataset_id
  AND dvn.admin_pcode = ac.admin_pcode
ORDER BY check_type, instance_name
LIMIT 25;

