'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabaseClient';

// Dynamic imports for Leaflet
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import('react-leaflet').then(m => m.GeoJSON), { ssr: false });
import 'leaflet/dist/leaflet.css';

interface Instance {
  id: string;
  name: string;
  description: string | null;
  admin_scope: string[] | null;
  created_at: string | null;
  active: boolean | null;
  type: string | null;
}

export default function InstancePage() {
  const { id } = useParams();
  const supabase = createClient();

  const [instance, setInstance] = useState<Instance | null>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [adm3Geojson, setAdm3Geojson] = useState<any>(null);
  const [affectedNames, setAffectedNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadInstance = useCallback(async () => {
    setLoading(true);
    const { data: inst, error } = await supabase.from('instances').select('*').eq('id', id).single();
    if (error) {
      console.error('Instance load error:', error);
      setLoading(false);
      return;
    }
    setInstance(inst);

    const { data: m } = await supabase.rpc('get_instance_summary', { in_instance: id });
    setMetrics(m?.[0] ?? null);

    // Load all ADM3 geometries once, filter locally
    const { data: allAdm3, error: admErr } = await supabase
      .from('admin_boundaries')
      .select('admin_pcode, name, parent_pcode, admin_level, geom')
      .eq('admin_level', 'ADM3');

    if (admErr) {
      console.error('ADM3 load error:', admErr);
      setLoading(false);
      return;
    }

    const scope = inst?.admin_scope ?? [];
    const filtered = (allAdm3 || []).filter((r: any) => {
      if (!scope.length) return false;
      const prefix = r.admin_pcode?.substring(0, 4);
      return scope.includes(r.parent_pcode) || scope.includes(prefix);
    });

    const features = filtered.map((r: any) => ({
      type: 'Feature',
      geometry: JSON.parse(r.geom),
      properties: { admin_pcode: r.admin_pcode, name: r.name },
    }));

    setAdm3Geojson({ type: 'FeatureCollection', features });

    // Load readable names
    if (scope.length) {
      const { data: namesData } = await supabase
        .from('admin_boundaries')
        .select('name')
        .in('admin_pcode', scope);
      setAffectedNames(namesData?.map((d) => d.name) ?? []);
    }

    setLoading(false);
  }, [id, supabase]);

  useEffect(() => {
    loadInstance();
  }, [loadInstance]);

  const style = () => ({
    color: '#555',
    weight: 0.6,
    fillColor: '#8bb7f0',
    fillOpacity: 0.5,
  });

  const onEachFeature = (feature: any, layer: any) => {
    const name = feature.properties?.name || feature.properties?.admin_pcode;
    layer.bindTooltip(name, { sticky: true });
  };

  return (
    <div className="p-6 bg-[var(--gsc-beige,#f5f2ee)] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-[var(--gsc-blue,#004b87)]">
          {instance?.name ?? 'Instance'}
        </h1>
        <div className="flex gap-2">
          <button className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
            Configure Datasets
          </button>
          <button className="px-3 py-2 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700">
            Define Affected Area
          </button>
        </div>
      </div>

      <div className="text-sm text-gray-600 mb-4">
        Created at:{' '}
        {instance?.created_at
          ? new Date(instance.created_at).toLocaleString()
          : 'Unknown'}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Framework Avg', value: metrics?.framework_avg },
          { label: 'Final Avg', value: metrics?.final_avg },
          { label: 'People Affected', value: metrics?.people_affected },
          { label: 'People in Need', value: metrics?.people_in_need },
        ].map((m, i) => (
          <div key={i} className="p-4 bg-white border rounded text-center shadow-sm">
            <div className="text-xs text-gray-600">{m.label}</div>
            <div className="text-xl font-semibold text-gray-800">
              {m.value ? Number(m.value).toLocaleString() : '-'}
            </div>
          </div>
        ))}
      </div>

      {affectedNames.length > 0 && (
        <div className="bg-white border rounded-md p-3 mb-4 shadow-sm">
          <div className="text-sm text-gray-700">
            🗺️ <strong>Affected Area:</strong>{' '}
            {affectedNames.join(' → ')} (Target Level: <strong>ADM3</strong>)
          </div>
        </div>
      )}

      {/* Map */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-9">
          <div className="h-[600px] w-full border rounded shadow overflow-hidden relative">
            {loading ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                Loading map…
              </div>
            ) : (
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
                {adm3Geojson && (
                  <GeoJSON data={adm3Geojson as any} style={style} onEachFeature={onEachFeature} />
                )}
              </MapContainer>
            )}
          </div>
        </div>

        {/* Side table placeholder */}
        <div className="col-span-3 bg-white border rounded-lg shadow-sm p-3">
          <div className="text-sm font-semibold mb-2 text-gray-700">Top Locations</div>
          <p className="text-xs text-gray-500">No data yet</p>
        </div>
      </div>
    </div>
  );
}
