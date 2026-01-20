-- ==============================
-- CREATE FRAMEWORK CONFIGURATION TABLE
-- ==============================
-- Stores global SSC Framework configuration that site administrators can manage
-- This replaces per-instance configuration with a system-wide default

CREATE TABLE IF NOT EXISTS public.framework_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Default Framework Configuration',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  
  -- Category configurations (P1, P2, P3, Hazard, Underlying Vulnerability)
  category_config JSONB NOT NULL DEFAULT '{
    "SSC Framework - P1": {
      "enabled": true,
      "method": "weighted_normalized_sum",
      "default_weight": 1.0,
      "description": "The Shelter - Structural safety & direct exposure of homes"
    },
    "SSC Framework - P2": {
      "enabled": true,
      "method": "weighted_normalized_sum",
      "default_weight": 1.0,
      "description": "The Living Conditions - Physical & socioeconomic fragility factors"
    },
    "SSC Framework - P3": {
      "enabled": true,
      "method": "weighted_normalized_sum",
      "default_weight": 1.0,
      "description": "The Settlement - Readiness of services, governance & access"
    },
    "Hazard": {
      "enabled": true,
      "method": "weighted_normalized_sum",
      "default_weight": 1.0,
      "description": "Recent hazard footprints & alerts"
    },
    "Underlying Vulnerability": {
      "enabled": true,
      "method": "weighted_normalized_sum",
      "default_weight": 1.0,
      "description": "Chronic structural drivers"
    }
  }'::jsonb,
  
  -- SSC Framework rollup configuration (aggregating P1, P2, P3)
  ssc_rollup_config JSONB NOT NULL DEFAULT '{
    "method": "worst_case",
    "weights": {
      "SSC Framework - P1": 0.333,
      "SSC Framework - P2": 0.333,
      "SSC Framework - P3": 0.334
    },
    "description": "How to aggregate P1, P2, P3 into SSC Framework score"
  }'::jsonb,
  
  -- Overall rollup configuration (aggregating SSC Framework, Hazard, Underlying Vulnerability)
  overall_rollup_config JSONB NOT NULL DEFAULT '{
    "method": "average",
    "weights": {
      "SSC Framework": 0.6,
      "Hazard": 0.2,
      "Underlying Vulnerability": 0.2
    },
    "description": "How to aggregate categories into final overall score"
  }'::jsonb,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

-- Create index for active configuration
CREATE INDEX IF NOT EXISTS idx_framework_config_active ON public.framework_config(is_active) WHERE is_active = true;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_framework_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER framework_config_updated_at
  BEFORE UPDATE ON public.framework_config
  FOR EACH ROW
  EXECUTE FUNCTION update_framework_config_updated_at();

-- Add comments
COMMENT ON TABLE public.framework_config IS 'Global SSC Framework configuration managed by site administrators';
COMMENT ON COLUMN public.framework_config.category_config IS 'Configuration for each category (P1, P2, P3, Hazard, Underlying Vulnerability)';
COMMENT ON COLUMN public.framework_config.ssc_rollup_config IS 'Configuration for aggregating P1, P2, P3 into SSC Framework score';
COMMENT ON COLUMN public.framework_config.overall_rollup_config IS 'Configuration for aggregating categories into final overall score';

-- RPC Function: Get active framework configuration
CREATE OR REPLACE FUNCTION public.get_framework_config()
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  category_config JSONB,
  ssc_rollup_config JSONB,
  overall_rollup_config JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fc.id,
    fc.name,
    fc.description,
    fc.category_config,
    fc.ssc_rollup_config,
    fc.overall_rollup_config,
    fc.created_at,
    fc.updated_at
  FROM public.framework_config fc
  WHERE fc.is_active = true
  ORDER BY fc.updated_at DESC
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.get_framework_config IS 'Returns the active framework configuration';

-- Grant permissions
GRANT SELECT ON public.framework_config TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.framework_config TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_framework_config TO anon, authenticated;

-- Insert default configuration if none exists
INSERT INTO public.framework_config (name, description, is_active)
SELECT 
  'Default SSC Framework Configuration',
  'Default configuration for the SSC Framework. Site administrators can modify this.',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.framework_config WHERE is_active = true
);
