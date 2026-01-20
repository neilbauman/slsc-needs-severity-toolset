-- ==============================
-- CHECK COUNTRY BOUNDARIES
-- ==============================
-- Diagnostic query to check if admin_boundaries have correct country_id

-- Check how many boundaries exist for each country
SELECT 
  c.name as country_name,
  c.iso_code,
  COUNT(ab.admin_pcode) as boundary_count,
  COUNT(DISTINCT ab.admin_level) as admin_levels
FROM countries c
LEFT JOIN admin_boundaries ab ON ab.country_id = c.id
WHERE c.active = true
GROUP BY c.id, c.name, c.iso_code
ORDER BY c.name;

-- Check boundaries with NULL country_id
SELECT 
  COUNT(*) as null_country_count,
  COUNT(DISTINCT admin_level) as admin_levels
FROM admin_boundaries
WHERE country_id IS NULL;

-- Check boundaries for a specific country (replace with actual country ID)
-- SELECT 
--   admin_level,
--   COUNT(*) as count,
--   COUNT(DISTINCT admin_pcode) as unique_pcodes
-- FROM admin_boundaries
-- WHERE country_id = 'your-country-id-here'
-- GROUP BY admin_level
-- ORDER BY admin_level;
