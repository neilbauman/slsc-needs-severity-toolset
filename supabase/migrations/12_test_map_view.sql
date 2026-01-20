-- ==============================
-- TEST AND DIAGNOSE MAP VIEW
-- ==============================
-- Run this to check why the map view might not be returning data

-- First, check what geometry column exists
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'admin_boundaries'
  AND column_name IN ('geom', 'geometry')
ORDER BY column_name;

-- Check if the view exists and what it returns for a specific instance
-- Replace 'YOUR_INSTANCE_ID' with the actual instance ID
SELECT 
  'View row count' AS check_type,
  COUNT(*)::TEXT AS result
FROM public.v_instance_admin_scores_geojson
WHERE instance_id = '5197ced7-a93e-4548-a482-07a5f1c123ed'::UUID;

-- Check instance admin_scope
SELECT 
  'Instance admin_scope' AS check_type,
  COALESCE(array_length(admin_scope, 1), 0)::TEXT AS result,
  admin_scope::TEXT AS details
FROM public.instances
WHERE id = '5197ced7-a93e-4548-a482-07a5f1c123ed'::UUID;

-- Check affected ADM3 areas directly
SELECT 
  'Affected ADM3 count' AS check_type,
  COUNT(DISTINCT ab.admin_pcode)::TEXT AS result
FROM public.instances i
INNER JOIN public.admin_boundaries ab 
  ON ab.country_id = i.country_id
  AND UPPER(TRIM(ab.admin_level)) = 'ADM3'
  AND (
    (i.admin_scope IS NOT NULL AND array_length(i.admin_scope, 1) > 0 AND ab.parent_pcode = ANY(i.admin_scope))
    OR
    (i.admin_scope IS NOT NULL AND array_length(i.admin_scope, 1) > 0 AND EXISTS (
      SELECT 1 FROM unnest(i.admin_scope) AS adm2_code
      WHERE ab.admin_pcode LIKE adm2_code || '%'
    ))
  )
WHERE i.id = '5197ced7-a93e-4548-a482-07a5f1c123ed'::UUID;

-- Check if geometry exists for affected areas (check both column names)
SELECT 
  'Geometry check (geom)' AS check_type,
  COUNT(*)::TEXT AS result
FROM public.instances i
INNER JOIN public.admin_boundaries ab 
  ON ab.country_id = i.country_id
  AND UPPER(TRIM(ab.admin_level)) = 'ADM3'
  AND (
    (i.admin_scope IS NOT NULL AND array_length(i.admin_scope, 1) > 0 AND ab.parent_pcode = ANY(i.admin_scope))
    OR
    (i.admin_scope IS NOT NULL AND array_length(i.admin_scope, 1) > 0 AND EXISTS (
      SELECT 1 FROM unnest(i.admin_scope) AS adm2_code
      WHERE ab.admin_pcode LIKE adm2_code || '%'
    ))
  )
WHERE i.id = '5197ced7-a93e-4548-a482-07a5f1c123ed'::UUID
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admin_boundaries' AND column_name = 'geom'
  )
  AND ab.geom IS NOT NULL;

SELECT 
  'Geometry check (geometry)' AS check_type,
  COUNT(*)::TEXT AS result
FROM public.instances i
INNER JOIN public.admin_boundaries ab 
  ON ab.country_id = i.country_id
  AND UPPER(TRIM(ab.admin_level)) = 'ADM3'
  AND (
    (i.admin_scope IS NOT NULL AND array_length(i.admin_scope, 1) > 0 AND ab.parent_pcode = ANY(i.admin_scope))
    OR
    (i.admin_scope IS NOT NULL AND array_length(i.admin_scope, 1) > 0 AND EXISTS (
      SELECT 1 FROM unnest(i.admin_scope) AS adm2_code
      WHERE ab.admin_pcode LIKE adm2_code || '%'
    ))
  )
WHERE i.id = '5197ced7-a93e-4548-a482-07a5f1c123ed'::UUID
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admin_boundaries' AND column_name = 'geometry'
  )
  AND ab.geometry IS NOT NULL;

-- Sample a few rows from the view to see what's being returned
SELECT 
  instance_id,
  admin_pcode,
  CASE 
    WHEN geojson IS NULL THEN 'NULL geojson'
    WHEN jsonb_typeof(geojson) = 'object' THEN 'Valid GeoJSON object'
    ELSE 'Unexpected format: ' || jsonb_typeof(geojson)
  END AS geojson_status
FROM public.v_instance_admin_scores_geojson
WHERE instance_id = '5197ced7-a93e-4548-a482-07a5f1c123ed'::UUID
LIMIT 5;
