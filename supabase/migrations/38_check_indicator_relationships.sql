-- Diagnostic query to check for orphaned or mismatched indicators
-- Run this to identify indicators that don't properly match up with their subthemes/themes/pillars

-- Check for orphaned indicators (indicators with invalid subtheme_id)
SELECT 
  'Orphaned Indicators' as issue_type,
  i.id,
  i.code,
  i.name,
  i.subtheme_id,
  'Subtheme does not exist' as problem
FROM framework_indicators i
LEFT JOIN framework_subthemes st ON i.subtheme_id = st.id
WHERE st.id IS NULL AND i.is_active = true;

-- Check for indicators with subthemes that have invalid theme_id
SELECT 
  'Indicators with orphaned subthemes' as issue_type,
  i.id as indicator_id,
  i.code as indicator_code,
  i.name as indicator_name,
  st.id as subtheme_id,
  st.code as subtheme_code,
  st.theme_id,
  'Subtheme has invalid theme_id' as problem
FROM framework_indicators i
JOIN framework_subthemes st ON i.subtheme_id = st.id
LEFT JOIN framework_themes t ON st.theme_id = t.id
WHERE t.id IS NULL AND i.is_active = true AND st.is_active = true;

-- Check for indicators with themes that have invalid pillar_id
SELECT 
  'Indicators with orphaned themes' as issue_type,
  i.id as indicator_id,
  i.code as indicator_code,
  i.name as indicator_name,
  st.code as subtheme_code,
  t.id as theme_id,
  t.code as theme_code,
  t.pillar_id,
  'Theme has invalid pillar_id' as problem
FROM framework_indicators i
JOIN framework_subthemes st ON i.subtheme_id = st.id
JOIN framework_themes t ON st.theme_id = t.id
LEFT JOIN framework_pillars p ON t.pillar_id = p.id
WHERE p.id IS NULL AND i.is_active = true AND st.is_active = true AND t.is_active = true;

-- Summary: Count indicators by hierarchy level
SELECT 
  'Summary' as report_type,
  COUNT(DISTINCT p.id) as total_pillars,
  COUNT(DISTINCT t.id) as total_themes,
  COUNT(DISTINCT st.id) as total_subthemes,
  COUNT(DISTINCT i.id) as total_indicators,
  COUNT(DISTINCT CASE WHEN st.id IS NULL THEN i.id END) as orphaned_indicators,
  COUNT(DISTINCT CASE WHEN t.id IS NULL THEN i.id END) as indicators_with_orphaned_subthemes,
  COUNT(DISTINCT CASE WHEN p.id IS NULL THEN i.id END) as indicators_with_orphaned_themes
FROM framework_indicators i
LEFT JOIN framework_subthemes st ON i.subtheme_id = st.id
LEFT JOIN framework_themes t ON st.theme_id = t.id
LEFT JOIN framework_pillars p ON t.pillar_id = p.id
WHERE i.is_active = true;

-- Show full hierarchy path for all indicators (to verify relationships)
SELECT 
  p.code as pillar_code,
  p.name as pillar_name,
  t.code as theme_code,
  t.name as theme_name,
  st.code as subtheme_code,
  st.name as subtheme_name,
  i.code as indicator_code,
  i.name as indicator_name,
  CASE 
    WHEN p.id IS NULL THEN 'MISSING PILLAR'
    WHEN t.id IS NULL THEN 'MISSING THEME'
    WHEN st.id IS NULL THEN 'MISSING SUBTHEME'
    ELSE 'OK'
  END as status
FROM framework_indicators i
LEFT JOIN framework_subthemes st ON i.subtheme_id = st.id
LEFT JOIN framework_themes t ON st.theme_id = t.id
LEFT JOIN framework_pillars p ON t.pillar_id = p.id
WHERE i.is_active = true
ORDER BY p.code, t.code, st.code, i.code;
