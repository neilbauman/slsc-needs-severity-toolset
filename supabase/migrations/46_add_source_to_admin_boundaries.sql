-- ==============================
-- ADD SOURCE TO ADMIN BOUNDARY DATASETS
-- ==============================
-- This migration adds source information to admin boundary datasets
-- Admin boundaries typically come from OCHA HDX (Humanitarian Data Exchange)

-- Update any existing admin boundary datasets with source information
-- Note: This assumes admin boundaries were uploaded as datasets
-- If admin boundaries are only in admin_boundaries table, this won't find them
-- In that case, you may need to create dataset entries for them

UPDATE datasets
SET 
  source = 'OCHA HDX',
  metadata = COALESCE(metadata, '{}'::jsonb) || 
    jsonb_build_object(
      'source_link', 
      CASE 
        WHEN country_id = (SELECT id FROM countries WHERE iso_code = 'PHL') THEN 
          'https://data.humdata.org/dataset/cod-ab-phl'
        WHEN country_id = (SELECT id FROM countries WHERE iso_code = 'LKA') THEN 
          'https://data.humdata.org/dataset/cod-ab-lka'
        WHEN country_id = (SELECT id FROM countries WHERE iso_code = 'BGD') THEN 
          'https://data.humdata.org/dataset/cod-ab-bgd'
        WHEN country_id = (SELECT id FROM countries WHERE iso_code = 'MOZ') THEN 
          'https://data.humdata.org/dataset/cod-ab-moz'
        WHEN country_id = (SELECT id FROM countries WHERE iso_code = 'PSE') THEN 
          'https://data.humdata.org/dataset/cod-ab-pse'
        ELSE 
          'https://data.humdata.org/organization/ocha'
      END
    )
WHERE 
  (name ILIKE '%admin%boundary%' 
   OR name ILIKE '%boundary%'
   OR description ILIKE '%admin%boundary%'
   OR description ILIKE '%administrative%boundary%')
  AND source IS NULL;

-- Add comment
COMMENT ON COLUMN datasets.source IS 'Data source name (e.g., OCHA HDX, World Bank)';
COMMENT ON COLUMN datasets.metadata IS 'Additional metadata including source_link for URLs';
