-- ==============================
-- ENHANCE FRAMEWORK INDICATORS FOR ALL LEVELS
-- ==============================
-- Allows indicators to be attached to pillars, themes, OR subthemes
-- This enables more flexible framework structure where indicators can exist at any level

-- Modify indicators table to support indicators at all levels
ALTER TABLE public.framework_indicators
  DROP CONSTRAINT IF EXISTS framework_indicators_subtheme_id_fkey,
  ALTER COLUMN subtheme_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS pillar_id UUID REFERENCES public.framework_pillars(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS theme_id UUID REFERENCES public.framework_themes(id) ON DELETE CASCADE;

-- Add constraint: indicator must belong to exactly one parent (pillar, theme, or subtheme)
ALTER TABLE public.framework_indicators
  ADD CONSTRAINT framework_indicators_single_parent_check
  CHECK (
    (pillar_id IS NOT NULL AND theme_id IS NULL AND subtheme_id IS NULL) OR
    (pillar_id IS NULL AND theme_id IS NOT NULL AND subtheme_id IS NULL) OR
    (pillar_id IS NULL AND theme_id IS NULL AND subtheme_id IS NOT NULL)
  );

-- Update unique constraint to allow same code at different levels
ALTER TABLE public.framework_indicators
  DROP CONSTRAINT IF EXISTS framework_indicators_subtheme_id_code_key;

-- Create new unique constraints for each parent type
CREATE UNIQUE INDEX IF NOT EXISTS idx_framework_indicators_pillar_code 
  ON public.framework_indicators(pillar_id, code) 
  WHERE pillar_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_framework_indicators_theme_code 
  ON public.framework_indicators(theme_id, code) 
  WHERE theme_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_framework_indicators_subtheme_code 
  ON public.framework_indicators(subtheme_id, code) 
  WHERE subtheme_id IS NOT NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_framework_indicators_pillar_id ON public.framework_indicators(pillar_id) WHERE pillar_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_framework_indicators_theme_id ON public.framework_indicators(theme_id) WHERE theme_id IS NOT NULL;

-- Update the RPC function to include indicators at all levels
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
        WHERE i.pillar_id = p.id AND i.is_active = true
      ),
      'themes', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', t.id,
            'code', t.code,
            'name', t.name,
            'description', t.description,
            'order_index', t.order_index,
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
              WHERE i.theme_id = t.id AND i.is_active = true
            ),
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

COMMENT ON FUNCTION public.get_framework_structure IS 'Returns the complete hierarchical framework structure with indicators at all levels (pillars, themes, and subthemes)';
