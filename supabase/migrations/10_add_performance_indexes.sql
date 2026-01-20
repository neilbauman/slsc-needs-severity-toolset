-- ==============================
-- ADD PERFORMANCE INDEXES FOR SCORING FUNCTIONS
-- ==============================
-- Creates indexes to speed up get_instance_summary and other scoring queries

-- Indexes for instance_category_scores (heavily queried in get_instance_summary)
CREATE INDEX IF NOT EXISTS idx_instance_category_scores_instance_category 
  ON public.instance_category_scores(instance_id, category);

CREATE INDEX IF NOT EXISTS idx_instance_category_scores_instance_category_score 
  ON public.instance_category_scores(instance_id, category, score) 
  WHERE score >= 3.0;

CREATE INDEX IF NOT EXISTS idx_instance_category_scores_admin_pcode 
  ON public.instance_category_scores(admin_pcode);

-- Indexes for dataset_values_numeric (used in population/poverty calculations)
CREATE INDEX IF NOT EXISTS idx_dataset_values_numeric_dataset_admin 
  ON public.dataset_values_numeric(dataset_id, admin_pcode);

CREATE INDEX IF NOT EXISTS idx_dataset_values_numeric_admin 
  ON public.dataset_values_numeric(admin_pcode);

-- Indexes for admin_boundaries (used for parent_pcode lookups)
CREATE INDEX IF NOT EXISTS idx_admin_boundaries_level_country 
  ON public.admin_boundaries(admin_level, country_id);

CREATE INDEX IF NOT EXISTS idx_admin_boundaries_parent_country 
  ON public.admin_boundaries(parent_pcode, admin_level, country_id);

CREATE INDEX IF NOT EXISTS idx_admin_boundaries_pcode_level 
  ON public.admin_boundaries(admin_pcode, admin_level, country_id);

-- Indexes for datasets (used for finding population/poverty datasets)
CREATE INDEX IF NOT EXISTS idx_datasets_country_type_level 
  ON public.datasets(country_id, type, admin_level);

CREATE INDEX IF NOT EXISTS idx_datasets_country_name 
  ON public.datasets(country_id, name);

-- Indexes for instance_dataset_scores (used in framework aggregation)
CREATE INDEX IF NOT EXISTS idx_instance_dataset_scores_instance_dataset 
  ON public.instance_dataset_scores(instance_id, dataset_id);

CREATE INDEX IF NOT EXISTS idx_instance_dataset_scores_admin 
  ON public.instance_dataset_scores(admin_pcode);

-- Indexes for hazard_event_scores (used in framework aggregation)
CREATE INDEX IF NOT EXISTS idx_hazard_event_scores_instance 
  ON public.hazard_event_scores(instance_id, hazard_event_id);

CREATE INDEX IF NOT EXISTS idx_hazard_event_scores_admin 
  ON public.hazard_event_scores(admin_pcode);

-- Indexes for instances (used in all functions)
CREATE INDEX IF NOT EXISTS idx_instances_country 
  ON public.instances(country_id);

-- Indexes for instance_datasets (used in scoring)
CREATE INDEX IF NOT EXISTS idx_instance_datasets_instance_dataset 
  ON public.instance_datasets(instance_id, dataset_id);

-- Indexes for hazard_events (used in scoring)
CREATE INDEX IF NOT EXISTS idx_hazard_events_instance_country 
  ON public.hazard_events(instance_id, country_id);

-- Composite index for admin_boundaries lookups in get_instance_summary
-- This helps with the ADM4 -> ADM3 parent_pcode joins
CREATE INDEX IF NOT EXISTS idx_admin_boundaries_adm4_parent 
  ON public.admin_boundaries(admin_pcode, parent_pcode, admin_level, country_id)
  WHERE UPPER(TRIM(admin_level)) = 'ADM4';

-- Analyze tables to update statistics for query planner
ANALYZE public.instance_category_scores;
ANALYZE public.dataset_values_numeric;
ANALYZE public.admin_boundaries;
ANALYZE public.datasets;
ANALYZE public.instance_dataset_scores;
ANALYZE public.hazard_event_scores;
ANALYZE public.instances;

COMMENT ON INDEX idx_instance_category_scores_instance_category IS 'Speeds up queries filtering by instance_id and category (used in get_instance_summary and scoring functions)';
COMMENT ON INDEX idx_instance_category_scores_instance_category_score IS 'Speeds up queries for people_concern calculation (severity >= 3)';
COMMENT ON INDEX idx_dataset_values_numeric_dataset_admin IS 'Speeds up population and poverty dataset value lookups';
COMMENT ON INDEX idx_admin_boundaries_parent_country IS 'Speeds up parent_pcode lookups for ADM4 -> ADM3 aggregation';
