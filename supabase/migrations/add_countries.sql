-- ==============================
-- ADD COUNTRIES TABLE MIGRATION
-- ==============================
-- This migration creates the countries table for multi-country support
-- Run this in your DEV Supabase project first for testing

CREATE TABLE IF NOT EXISTS public.countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iso_code TEXT NOT NULL UNIQUE CHECK (char_length(iso_code) = 3), -- ISO 3166-1 alpha-3
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  active BOOLEAN DEFAULT true
);

-- Create index on iso_code for fast lookups
CREATE INDEX IF NOT EXISTS idx_countries_iso_code ON public.countries(iso_code);

-- Insert initial countries (you can add more as needed)
INSERT INTO public.countries (iso_code, name) VALUES 
  ('PHL', 'Philippines'),
  ('BGD', 'Bangladesh'),
  ('MMR', 'Myanmar')
ON CONFLICT (iso_code) DO NOTHING;

-- Add comment
COMMENT ON TABLE public.countries IS 'Stores country information for multi-country isolation';
COMMENT ON COLUMN public.countries.iso_code IS 'ISO 3166-1 alpha-3 country code (e.g., PHL, BGD, MMR)';
