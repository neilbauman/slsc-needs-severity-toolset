-- Fix user_countries assignments
-- Run this in your Supabase SQL Editor

-- First, check if there are any user_countries assignments
SELECT 
  uc.user_id,
  u.email,
  uc.country_id,
  uc.role,
  c.name as country_name
FROM user_countries uc
LEFT JOIN auth.users u ON u.id = uc.user_id
LEFT JOIN countries c ON c.id = uc.country_id
ORDER BY u.email, c.name;

-- Check all active countries
SELECT id, iso_code, name, active FROM countries WHERE active = true ORDER BY name;

-- Check your user ID
SELECT id, email FROM auth.users WHERE email = 'neil.bauman@sheltercluster.org';

-- If you need to add yourself as admin for all countries, run this:
-- Replace 'YOUR_USER_ID' with your actual user ID from the query above

/*
INSERT INTO user_countries (user_id, country_id, role)
SELECT 
  'YOUR_USER_ID'::uuid,
  c.id,
  'admin'
FROM countries c
WHERE c.active = true
ON CONFLICT (user_id, country_id) DO UPDATE SET role = 'admin';
*/

-- OR add yourself as admin for specific countries by ID:
/*
INSERT INTO user_countries (user_id, country_id, role)
VALUES 
  ('YOUR_USER_ID'::uuid, 'COUNTRY_ID_1'::uuid, 'admin'),
  ('YOUR_USER_ID'::uuid, 'COUNTRY_ID_2'::uuid, 'admin')
ON CONFLICT (user_id, country_id) DO UPDATE SET role = 'admin';
*/
