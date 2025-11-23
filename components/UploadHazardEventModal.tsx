'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface UploadHazardEventModalProps {
  instanceId: string;
  onClose: () => void;
  onUploaded: () => void;
}

export default function UploadHazardEventModal({
  instanceId,
  onClose,
  onUploaded,
}: UploadHazardEventModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [magnitudeField, setMagnitudeField] = useState<string>('value');
  const [detectedFields, setDetectedFields] = useState<string[]>([]);
  const [magnitudeValues, setMagnitudeValues] = useState<number[]>([]);
  
  const [meta, setMeta] = useState({
    name: '',
    description: '',
    event_type: 'earthquake',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-detect magnitude field from GeoJSON properties
  const detectMagnitudeField = (features: any[]): string => {
    const candidates = ['value', 'magnitude', 'intensity', 'mmi', 'pga', 'shaking'];
    
    if (!features || features.length === 0) return 'value';
    
    // Check first few features for magnitude fields
    for (const candidate of candidates) {
      for (const feature of features.slice(0, 10)) {
        if (feature.properties && feature.properties[candidate] !== undefined) {
          return candidate;
        }
      }
    }
    
    // If no candidate found, check all property keys
    const allKeys = new Set<string>();
    features.slice(0, 10).forEach(f => {
      if (f.properties) {
        Object.keys(f.properties).forEach(k => allKeys.add(k));
      }
    });
    
    // Look for numeric properties
    for (const key of Array.from(allKeys)) {
      const lowerKey = key.toLowerCase();
      if (candidates.some(c => lowerKey.includes(c))) {
        return key;
      }
    }
    
    return 'value'; // Default
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError(null);

    try {
      const text = await f.text();
      let parsed: any;

      // Try parsing as JSON/GeoJSON
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        setError('Invalid JSON file. Please upload a valid GeoJSON or JSON file.');
        return;
      }

      // Handle FeatureCollection
      if (parsed.type === 'FeatureCollection' && parsed.features) {
        setGeoJsonData(parsed);
        setPreview(parsed);
        
        // Detect magnitude field
        const detected = detectMagnitudeField(parsed.features);
        setMagnitudeField(detected);
        
        // Extract all property keys from features
        const fields = new Set<string>();
        parsed.features.slice(0, 10).forEach((f: any) => {
          if (f.properties) {
            Object.keys(f.properties).forEach(k => fields.add(k));
          }
        });
        setDetectedFields(Array.from(fields));
        
        // Extract magnitude values for preview
        const values: number[] = [];
        parsed.features.forEach((f: any) => {
          if (f.properties && f.properties[detected] !== undefined) {
            const val = Number(f.properties[detected]);
            if (!isNaN(val)) {
              values.push(val);
            }
          }
        });
        setMagnitudeValues([...new Set(values)].sort((a, b) => a - b));
        
      } else if (parsed.type === 'Feature') {
        // Single feature - wrap in FeatureCollection
        setGeoJsonData({ type: 'FeatureCollection', features: [parsed] });
        setPreview({ type: 'FeatureCollection', features: [parsed] });
        
        const detected = detectMagnitudeField([parsed]);
        setMagnitudeField(detected);
        
        if (parsed.properties) {
          setDetectedFields(Object.keys(parsed.properties));
          const val = Number(parsed.properties[detected]);
          if (!isNaN(val)) {
            setMagnitudeValues([val]);
          }
        }
      } else {
        setError('Invalid GeoJSON format. Expected FeatureCollection or Feature.');
        return;
      }
    } catch (err: any) {
      console.error('Error parsing file:', err);
      setError(`Failed to parse file: ${err.message}`);
    }
  };

  const handleUpload = async () => {
    if (!file || !geoJsonData) {
      setError('Please select a file.');
      return;
    }
    if (!meta.name.trim()) {
      setError('Please enter an event name.');
      return;
    }
    if (!magnitudeField) {
      setError('Please select a magnitude field.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Preprocessing: For typhoon events, filter out Polygon features (cone)
      // Keep only LineString/MultiLineString features (track)
      const originalCount = geoJsonData.features.length;
      let processedGeoJson = geoJsonData;
      
      if (meta.event_type === 'typhoon') {
        processedGeoJson = {
          ...geoJsonData,
          features: geoJsonData.features.filter((feature: any) => {
            const geomType = feature?.geometry?.type || '';
            // Keep LineString, MultiLineString, Point (track and points)
            // Exclude Polygon, MultiPolygon (cone)
            return geomType === 'LineString' || 
                   geomType === 'MultiLineString' || 
                   geomType === 'Point' ||
                   geomType === 'MultiPoint';
          })
        };
        const filteredCount = processedGeoJson.features.length;
        if (originalCount !== filteredCount) {
          console.log(`Preprocessing: Filtered out ${originalCount - filteredCount} Polygon features (cone) for typhoon event. Keeping ${filteredCount} track features.`);
        }
      }

      // Extract sample metadata from first feature
      const sampleProperties = processedGeoJson.features[0]?.properties || {};
      const units = sampleProperties.units || 'mmi';

      // Use RPC function to insert with proper geometry conversion
      const { data: rpcData, error: rpcError } = await supabase.rpc('insert_hazard_event', {
        p_instance_id: instanceId,
        p_name: meta.name.trim(),
        p_description: meta.description.trim() || null,
        p_event_type: meta.event_type,
        p_geojson: processedGeoJson,
        p_magnitude_field: magnitudeField,
        p_metadata: {
          units: units,
          feature_count: processedGeoJson.features.length,
          original_feature_count: geoJsonData.features.length,
          sample_properties: sampleProperties,
          preprocessing_applied: meta.event_type === 'typhoon' ? 'polygon_features_removed' : null,
        },
      });

      if (rpcError) {
        throw rpcError;
      }

      const filteredCount = processedGeoJson.features.length;
      const message = meta.event_type === 'typhoon' && originalCount !== filteredCount
        ? `✅ Uploaded hazard event "${meta.name}" with ${filteredCount} features (${originalCount - filteredCount} Polygon features removed automatically).`
        : `✅ Uploaded hazard event "${meta.name}" with ${filteredCount} features.`;
      alert(message);

      await onUploaded();
      onClose();
    } catch (err: any) {
      console.error('Upload failed:', err);
      setError(err.message || 'Upload failed. Make sure PostGIS is enabled and the geometry is valid.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center border-b px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-800">
            Upload Hazard Event (GeoJSON)
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
            disabled={loading}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 text-sm">
          {error && <p className="text-red-600">{error}</p>}

          {/* File chooser */}
          <div>
            <label className="block text-gray-700 font-medium">GeoJSON/JSON File</label>
            <input
              type="file"
              accept=".json,.geojson"
              onChange={handleFile}
              className="mt-1 border rounded px-2 py-1 w-full"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Upload a GeoJSON FeatureCollection file (e.g., earthquake shake map)
            </p>
          </div>

          {preview && (
            <>
              {/* Metadata */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium">Event Name</label>
                  <input
                    type="text"
                    value={meta.name}
                    onChange={(e) =>
                      setMeta((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="border rounded px-2 py-1 w-full"
                    disabled={loading}
                    placeholder="e.g., Earthquake 2024"
                  />
                </div>

                <div>
                  <label className="block font-medium">Event Type</label>
                  <select
                    value={meta.event_type}
                    onChange={(e) =>
                      setMeta((prev) => ({ ...prev, event_type: e.target.value }))
                    }
                    className="border rounded px-2 py-1 w-full"
                    disabled={loading}
                  >
                    <option value="earthquake">Earthquake</option>
                    <option value="flood">Flood</option>
                    <option value="typhoon">Typhoon</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium">Description</label>
                <textarea
                  value={meta.description}
                  onChange={(e) =>
                    setMeta((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="border rounded px-2 py-1 w-full"
                  rows={2}
                  disabled={loading}
                  placeholder="Optional description"
                />
              </div>

              {/* Magnitude Field Selection */}
              <div>
                <label className="block font-medium">Magnitude/Intensity Field</label>
                <select
                  value={magnitudeField}
                  onChange={(e) => setMagnitudeField(e.target.value)}
                  className="border rounded px-2 py-1 w-full"
                  disabled={loading}
                >
                  {detectedFields.map((field) => (
                    <option key={field} value={field}>
                      {field}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Field containing magnitude/intensity values (e.g., MMI, PGA)
                </p>
              </div>

              {/* Preview */}
              <div className="border-t pt-3">
                <h3 className="font-semibold text-gray-800 mb-1">
                  Preview
                </h3>
                <div className="text-xs space-y-1">
                  <p>
                    <strong>Features:</strong> {geoJsonData.features.length}
                  </p>
                  {magnitudeValues.length > 0 && (
                    <div>
                      <strong>Magnitude Range:</strong> {magnitudeValues[0]} - {magnitudeValues[magnitudeValues.length - 1]}
                      <br />
                      <strong>Unique Values:</strong> {magnitudeValues.length}
                      <br />
                      <strong>Sample Values:</strong> {magnitudeValues.slice(0, 10).join(', ')}
                      {magnitudeValues.length > 10 && ' ...'}
                    </div>
                  )}
                  {geoJsonData.features[0]?.properties && (
                    <div className="mt-2">
                      <strong>Sample Properties:</strong>
                      <pre className="bg-gray-50 p-2 rounded mt-1 text-xs overflow-x-auto">
                        {JSON.stringify(geoJsonData.features[0].properties, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-3 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded bg-gray-200 hover:bg-gray-300"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || !meta.name.trim() || loading}
            className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? 'Uploading…' : 'Upload Hazard Event'}
          </button>
        </div>
      </div>
    </div>
  );
}

