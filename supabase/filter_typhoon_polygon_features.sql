-- ==============================
-- FILTER TYPHOON POLYGON FEATURES
-- ==============================
-- This script removes Polygon/MultiPolygon features (cone) from typhoon events
-- Keeps only LineString/MultiLineString features (track)
-- Run this to update existing typhoon events in the database

UPDATE public.hazard_events
SET metadata = 
  jsonb_set(
    jsonb_set(
      jsonb_set(
        metadata,
        '{original_geojson}',
        (
          SELECT jsonb_build_object(
            'type', 'FeatureCollection',
            'features', jsonb_agg(feature)
          )
          FROM jsonb_array_elements(metadata->'original_geojson'->'features') AS feature
          WHERE LOWER(COALESCE(feature->'geometry'->>'type', '')) IN ('linestring', 'multilinestring', 'point', 'multipoint')
        )
      ),
      '{preprocessing_applied}',
      '"polygon_features_removed"'
    ),
    '{original_feature_count}',
    to_jsonb(jsonb_array_length(metadata->'original_geojson'->'features'))
  )
WHERE event_type = 'typhoon'
  AND metadata->'original_geojson' IS NOT NULL
  AND jsonb_array_length(metadata->'original_geojson'->'features') > 0;

-- Show results
SELECT 
  id,
  name,
  event_type,
  jsonb_array_length(metadata->'original_geojson'->'features') AS feature_count,
  metadata->>'preprocessing_applied' AS preprocessing_applied
FROM public.hazard_events
WHERE event_type = 'typhoon';

