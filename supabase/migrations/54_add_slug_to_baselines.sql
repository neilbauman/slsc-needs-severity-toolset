-- ==============================
-- ADD SLUG SUPPORT TO COUNTRY_BASELINES
-- ==============================
-- Adds a slug column for prettier URLs (e.g., /baselines/philippines-2024 instead of /baselines/uuid)

-- Add slug column
ALTER TABLE public.country_baselines
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- Create unique index on slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_country_baselines_slug 
  ON public.country_baselines(slug) 
  WHERE slug IS NOT NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_country_baselines_slug_lookup 
  ON public.country_baselines(slug);

-- Function to generate slug from name
CREATE OR REPLACE FUNCTION generate_baseline_slug(baseline_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  slug_text TEXT;
BEGIN
  -- Convert to lowercase, replace spaces with hyphens, remove special chars
  slug_text := lower(trim(baseline_name));
  slug_text := regexp_replace(slug_text, '[^a-z0-9]+', '-', 'g');
  slug_text := regexp_replace(slug_text, '^-+|-+$', '', 'g');
  
  -- Ensure it's not empty
  IF slug_text = '' THEN
    slug_text := 'baseline-' || substr(md5(random()::text), 1, 8);
  END IF;
  
  RETURN slug_text;
END;
$$;

-- Update existing baselines to have slugs (if they don't have one)
UPDATE public.country_baselines
SET slug = generate_baseline_slug(name) || '-' || substr(id::text, 1, 8)
WHERE slug IS NULL;

COMMENT ON COLUMN public.country_baselines.slug IS 'URL-friendly identifier for the baseline (e.g., philippines-2024)';
