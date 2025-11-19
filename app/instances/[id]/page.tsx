'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@supabase/supabase-js';
import L, { Map } from 'leaflet';
import 'leaflet/dist/leaflet.css';

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import('react-leaflet').then(m => m.GeoJSON), { ssr: false });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const CATEGORY_ORDER = [
  'SSC Framework P1',
  'SSC Framework P2',
  'SSC Framework P3',
  'Hazards',
  'Underlying Vulnerability'
];

export default function InstancePage({ params }: { params: { id: string } }) {
  const instanceId = params.id;
  const mapRef = useRef<Map | null>(null);
  const [features, setFeatures] = useState<any[]>([]);
  const [affectedBounds, setAffectedBounds] = useState<any>(null);
  const [datasetsByCategory, setDatasetsByCategory] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  const getColor = (score: number) => {
    if (score <= 1) return '#2ECC71';
    if (score <= 2) return '#A2D56E';
    if (score <= 3) return '#FFD54F';
    if (score <= 4) return '#FF8C42';
    return '#E74C3C';
  };

  // Load map features and affected bounds
  useEffect(() => {
    const fetchGeoData = async () => {
      setLoading(true);

      const { data: geoData, error: geoError } = await supabase
        .from('v_instance_admin_scores_geojson')
        .select('geojson')
        .eq('instance_id', instanceId);

      if (geoError) console.error('GeoJSON fetch error:', geoError);
      else if (geoData) {
        const parsed = geoData
          .map((d: any) => {
            try {
              return typeof d.geojson === 'string' ? JSON.parse(d.geojson) : d.geojson;
            } catch {
              return null;
            }
          })
          .filter(Boolean);
        setFeatures(parsed);
      }

      const { data: areaData, error: areaError } = await supabase
        .from('v_instance_affected_areas')
        .select('geom')
        .eq('instance_id', instanceId)
        .maybeSingle();

      if (!areaError && areaData?.geom) {
        try {
          const geom =
            typeof areaData.geom === 'string' ? JSON.parse(areaData.geom) : areaData.geom;
          setAffectedBounds(geom);
        } catch {
          console.warn('Invalid area geometry skipped');
        }
      }

      setLoading(false);
    };

    fetchGeoData();
  }, [instanceId]);

  // Zoom to affected area
  useEffect(() => {
    if (mapRef.current && affectedBounds) {
      const bounds = L.geoJSON(affectedBounds).getBounds();
      mapRef.current.fitBounds(bounds);
    }
  }, [affectedBounds]);

  // Load datasets grouped by category
  useEffect(() => {
    const fetchDatasets = async () => {
      const { data, error } = await supabase
        .from('instance_datasets')
        .select(`
          id,
          dataset_id,
          datasets ( name ),
          instance_dataset_config (
            category_id,
            instance_category_config ( category_name )
          )
        `)
        .eq('instance_id', instanceId);

      if (error) {
        console.error('Dataset fetch error:', error);
        return;
      }

      const grouped: Record<string, any[]> = {};
      CATEGORY_ORDER.forEach(c => (grouped[c] = []));

      data?.forEach((row: any) => {
        const category = row.instance_dataset_config?.instance_category_config?.category_name;
        const datasetName = row.datasets?.name || 'Unnamed Dataset';
        if (category && grouped[category]) grouped[category].push(datasetName);
      });

      setDatasetsByCategory(grouped);
    };

    fetchDatasets();
  }, [instanceId]);

  if (loading) return <div className="p-4 text-sm text-gray-500">Loading...</div>;

  return (
    <div className="flex flex-col h-screen p-2 bg-gray-50">
      <div className="flex flex-row space-x-2 h-[85vh]">
        {/* Map */}
        <div className="flex-1 relative rounded-md overflow-hidden border border-gray-200">
          <MapContainer
            center={[12.8797, 121.774]}
            zoom={6}
            style={{ height: '100%', width: '100%' }}
            whenReady={((event: any) => {
              mapRef.current = event.target;
            }) as any}
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
                  const s = feature.properties?.score?.toFixed(0) ?? '-';
                  const n = feature.properties?.admin_name ?? 'Unknown';
                  layer.bindTooltip(`${n}: Score ${s}`);
                }}
              />
            ))}
          </MapContainer>
        </div>

        {/* Sidebar */}
        <div className="w-64 flex flex-col space-y-2 p-2 border-l border-gray-200 bg-white rounded-md text-xs">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Score Layers</h3>

          <div className="overflow-y-auto space-y-2">
            {CATEGORY_ORDER.map(cat => (
              <div key={cat} className="border-b border-gray-100 pb-1">
                <p className="font-medium text-gray-700">{cat}</p>
                <div className="flex flex-col mt-1 space-y-1">
                  {(datasetsByCategory[cat] ?? []).map((ds, i) => (
                    <button
                      key={i}
                      className="text-left px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 truncate"
                      title={ds}
                    >
                      {ds}
                    </button>
                  ))}
                  {(!datasetsByCategory[cat] || datasetsByCategory[cat].length === 0) && (
                    <p className="text-gray-400 italic pl-2">No datasets</p>
                  )}
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
