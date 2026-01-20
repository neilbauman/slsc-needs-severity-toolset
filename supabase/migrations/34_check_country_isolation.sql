-- ==============================
-- DIAGNOSTIC: Check Country Isolation
-- ==============================
-- This migration provides diagnostic queries to check if data is properly isolated by country

-- Check datasets by country
SELECT 
  c.name AS country_name,
  c.iso_code,
  COUNT(d.id) AS dataset_count
FROM countries c
LEFT JOIN datasets d ON d.country_id = c.id
GROUP BY c.id, c.name, c.iso_code
ORDER BY c.name;

-- Check instances by country
SELECT 
  c.name AS country_name,
  c.iso_code,
  COUNT(i.id) AS instance_count
FROM countries c
LEFT JOIN instances i ON i.country_id = c.id
GROUP BY c.id, c.name, c.iso_code
ORDER BY c.name;

-- Check admin boundaries by country
SELECT 
  c.name AS country_name,
  c.iso_code,
  ab.admin_level,
  COUNT(ab.admin_pcode) AS boundary_count
FROM countries c
LEFT JOIN admin_boundaries ab ON ab.country_id = c.id
GROUP BY c.id, c.name, c.iso_code, ab.admin_level
ORDER BY c.name, ab.admin_level;

-- Check for datasets with wrong country_id (if any datasets reference non-existent countries)
SELECT 
  d.id,
  d.name,
  d.country_id,
  c.name AS country_name
FROM datasets d
LEFT JOIN countries c ON c.id = d.country_id
WHERE c.id IS NULL;

-- Check for instances with wrong country_id
SELECT 
  i.id,
  i.name,
  i.country_id,
  c.name AS country_name
FROM instances i
LEFT JOIN countries c ON c.id = i.country_id
WHERE c.id IS NULL;

-- Check for admin_boundaries with wrong country_id
SELECT 
  ab.admin_pcode,
  ab.name,
  ab.admin_level,
  ab.country_id,
  c.name AS country_name
FROM admin_boundaries ab
LEFT JOIN countries c ON c.id = ab.country_id
WHERE c.id IS NULL
LIMIT 100;

-- Check instance_datasets links that cross country boundaries (should be 0)
SELECT 
  id.id,
  id.instance_id,
  id.dataset_id,
  i.country_id AS instance_country_id,
  d.country_id AS dataset_country_id,
  ci.name AS instance_country,
  cd.name AS dataset_country
FROM instance_datasets id
JOIN instances i ON i.id = id.instance_id
JOIN datasets d ON d.id = id.dataset_id
LEFT JOIN countries ci ON ci.id = i.country_id
LEFT JOIN countries cd ON cd.id = d.country_id
WHERE i.country_id != d.country_id;
