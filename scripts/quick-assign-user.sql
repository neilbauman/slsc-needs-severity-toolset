-- ==============================
-- QUICK USER COUNTRY ASSIGNMENT
-- ==============================
-- Easy script to assign a country to a user
-- 
-- INSTRUCTIONS:
-- 1. Get your user ID: SELECT id, email FROM auth.users;
-- 2. Replace YOUR_EMAIL_HERE with your email below
-- 3. Or replace YOUR_USER_ID_HERE with the UUID directly
-- 4. Run this script

-- ==============================
-- OPTION 1: Assign by Email
-- ==============================
DO $$
DECLARE
  user_email TEXT := 'YOUR_EMAIL_HERE';  -- Replace with your email
  user_uuid UUID;
  phl_country_id UUID;
  user_role TEXT := 'user';  -- Change to 'admin' for site admin
BEGIN
  -- Find user by email
  SELECT id INTO user_uuid 
  FROM auth.users 
  WHERE email = user_email;
  
  IF user_uuid IS NULL THEN
    RAISE EXCEPTION 'User not found with email: %', user_email;
  END IF;
  
  -- Get Philippines country
  SELECT id INTO phl_country_id 
  FROM countries 
  WHERE iso_code = 'PHL';
  
  IF phl_country_id IS NULL THEN
    RAISE EXCEPTION 'Philippines country not found - run migrations first!';
  END IF;
  
  -- Assign country
  INSERT INTO user_countries (user_id, country_id, role)
  VALUES (user_uuid, phl_country_id, user_role)
  ON CONFLICT (user_id, country_id) 
  DO UPDATE SET role = user_role;
  
  RAISE NOTICE '✅ Successfully assigned % to user: %', user_role, user_email;
END $$;

-- ==============================
-- OPTION 2: Assign by User ID (More Reliable)
-- ==============================
-- Uncomment and replace YOUR_USER_ID_HERE with actual UUID:

-- DO $$
-- DECLARE
--   user_uuid UUID := 'YOUR_USER_ID_HERE'::UUID;  -- Replace with user ID
--   phl_country_id UUID;
--   user_role TEXT := 'user';  -- or 'admin' for site admin
-- BEGIN
--   SELECT id INTO phl_country_id FROM countries WHERE iso_code = 'PHL';
--   
--   INSERT INTO user_countries (user_id, country_id, role)
--   VALUES (user_uuid, phl_country_id, user_role)
--   ON CONFLICT (user_id, country_id) 
--   DO UPDATE SET role = user_role;
--   
--   RAISE NOTICE '✅ Successfully assigned % to user ID: %', user_role, user_uuid;
-- END $$;

-- ==============================
-- VERIFY ASSIGNMENT
-- ==============================
-- Run this to verify:
-- SELECT 
--   u.email,
--   c.name as country,
--   uc.role
-- FROM auth.users u
-- JOIN user_countries uc ON u.id = uc.user_id
-- JOIN countries c ON uc.country_id = c.id;
