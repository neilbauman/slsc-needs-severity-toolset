'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface MagnitudeRange {
  min: number;
  max: number;
  score: number | '';
}

interface DistanceRange {
  min: number; // meters
  max: number; // meters
  score: number | '';
}

interface LocationPreview {
  admin_pcode: string;
  admin_name: string;
  magnitude_value: number;
  calculatedScore?: number;
}

interface HazardEventScoringModalProps {
  hazardEvent: any;
  instance: any;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export default function HazardEventScoringModal({
  hazardEvent,
  instance,
  onClose,
  onSaved,
}: HazardEventScoringModalProps) {
  const [ranges, setRanges] = useState<MagnitudeRange[]>([
    { min: 0, max: 4.0, score: 1 },
    { min: 4.0, max: 5.0, score: 2 },
    { min: 5.0, max: 6.0, score: 3 },
    { min: 6.0, max: 7.0, score: 4 },
    { min: 7.0, max: 10.0, score: 5 },
  ]);
  const [magnitudeStats, setMagnitudeStats] = useState<{ min: number; max: number; unique: number[] } | null>(null);
  const [previewLocations, setPreviewLocations] = useState<LocationPreview[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [matchingMethod, setMatchingMethod] = useState<'centroid' | 'intersection' | 'overlap' | 'within_distance' | 'point_on_surface'>('centroid');
  const [distanceThreshold, setDistanceThreshold] = useState<number>(10000);
  const [scoringMode, setScoringMode] = useState<'magnitude' | 'distance'>('magnitude'); // 'magnitude' or 'distance'
  const [distanceRanges, setDistanceRanges] = useState<DistanceRange[]>([
    { min: 0, max: 50, score: 5 },      // 0-50km: highest risk (stored as km, converted to meters)
    { min: 50, max: 100, score: 4 }, // 50-100km: high risk
    { min: 100, max: 200, score: 3 }, // 100-200km: medium risk
    { min: 200, max: 300, score: 2 }, // 200-300km: low risk
    { min: 300, max: 1000, score: 1 }, // 300km+: minimal risk
  ]);

  // Detect scoring mode and load statistics
  useEffect(() => {
    const loadEventStats = async () => {
      if (!hazardEvent?.id) return;

      try {
        const metadata = hazardEvent.metadata || {};
        const originalGeoJson = metadata.original_geojson;
        const magnitudeField = hazardEvent.magnitude_field || 'value';
        const eventType = hazardEvent.event_type || 'earthquake';

        // Detect if this is a track-type event (typhoon, storm track) that should use distance-based scoring
        // Check if event_type is 'typhoon' or if there are no magnitude values in the features
        let hasMagnitudeValues = false;
        if (originalGeoJson && originalGeoJson.features) {
          for (const feature of originalGeoJson.features.slice(0, 10)) {
            if (feature.properties && feature.properties[magnitudeField] !== undefined) {
              const val = Number(feature.properties[magnitudeField]);
              if (!isNaN(val)) {
                hasMagnitudeValues = true;
                break;
              }
            }
          }
        }

        // If event_type is typhoon or no magnitude values found, use distance-based scoring
        if (eventType === 'typhoon' || !hasMagnitudeValues) {
          setScoringMode('distance');
        } else {
          setScoringMode('magnitude');
          
          // Load magnitude statistics
          const values: number[] = [];
          originalGeoJson.features.forEach((feature: any) => {
            if (feature.properties && feature.properties[magnitudeField] !== undefined) {
              const val = Number(feature.properties[magnitudeField]);
              if (!isNaN(val)) {
                values.push(val);
              }
            }
          });

          if (values.length > 0) {
            const unique = [...new Set(values)].sort((a, b) => a - b);
            setMagnitudeStats({
              min: Math.min(...values),
              max: Math.max(...values),
              unique: unique,
            });

            // Auto-adjust ranges based on data
            if (ranges.length === 5 && ranges[0].min === 0 && ranges[4].max === 10.0) {
              const minVal = Math.min(...values);
              const maxVal = Math.max(...values);
              const range = maxVal - minVal;
              const step = range / 5;

              setRanges([
                { min: minVal, max: minVal + step, score: 1 },
                { min: minVal + step, max: minVal + step * 2, score: 2 },
                { min: minVal + step * 2, max: minVal + step * 3, score: 3 },
                { min: minVal + step * 3, max: minVal + step * 4, score: 4 },
                { min: minVal + step * 4, max: maxVal + 0.1, score: 5 },
              ]);
            }
          }
        }
      } catch (err) {
        console.error('Error loading event stats:', err);
      }
    };

    loadEventStats();
  }, [hazardEvent]);

  // Load saved configuration
  useEffect(() => {
    const loadSavedConfig = async () => {
      if (!instance?.id || !hazardEvent?.id) return;

      // For now, we'll store config in a separate table or metadata
      // Check if there's a saved config
      const { data } = await supabase
        .from('hazard_events')
        .select('metadata')
        .eq('id', hazardEvent.id)
        .single();

      if (data?.metadata?.score_config) {
        const cfg = data.metadata.score_config;
        if (cfg.ranges) {
          setRanges(cfg.ranges);
        }
        if (cfg.distance_ranges) {
          // Convert saved meters to km for display
          const rangesInKm = cfg.distance_ranges.map((r: any) => ({
            min: (r.min || 0) / 1000,
            max: (r.max || 0) / 1000,
            score: r.score,
          }));
          setDistanceRanges(rangesInKm);
        }
        if (cfg.scoring_mode) {
          setScoringMode(cfg.scoring_mode);
        }
        setMessage("✅ Loaded existing scoring configuration");
        setTimeout(() => setMessage(""), 3000);
      }
    };

    loadSavedConfig();
  }, [instance, hazardEvent]);

  const handleRangeChange = (index: number, field: 'min' | 'max' | 'score', value: string) => {
    const newRanges = [...ranges];
    if (field === 'score') {
      const parsed = value === '' ? '' : Math.max(1, Math.min(5, parseInt(value) || 1));
      newRanges[index].score = parsed;
    } else {
      const parsed = parseFloat(value) || 0;
      newRanges[index][field] = parsed;
    }
    setRanges(newRanges);
  };

  const handleDistanceRangeChange = (index: number, field: 'min' | 'max' | 'score', value: string) => {
    const newRanges = [...distanceRanges];
    if (field === 'score') {
      const parsed = value === '' ? '' : Math.max(1, Math.min(5, parseInt(value) || 1));
      newRanges[index].score = parsed;
    } else {
      // For distance fields, parse as float (in km)
      const parsed = value === '' ? 0 : parseFloat(value) || 0;
      newRanges[index][field] = parsed;
    }
    setDistanceRanges(newRanges);
  };

  const addRange = () => {
    if (scoringMode === 'magnitude') {
      const lastRange = ranges[ranges.length - 1];
      setRanges([
        ...ranges,
        { min: lastRange.max, max: lastRange.max + 1, score: '' },
      ]);
    } else {
      const lastRange = distanceRanges[distanceRanges.length - 1];
      setDistanceRanges([
        ...distanceRanges,
        { min: lastRange.max, max: lastRange.max + 50, score: '' }, // Add 50km increments
      ]);
    }
  };

  const removeRange = (index: number) => {
    if (scoringMode === 'magnitude') {
      if (ranges.length <= 1) return;
      setRanges(ranges.filter((_, i) => i !== index));
    } else {
      if (distanceRanges.length <= 1) return;
      setDistanceRanges(distanceRanges.filter((_, i) => i !== index));
    }
  };

  const calculatePreview = async () => {
    if (!hazardEvent?.id || !instance?.id) return;

    setLoadingPreview(true);
    try {
      // Get sample admin areas from affected areas
      const { data: affectedAreas } = await supabase
        .from('affected_areas')
        .select('admin_pcode')
        .eq('instance_id', instance.id)
        .limit(10);

      if (!affectedAreas || affectedAreas.length === 0) {
        setPreviewLocations([]);
        setLoadingPreview(false);
        return;
      }

      // For preview, we'll simulate by getting admin boundaries and calculating centroids
      // Then we'd find the nearest contour, but for preview we'll use sample data
      const previews: LocationPreview[] = [];

      // Get admin boundary names
      const adminPcodes = affectedAreas.map(a => a.admin_pcode);
      const { data: boundaries } = await supabase
        .from('admin_boundaries')
        .select('admin_pcode, name')
        .in('admin_pcode', adminPcodes.slice(0, 5));

      // For preview, simulate magnitude values based on ranges
      (boundaries || []).forEach((boundary, idx) => {
        const magnitudeValue = magnitudeStats
          ? magnitudeStats.min + (magnitudeStats.max - magnitudeStats.min) * (idx / (boundaries?.length || 1))
          : 5.0;

        // Find which range this magnitude falls into
        const range = ranges.find(
          r => magnitudeValue >= r.min && magnitudeValue < r.max
        ) || ranges[ranges.length - 1];

        previews.push({
          admin_pcode: boundary.admin_pcode,
          admin_name: boundary.name || boundary.admin_pcode,
          magnitude_value: magnitudeValue,
          calculatedScore: typeof range.score === 'number' ? range.score : undefined,
        });
      });

      setPreviewLocations(previews);
    } catch (err) {
      console.error('Error calculating preview:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!instance?.id || !hazardEvent?.id) return;

    setSaving(true);
    const config = {
      ranges: scoringMode === 'magnitude' ? ranges.filter(r => r.score !== '') : null,
      distance_ranges: scoringMode === 'distance' 
        ? distanceRanges.filter(r => r.score !== '').map(r => ({
            min: r.min * 1000, // Convert km to meters for storage
            max: r.max * 1000,
            score: r.score,
          }))
        : null,
      scoring_mode: scoringMode,
    };

    // Store in metadata
    const { error } = await supabase
      .from('hazard_events')
      .update({
        metadata: {
          ...(hazardEvent.metadata || {}),
          score_config: config,
        },
      })
      .eq('id', hazardEvent.id);

    if (error) {
      setMessage(`❌ Error saving config: ${error.message}`);
      console.error("Save config error:", error);
    } else {
      setMessage("✅ Config saved! (Note: This does not apply scoring - use 'Apply Scoring' button)");
    }
    setSaving(false);
  };

  const handleApplyScoring = async () => {
    if (!instance?.id || !hazardEvent?.id) {
      alert('Missing instance or hazard event ID.');
      return;
    }

    // Validate based on scoring mode
    if (scoringMode === 'magnitude') {
      const unscored = ranges.filter((r) => r.score === '');
      if (unscored.length > 0) {
        alert(`Please assign scores to all magnitude ranges. Missing scores for ${unscored.length} range(s).`);
        return;
      }

      // Validate ranges don't overlap incorrectly
      for (let i = 0; i < ranges.length - 1; i++) {
        if (ranges[i].max > ranges[i + 1].min) {
          alert(`Ranges overlap incorrectly. Range ${i + 1} max (${ranges[i].max}) should be <= Range ${i + 2} min (${ranges[i + 1].min}).`);
          return;
        }
      }
    } else {
      // Distance-based scoring
      const unscored = distanceRanges.filter((r) => r.score === '');
      if (unscored.length > 0) {
        alert(`Please assign scores to all distance ranges. Missing scores for ${unscored.length} range(s).`);
        return;
      }

      // Validate ranges don't overlap incorrectly
      for (let i = 0; i < distanceRanges.length - 1; i++) {
        if (distanceRanges[i].max > distanceRanges[i + 1].min) {
          alert(`Ranges overlap incorrectly. Range ${i + 1} max (${distanceRanges[i].max}m) should be <= Range ${i + 2} min (${distanceRanges[i + 1].min}m).`);
          return;
        }
      }
    }

    setLoading(true);
    setMessage("Applying scoring...");

    // Determine if we should limit to affected areas
    const limitToAffected = instance?.admin_scope && Array.isArray(instance.admin_scope) && instance.admin_scope.length > 0;

    let rpcParams: any = {
      in_hazard_event_id: hazardEvent.id,
      in_instance_id: instance.id,
      in_limit_to_affected: limitToAffected,
      in_matching_method: matchingMethod,
      in_distance_meters: matchingMethod === 'within_distance' ? distanceThreshold : null,
    };

    if (scoringMode === 'magnitude') {
      const magnitudeRanges = ranges
        .filter((r) => r.score !== '')
        .map((r) => ({
          min: Number(r.min),
          max: Number(r.max),
          score: Number(r.score),
        }));
      rpcParams.in_magnitude_ranges = magnitudeRanges;
      // Don't include in_distance_ranges for magnitude-based scoring
      delete rpcParams.in_distance_ranges;
    } else {
      // Distance-based scoring - convert km to meters for backend
      const distRanges = distanceRanges
        .filter((r) => r.score !== '')
        .map((r) => ({
          min: Number(r.min) * 1000, // Convert km to meters
          max: Number(r.max) * 1000, // Convert km to meters
          score: Number(r.score),
        }));
      rpcParams.in_distance_ranges = distRanges;
      // Don't include in_magnitude_ranges for distance-based scoring
      delete rpcParams.in_magnitude_ranges;
    }

    const { data, error } = await supabase.rpc('score_hazard_event', rpcParams);

    if (error) {
      console.error('Error applying scoring:', error);
      setMessage(`❌ Error applying scoring: ${error.message}`);
      setLoading(false);
      return;
    }

    console.log('Scoring applied successfully:', data);
    
    // Check if scores were actually created
    if (data && typeof data === 'object') {
      const scoredLocations = data.scored_locations || data.scored_count || 0;
      const totalAdminAreas = data.total_admin_areas || 0;
      const skippedNoGeom = data.skipped_no_geometry || 0;
      const skippedNoMagnitude = data.skipped_no_magnitude || 0;
      const message = data.message || '';
      
      if (scoredLocations === 0) {
        let errorMsg = `⚠️ Warning: Scoring completed but no locations were scored.\n\n`;
        errorMsg += `Total admin areas processed: ${totalAdminAreas}\n`;
        if (skippedNoGeom > 0) {
          errorMsg += `- ${skippedNoGeom} skipped (no geometry found)\n`;
        }
        if (skippedNoMagnitude > 0) {
          errorMsg += `- ${skippedNoMagnitude} skipped (no magnitude value found)\n`;
        }
        if (message) {
          errorMsg += `\nDetails: ${message}`;
        }
        errorMsg += `\n\nPossible causes:\n`;
        errorMsg += `- Geometry column not found in admin_boundaries table\n`;
        errorMsg += `- No admin boundaries match the affected area scope\n`;
        errorMsg += `- Magnitude values from GeoJSON don't match admin area centroids\n`;
        errorMsg += `- Magnitude field name mismatch (check metadata)`;
        setMessage(errorMsg);
        setLoading(false);
        return;
      }
      setMessage(`✅ Scoring complete! ${scoredLocations} locations scored with average score of ${(data.average_score || 0).toFixed(2)}.`);
    } else {
      setMessage("✅ Scoring complete! Scores calculated for all locations.");
    }

    // Save config after successful scoring
    await handleSaveConfig();

    // Close and refresh parent
    if (onSaved) await onSaved();
    setTimeout(() => {
      onClose();
    }, 1500);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-1">
          {hazardEvent?.name || 'Hazard Event'}
        </h2>
        <p className="text-gray-600 mb-4">
          {scoringMode === 'magnitude' 
            ? 'Map magnitude/intensity ranges to vulnerability scores (1–5). Higher magnitudes should generally receive higher scores.'
            : 'Map distance thresholds from the storm track to vulnerability scores (1–5). Closer distances should receive higher scores.'}
        </p>

        {/* Scoring Mode Indicator */}
        <div className="mb-4 p-2 border rounded bg-blue-50">
          <p className="text-sm">
            <strong>Scoring Mode:</strong> {scoringMode === 'magnitude' ? 'Magnitude-based' : 'Distance-based (from track)'}
            {scoringMode === 'distance' && (
              <span className="ml-2 text-xs text-gray-600">
                (Detected track-type event - scoring by distance from storm path)
              </span>
            )}
          </p>
        </div>

        {/* Magnitude Statistics (only for magnitude-based scoring) */}
        {scoringMode === 'magnitude' && magnitudeStats && (
          <div className="mb-4 p-3 border rounded bg-blue-50">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">Magnitude Statistics</h3>
            <div className="text-sm text-blue-700">
              <p><strong>Range:</strong> {magnitudeStats.min.toFixed(2)} - {magnitudeStats.max.toFixed(2)}</p>
              <p><strong>Unique Values:</strong> {magnitudeStats.unique.length}</p>
              <p className="text-xs mt-1">
                <strong>Sample Values:</strong> {magnitudeStats.unique.slice(0, 10).join(', ')}
                {magnitudeStats.unique.length > 10 && ' ...'}
              </p>
            </div>
          </div>
        )}

        {/* Distance-based scoring info */}
        {scoringMode === 'distance' && (
          <div className="mb-4 p-3 border rounded bg-green-50">
            <h3 className="text-sm font-semibold text-green-800 mb-2">Distance-Based Scoring</h3>
            <div className="text-sm text-green-700">
              <p>This event will be scored based on distance from administrative boundaries to the storm track.</p>
              <p className="text-xs mt-1">
                Distance is calculated from the boundary center (centroid) to the nearest point on the track.
              </p>
            </div>
          </div>
        )}

        {/* Spatial Matching Method Selection */}
        <div className="mb-4 p-3 border rounded bg-gray-50">
          <h3 className="text-sm font-semibold mb-2">Spatial Matching Method</h3>
          <p className="text-xs text-gray-600 mb-2">
            {scoringMode === 'magnitude' 
              ? 'Choose how to match shake map contours to administrative boundaries:'
              : 'For distance-based scoring, the centroid method is used to calculate distance from boundary center to track.'}
          </p>
          <div className="space-y-2">
            <div>
              <label className="text-xs font-medium">Method:</label>
              <select
                value={matchingMethod}
                onChange={(e) => setMatchingMethod(e.target.value as any)}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm mt-1"
              >
                <option value="centroid">Centroid (default) - Find nearest contour to boundary center</option>
                <option value="point_on_surface">Point on Surface - Use representative point inside boundary</option>
                <option value="intersection">Intersection - Use contour that intersects the boundary</option>
                <option value="overlap">Maximum Overlap - Use contour with most area overlap</option>
                <option value="within_distance">Within Distance - Find contours within distance threshold</option>
              </select>
            </div>
            {matchingMethod === 'within_distance' && (
              <div>
                <label className="text-xs font-medium">Distance Threshold (meters):</label>
                <input
                  type="number"
                  min="100"
                  max="100000"
                  step="1000"
                  value={distanceThreshold}
                  onChange={(e) => setDistanceThreshold(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm mt-1"
                  placeholder="10000"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Contours within this distance of the boundary will be considered
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Range Mapping - Magnitude or Distance */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold">
              {scoringMode === 'magnitude' 
                ? 'Magnitude Range to Score Mapping' 
                : 'Distance Range to Score Mapping (from track)'}
            </h3>
            <button
              onClick={addRange}
              className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded"
            >
              + Add Range
            </button>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="text-left p-2 font-medium">
                  {scoringMode === 'magnitude' ? 'Min' : 'Min (km)'}
                </th>
                <th className="text-left p-2 font-medium">
                  {scoringMode === 'magnitude' ? 'Max' : 'Max (km)'}
                </th>
                <th className="text-left p-2 font-medium w-32">Score (1–5)</th>
                <th className="text-left p-2 font-medium w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(scoringMode === 'magnitude' ? ranges : distanceRanges).map((range, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="p-2">
                    <input
                      type="number"
                      step={scoringMode === 'magnitude' ? "0.1" : "1"}
                      value={range.min}
                      onChange={(e) => scoringMode === 'magnitude' 
                        ? handleRangeChange(i, 'min', e.target.value)
                        : handleDistanceRangeChange(i, 'min', e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 w-24"
                      style={{ 
                        // Remove spinner arrows for better typing experience
                        MozAppearance: 'textfield',
                        WebkitAppearance: 'none',
                      }}
                      onWheel={(e) => {
                        // Prevent accidental changes when scrolling
                        e.currentTarget.blur();
                      }}
                    />
                    {scoringMode === 'distance' && (
                      <span className="text-xs text-gray-500 ml-1">km</span>
                    )}
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      step={scoringMode === 'magnitude' ? "0.1" : "1"}
                      value={range.max}
                      onChange={(e) => scoringMode === 'magnitude'
                        ? handleRangeChange(i, 'max', e.target.value)
                        : handleDistanceRangeChange(i, 'max', e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 w-24"
                      style={{ 
                        // Remove spinner arrows for better typing experience
                        MozAppearance: 'textfield',
                        WebkitAppearance: 'none',
                      }}
                      onWheel={(e) => {
                        // Prevent accidental changes when scrolling
                        e.currentTarget.blur();
                      }}
                    />
                    {scoringMode === 'distance' && (
                      <span className="text-xs text-gray-500 ml-1">km</span>
                    )}
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={range.score}
                      onChange={(e) => scoringMode === 'magnitude'
                        ? handleRangeChange(i, 'score', e.target.value)
                        : handleDistanceRangeChange(i, 'score', e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 w-20"
                      placeholder="1-5"
                    />
                  </td>
                  <td className="p-2">
                    {(scoringMode === 'magnitude' ? ranges : distanceRanges).length > 1 && (
                      <button
                        onClick={() => removeRange(i)}
                        className="text-red-600 hover:text-red-800 text-xs"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-600 mt-2">
            {scoringMode === 'magnitude' 
              ? 'Ranges should be non-overlapping and cover the full magnitude range. Higher magnitudes should map to higher scores (5 = most vulnerable).'
              : 'Ranges should be non-overlapping and cover the full distance range. Closer distances should map to higher scores (5 = most vulnerable). Distance is measured in kilometers from the admin area to the nearest point on the storm track.'}
          </p>
        </div>

        {/* Preview Section */}
        {previewLocations.length > 0 && (
          <div className="mb-4 p-3 border rounded bg-blue-50">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold text-blue-800">Preview: Score Calculation</h3>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                {showPreview ? 'Hide' : 'Show'} Preview
              </button>
            </div>
            {showPreview && (
              <div className="text-xs space-y-2">
                {previewLocations.map((loc, idx) => (
                  <div key={idx} className="border rounded p-2 bg-white">
                    <div className="font-medium mb-1">{loc.admin_name} ({loc.admin_pcode})</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-gray-600">Magnitude</div>
                        <div className="font-semibold">{loc.magnitude_value.toFixed(2)}</div>
                      </div>
                      {loc.calculatedScore !== undefined && (
                        <div>
                          <div className="text-gray-600">Calculated Score</div>
                          <div className="font-bold text-blue-700">{loc.calculatedScore}</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <p className="text-gray-600 italic text-xs mt-2">
                  Showing sample locations. All affected areas will be scored when you apply.
                </p>
              </div>
            )}
          </div>
        )}

        {message && (
          <div
            className={`mb-4 p-2 rounded text-sm ${
              message.startsWith("✅") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            }`}
          >
            {message}
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={loading || saving}
            className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            Close
          </button>
          <button
            onClick={handleSaveConfig}
            disabled={loading || saving || (scoringMode === 'magnitude' ? ranges.some((r) => r.score === '') : distanceRanges.some((r) => r.score === ''))}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            title={(scoringMode === 'magnitude' ? ranges.some((r) => r.score === '') : distanceRanges.some((r) => r.score === '')) ? "Please assign scores to all ranges first" : ""}
          >
            {saving ? 'Saving…' : 'Save Config'}
          </button>
          <button
            onClick={handleApplyScoring}
            disabled={loading || saving || (scoringMode === 'magnitude' ? ranges.some((r) => r.score === '') : distanceRanges.some((r) => r.score === ''))}
            className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            title={(scoringMode === 'magnitude' ? ranges.some((r) => r.score === '') : distanceRanges.some((r) => r.score === '')) ? "Please assign scores to all ranges first" : ""}
          >
            {loading ? 'Applying…' : 'Apply Scoring'}
          </button>
        </div>
      </div>
    </div>
  );
}

