'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@supabase/supabase-js';
import 'leaflet/dist/leaflet.css';

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import('react-leaflet').then(m => m.GeoJSON), { ssr: false });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function InstancePage({ params }: { params: { id: string } }) {
  const instanceId = params.id;
  const mapRef = useRef<any>(null);
  const [features, setFeatures] = useState<any[]>([]);
  const [affectedBounds, setAffectedBounds] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Color scale: 1 (green) → 5 (red)
  const getColor = (score: number) => {
    if (score <= 1) return '#2ECC71';
    if (score <= 2) return '#A2D56E';
    if (score <= 3) return '#FFD54F';
    if (score <= 4) return '#FF8C42';
    return '#E74C3C';
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Get polygons with scores
      const { data: geoData, error: geoError } = await supabase
        .from('v_instance_admin_scores_geojson')
        .select('geojson')
        .eq('instance_id', instanceId);

      if (geoError) console.error('GeoJSON fetch error:', geoError);
      else if (geoData) {
        const parsed = geoData.map((d: any) => JSON.parse(d.geojson));
        setFeatures(parsed);
      }

      // Get affected area geometry
      const { data: areaData, error: areaError } = await supabase
        .from('v_instance_affected_areas')
        .select('geom')
        .eq('instance_id', instanceId)
        .maybeSingle();

      if (!areaError && areaData?.geom) {
        const geom = JSON.parse(areaData.geom);
        setAffectedBounds(geom);
      }

      setLoading(false);
    };

    fetchData();
  }, [instanceId]);

  useEffect(() => {
    if (mapRef.current && affectedBounds) {
      const bounds = L.geoJSON(affectedBounds).getBounds();
      mapRef.current.fitBounds(bounds);
    }
  }, [affectedBounds]);

  if (loading) return <div className="p-4 text-sm text-gray-500">Loading...</div>;

  return (
    <div className="flex flex-col h-screen p-2 space-y-2 bg-gray-50">
      <div className="flex flex-row space-x-2 h-[85vh]">
        {/* Map Section */}
        <div className="flex-1 relative rounded-md overflow-hidden border border-gray-200">
          <MapContainer
            center={[12.8797, 121.774]}
            zoom={6}
            style={{ height: '100%', width: '100%' }}
            whenReady={(map) => (mapRef.current = map.target)}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {features.map((f: any, idx: number) => (
              <GeoJSON
                key={idx}
                data={f}
                style={() => ({
                  color: '#333',
                  weight: 0.8,
                  fillColor: getColor(f.properties?.score ?? 0),
                  fillOpacity: 0.7,
                })}
                onEachFeature={(feature, layer) => {
                  const s = feature.properties?.score?.toFixed(2) ?? '-';
                  const n = feature.properties?.admin_name ?? 'Unknown';
                  layer.bindTooltip(`${n}: Score ${s}`);
                }}
              />
            ))}
          </MapContainer>
        </div>

        {/* Sidebar Controls */}
        <div className="w-64 flex flex-col space-y-2 p-2 border-l border-gray-200 bg-white rounded-md">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Layers</h3>

          <div className="text-xs text-gray-600 space-y-1">
            {['SSC Framework P1', 'SSC Framework P2', 'SSC Framework P3', 'Hazards', 'Underlying Vulnerability'].map((cat) => (
              <div key={cat} className="border-b border-gray-100 pb-1">
                <p className="font-medium text-gray-700">{cat}</p>
                <div className="flex flex-col mt-1 space-y-1">
                  <button className="text-left px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 text-[11px]">
                    Dataset 1
                  </button>
                  <button className="text-left px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 text-[11px]">
                    Dataset 2
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 mt-auto space-y-1 border-t border-gray-100">
            <button className="w-full bg-blue-600 text-white text-xs py-1.5 rounded hover:bg-blue-700">
              Adjust Scoring
            </button>
            <button className="w-full bg-green-600 text-white text-xs py-1.5 rounded hover:bg-green-700">
              Refresh Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
