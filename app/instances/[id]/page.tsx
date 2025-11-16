'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabaseClient';
import InstanceDatasetConfigModal from '@/components/InstanceDatasetConfigModal';
import DefineAffectedAreaModal from '@/components/DefineAffectedAreaModal';
import InstanceRecomputePanel from '@/components/InstanceRecomputePanel';

// Dynamic imports for react-leaflet
const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import('react-leaflet').then((m) => m.GeoJSON), { ssr: false });

interface Instance {
  id: string;
  name: string;
  description: string | null;
  created_at: string | null;
  admin_scope: string[] | null;
  active: boolean | null;
  type: string | null;
}

export default function InstanceDashboardPage() {
  const { id } = useParams();
  const supabase = createClient();

  const [instance, setInstance] = useState<Instance | null>(null);
  const [geojson, setGeojson] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [showDatasetConfig, setShowDatasetConfig] = useState(false);

  const loadInstance = useCallback(async () => {
    setLoading(true);
    const { data: inst } = await supabase.from('instances').select('*').eq('id', id).single();
    setInstance(inst);

    const { data: m } = await supabase.rpc('get_instance_summary', { in_instance: id });
    setMetrics(m?.[0] ?? null);

    const { data: gj } = await supabase.rpc('get_adm3_geojson_with_scores', { in_instance: id });
    setGeojson(gj);
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

  const onEachFeature = (feature: any, layer: any) => {
    const props = feature.properties || {};
    const name = props.name || props.admin_pcode;
    const score = props.final_score ?? '–';
    layer.bindTooltip(`${name}<br/><b>Final:</b> ${score}`, { sticky: true });
  };

  const style = (feature: any) => ({
    color: '#555',
    weight: 0.5,
    fillColor: getColor(feature.properties?.final_score ?? null),
    fillOpacity: 0.7,
  });

  if (loading)
    return (
      <div className="p-6 text-gray-600">
        <h1 className="text-lg font-semibold mb-3">Loading Instance...</h1>
        <p>This may take a few seconds.</p>
      </div>
    );

  return (
    <div className="p-6 bg-[var(--gsc-beige,#f5f2ee)] min-h-screen space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--gsc-blue,#004b87)]">
            {instance?.name ?? 'Instance'}
          </h1>
          <p className="text-gray-600 text-sm">
            Created at:{' '}
            {instance?.created_at
              ? new Date(instance.created_at).toLocaleString()
              : '—'}
          </p>
          {instance?.description && (
            <p className="text-gray-500 text-sm mt-1">{instance.description}</p>
          )}
        </div>

        <div className="flex gap-2 no-print">
          <button
            onClick={() => setShowDatasetConfig(true)}
            className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
          >
            Configure Datasets
          </button>
          <button
            onClick={() => setShowAreaModal(true)}
            className="px-3 py-2 bg-amber-500 text-white rounded-md text-sm hover:bg-amber-600"
          >
            Define Affected Area
          </button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-4 gap-4">
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

      <InstanceRecomputePanel instanceId={instance?.id ?? ''} />

      {/* Map + Table */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-9">
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
                <GeoJSON data={geojson} style={style} onEachFeature={onEachFeature} />
              )}
            </MapContainer>

            <div className="absolute bottom-4 left-4 bg-white bg-opacity-90 p-3 rounded shadow text-sm">
              <div className="font-semibold mb-1">Final Score</div>
              <div className="flex flex-col gap-1">
                <div><span className="inline-block w-4 h-3 bg-[#b30000] mr-2"></span>4–5 (Very High)</div>
                <div><span className="inline-block w-4 h-3 bg-[#e34a33] mr-2"></span>3–3.9 (High)</div>
                <div><span className="inline-block w-4 h-3 bg-[#fc8d59] mr-2"></span>2–2.9 (Moderate)</div>
                <div><span className="inline-block w-4 h-3 bg-[#fdbb84] mr-2"></span>1–1.9 (Low)</div>
                <div><span className="inline-block w-4 h-3 bg-[#fdd49e] mr-2"></span>0–0.9 (Very Low)</div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-3 bg-white border rounded-lg shadow-sm p-3 overflow-y-auto max-h-[600px]">
          <div className="text-sm font-semibold mb-2 text-gray-700">Top Locations</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="text-left py-1">Admin</th>
                <th className="text-right py-1">Score</th>
              </tr>
            </thead>
            <tbody>
              {geojson?.features
                ?.filter((f: any) => f.properties?.final_score != null)
                ?.sort((a: any, b: any) => b.properties.final_score - a.properties.final_score)
                ?.slice(0, 15)
                ?.map((f: any) => (
                  <tr key={f.properties.admin_pcode} className="border-b last:border-none">
                    <td className="py-1">{f.properties.name}</td>
                    <td className="py-1 text-right">
                      {Number(f.properties.final_score).toFixed(3)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {showDatasetConfig && instance && (
        <InstanceDatasetConfigModal
          instance={instance}
          onClose={() => setShowDatasetConfig(false)}
          onSaved={loadInstance}
        />
      )}

      {showAreaModal && instance && (
        <DefineAffectedAreaModal
          open={showAreaModal}
          instance={instance}
          onClose={() => setShowAreaModal(false)}
          onSaved={loadInstance}
        />
      )}
    </div>
  );
}
