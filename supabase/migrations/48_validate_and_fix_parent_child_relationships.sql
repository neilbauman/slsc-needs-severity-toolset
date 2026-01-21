-- ==============================
-- VALIDATE AND FIX PARENT/CHILD RELATIONSHIPS
-- ==============================
-- This migration validates and fixes parent/child relationships in admin_boundaries
-- Ensures all child boundaries have valid parent_pcode references

-- Function to validate and report parent/child issues
CREATE OR REPLACE FUNCTION public.validate_parent_child_relationships(
  p_country_id UUID DEFAULT NULL
)
RETURNS TABLE(
  country_code TEXT,
  admin_level TEXT,
  total_count INTEGER,
  orphans_count INTEGER,
  invalid_parents_count INTEGER,
  valid_parents_count INTEGER,
  issues TEXT[]
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_country RECORD;
  v_level TEXT;
  v_parent_level TEXT;
  v_total INTEGER;
  v_orphans INTEGER;
  v_invalid INTEGER;
  v_valid INTEGER;
  v_issues TEXT[];
  v_pcode TEXT;
  v_parent_pcode TEXT;
BEGIN
  -- Loop through each country
  FOR v_country IN 
    SELECT DISTINCT 
      ab.country_id,
      c.iso_code
    FROM admin_boundaries ab
    JOIN countries c ON c.id = ab.country_id
    WHERE (p_country_id IS NULL OR ab.country_id = p_country_id)
  LOOP
    -- Check each admin level
    FOR v_level IN SELECT DISTINCT admin_level FROM admin_boundaries WHERE country_id = v_country.country_id ORDER BY admin_level
    LOOP
      -- Get level number
      DECLARE
        v_level_num INTEGER := CAST(SUBSTRING(v_level FROM 4) AS INTEGER);
      BEGIN
        v_total := 0;
        v_orphans := 0;
        v_invalid := 0;
        v_valid := 0;
        v_issues := ARRAY[]::TEXT[];
        
        -- Count total
        SELECT COUNT(*) INTO v_total
        FROM admin_boundaries
        WHERE country_id = v_country.country_id
          AND admin_level = v_level;
        
        -- For ADM0, no parent needed
        IF v_level_num = 0 THEN
          RETURN QUERY SELECT 
            v_country.iso_code,
            v_level,
            v_total,
            0,
            0,
            0,
            ARRAY[]::TEXT[];
          CONTINUE;
        END IF;
        
        -- Get parent level
        v_parent_level := 'ADM' || (v_level_num - 1);
        
        -- Count orphans (no parent_pcode)
        SELECT COUNT(*) INTO v_orphans
        FROM admin_boundaries
        WHERE country_id = v_country.country_id
          AND admin_level = v_level
          AND parent_pcode IS NULL;
        
        -- Check invalid parent references
        FOR v_pcode, v_parent_pcode IN
          SELECT admin_pcode, parent_pcode
          FROM admin_boundaries
          WHERE country_id = v_country.country_id
            AND admin_level = v_level
            AND parent_pcode IS NOT NULL
        LOOP
          -- Check if parent exists
          IF EXISTS (
            SELECT 1 FROM admin_boundaries
            WHERE country_id = v_country.country_id
              AND admin_level = v_parent_level
              AND admin_pcode = v_parent_pcode
          ) THEN
            v_valid := v_valid + 1;
          ELSE
            v_invalid := v_invalid + 1;
            v_issues := array_append(v_issues, format('%s -> %s (parent not found)', v_pcode, v_parent_pcode));
          END IF;
        END LOOP;
        
        RETURN QUERY SELECT 
          v_country.iso_code,
          v_level,
          v_total,
          v_orphans,
          v_invalid,
          v_valid,
          v_issues;
      END;
    END LOOP;
  END LOOP;
END;
$$;

-- Function to auto-fix parent/child relationships where possible
CREATE OR REPLACE FUNCTION public.fix_parent_child_relationships(
  p_country_id UUID DEFAULT NULL
)
RETURNS TABLE(
  country_code TEXT,
  admin_level TEXT,
  fixed_count INTEGER,
  remaining_issues INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_country RECORD;
  v_level TEXT;
  v_parent_level TEXT;
  v_fixed INTEGER;
  v_remaining INTEGER;
BEGIN
  -- Loop through each country
  FOR v_country IN 
    SELECT DISTINCT 
      ab.country_id,
      c.iso_code
    FROM admin_boundaries ab
    JOIN countries c ON c.id = ab.country_id
    WHERE (p_country_id IS NULL OR ab.country_id = p_country_id)
  LOOP
    -- Fix each admin level (starting from ADM1)
    FOR v_level IN SELECT DISTINCT admin_level FROM admin_boundaries 
      WHERE country_id = v_country.country_id 
        AND admin_level != 'ADM0'
      ORDER BY admin_level
    LOOP
      DECLARE
        v_level_num INTEGER := CAST(SUBSTRING(v_level FROM 4) AS INTEGER);
      BEGIN
        v_parent_level := 'ADM' || (v_level_num - 1);
        v_fixed := 0;
        v_remaining := 0;
        
        -- Try to fix boundaries with missing or invalid parent_pcode
        -- by inferring from admin_pcode structure (e.g., BD20030004 -> BD2003)
        UPDATE admin_boundaries ab
        SET parent_pcode = (
          SELECT parent.admin_pcode
          FROM admin_boundaries parent
          WHERE parent.country_id = ab.country_id
            AND parent.admin_level = v_parent_level
            AND (
              -- Try to match by pcode prefix (e.g., BD20030004 starts with BD2003)
              ab.admin_pcode LIKE parent.admin_pcode || '%'
              OR parent.admin_pcode = SUBSTRING(ab.admin_pcode FROM 1 FOR LENGTH(parent.admin_pcode))
            )
          LIMIT 1
        )
        WHERE ab.country_id = v_country.country_id
          AND ab.admin_level = v_level
          AND (
            ab.parent_pcode IS NULL
            OR NOT EXISTS (
              SELECT 1 FROM admin_boundaries p
              WHERE p.country_id = ab.country_id
                AND p.admin_level = v_parent_level
                AND p.admin_pcode = ab.parent_pcode
            )
          )
          AND EXISTS (
            SELECT 1 FROM admin_boundaries parent
            WHERE parent.country_id = ab.country_id
              AND parent.admin_level = v_parent_level
              AND (
                ab.admin_pcode LIKE parent.admin_pcode || '%'
                OR parent.admin_pcode = SUBSTRING(ab.admin_pcode FROM 1 FOR LENGTH(parent.admin_pcode))
              )
          );
        
        GET DIAGNOSTICS v_fixed = ROW_COUNT;
        
        -- Count remaining issues
        SELECT COUNT(*) INTO v_remaining
        FROM admin_boundaries ab
        WHERE ab.country_id = v_country.country_id
          AND ab.admin_level = v_level
          AND (
            ab.parent_pcode IS NULL
            OR NOT EXISTS (
              SELECT 1 FROM admin_boundaries p
              WHERE p.country_id = ab.country_id
                AND p.admin_level = v_parent_level
                AND p.admin_pcode = ab.parent_pcode
            )
          );
        
        RETURN QUERY SELECT 
          v_country.iso_code,
          v_level,
          v_fixed,
          v_remaining;
      END;
    END LOOP;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.validate_parent_child_relationships IS 'Validates parent/child relationships in admin_boundaries and reports issues';
COMMENT ON FUNCTION public.fix_parent_child_relationships IS 'Attempts to auto-fix parent/child relationships by inferring from pcode structure';
