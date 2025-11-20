-- ============================================
-- Drop all versions of score_numeric_auto
-- ============================================
-- Run this FIRST if you get "function name is not unique" error
-- Then run the CREATE function
-- ============================================

DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT oid::regprocedure AS func_signature
    FROM pg_proc
    WHERE proname = 'score_numeric_auto'
      AND pronamespace = 'public'::regnamespace
  ) LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
  END LOOP;
END $$;

