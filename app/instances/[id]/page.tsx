'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import dynamic from 'next/dynamic';
import AffectedAreaModal from '@/components/AffectedAreaModal';

// Lazy-load React Leaflet (no SSR)
const MapContainer = dynamic(
  () => import('react-leaflet').then(m => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then(m => m.TileLayer),
  { ssr: false }
);

export default function InstancePage() {
  const supabase = createClient();
  const { id } = useParams();
  const router = useRouter();

  const [instance, setInstance] = useState<any>(null);
  const [showAffected, setShowAffected] = useState(false);
  const [frameworkAvg, setFrameworkAvg] = useState<number | null>(null);
  const [finalAvg, setFinalAvg] = useState<number | null>(null);
  const [priority, setPriority] = useState<{ pcode: string; score: number }[]>([]);

  const loadInstance = async () => {
    if (!id) return;
    const { data: inst } = await supabase
      .from('instances')
      .select('*')
      .eq('id', id as string)
      .single();
    setInstance(inst);

    const { data: fw } = await supabase.rpc('get_framework_avg', { instance_uuid: id as string });
    const { data: fin } = await supabase.rpc('get_final_avg', { instance_uuid: id as string });
    setFrameworkAvg(fw?.framework_avg ?? null);
    setFinalAvg(fin?.final_avg ?? null);

    const { data: prio } = await supabase
      .from('scored_instance_values')
      .select('pcode, score')
      .eq('instance_id', id as string)
      .eq('pillar', 'Final')
      .order('score', { ascending: false })
      .limit(15);
    setPriority(prio ?? []);
  };

  useEffect(() => {
    loadInstance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleFrameworkRecompute = async () => {
    if (!id) return;
    await supabase.rpc('score_framework_aggregate', { in_instance_id: id as string });
    await loadInstance();
  };

  const handleFinalRecompute = async () => {
    if (!id) return;
    await supabase.rpc('score_final_aggregate', { in_instance_id: id as string });
    await loadInstance();
  };

  return (
    <div className="p-6 bg-[var(--gsc-beige,#f5f2ee)] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-[var(--gsc-blue,#004b87)]">
          {instance?.name ?? 'Instance'}
        </h1>
        <div className="space-x-2">
          <button
            onClick={() => router.push('/instances')}
            className="px-3 py-1.5 border rounded text-sm bg-white hover:bg-gray-50"
          >
            Back
          </button>
          <button
            onClick={() => router.push('/datasets')}
            className="px-3 py-1.5 border rounded text-sm bg-white hover:bg-gray-50"
          >
            Datasets
          </button>
          <button
            onClick={() => setShowAffected(true)}
            className="px-3 py-1.5 rounded text-sm bg-[var(--gsc-green,#2e7d32)] text-white hover:opacity-90"
          >
            Define Affected Area
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-12 gap-4">
        {/* Map card */}
        <div className="col-span-7 bg-white border rounded-lg shadow-sm p-3">
          <div className="flex items-center justify-between mb-2 text-sm font-medium text-gray-700">
            <span>Affected Area</span>
            <span className="text-gray-400 text-xs">
              {(instance?.admin_scope ?? []).length} selected
            </span>
          </div>
          <div className="h-[520px] rounded overflow-hidden border relative z-0">
            <MapContainer
              center={[12.8797, 121.774]}
              zoom={5}
              scrollWheelZoom={false}
              className="h-full w-full"
            >
              <TileLayer
                attribution="&copy; OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            </MapContainer>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Use <span className="font-medium">Define Affected Area</span> to pick ADM1/ADM2. Map will
            reflect your saved selection.
          </p>
        </div>

        {/* Metrics + Actions */}
        <div className="col-span-5 space-y-4">
          <div className="bg-white border rounded-lg shadow-sm p-4">
            <div className="text-sm font-semibold text-gray-700 mb-2">Key Metrics</div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-[var(--gsc-light-gray,#e5e7eb)] rounded-lg py-3">
                <div className="text-xs text-gray-600">Framework Avg</div>
                <div className="text-xl font-semibold text-[var(--gsc-blue,#004b87)]">
                  {frameworkAvg?.toFixed(3) ?? '-'}
                </div>
              </div>
              <div className="bg-[var(--gsc-light-gray,#e5e7eb)] rounded-lg py-3">
                <div className="text-xs text-gray-600">Final Avg</div>
                <div className="text-xl font-semibold text-[var(--gsc-red,#630710)]">
                  {finalAvg?.toFixed(3) ?? '-'}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-lg shadow-sm p-4">
            <div className="text-sm font-semibold text-gray-700 mb-2">Recompute</div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleFrameworkRecompute}
                className="flex-1 bg-[var(--gsc-blue,#004b87)] text-white py-2 rounded hover:opacity-90 text-sm"
              >
                Recompute Framework
              </button>
              <button
                onClick={handleFinalRecompute}
                className="flex-1 bg-[var(--gsc-green,#2e7d32)] text-white py-2 rounded hover:opacity-90 text-sm"
              >
                Recompute Final
              </button>
            </div>
          </div>

          <div className="bg-white border rounded-lg shadow-sm p-4">
            <div className="text-sm font-semibold text-gray-700 mb-2">
              Priority Locations (Top 15)
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b">
                  <th className="text-left py-1">Admin Pcode</th>
                  <th className="text-right py-1">Final Score</th>
                </tr>
              </thead>
              <tbody>
                {priority.map((p) => (
                  <tr key={p.pcode} className="border-b last:border-none">
                    <td className="py-1">{p.pcode}</td>
                    <td className="py-1 text-right">{p.score.toFixed(3)}</td>
                  </tr>
                ))}
                {priority.length === 0 && (
                  <tr>
                    <td colSpan={2} className="py-2 text-center text-gray-400">
                      No results.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showAffected && instance && (
        <AffectedAreaModal
          instance={instance}
          onClose={() => setShowAffected(false)}
          onSaved={loadInstance}
        />
      )}
    </div>
  );
}
