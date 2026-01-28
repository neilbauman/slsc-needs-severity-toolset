-- ==============================
-- LAYERED RESPONSE ARCHITECTURE MIGRATION
-- ==============================
-- This migration creates the new layered response architecture:
-- - Country baselines (pre-disaster structural vulnerability)
-- - Responses (event-specific analyses with affected areas)
-- - Response layers (temporal progression within a response)
-- 
-- Existing instances table is preserved for backward compatibility.
-- New tables run in parallel for validation before full migration.

-- ==============================
-- STEP 1: Create ENUM types
-- ==============================

-- Layer type enum
DO $$ BEGIN
  CREATE TYPE layer_type AS ENUM (
    'hazard_prediction',
    'hazard_impact', 
    'assessment',
    'intervention',
    'monitoring',
    'custom'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Effect direction enum
DO $$ BEGIN
  CREATE TYPE effect_direction AS ENUM (
    'increase',
    'decrease',
    'mixed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Normalization scope enum
DO $$ BEGIN
  CREATE TYPE normalization_scope AS ENUM (
    'national',
    'affected_area'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Baseline status enum
DO $$ BEGIN
  CREATE TYPE baseline_status AS ENUM (
    'draft',
    'active',
    'archived'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Response status enum
DO $$ BEGIN
  CREATE TYPE response_status AS ENUM (
    'active',
    'monitoring',
    'closed',
    'archived'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ==============================
-- STEP 2: Create country_baselines table
-- ==============================

CREATE TABLE IF NOT EXISTS public.country_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id UUID,  -- No FK constraint for single-country database (add FK when countries table exists)
  name TEXT NOT NULL,
  description TEXT,
  
  -- Configuration
  config JSONB DEFAULT '{}',  -- Aggregation methods, weights for baseline categories
  
  -- Status tracking
  status baseline_status DEFAULT 'draft',
  computed_at TIMESTAMP,
  
  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_country_baselines_country_id 
  ON public.country_baselines(country_id);
CREATE INDEX IF NOT EXISTS idx_country_baselines_status 
  ON public.country_baselines(status);

-- Comments
COMMENT ON TABLE public.country_baselines IS 
  'Country-level baseline analysis representing pre-disaster structural vulnerability';
COMMENT ON COLUMN public.country_baselines.config IS 
  'JSONB configuration including aggregation methods and category weights';
COMMENT ON COLUMN public.country_baselines.status IS 
  'draft = being configured, active = current baseline, archived = historical';

-- ==============================
-- STEP 3: Create baseline_datasets junction table
-- ==============================

CREATE TABLE IF NOT EXISTS public.baseline_datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_id UUID NOT NULL REFERENCES public.country_baselines(id) ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  
  -- Dataset configuration within baseline
  category TEXT,  -- Which SSC category this dataset belongs to (P1, P2, P3, UV, etc.)
  weight NUMERIC DEFAULT 1.0,
  scoring_config JSONB,  -- Scoring method and parameters
  
  -- Ordering
  order_index INTEGER,
  
  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_baseline_dataset UNIQUE (baseline_id, dataset_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_baseline_datasets_baseline_id 
  ON public.baseline_datasets(baseline_id);
CREATE INDEX IF NOT EXISTS idx_baseline_datasets_dataset_id 
  ON public.baseline_datasets(dataset_id);
CREATE INDEX IF NOT EXISTS idx_baseline_datasets_category 
  ON public.baseline_datasets(category);

-- Comments
COMMENT ON TABLE public.baseline_datasets IS 
  'Links datasets to country baselines with scoring configuration';

-- ==============================
-- STEP 4: Create baseline_scores table
-- ==============================

CREATE TABLE IF NOT EXISTS public.baseline_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_id UUID NOT NULL REFERENCES public.country_baselines(id) ON DELETE CASCADE,
  admin_pcode TEXT NOT NULL,
  
  -- Score data
  category TEXT NOT NULL,  -- P1, P2, P3, Hazard, UV, SSC Framework, Overall
  score NUMERIC NOT NULL CHECK (score >= 1 AND score <= 5),
  
  -- Metadata
  computed_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_baseline_score UNIQUE (baseline_id, admin_pcode, category)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_baseline_scores_baseline_id 
  ON public.baseline_scores(baseline_id);
CREATE INDEX IF NOT EXISTS idx_baseline_scores_admin_pcode 
  ON public.baseline_scores(admin_pcode);
CREATE INDEX IF NOT EXISTS idx_baseline_scores_category 
  ON public.baseline_scores(category);
CREATE INDEX IF NOT EXISTS idx_baseline_scores_composite 
  ON public.baseline_scores(baseline_id, category);

-- Comments
COMMENT ON TABLE public.baseline_scores IS 
  'Pre-computed baseline vulnerability scores per admin area (national normalization)';

-- ==============================
-- STEP 5: Create responses table
-- ==============================

CREATE TABLE IF NOT EXISTS public.responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id UUID,  -- No FK constraint for single-country database (add FK when countries table exists)
  baseline_id UUID REFERENCES public.country_baselines(id) ON DELETE SET NULL,
  
  -- Basic info
  name TEXT NOT NULL,
  description TEXT,
  
  -- Affected area (inherited from instances concept)
  admin_scope TEXT[],  -- Array of ADM2 codes defining affected area
  
  -- Normalization configuration
  normalization_scope normalization_scope DEFAULT 'affected_area',
  
  -- Status tracking
  status response_status DEFAULT 'active',
  
  -- Reference datasets for metrics
  population_dataset_id UUID REFERENCES public.datasets(id) ON DELETE SET NULL,
  poverty_dataset_id UUID REFERENCES public.datasets(id) ON DELETE SET NULL,
  
  -- Link to legacy instance (for migration tracking)
  legacy_instance_id UUID REFERENCES public.instances(id) ON DELETE SET NULL,
  
  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_responses_country_id 
  ON public.responses(country_id);
CREATE INDEX IF NOT EXISTS idx_responses_baseline_id 
  ON public.responses(baseline_id);
CREATE INDEX IF NOT EXISTS idx_responses_status 
  ON public.responses(status);
CREATE INDEX IF NOT EXISTS idx_responses_legacy_instance_id 
  ON public.responses(legacy_instance_id);

-- Comments
COMMENT ON TABLE public.responses IS 
  'Event-specific response analysis with affected area and temporal layers';
COMMENT ON COLUMN public.responses.admin_scope IS 
  'Array of ADM2 codes defining the geographic scope of the response';
COMMENT ON COLUMN public.responses.normalization_scope IS 
  'national = scores relative to country, affected_area = scores relative to affected zone only';
COMMENT ON COLUMN public.responses.legacy_instance_id IS 
  'Reference to original instance during migration (for comparison)';

-- ==============================
-- STEP 6: Create response_layers table
-- ==============================

CREATE TABLE IF NOT EXISTS public.response_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL REFERENCES public.responses(id) ON DELETE CASCADE,
  
  -- Basic info
  name TEXT NOT NULL,
  description TEXT,
  
  -- Layer classification
  layer_type layer_type NOT NULL DEFAULT 'custom',
  effect_direction effect_direction,  -- NULL = use default based on layer_type
  
  -- Ordering and timing
  order_index INTEGER NOT NULL DEFAULT 1,
  reference_date DATE,  -- The point-in-time this layer represents
  
  -- Weighting
  weight NUMERIC DEFAULT 1.0 CHECK (weight >= 0),
  
  -- Configuration
  config JSONB DEFAULT '{}',  -- Layer-specific scoring configuration
  
  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_layer_order UNIQUE (response_id, order_index)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_response_layers_response_id 
  ON public.response_layers(response_id);
CREATE INDEX IF NOT EXISTS idx_response_layers_layer_type 
  ON public.response_layers(layer_type);
CREATE INDEX IF NOT EXISTS idx_response_layers_order 
  ON public.response_layers(response_id, order_index);

-- Comments
COMMENT ON TABLE public.response_layers IS 
  'Temporal layers within a response representing progression of the crisis';
COMMENT ON COLUMN public.response_layers.layer_type IS 
  'hazard_prediction, hazard_impact, assessment, intervention, monitoring, custom';
COMMENT ON COLUMN public.response_layers.effect_direction IS 
  'increase = raises vulnerability, decrease = lowers vulnerability, mixed = depends on data';
COMMENT ON COLUMN public.response_layers.order_index IS 
  'Temporal ordering: 1 = first layer, 2 = second, etc.';
COMMENT ON COLUMN public.response_layers.reference_date IS 
  'The date/time this layer represents in the response timeline';

-- ==============================
-- STEP 7: Create layer_datasets junction table
-- ==============================

CREATE TABLE IF NOT EXISTS public.layer_datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_id UUID NOT NULL REFERENCES public.response_layers(id) ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  
  -- Configuration
  weight NUMERIC DEFAULT 1.0,
  scoring_config JSONB,  -- Scoring method and parameters
  
  -- Ordering
  order_index INTEGER,
  
  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_layer_dataset UNIQUE (layer_id, dataset_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_layer_datasets_layer_id 
  ON public.layer_datasets(layer_id);
CREATE INDEX IF NOT EXISTS idx_layer_datasets_dataset_id 
  ON public.layer_datasets(dataset_id);

-- Comments
COMMENT ON TABLE public.layer_datasets IS 
  'Links datasets to response layers with scoring configuration';

-- ==============================
-- STEP 8: Create layer_hazard_events junction table
-- ==============================

CREATE TABLE IF NOT EXISTS public.layer_hazard_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_id UUID NOT NULL REFERENCES public.response_layers(id) ON DELETE CASCADE,
  hazard_event_id UUID NOT NULL REFERENCES public.hazard_events(id) ON DELETE CASCADE,
  
  -- Configuration
  weight NUMERIC DEFAULT 1.0,
  scoring_config JSONB,  -- Scoring method and parameters (ranges, matching method, etc.)
  
  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_layer_hazard_event UNIQUE (layer_id, hazard_event_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_layer_hazard_events_layer_id 
  ON public.layer_hazard_events(layer_id);
CREATE INDEX IF NOT EXISTS idx_layer_hazard_events_hazard_event_id 
  ON public.layer_hazard_events(hazard_event_id);

-- Comments
COMMENT ON TABLE public.layer_hazard_events IS 
  'Links hazard events to response layers';

-- ==============================
-- STEP 9: Create layer_scores table
-- ==============================

CREATE TABLE IF NOT EXISTS public.layer_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_id UUID NOT NULL REFERENCES public.response_layers(id) ON DELETE CASCADE,
  admin_pcode TEXT NOT NULL,
  
  -- Score data
  category TEXT NOT NULL,  -- Dataset-level, Hazard, or aggregate category
  score NUMERIC NOT NULL CHECK (score >= 1 AND score <= 5),
  
  -- For tracking adjustments relative to baseline
  baseline_score NUMERIC,  -- Original baseline score for this category
  adjustment_value NUMERIC,  -- The delta applied (score - baseline_score)
  
  -- Metadata
  computed_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_layer_score UNIQUE (layer_id, admin_pcode, category)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_layer_scores_layer_id 
  ON public.layer_scores(layer_id);
CREATE INDEX IF NOT EXISTS idx_layer_scores_admin_pcode 
  ON public.layer_scores(admin_pcode);
CREATE INDEX IF NOT EXISTS idx_layer_scores_category 
  ON public.layer_scores(category);
CREATE INDEX IF NOT EXISTS idx_layer_scores_composite 
  ON public.layer_scores(layer_id, category);

-- Comments
COMMENT ON TABLE public.layer_scores IS 
  'Computed scores for each layer, including adjustment relative to baseline';
COMMENT ON COLUMN public.layer_scores.baseline_score IS 
  'The original baseline score (may be national or affected-area normalized)';
COMMENT ON COLUMN public.layer_scores.adjustment_value IS 
  'The delta this layer applies: positive = increases vulnerability, negative = decreases';

-- ==============================
-- STEP 10: Create response_scores table (aggregated across layers)
-- ==============================

CREATE TABLE IF NOT EXISTS public.response_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL REFERENCES public.responses(id) ON DELETE CASCADE,
  admin_pcode TEXT NOT NULL,
  
  -- Score data
  category TEXT NOT NULL,  -- Overall, Priority, or specific category
  score NUMERIC NOT NULL CHECK (score >= 1 AND score <= 5),
  
  -- Components for transparency
  baseline_component NUMERIC,  -- Contribution from baseline
  layer_component NUMERIC,  -- Contribution from all layers
  
  -- Metadata
  computed_at TIMESTAMP DEFAULT NOW(),
  layer_id UUID REFERENCES public.response_layers(id) ON DELETE SET NULL,  -- Which layer this score is "as of"
  
  CONSTRAINT unique_response_score UNIQUE (response_id, admin_pcode, category, layer_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_response_scores_response_id 
  ON public.response_scores(response_id);
CREATE INDEX IF NOT EXISTS idx_response_scores_admin_pcode 
  ON public.response_scores(admin_pcode);
CREATE INDEX IF NOT EXISTS idx_response_scores_category 
  ON public.response_scores(category);
CREATE INDEX IF NOT EXISTS idx_response_scores_layer_id 
  ON public.response_scores(layer_id);

-- Comments
COMMENT ON TABLE public.response_scores IS 
  'Final aggregated scores for a response at each layer point in time';
COMMENT ON COLUMN public.response_scores.layer_id IS 
  'The layer this score is calculated "as of" (NULL = baseline only)';

-- ==============================
-- STEP 11: Create helper function for layer effect direction defaults
-- ==============================

CREATE OR REPLACE FUNCTION get_default_effect_direction(p_layer_type layer_type)
RETURNS effect_direction
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE p_layer_type
    WHEN 'hazard_prediction' THEN 'increase'::effect_direction
    WHEN 'hazard_impact' THEN 'increase'::effect_direction
    WHEN 'intervention' THEN 'decrease'::effect_direction
    WHEN 'assessment' THEN 'mixed'::effect_direction
    WHEN 'monitoring' THEN 'mixed'::effect_direction
    WHEN 'custom' THEN 'mixed'::effect_direction
    ELSE 'mixed'::effect_direction
  END;
END;
$$;

COMMENT ON FUNCTION get_default_effect_direction IS 
  'Returns the default effect direction for a layer type';

-- ==============================
-- STEP 12: Create trigger to set default effect direction
-- ==============================

CREATE OR REPLACE FUNCTION set_layer_effect_direction()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.effect_direction IS NULL THEN
    NEW.effect_direction := get_default_effect_direction(NEW.layer_type);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_layer_effect_direction ON public.response_layers;
CREATE TRIGGER trigger_set_layer_effect_direction
  BEFORE INSERT ON public.response_layers
  FOR EACH ROW
  EXECUTE FUNCTION set_layer_effect_direction();

-- ==============================
-- STEP 13: Create updated_at triggers
-- ==============================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_country_baselines_updated_at ON public.country_baselines;
CREATE TRIGGER trigger_country_baselines_updated_at
  BEFORE UPDATE ON public.country_baselines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_responses_updated_at ON public.responses;
CREATE TRIGGER trigger_responses_updated_at
  BEFORE UPDATE ON public.responses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_response_layers_updated_at ON public.response_layers;
CREATE TRIGGER trigger_response_layers_updated_at
  BEFORE UPDATE ON public.response_layers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==============================
-- STEP 14: Create view for response with layers summary
-- ==============================

CREATE OR REPLACE VIEW public.v_responses_with_layers AS
SELECT 
  r.id AS response_id,
  r.country_id,
  r.baseline_id,
  r.name AS response_name,
  r.description AS response_description,
  r.admin_scope,
  r.normalization_scope,
  r.status AS response_status,
  r.created_at AS response_created_at,
  r.legacy_instance_id,
  cb.name AS baseline_name,
  cb.status AS baseline_status,
  COUNT(rl.id) AS layer_count,
  MIN(rl.reference_date) AS first_layer_date,
  MAX(rl.reference_date) AS last_layer_date,
  ARRAY_AGG(rl.name ORDER BY rl.order_index) FILTER (WHERE rl.id IS NOT NULL) AS layer_names,
  ARRAY_AGG(rl.layer_type ORDER BY rl.order_index) FILTER (WHERE rl.id IS NOT NULL) AS layer_types
FROM public.responses r
LEFT JOIN public.country_baselines cb ON cb.id = r.baseline_id
LEFT JOIN public.response_layers rl ON rl.response_id = r.id
GROUP BY 
  r.id, r.country_id, r.baseline_id, r.name, r.description, 
  r.admin_scope, r.normalization_scope, r.status, r.created_at,
  r.legacy_instance_id, cb.name, cb.status;

COMMENT ON VIEW public.v_responses_with_layers IS 
  'Summary view of responses with their layer counts and timeline';

-- ==============================
-- STEP 15: Enable RLS policies
-- ==============================

ALTER TABLE public.country_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baseline_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baseline_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.response_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.layer_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.layer_hazard_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.layer_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.response_scores ENABLE ROW LEVEL SECURITY;

-- Basic read policies (authenticated users can read)
CREATE POLICY "Allow authenticated read country_baselines" ON public.country_baselines
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read baseline_datasets" ON public.baseline_datasets
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read baseline_scores" ON public.baseline_scores
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read responses" ON public.responses
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read response_layers" ON public.response_layers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read layer_datasets" ON public.layer_datasets
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read layer_hazard_events" ON public.layer_hazard_events
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read layer_scores" ON public.layer_scores
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read response_scores" ON public.response_scores
  FOR SELECT TO authenticated USING (true);

-- Basic write policies (authenticated users can write)
CREATE POLICY "Allow authenticated write country_baselines" ON public.country_baselines
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated write baseline_datasets" ON public.baseline_datasets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated write baseline_scores" ON public.baseline_scores
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated write responses" ON public.responses
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated write response_layers" ON public.response_layers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated write layer_datasets" ON public.layer_datasets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated write layer_hazard_events" ON public.layer_hazard_events
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated write layer_scores" ON public.layer_scores
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated write response_scores" ON public.response_scores
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==============================
-- MIGRATION COMPLETE
-- ==============================

-- Summary of tables created:
-- 1. country_baselines - Country-level baseline configurations
-- 2. baseline_datasets - Links datasets to baselines
-- 3. baseline_scores - Pre-computed baseline scores
-- 4. responses - Event-specific response analyses
-- 5. response_layers - Temporal layers within responses
-- 6. layer_datasets - Links datasets to layers
-- 7. layer_hazard_events - Links hazard events to layers
-- 8. layer_scores - Scores per layer
-- 9. response_scores - Aggregated response scores

-- Next steps:
-- 1. Create scoring RPC functions
-- 2. Create Philippines baseline from existing data
-- 3. Create parallel responses from existing instances
