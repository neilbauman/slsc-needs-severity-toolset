-- ==============================
-- ASSIGN COUNTRIES TO TEST USERS
-- ==============================
-- Run this AFTER creating test users in Supabase Auth
-- 
-- Instructions:
-- 1. First, get your user IDs by running:
--    SELECT id, email FROM auth.users;
-- 2. Replace USER_EMAIL_HERE with actual email addresses below
-- 3. Or use user IDs directly (more reliable)

-- ==============================
-- OPTION 1: Assign by Email
-- ==============================
-- Replace 'your-email@example.com' with actual user email

DO $$
DECLARE
  user_uuid UUID;
  phl_country_id UUID;
  bgd_country_id UUID;
BEGIN
  -- Get country IDs
  SELECT id INTO phl_country_id FROM countries WHERE iso_code = 'PHL';
  SELECT id INTO bgd_country_id FROM countries WHERE iso_code = 'BGD';
  
  -- Example: Assign Philippines to a user
  -- Replace 'test@example.com' with actual email
  SELECT id INTO user_uuid FROM auth.users WHERE email = 'test@example.com';
  
  IF user_uuid IS NOT NULL THEN
    INSERT INTO user_countries (user_id, country_id, role)
    VALUES (user_uuid, phl_country_id, 'user')
    ON CONFLICT (user_id, country_id) DO NOTHING;
    
    RAISE NOTICE 'Assigned Philippines to user: test@example.com';
  ELSE
    RAISE WARNING 'User not found: test@example.com';
  END IF;
END $$;

-- ==============================
-- OPTION 2: Assign by User ID (More Reliable)
-- ==============================
-- First, get user IDs:
-- SELECT id, email FROM auth.users;

-- Then uncomment and replace USER_ID_HERE with actual UUID:

-- INSERT INTO user_countries (user_id, country_id, role)
-- VALUES (
--   'USER_ID_HERE'::UUID,  -- Replace with actual user ID
--   (SELECT id FROM countries WHERE iso_code = 'PHL'),
--   'user'  -- or 'admin' for site admin
-- )
-- ON CONFLICT (user_id, country_id) DO NOTHING;

-- ==============================
-- CREATE A SITE ADMIN
-- ==============================
-- Site admins can access all countries
-- Uncomment and replace ADMIN_USER_ID_HERE:

-- INSERT INTO user_countries (user_id, country_id, role)
-- VALUES (
--   'ADMIN_USER_ID_HERE'::UUID,  -- Replace with admin user ID
--   (SELECT id FROM countries WHERE iso_code = 'PHL'),
--   'admin'  -- Site admin role
-- )
-- ON CONFLICT (user_id, country_id) DO UPDATE SET role = 'admin';

-- ==============================
-- QUICK REFERENCE QUERIES
-- ==============================

-- View all users and their country assignments:
-- SELECT 
--   u.email,
--   c.name as country_name,
--   uc.role
-- FROM auth.users u
-- JOIN user_countries uc ON u.id = uc.user_id
-- JOIN countries c ON uc.country_id = c.id
-- ORDER BY u.email, c.name;

-- View users without country assignments:
-- SELECT 
--   u.id,
--   u.email,
--   u.created_at
-- FROM auth.users u
-- LEFT JOIN user_countries uc ON u.id = uc.user_id
-- WHERE uc.id IS NULL;
