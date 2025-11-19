'use client';

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { supabase } from '@/lib/supabaseClient';

interface SummaryData {
  total_areas: number;
  min_score: number;
  max_score: number;
  avg_score: number;
}

interface GeoFeature {
  type: string;
  geometry: { type: string; coordinates: any };
  properties: {
    score: number;
    admin_name: string;
    dataset_id: string;
    admin_pcode: string;
  };
}

export default function InstancePage({ params }: { params: { id: string } }) {
  const instanceId = params.id;
  const mapRef = useRef<L.Map | null>(null);

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [features, setFeatures] = useState<GeoFeature[]>([]);
  const [hoverInfo, setHoverInfo] = useState<{ name: string; score: number } | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<'define' | 'datasets' | 'calibrate' | null>(null);

  // Load instance data
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const { data: summaryData, error: summaryError } = await supabase
          .from('v_instance_affected_summary')
          .select('*')
          .eq('instance_id', instanceId)
          .single();
        if (summaryError) throw summaryError;
        setSummary(summaryData as SummaryData);

        const { data: geoData, error: geoError } = await supabase
          .from('v_instance_admin_scores_geojson')
          .select('*')
          .eq('instance_id', instanceId);
        if (geoError) throw geoError;

        const parsed = geoData.map((d: any) => JSON.parse(JSON.stringify(d.geojson)));
        setFeatures(parsed);

        // Auto-fit map to affected polygons
        if (mapRef.current && parsed.length > 0) {
          const bounds = L.geoJSON(parsed as any).getBounds();
          mapRef.current.fitBounds(bounds, { padding: [25, 25] });
        }
      } catch (err) {
        console.error('Error loading instance data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [instanceId]);

  const getColor = (score: number) => {
    if (score <= 1) return '#2ECC71';
    if (score <= 2) return '#F1C40F';
    if (score <= 3) return '#E67E22';
    if (score <= 4) return '#E74C3C';
    return '#C0392B';
  };

  const onEachFeature = (feature: any, layer: L.Layer) => {
    const f = feature as any;
    layer.on({
      mouseover: (e: any) => {
        const l = e.target;
        l.setStyle({ weight: 2, color: '#000', fillOpacity: 0.9 });
        setHoverInfo({ name: f.properties.admin_name, score: f.properties.score });
      },
      mouseout: (e: any) => {
        const l = e.target;
        l.setStyle({ weight: 1, color: '#666', fillOpacity: 0.7 });
        setHoverInfo(null);
      },
      click: () => setSelectedFeature(f.properties.admin_pcode),
    });
  };

  const styleFeature = (feature: any) => ({
    color: selectedFeature === feature.properties.admin_pcode ? '#000' : '#666',
    weight: selectedFeature === feature.properties.admin_pcode ? 3 : 1,
    fillColor: getColor(feature.properties.score),
    fillOpacity: 0.7,
  });

  if (loading) return <div className="p-4">Loading…</div>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Cebu EQ–Typhoon</h2>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        <div className="border rounded-md p-3 text-center">
          <p className="text-sm text-gray-500">Total Areas</p>
          <p className="text-xl font-semibold">
            {summary ? summary.total_areas.toLocaleString() : '-'}
          </p>
        </div>
        <div className="border rounded-md p-3 text-center">
          <p className="text-sm text-gray-500">Min Score</p>
          <p className="text-xl font-semibold">{summary ? summary.min_score.toFixed(2) : '-'}</p>
        </div>
        <div className="border rounded-md p-3 text-center">
          <p className="text-sm text-gray-500">Max Score</p>
          <p className="text-xl font-semibold">{summary ? summary.max_score.toFixed(2) : '-'}</p>
        </div>
        <div className="border rounded-md p-3 text-center">
          <p className="text-sm text-gray-500">Average Score</p>
          <p className="text-xl font-semibold">{summary ? summary.avg_score.toFixed(2) : '-'}</p>
        </div>
      </div>

      {/* Map + Controls */}
      <div className="grid grid-cols-[1fr_250px] gap-4">
        <div className="h-[75vh] border rounded-lg overflow-hidden relative">
          <MapContainer
            center={[11.0, 122.0]}
            zoom={6}
            style={{ height: '100%', width: '100%' }}
            whenReady={() => {
              if (!mapRef.current) {
                const m = (document.querySelector('.leaflet-container') as any)?._leaflet_map;
                if (m) mapRef.current = m;
              }
            }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {features.map((f: GeoFeature, i) => (
              <GeoJSON key={i} data={f as any} style={styleFeature} onEachFeature={onEachFeature} />
            ))}
          </MapContainer>

          {hoverInfo && (
            <div className="absolute bottom-4 left-4 bg-white border rounded px-2 py-1 shadow text-sm">
              <b>{hoverInfo.name}</b>: {hoverInfo.score.toFixed(2)}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-3">
          <button
            onClick={() => setActiveModal('define')}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            Define Affected Area
          </button>
          <button
            onClick={() => setActiveModal('datasets')}
            className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
          >
            Configure Datasets
          </button>
          <button
            onClick={() => setActiveModal('calibrate')}
            className="w-full bg-orange-600 text-white py-2 rounded hover:bg-orange-700"
          >
            Calibrate Scores
          </button>
          <button
            onClick={async () => {
              try {
                await supabase.rpc('recompute_scores', { instance_id: instanceId });
                alert('Scores recomputed successfully.');
              } catch {
                alert('Failed to recompute scores.');
              }
            }}
            className="w-full bg-gray-800 text-white py-2 rounded hover:bg-gray-900"
          >
            Recompute Scores
          </button>
        </div>
      </div>

      {/* === MODALS === */}
      {activeModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[700px] max-h-[85vh] overflow-y-auto shadow-xl">
            {activeModal === 'define' && (
              <>
                <h3 className="text-lg font-semibold mb-3">Define Affected Area</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Select or update the administrative areas considered affected for this instance.
                </p>
                {/* Replace with your area-selection component */}
              </>
            )}
            {activeModal === 'datasets' && (
              <>
                <h3 className="text-lg font-semibold mb-3">Configure Datasets</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Choose which datasets contribute to each scoring component.
                </p>
                {/* Replace with dataset configuration form */}
              </>
            )}
            {activeModal === 'calibrate' && (
              <>
                <h3 className="text-lg font-semibold mb-3">Calibrate Scores</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Adjust normalization and thresholds for dataset scoring.
                </p>
                {/* Replace with calibration UI */}
              </>
            )}
            <div className="text-right mt-5">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-900"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
