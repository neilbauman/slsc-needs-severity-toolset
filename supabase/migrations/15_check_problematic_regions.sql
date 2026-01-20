-- ==============================
-- CHECK PROBLEMATIC ADM1 REGIONS
-- ==============================
-- Diagnostic query to check if specific ADM1 regions have data issues

-- Check ADM1 regions and their ADM2/ADM3 counts
DO $$
DECLARE
  v_geom_col TEXT;
BEGIN
  -- Detect geometry column
  SELECT column_name INTO v_geom_col
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'admin_boundaries'
    AND column_name IN ('geom', 'geometry')
  ORDER BY CASE column_name WHEN 'geom' THEN 1 ELSE 2 END
  LIMIT 1;
  
  IF v_geom_col IS NULL THEN
    v_geom_col := 'geometry';
  END IF;
  
  IF v_geom_col = 'geom' THEN
    EXECUTE format('
      SELECT 
        ab1.admin_pcode AS adm1_pcode,
        ab1.name AS adm1_name,
        COUNT(DISTINCT ab2.admin_pcode) AS adm2_count,
        COUNT(DISTINCT ab3.admin_pcode) AS adm3_count,
        COUNT(DISTINCT CASE WHEN ab3.geom IS NOT NULL THEN ab3.admin_pcode END) AS adm3_with_geometry
      FROM public.admin_boundaries ab1
      LEFT JOIN public.admin_boundaries ab2 
        ON ab2.parent_pcode = ab1.admin_pcode 
        AND UPPER(TRIM(ab2.admin_level)) = ''ADM2''
      LEFT JOIN public.admin_boundaries ab3 
        ON ab3.parent_pcode = ab2.admin_pcode 
        AND UPPER(TRIM(ab3.admin_level)) = ''ADM3''
      WHERE UPPER(TRIM(ab1.admin_level)) = ''ADM1''
        AND ab1.admin_pcode IN (''PH08'', ''PH12'', ''PH10'', ''PH07'', ''PH11'')
      GROUP BY ab1.admin_pcode, ab1.name
      ORDER BY ab1.name;
    ');
  ELSE
    EXECUTE format('
      SELECT 
        ab1.admin_pcode AS adm1_pcode,
        ab1.name AS adm1_name,
        COUNT(DISTINCT ab2.admin_pcode) AS adm2_count,
        COUNT(DISTINCT ab3.admin_pcode) AS adm3_count,
        COUNT(DISTINCT CASE WHEN ab3.geometry IS NOT NULL THEN ab3.admin_pcode END) AS adm3_with_geometry
      FROM public.admin_boundaries ab1
      LEFT JOIN public.admin_boundaries ab2 
        ON ab2.parent_pcode = ab1.admin_pcode 
        AND UPPER(TRIM(ab2.admin_level)) = ''ADM2''
      LEFT JOIN public.admin_boundaries ab3 
        ON ab3.parent_pcode = ab2.admin_pcode 
        AND UPPER(TRIM(ab3.admin_level)) = ''ADM3''
      WHERE UPPER(TRIM(ab1.admin_level)) = ''ADM1''
        AND ab1.admin_pcode IN (''PH08'', ''PH12'', ''PH10'', ''PH07'', ''PH11'')
      GROUP BY ab1.admin_pcode, ab1.name
      ORDER BY ab1.name;
    ');
  END IF;
END $$;

-- Check if these regions have any ADM2s at all
SELECT 
  ab1.admin_pcode AS adm1_pcode,
  ab1.name AS adm1_name,
  ab2.admin_pcode AS adm2_pcode,
  ab2.name AS adm2_name,
  COUNT(DISTINCT ab3.admin_pcode) AS adm3_count
FROM public.admin_boundaries ab1
LEFT JOIN public.admin_boundaries ab2 
  ON ab2.parent_pcode = ab1.admin_pcode 
  AND UPPER(TRIM(ab2.admin_level)) = 'ADM2'
LEFT JOIN public.admin_boundaries ab3 
  ON ab3.parent_pcode = ab2.admin_pcode 
  AND UPPER(TRIM(ab3.admin_level)) = 'ADM3'
WHERE UPPER(TRIM(ab1.admin_level)) = 'ADM1'
  AND ab1.admin_pcode IN ('PH08', 'PH12', 'PH10', 'PH07', 'PH11')
GROUP BY ab1.admin_pcode, ab1.name, ab2.admin_pcode, ab2.name
ORDER BY ab1.name, ab2.name
LIMIT 50;

-- Check total ADM3 count when all regions are selected vs when problematic ones are excluded
SELECT 
  'All regions' AS scenario,
  COUNT(DISTINCT ab3.admin_pcode) AS total_adm3_count
FROM public.admin_boundaries ab1
INNER JOIN public.admin_boundaries ab2 ON ab2.parent_pcode = ab1.admin_pcode AND UPPER(TRIM(ab2.admin_level)) = 'ADM2'
INNER JOIN public.admin_boundaries ab3 ON ab3.parent_pcode = ab2.admin_pcode AND UPPER(TRIM(ab3.admin_level)) = 'ADM3'
WHERE UPPER(TRIM(ab1.admin_level)) = 'ADM1'

UNION ALL

SELECT 
  'Without problematic regions' AS scenario,
  COUNT(DISTINCT ab3.admin_pcode) AS total_adm3_count
FROM public.admin_boundaries ab1
INNER JOIN public.admin_boundaries ab2 ON ab2.parent_pcode = ab1.admin_pcode AND UPPER(TRIM(ab2.admin_level)) = 'ADM2'
INNER JOIN public.admin_boundaries ab3 ON ab3.parent_pcode = ab2.admin_pcode AND UPPER(TRIM(ab3.admin_level)) = 'ADM3'
WHERE UPPER(TRIM(ab1.admin_level)) = 'ADM1'
  AND ab1.admin_pcode NOT IN ('PH08', 'PH12', 'PH10', 'PH07', 'PH11');
