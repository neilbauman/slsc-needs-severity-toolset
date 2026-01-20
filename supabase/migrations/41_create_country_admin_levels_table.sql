-- ==============================
-- CREATE COUNTRY ADMIN LEVELS TABLE
-- ==============================
-- Allows countries to define custom names for their administrative levels
-- Instead of hardcoded ADM1, ADM2, ADM3, ADM4, countries can use:
-- - "Province", "District", "Municipality", "Barangay" (Philippines)
-- - "Region", "Province", "District", "Commune" (other countries)
-- etc.

CREATE TABLE IF NOT EXISTS public.country_admin_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id UUID NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  level_number INTEGER NOT NULL CHECK (level_number BETWEEN 1 AND 5),
  name TEXT NOT NULL, -- Singular: "Province", "District"
  plural_name TEXT, -- Plural: "Provinces", "Districts" (optional, defaults to name + 's')
  code_prefix TEXT, -- Optional: "PROV", "DIST" (for generating codes)
  order_index INTEGER NOT NULL DEFAULT 0, -- For ordering (1 = highest level, 4 = lowest)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(country_id, level_number)
);

CREATE INDEX IF NOT EXISTS idx_country_admin_levels_country_id ON public.country_admin_levels(country_id);
CREATE INDEX IF NOT EXISTS idx_country_admin_levels_level_number ON public.country_admin_levels(level_number);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_country_admin_levels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS country_admin_levels_updated_at ON public.country_admin_levels;
CREATE TRIGGER country_admin_levels_updated_at
  BEFORE UPDATE ON public.country_admin_levels
  FOR EACH ROW
  EXECUTE FUNCTION update_country_admin_levels_updated_at();

COMMENT ON TABLE public.country_admin_levels IS 'Stores custom names for administrative levels per country. Allows countries to use their own terminology instead of generic ADM1-ADM4.';
COMMENT ON COLUMN public.country_admin_levels.level_number IS 'Administrative level number: 1 (highest, e.g., Region/Province), 2, 3, 4, 5 (lowest, e.g., Barangay/Village). Most countries use 3-4 levels.';
COMMENT ON COLUMN public.country_admin_levels.name IS 'Singular name for this level (e.g., "Province", "District", "Municipality")';
COMMENT ON COLUMN public.country_admin_levels.plural_name IS 'Plural name (e.g., "Provinces", "Districts"). If NULL, defaults to name + "s"';
COMMENT ON COLUMN public.country_admin_levels.code_prefix IS 'Optional prefix for admin codes (e.g., "PROV" for Province codes)';

-- RPC Function: Get admin level names for a country
CREATE OR REPLACE FUNCTION public.get_country_admin_levels(
  in_country_id UUID
)
RETURNS TABLE (
  level_number INTEGER,
  name TEXT,
  plural_name TEXT,
  code_prefix TEXT,
  order_index INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cal.level_number,
    cal.name,
    COALESCE(cal.plural_name, cal.name || 's') AS plural_name,
    cal.code_prefix,
    cal.order_index
  FROM public.country_admin_levels cal
  WHERE cal.country_id = in_country_id
  ORDER BY cal.level_number ASC;
END;
$$;

COMMENT ON FUNCTION public.get_country_admin_levels(UUID) IS 'Returns custom admin level names for a country. Returns empty if not configured (fallback to ADM1-ADM4).';

-- RPC Function: Get admin level name for a specific level (supports ADM1-ADM5)
DROP FUNCTION IF EXISTS public.get_admin_level_name(UUID, INTEGER, BOOLEAN);
CREATE OR REPLACE FUNCTION public.get_admin_level_name(
  in_country_id UUID,
  in_level_number INTEGER,
  in_plural BOOLEAN DEFAULT false
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_name TEXT;
BEGIN
  -- Validate level number
  IF in_level_number < 1 OR in_level_number > 5 THEN
    RETURN 'ADM' || in_level_number::TEXT;
  END IF;
  
  IF in_plural THEN
    SELECT COALESCE(plural_name, name || 's') INTO v_name
    FROM public.country_admin_levels
    WHERE country_id = in_country_id
      AND level_number = in_level_number
    LIMIT 1;
  ELSE
    SELECT name INTO v_name
    FROM public.country_admin_levels
    WHERE country_id = in_country_id
      AND level_number = in_level_number
    LIMIT 1;
  END IF;
  
  -- Fallback to generic ADM format if not configured
  IF v_name IS NULL THEN
    RETURN 'ADM' || in_level_number::TEXT;
  END IF;
  
  RETURN v_name;
END;
$$;

COMMENT ON FUNCTION public.get_admin_level_name(UUID, INTEGER, BOOLEAN) IS 'Returns the name for a specific admin level. Falls back to ADM1-ADM4 if not configured.';

-- Insert default admin levels for Philippines (if it exists)
DO $$
DECLARE
  phl_country_id UUID;
BEGIN
  SELECT id INTO phl_country_id FROM public.countries WHERE iso_code = 'PHL';
  
  IF phl_country_id IS NOT NULL THEN
    INSERT INTO public.country_admin_levels (country_id, level_number, name, plural_name, code_prefix, order_index)
    VALUES 
      (phl_country_id, 1, 'Region', 'Regions', 'REG', 1),
      (phl_country_id, 2, 'Province', 'Provinces', 'PROV', 2),
      (phl_country_id, 3, 'Municipality', 'Municipalities', 'MUN', 3),
      (phl_country_id, 4, 'Barangay', 'Barangays', 'BRGY', 4)
    ON CONFLICT (country_id, level_number) DO NOTHING;
    
    RAISE NOTICE 'Inserted default admin levels for Philippines';
  END IF;
END $$;
