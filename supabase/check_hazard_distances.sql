-- ==============================
-- DIAGNOSTIC QUERY: Check Hazard Event Distances
-- ==============================
-- Run this query to see what distance values were stored for a hazard event
-- Replace the hazard_event_id with your actual hazard event ID

-- Example: Check distances for a specific hazard event
SELECT 
  hes.admin_pcode,
  ab.name AS admin_name,
  hes.score,
  hes.magnitude_value AS distance_meters,
  ROUND((hes.magnitude_value / 1000.0)::NUMERIC, 2) AS distance_km,
  hes.computed_at
FROM hazard_event_scores hes
LEFT JOIN admin_boundaries ab ON ab.admin_pcode = hes.admin_pcode AND ab.admin_level = 'ADM3'
WHERE hes.hazard_event_id = '1c21d28c-e640-4c3d-ba4e-2caea870a2a9'  -- Replace with your hazard event ID
ORDER BY hes.magnitude_value ASC;

-- Summary statistics
SELECT 
  COUNT(*) AS total_locations,
  MIN(hes.magnitude_value) AS min_distance_m,
  MAX(hes.magnitude_value) AS max_distance_m,
  AVG(hes.magnitude_value) AS avg_distance_m,
  COUNT(CASE WHEN hes.score = 5 THEN 1 END) AS locations_with_score_5,
  COUNT(CASE WHEN hes.score = 4 THEN 1 END) AS locations_with_score_4,
  COUNT(CASE WHEN hes.score = 3 THEN 1 END) AS locations_with_score_3,
  COUNT(CASE WHEN hes.score = 2 THEN 1 END) AS locations_with_score_2,
  COUNT(CASE WHEN hes.score = 1 THEN 1 END) AS locations_with_score_1
FROM hazard_event_scores hes
WHERE hes.hazard_event_id = '1c21d28c-e640-4c3d-ba4e-2caea870a2a9';  -- Replace with your hazard event ID

