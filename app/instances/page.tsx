'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabaseClient';

// Dynamic imports for react-leaflet
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import('react-leaflet').then(m => m.GeoJSON), { ssr: false });

interface Instance {
  id: string;
  name: string;
  admin_scope: string[] | null;
}

export default function InstancePage() {
  const { id } = useParams();
  const supabase = createClient();

  const [instance, setInstance] = useState<Instance | null>(null);
  const [geojson, setGeojson] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadInstance = useCallback(async () => {
    setLoading(true);
    const { data: inst, error } = await supabase.from('instances').select('*').eq('id', id).single();
    if (error) {
      console.error('Error loading instance:', error);
      setLoading(false);
      return;
    }
    setInstance(inst);

    // Load summary metrics
    const { data: m } = await supabase.rpc('get_instance_summary', { in_instance: id });
    setMetrics(m?.[0] ?? null);

    // Load ADM3 boundaries based on admin_scope (affected area)
    if (inst?.admin_scope && inst.admin_scope.length > 0) {
      const { data: adm3, error: geoErr } = await supabase
        .from('admin_boundaries_geojson')
        .select('admin_pcode, name, geom')
        .eq('admin_level', 'ADM3')
        .in('parent_pcode', inst.admin_scope);

      if (geoErr) {
        console.error('Error loading ADM3 boundaries:', geoErr);
      } else {
        const features = (adm3 || [])
          .map((row: any) => ({
            type: 'Feature',
            geometry: row.geom,
            properties: {
              admin_pcode: row.admin_pcode,
              name: row.name,
            },
          }));

        setGeojson({
          type: 'FeatureCollection',
          features,
        });
      }
    } else {
      setGeojson(null);
    }

    setLoading(false);
  }, [id, supabase]);

  useEffect(() => {
    loadInstance();
  }, [loadInstance]);

  const getColor = () => '#004b87'; // Solid blue fill for affected areas

  const onEachFeature = (feature: any, layer: any) => {
    const name = feature.properties?.name || feature.properties?.admin_pcode;
    layer.bindTooltip(`${name}`, { sticky: true });
  };

  const style = () => ({
    color: '#004b87',
    weight: 0.7,
    fillColor: '#1d9bf0',
    fillOpacity: 0.5,
  });

  return (
    <div className="p-6 bg-[var(--gsc-beige,#f5f2ee)] min-h-screen">
      <h1 className="text-xl font-semibold text-[var(--gsc-blue,#004b87)] mb-4">
        {instance?.name ?? 'Instance'}
      </h1>

      {loading && <div className="text-sm text-gray-500">Loading...</div>}

      {!loading && (
        <>
          {/* --- Summary --- */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-white border rounded text-center shadow-sm">
              <div className="text-xs text-gray-600">Framework Avg</div>
              <div className="text-xl font-semibold text-[var(--gsc-blue,#004b87)]">
                {metrics?.framework_avg?.toFixed(3) ?? '-'}
              </div>
            </div>
            <div className="p-4 bg-white border rounded text-center shadow-sm">
              <div className="text-xs text-gray-600">Final Avg</div>
              <div className="text-xl font-semibold text-[var(--gsc-red,#630710)]">
                {metrics?.final_avg?.toFixed(3) ?? '-'}
              </div>
            </div>
            <div className="p-4 bg-white border rounded text-center shadow-sm">
              <div className="text-xs text-gray-600">People Affected</div>
              <div className="text-lg font-semibold text-gray-800">
                {metrics?.people_affected?.toLocaleString() ?? '-'}
              </div>
            </div>
            <div className="p-4 bg-white border rounded text-center shadow-sm">
              <div className="text-xs text-gray-600">People in Need</div>
              <div className="text-lg font-semibold text-gray-800">
                {metrics?.people_in_need?.toLocaleString() ?? '-'}
              </div>
            </div>
          </div>

          {/* --- Map --- */}
          <div className="h-[600px] w-full border rounded shadow overflow-hidden relative">
            <MapContainer
              center={[12.8797, 121.774]}
              zoom={6}
              scrollWheelZoom={true}
              className="h-full w-full"
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {geojson && (
                <GeoJSON
                  key={instance?.id}
                  data={geojson}
                  style={style}
                  onEachFeature={onEachFeature}
                />
              )}
            </MapContainer>
          </div>
        </>
      )}
    </div>
  );
}
