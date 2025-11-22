-- ==============================
-- HAZARD EVENTS TABLES MIGRATION
-- ==============================
-- This migration adds support for GIS hazard event files (GeoJSON/JSON)
-- such as earthquake shake maps with spatial vulnerability scoring

-- Enable PostGIS extension if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Table: hazard_events
-- Stores hazard event metadata and geometry (e.g., earthquake shake maps)
CREATE TABLE IF NOT EXISTS public.hazard_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL DEFAULT 'earthquake', -- e.g., 'earthquake', 'flood', 'typhoon'
  geometry GEOGRAPHY(GEOMETRY, 4326), -- PostGIS geometry for GeoJSON features
  metadata JSONB, -- Store original GeoJSON properties, units, etc.
  magnitude_field TEXT NOT NULL DEFAULT 'value', -- Field name containing magnitude/intensity
  created_at TIMESTAMP DEFAULT NOW(),
  uploaded_by UUID,
  is_shared BOOLEAN DEFAULT false -- Future: allow sharing between instances
);

-- Table: hazard_event_scores
-- Stores calculated vulnerability scores for admin areas based on hazard events
CREATE TABLE IF NOT EXISTS public.hazard_event_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hazard_event_id UUID NOT NULL REFERENCES public.hazard_events(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  admin_pcode TEXT NOT NULL,
  score NUMERIC NOT NULL CHECK (score >= 1 AND score <= 5),
  magnitude_value NUMERIC, -- Original magnitude/intensity value from contour
  computed_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(hazard_event_id, instance_id, admin_pcode)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_hazard_events_instance_id ON public.hazard_events(instance_id);
CREATE INDEX IF NOT EXISTS idx_hazard_events_geometry ON public.hazard_events USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_hazard_event_scores_hazard_event_id ON public.hazard_event_scores(hazard_event_id);
CREATE INDEX IF NOT EXISTS idx_hazard_event_scores_instance_id ON public.hazard_event_scores(instance_id);
CREATE INDEX IF NOT EXISTS idx_hazard_event_scores_admin_pcode ON public.hazard_event_scores(admin_pcode);
CREATE INDEX IF NOT EXISTS idx_hazard_event_scores_composite ON public.hazard_event_scores(hazard_event_id, instance_id, admin_pcode);

-- Comments for documentation
COMMENT ON TABLE public.hazard_events IS 'Stores GIS hazard event files (GeoJSON) linked to instances';
COMMENT ON TABLE public.hazard_event_scores IS 'Stores vulnerability scores calculated from hazard events for admin areas';
COMMENT ON COLUMN public.hazard_events.geometry IS 'PostGIS geography storing GeoJSON geometry (LineString/MultiLineString for shake maps)';
COMMENT ON COLUMN public.hazard_events.magnitude_field IS 'Field name in GeoJSON properties containing magnitude/intensity value';

