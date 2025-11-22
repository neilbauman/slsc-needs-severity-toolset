'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface MagnitudeRange {
  min: number;
  max: number;
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

  // Load magnitude statistics from hazard event
  useEffect(() => {
    const loadMagnitudeStats = async () => {
      if (!hazardEvent?.id) return;

      try {
        // Get magnitude values from metadata
        const metadata = hazardEvent.metadata || {};
        const originalGeoJson = metadata.original_geojson;
        const magnitudeField = hazardEvent.magnitude_field || 'value';

        if (originalGeoJson && originalGeoJson.features) {
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
        console.error('Error loading magnitude stats:', err);
      }
    };

    loadMagnitudeStats();
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

  const addRange = () => {
    const lastRange = ranges[ranges.length - 1];
    setRanges([
      ...ranges,
      { min: lastRange.max, max: lastRange.max + 1, score: '' },
    ]);
  };

  const removeRange = (index: number) => {
    if (ranges.length <= 1) return;
    setRanges(ranges.filter((_, i) => i !== index));
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
      ranges: ranges.filter(r => r.score !== ''),
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

    // Validate that all ranges have scores
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

    setLoading(true);
    setMessage("Applying scoring...");

    const magnitudeRanges = ranges
      .filter((r) => r.score !== '')
      .map((r) => ({
        min: Number(r.min),
        max: Number(r.max),
        score: Number(r.score),
      }));

    // Determine if we should limit to affected areas
    const limitToAffected = instance?.admin_scope && Array.isArray(instance.admin_scope) && instance.admin_scope.length > 0;

    const { data, error } = await supabase.rpc('score_hazard_event', {
      in_hazard_event_id: hazardEvent.id,
      in_instance_id: instance.id,
      in_magnitude_ranges: magnitudeRanges,
      in_limit_to_affected: limitToAffected,
    });

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
          Map magnitude/intensity ranges to vulnerability scores (1–5). Higher magnitudes should generally receive higher scores.
        </p>

        {/* Magnitude Statistics */}
        {magnitudeStats && (
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

        {/* Magnitude Range Mapping */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold">Magnitude Range to Score Mapping</h3>
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
                <th className="text-left p-2 font-medium">Min</th>
                <th className="text-left p-2 font-medium">Max</th>
                <th className="text-left p-2 font-medium w-32">Score (1–5)</th>
                <th className="text-left p-2 font-medium w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ranges.map((range, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="p-2">
                    <input
                      type="number"
                      step="0.1"
                      value={range.min}
                      onChange={(e) => handleRangeChange(i, 'min', e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 w-24"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      step="0.1"
                      value={range.max}
                      onChange={(e) => handleRangeChange(i, 'max', e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 w-24"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={range.score}
                      onChange={(e) => handleRangeChange(i, 'score', e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 w-20"
                      placeholder="1-5"
                    />
                  </td>
                  <td className="p-2">
                    {ranges.length > 1 && (
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
            Ranges should be non-overlapping and cover the full magnitude range. Higher magnitudes should map to higher scores (5 = most vulnerable).
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
            disabled={loading || saving || ranges.some((r) => r.score === '')}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            title={ranges.some((r) => r.score === '') ? "Please assign scores to all ranges first" : ""}
          >
            {saving ? 'Saving…' : 'Save Config'}
          </button>
          <button
            onClick={handleApplyScoring}
            disabled={loading || saving || ranges.some((r) => r.score === '')}
            className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            title={ranges.some((r) => r.score === '') ? "Please assign scores to all ranges first" : ""}
          >
            {loading ? 'Applying…' : 'Apply Scoring'}
          </button>
        </div>
      </div>
    </div>
  );
}

