-- ==============================
-- CHECK GEOMETRY DATA AVAILABILITY
-- ==============================
-- Run this in your TARGET database to check what's missing

-- 1. Check if admin_boundaries has geometry data
SELECT 
  'admin_boundaries' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN geometry IS NOT NULL THEN 1 END) as with_geometry,
  COUNT(CASE WHEN geom IS NOT NULL THEN 1 END) as with_geom,
  COUNT(CASE WHEN geometry IS NULL AND geom IS NULL THEN 1 END) as missing_geometry
FROM public.admin_boundaries
WHERE country_id = (SELECT id FROM public.countries WHERE iso_code = 'PHL' LIMIT 1);

-- 2. Check if instance_category_scores has 'Overall' category scores
SELECT 
  'instance_category_scores' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN category = 'Overall' THEN 1 END) as overall_scores,
  COUNT(DISTINCT instance_id) as instances_with_scores
FROM public.instance_category_scores;

-- 3. Check specific instance (replace with your instance ID)
-- Replace 'fda79464-f087-4ddf-8eee-e6b87ccc9978' with your actual instance ID
SELECT 
  'Instance Check' as check_type,
  i.name as instance_name,
  COUNT(DISTINCT ics.admin_pcode) as locations_with_scores,
  COUNT(DISTINCT ab.admin_pcode) as locations_with_geometry,
  COUNT(DISTINCT CASE WHEN ics.admin_pcode = ab.admin_pcode THEN ics.admin_pcode END) as locations_with_both
FROM public.instances i
LEFT JOIN public.instance_category_scores ics ON ics.instance_id = i.id AND ics.category = 'Overall'
LEFT JOIN public.admin_boundaries ab ON ab.admin_pcode = ics.admin_pcode 
  AND ab.admin_level = 'ADM3' 
  AND ab.country_id = i.country_id
  AND (ab.geometry IS NOT NULL OR ab.geom IS NOT NULL)
WHERE i.id = 'fda79464-f087-4ddf-8eee-e6b87ccc9978'
GROUP BY i.id, i.name;

-- 4. Check what the view would return
SELECT 
  'v_instance_admin_scores_geojson' as view_name,
  COUNT(*) as records_in_view
FROM public.v_instance_admin_scores_geojson
WHERE instance_id = 'fda79464-f087-4ddf-8eee-e6b87ccc9978';

-- 5. Sample admin_boundaries to see if geometry exists
SELECT 
  admin_pcode,
  admin_level,
  name,
  CASE 
    WHEN geometry IS NOT NULL THEN 'Has geometry column'
    WHEN geom IS NOT NULL THEN 'Has geom column'
    ELSE 'No geometry'
  END as geometry_status
FROM public.admin_boundaries
WHERE country_id = (SELECT id FROM public.countries WHERE iso_code = 'PHL' LIMIT 1)
  AND admin_level = 'ADM3'
LIMIT 10;
