-- ==============================
-- ASSIGN ADMIN USER TO ALL COUNTRIES
-- ==============================
-- This migration assigns a specific user (neil.bauman@sheltercluster.org) 
-- as admin to all active countries, making them a site administrator

-- First, get the user ID
DO $$
DECLARE
  v_user_id UUID;
  v_country_id UUID;
  v_country_count INTEGER := 0;
BEGIN
  -- Find the user by email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'neil.bauman@sheltercluster.org';
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User neil.bauman@sheltercluster.org not found in auth.users';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Found user ID: %', v_user_id;
  
  -- Assign admin role to all active countries
  FOR v_country_id IN 
    SELECT id FROM countries WHERE active = true
  LOOP
    -- Check if assignment already exists
    IF NOT EXISTS (
      SELECT 1 FROM user_countries 
      WHERE user_id = v_user_id 
      AND country_id = v_country_id
    ) THEN
      -- Insert new assignment
      INSERT INTO user_countries (user_id, country_id, role)
      VALUES (v_user_id, v_country_id, 'admin');
      v_country_count := v_country_count + 1;
    ELSE
      -- Update existing assignment to admin if it's not already
      UPDATE user_countries
      SET role = 'admin'
      WHERE user_id = v_user_id 
      AND country_id = v_country_id
      AND role != 'admin';
      
      IF FOUND THEN
        v_country_count := v_country_count + 1;
      END IF;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Assigned admin role to % countries for user %', v_country_count, v_user_id;
END $$;
