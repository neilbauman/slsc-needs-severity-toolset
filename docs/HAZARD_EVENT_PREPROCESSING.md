# Hazard Event Preprocessing

## Automatic Polygon Filtering for Typhoon Events

The system now automatically filters out Polygon and MultiPolygon features (cone) from typhoon events during upload, keeping only LineString/MultiLineString features (track). This ensures cleaner visualization and more accurate distance-based scoring.

## How It Works

### During Upload

When uploading a typhoon event:
1. The system detects `event_type = 'typhoon'`
2. Automatically filters out Polygon/MultiPolygon features
3. Keeps only LineString, MultiLineString, Point, and MultiPoint features
4. Stores the filtered GeoJSON in the database
5. Records original feature count in metadata

### When Retrieving

The `get_hazard_events_for_instance` function also filters polygons for typhoon events as a safety measure, ensuring polygons are never displayed even if they exist in the stored data.

## Updating Existing Typhoon Events

If you have existing typhoon events with polygon features that you want to filter:

1. **Run the SQL script** in Supabase SQL Editor:
   ```sql
   -- See: supabase/filter_typhoon_polygon_features.sql
   ```

2. **Or manually update** via SQL:
   ```sql
   UPDATE public.hazard_events
   SET metadata = jsonb_set(
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
   )
   WHERE event_type = 'typhoon'
     AND metadata->'original_geojson' IS NOT NULL;
   ```

## Future Preprocessing Options

The preprocessing system can be extended to:
- Filter by magnitude ranges
- Remove duplicate features
- Simplify geometries for performance
- Normalize coordinate systems
- Validate and clean feature properties

## Metadata

The preprocessing status is stored in metadata:
- `preprocessing_applied`: Indicates what preprocessing was done
- `original_feature_count`: Original number of features before filtering
- `feature_count`: Final number of features after filtering

