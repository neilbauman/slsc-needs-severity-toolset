-- ==============================
-- SETUP VERIFICATION SCRIPT
-- ==============================
-- Run this in your dev Supabase SQL Editor after setup
-- Share the output if you need help troubleshooting

-- Check countries
SELECT 
  iso_code,
  name,
  active,
  created_at
FROM countries
ORDER BY iso_code;

-- Check user country assignments
SELECT 
  u.email,
  c.name as country_name,
  c.iso_code,
  uc.role,
  uc.created_at
FROM auth.users u
LEFT JOIN user_countries uc ON u.id = uc.user_id
LEFT JOIN countries c ON uc.country_id = c.id
ORDER BY u.email, c.name;

-- Check users without country assignments
SELECT 
  u.id,
  u.email,
  u.created_at
FROM auth.users u
LEFT JOIN user_countries uc ON u.id = uc.user_id
WHERE uc.id IS NULL;

-- Check data migration status
SELECT 
  'datasets' as table_name,
  COUNT(*) as total_rows,
  COUNT(country_id) as with_country_id,
  COUNT(*) - COUNT(country_id) as missing_country_id
FROM datasets
UNION ALL
SELECT 
  'instances',
  COUNT(*),
  COUNT(country_id),
  COUNT(*) - COUNT(country_id)
FROM instances
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'instances')
UNION ALL
SELECT 
  'admin_boundaries',
  COUNT(*),
  COUNT(country_id),
  COUNT(*) - COUNT(country_id)
FROM admin_boundaries
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_boundaries');

-- Check indexes
SELECT 
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE '%country_id%'
ORDER BY tablename, indexname;

-- Summary
DO $$
DECLARE
  country_count INTEGER;
  user_count INTEGER;
  assignment_count INTEGER;
  users_without_countries INTEGER;
  datasets_with_country INTEGER;
  datasets_total INTEGER;
BEGIN
  SELECT COUNT(*) INTO country_count FROM countries;
  SELECT COUNT(*) INTO user_count FROM auth.users;
  SELECT COUNT(*) INTO assignment_count FROM user_countries;
  SELECT COUNT(*) INTO users_without_countries 
  FROM auth.users u
  LEFT JOIN user_countries uc ON u.id = uc.user_id
  WHERE uc.id IS NULL;
  
  SELECT COUNT(*), COUNT(country_id) 
  INTO datasets_total, datasets_with_country
  FROM datasets;
  
  RAISE NOTICE 'Countries: %', country_count;
  RAISE NOTICE 'Users: %', user_count;
  RAISE NOTICE 'Country Assignments: %', assignment_count;
  RAISE NOTICE 'Users without countries: %', users_without_countries;
  RAISE NOTICE 'Datasets: % total, % with country_id', datasets_total, datasets_with_country;
  
  IF country_count = 0 THEN
    RAISE WARNING '⚠ No countries found - run add_countries.sql';
  END IF;
  
  IF users_without_countries > 0 THEN
    RAISE WARNING '⚠ % users without country assignments - run assign_test_user_countries.sql', users_without_countries;
  END IF;
  
  IF datasets_total > 0 AND datasets_with_country < datasets_total THEN
    RAISE WARNING '⚠ Some datasets missing country_id - check migration';
  END IF;
  
  IF country_count > 0 AND assignment_count > 0 AND datasets_with_country = datasets_total THEN
    RAISE NOTICE '✅ Setup looks good!';
  END IF;
END $$;
