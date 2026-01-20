-- ==============================
-- GET USERS WITH ACCESS FUNCTION
-- ==============================
-- RPC function to get all users with their country access
-- This allows site admins to see user emails and manage access
-- Note: Requires service role or admin privileges to access auth.users

CREATE OR REPLACE FUNCTION public.get_users_with_access()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  created_at TIMESTAMPTZ,
  user_countries JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user_id UUID;
  v_is_site_admin BOOLEAN;
BEGIN
  -- Get current user ID
  v_current_user_id := auth.uid();
  
  -- Check if current user is a site admin
  SELECT EXISTS(
    SELECT 1 
    FROM public.user_countries 
    WHERE user_id = v_current_user_id 
      AND role = 'admin'
  ) INTO v_is_site_admin;
  
  -- Only allow site admins to call this function
  IF NOT v_is_site_admin THEN
    RAISE EXCEPTION 'Access denied. Only site administrators can view user access.';
  END IF;
  
  RETURN QUERY
  SELECT 
    au.id AS user_id,
    au.email::TEXT AS email,
    au.created_at,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', uc.id,
            'country_id', uc.country_id,
            'role', uc.role,
            'country', jsonb_build_object(
              'id', c.id,
              'iso_code', c.iso_code,
              'name', c.name
            )
          )
        )
        FROM public.user_countries uc
        INNER JOIN public.countries c ON c.id = uc.country_id
        WHERE uc.user_id = au.id
      ),
      '[]'::jsonb
    ) AS user_countries
  FROM auth.users au
  ORDER BY au.created_at DESC;
END;
$$;

COMMENT ON FUNCTION public.get_users_with_access() IS 'Returns all users with their country access assignments. Only accessible to site administrators.';
