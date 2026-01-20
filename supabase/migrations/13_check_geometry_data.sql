-- ==============================
-- CHECK GEOMETRY DATA IN ADMIN_BOUNDARIES
-- ==============================
-- Run this to see if geometry data exists at all

-- Check which geometry column exists
SELECT 
  'Geometry Column Check' AS check_type,
  column_name AS result,
  'Column that exists in admin_boundaries' AS message
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'admin_boundaries'
  AND column_name IN ('geom', 'geometry')
ORDER BY column_name;

-- Check total geometry data (all admin levels, all countries)
-- Use DO block to check which column exists first
DO $$
DECLARE
  has_geom BOOLEAN;
  has_geometry BOOLEAN;
  geom_count BIGINT;
BEGIN
  -- Check which columns exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admin_boundaries' AND column_name = 'geom'
  ) INTO has_geom;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admin_boundaries' AND column_name = 'geometry'
  ) INTO has_geometry;
  
  -- Count based on which column exists
  IF has_geom THEN
    SELECT COUNT(*) INTO geom_count FROM public.admin_boundaries WHERE geom IS NOT NULL;
    RAISE NOTICE 'Total Geometry Data (geom): % rows', geom_count;
    
    SELECT COUNT(*) INTO geom_count FROM public.admin_boundaries 
    WHERE UPPER(TRIM(admin_level)) = 'ADM3' AND geom IS NOT NULL;
    RAISE NOTICE 'ADM3 Geometry Data (geom): % rows', geom_count;
  ELSIF has_geometry THEN
    SELECT COUNT(*) INTO geom_count FROM public.admin_boundaries WHERE geometry IS NOT NULL;
    RAISE NOTICE 'Total Geometry Data (geometry): % rows', geom_count;
    
    SELECT COUNT(*) INTO geom_count FROM public.admin_boundaries 
    WHERE UPPER(TRIM(admin_level)) = 'ADM3' AND geometry IS NOT NULL;
    RAISE NOTICE 'ADM3 Geometry Data (geometry): % rows', geom_count;
  ELSE
    RAISE NOTICE 'No geometry column found in admin_boundaries table';
  END IF;
END $$;

-- Check geometry data for Philippines specifically (using a simpler approach)
SELECT 
  'Philippines ADM3 Geometry' AS check_type,
  COUNT(*)::TEXT AS result,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'admin_boundaries' AND column_name = 'geom')
      THEN 'Philippines ADM3 rows with geom'
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'admin_boundaries' AND column_name = 'geometry')
      THEN 'Philippines ADM3 rows with geometry'
    ELSE 'No geometry column'
  END AS message
FROM public.admin_boundaries ab
INNER JOIN public.countries c ON c.id = ab.country_id
WHERE UPPER(TRIM(ab.admin_level)) = 'ADM3'
  AND LOWER(c.name) = 'philippines';

-- Sample a few admin_boundaries rows to see what data exists
-- This query will work regardless of which geometry column exists
SELECT 
  admin_pcode,
  admin_level,
  country_id,
  name,
  parent_pcode
FROM public.admin_boundaries
WHERE UPPER(TRIM(admin_level)) = 'ADM3'
LIMIT 5;
