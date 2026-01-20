-- ==============================
-- ADD USER_COUNTRIES TABLE MIGRATION
-- ==============================
-- This migration creates the user_countries junction table for many-to-many
-- relationship between users and countries with role-based access

CREATE TABLE IF NOT EXISTS public.user_countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country_id UUID NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, country_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_countries_user_id ON public.user_countries(user_id);
CREATE INDEX IF NOT EXISTS idx_user_countries_country_id ON public.user_countries(country_id);
CREATE INDEX IF NOT EXISTS idx_user_countries_role ON public.user_countries(role);

-- Add comment
COMMENT ON TABLE public.user_countries IS 'Junction table linking users to countries with role-based access (admin or user)';
COMMENT ON COLUMN public.user_countries.role IS 'User role for this country: admin (site admin, all countries) or user (country-specific user)';
