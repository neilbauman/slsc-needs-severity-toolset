'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabaseClient';

// Dynamic imports (Leaflet)
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

    // Load affected ADM3 polygons
    if (inst?.admin_scope?.length) {
      const { data, error: admErr } = await supabase
        .from('admin_boundaries')
        .select('admin_pcode, name, admin_level, parent_pcode, geom')
        .in('admin_level', ['ADM3'])
        .or(
          inst.admin_scope
            .map(
              (p) =>
                `parent_pcode.eq.${p},and(admin_level.eq.ADM3,substring(admin_pcode,1,4).eq.${p})`
            )
            .join(',')
        );

      if (admErr) console.error('ADM3 load error:', admErr);
      else if (data && data.length > 0) {
        // Build GeoJSON
        const features = data.map((r: any) => ({
          type: 'Feature',
          geometry: JSON.parse(r.geom as any),
          properties: {
            admin_pcode: r.admin_pcode,
            name: r.name,
            admin_level: r.admin_level,
          },
        }));

        const geojson = {
          type: 'FeatureCollection',
          features,
        };

        setAdm3Geojson(geojson);

        // Collect names for UI
        const { data: namesData } = await supabase
          .from('admin_boundaries')
          .select('name')
          .in('admin_pcode', inst.admin_scope);
        setAffectedNames(namesData?.map((d) => d.name) ?? []);
      }
    }
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => {
    loadInstance();
  }, [loadInstance]);

  const getColor = (score: number | null) => {
    if (score == null) return '#ccc';
    if (score >= 4) return '#b30000';
    if (score >= 3) return '#e34a33';
    if (score >= 2) return '#fc8d59';
    if (score >= 1) return '#fdbb84';
    return '#fdd49e';
  };

  const style = () => ({
    color: '#555',
    weight: 0.5,
    fillColor: '#8bb7f0',
    fillOpacity: 0.5,
  });

  const onEachFeature = (feature: any, layer: any) => {
    const props = feature.properties || {};
    const name = props.name || props.admin_pcode;
    layer.bindTooltip(`${name}`, { sticky: true });
  };

  return (
    <div className="p-6 bg-[var(--gsc-beige,#f5f2ee)] min-h-screen">
      {/* Header */}
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

      {/* Affected Area Summary */}
      {affectedNames.length > 0 && (
        <div className="bg-white border rounded-md p-3 mb-4 shadow-sm">
          <div className="text-sm text-gray-700">
            🗺️ <strong>Affected Area:</strong>{' '}
            {affectedNames.join(' → ')} (Target Level: <strong>ADM3</strong>)
          </div>
        </div>
      )}

      {/* Map + Side Panel */}
      <div className="grid grid-cols-12 gap-4">
        {/* Map */}
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

        {/* Table */}
        <div className="col-span-3 bg-white border rounded-lg shadow-sm p-3 overflow-y-auto max-h-[600px]">
          <div className="text-sm font-semibold mb-2 text-gray-700">
            Top Locations
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="text-left py-1">Admin</th>
                <th className="text-right py-1">Score</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-1 text-gray-500">No data yet</td>
                <td className="py-1 text-right">–</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
