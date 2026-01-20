-- ==============================
-- CREATE FRAMEWORK STRUCTURE TABLES
-- ==============================
-- Stores the hierarchical SSC Framework structure:
-- Pillars → Themes → Sub-themes → Indicators
-- This allows for detailed framework configuration and dataset categorization

-- Pillars table (P1, P2, P3)
CREATE TABLE IF NOT EXISTS public.framework_pillars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE, -- e.g., 'P1', 'P2', 'P3'
  name TEXT NOT NULL, -- e.g., 'The Shelter', 'The Living Conditions', 'The Settlement'
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Themes table (within each pillar)
CREATE TABLE IF NOT EXISTS public.framework_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pillar_id UUID NOT NULL REFERENCES public.framework_pillars(id) ON DELETE CASCADE,
  code TEXT NOT NULL, -- e.g., 'P1-T1', 'P2-T1'
  name TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(pillar_id, code)
);

-- Sub-themes table (within each theme)
CREATE TABLE IF NOT EXISTS public.framework_subthemes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id UUID NOT NULL REFERENCES public.framework_themes(id) ON DELETE CASCADE,
  code TEXT NOT NULL, -- e.g., 'P1-T1-ST1'
  name TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(theme_id, code)
);

-- Indicators table (within each sub-theme)
CREATE TABLE IF NOT EXISTS public.framework_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subtheme_id UUID NOT NULL REFERENCES public.framework_subthemes(id) ON DELETE CASCADE,
  code TEXT NOT NULL, -- e.g., 'P1-T1-ST1-I1'
  name TEXT NOT NULL,
  description TEXT,
  data_type TEXT CHECK (data_type IN ('numeric', 'categorical', 'both')),
  unit TEXT, -- e.g., 'percentage', 'count', 'index'
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(subtheme_id, code)
);

-- Link datasets to indicators (many-to-many)
CREATE TABLE IF NOT EXISTS public.dataset_indicators (
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  indicator_id UUID NOT NULL REFERENCES public.framework_indicators(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (dataset_id, indicator_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_framework_themes_pillar_id ON public.framework_themes(pillar_id);
CREATE INDEX IF NOT EXISTS idx_framework_subthemes_theme_id ON public.framework_subthemes(theme_id);
CREATE INDEX IF NOT EXISTS idx_framework_indicators_subtheme_id ON public.framework_indicators(subtheme_id);
CREATE INDEX IF NOT EXISTS idx_framework_pillars_code ON public.framework_pillars(code);
CREATE INDEX IF NOT EXISTS idx_framework_themes_code ON public.framework_themes(code);
CREATE INDEX IF NOT EXISTS idx_framework_subthemes_code ON public.framework_subthemes(code);
CREATE INDEX IF NOT EXISTS idx_framework_indicators_code ON public.framework_indicators(code);
CREATE INDEX IF NOT EXISTS idx_dataset_indicators_dataset_id ON public.dataset_indicators(dataset_id);
CREATE INDEX IF NOT EXISTS idx_dataset_indicators_indicator_id ON public.dataset_indicators(indicator_id);

-- Update triggers for updated_at
CREATE OR REPLACE FUNCTION update_framework_structure_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER framework_pillars_updated_at
  BEFORE UPDATE ON public.framework_pillars
  FOR EACH ROW
  EXECUTE FUNCTION update_framework_structure_updated_at();

CREATE TRIGGER framework_themes_updated_at
  BEFORE UPDATE ON public.framework_themes
  FOR EACH ROW
  EXECUTE FUNCTION update_framework_structure_updated_at();

CREATE TRIGGER framework_subthemes_updated_at
  BEFORE UPDATE ON public.framework_subthemes
  FOR EACH ROW
  EXECUTE FUNCTION update_framework_structure_updated_at();

CREATE TRIGGER framework_indicators_updated_at
  BEFORE UPDATE ON public.framework_indicators
  FOR EACH ROW
  EXECUTE FUNCTION update_framework_structure_updated_at();

-- Comments
COMMENT ON TABLE public.framework_pillars IS 'SSC Framework pillars (P1, P2, P3)';
COMMENT ON TABLE public.framework_themes IS 'Themes within each pillar';
COMMENT ON TABLE public.framework_subthemes IS 'Sub-themes within each theme';
COMMENT ON TABLE public.framework_indicators IS 'Indicators within each sub-theme';
COMMENT ON TABLE public.dataset_indicators IS 'Links datasets to framework indicators';

-- RPC Function: Get full framework structure
CREATE OR REPLACE FUNCTION public.get_framework_structure()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'code', p.code,
      'name', p.name,
      'description', p.description,
      'order_index', p.order_index,
      'themes', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', t.id,
            'code', t.code,
            'name', t.name,
            'description', t.description,
            'order_index', t.order_index,
            'subthemes', (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'id', st.id,
                  'code', st.code,
                  'name', st.name,
                  'description', st.description,
                  'order_index', st.order_index,
                  'indicators', (
                    SELECT jsonb_agg(
                      jsonb_build_object(
                        'id', i.id,
                        'code', i.code,
                        'name', i.name,
                        'description', i.description,
                        'data_type', i.data_type,
                        'unit', i.unit,
                        'order_index', i.order_index
                      ) ORDER BY i.order_index
                    )
                    FROM framework_indicators i
                    WHERE i.subtheme_id = st.id AND i.is_active = true
                  )
                ) ORDER BY st.order_index
              )
              FROM framework_subthemes st
              WHERE st.theme_id = t.id AND st.is_active = true
            )
          ) ORDER BY t.order_index
        )
        FROM framework_themes t
        WHERE t.pillar_id = p.id AND t.is_active = true
      )
    ) ORDER BY p.order_index
  )
  INTO result
  FROM framework_pillars p
  WHERE p.is_active = true;
  
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.get_framework_structure IS 'Returns the complete hierarchical framework structure (pillars → themes → sub-themes → indicators)';

-- Grant permissions
GRANT SELECT ON public.framework_pillars TO anon, authenticated;
GRANT SELECT ON public.framework_themes TO anon, authenticated;
GRANT SELECT ON public.framework_subthemes TO anon, authenticated;
GRANT SELECT ON public.framework_indicators TO anon, authenticated;
GRANT SELECT ON public.dataset_indicators TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.framework_pillars TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.framework_themes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.framework_subthemes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.framework_indicators TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.dataset_indicators TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_framework_structure TO anon, authenticated;
