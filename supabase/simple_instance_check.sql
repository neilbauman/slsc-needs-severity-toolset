-- Simple check: Does the instance exist and what's its config?
SELECT 
  id,
  name,
  population_dataset_id,
  admin_scope,
  array_length(admin_scope, 1) AS admin_scope_count
FROM instances
WHERE id = '5197ced7-a93e-4548-a482-07a5f1c123ed'::UUID;

-- Check if population dataset exists
SELECT 
  id,
  name,
  type,
  admin_level,
  (SELECT COUNT(*) FROM dataset_values_numeric WHERE dataset_id = d.id) AS value_count
FROM datasets d
WHERE id = (
  SELECT population_dataset_id 
  FROM instances 
  WHERE id = '5197ced7-a93e-4548-a482-07a5f1c123ed'::UUID
)
OR (name ILIKE '%population%' OR name ILIKE '%pop%')
ORDER BY 
  CASE WHEN name ILIKE '%population%' THEN 1 ELSE 2 END,
  created_at DESC
LIMIT 5;

