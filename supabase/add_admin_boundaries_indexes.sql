-- ==============================
-- ADMIN BOUNDARIES PERFORMANCE INDEXES
-- ==============================
-- Large instances now select dozens of ADM2 regions simultaneously.
-- The affected-area queries rely heavily on parent_pcode lookups.
-- Add supporting indexes to keep RPCs (get_instance_summary, score functions)
-- under the default PostgREST statement timeout.

CREATE INDEX IF NOT EXISTS idx_admin_boundaries_parent_pcode
  ON public.admin_boundaries(parent_pcode);

CREATE INDEX IF NOT EXISTS idx_admin_boundaries_level_parent
  ON public.admin_boundaries(UPPER(TRIM(admin_level)), parent_pcode);

